import { TextDocumentContentChangeEvent } from 'vscode';

/** 
 * An adaptor over the immutable content change array to make it behave like a mutable stack. 
 * 
 * # Ordering
 *
 * This stack is ordered (from the top to bottom) by ascending starting position of the content 
 * changes. 
 * 
 * # Carries
 * 
 * This adaptor also provides access to carry values, which describe the shift in positions due to 
 * earlier content changes.
 * 
 * We need this because the array of content changes obtained from the editor uses coordinates that 
 * would only be appropriate if the content changes were applied in reverse (starting from the end 
 * of the document until the start of the document). 
 * 
 * However, because this stack goes through the content changes from the start of the document until
 * the end of the document, we need some way of keeping track of past content changes's effect on
 * items that come after them.
 * 
 * An example will make the above clearer. Consider the sentence:
 * 
 *     cat dog cat cat dog cat cat dog cat 
 * 
 * If we used the search-and-replace feature of the editor to replace the words "dog" with "frog",
 * it will produce content changes in the following order:
 * 
 *     replace (line 0, character 22) to (line 0, character 25) with "frog",
 *     replace (line 0, character 13) to (line 0, character 16) with "frog",
 *     replace (line 0, character  4) to (line 0, character  7) with "frog" 
 * 
 * where 'line' is line index and 'character' is character index. 
 * 
 * Notice that if the content changes were applied in the order specified above, then it is fine. 
 * But if the content changes were applied the other way around, then the coordinates specified by 
 * the top two content changes would be incorrect, since applying the third content change would 
 * shift the text to the right of (line 0, character 7) by 1 unit, leaving the remaining content 
 * changes referencing stale positions.
 * 
 * # Character Indices
 * 
 * Character indices are in units of UTF-16 code units. 
 * 
 * Character indices do not have the same units as the column number shown in the bottom right of 
 * vscode, as the latter corresponds to physical width of characters in the editor, while the former
 * corresponds to the byte length of the characters in memory.
 */
export class ContentChangeStack {

    /** 
     * Index of the stack top.
     */
    private top: number;

    /** 
     * The immutable content change array that we are adapting over.
     * 
     * Our stack will yield content changes from this array, going from the end to the start of this
     * array.
     */
    private src: ReadonlyArray<TextDocumentContentChangeEvent>;

    private _vertCarry: number = 0;

    /** 
     * Vertical shifts due to all content changes that have been popped from the stack.
     *
     * Because we are going through content changes from the start to the end of the document, we 
     * have to take into account content changes that have been popped, since they might contribute 
     * a change in line number to any items that are positioned after them.
     */
    public get vertCarry(): number {
        return this._vertCarry;
    }

    private _horzCarry: { affectsLine: number, value: number } = { affectsLine: -1, value: 0 };

    /** 
     * Horizontal shift due to the most recent content change that was popped from the stack.
     * 
     * Aside from vertical shifts, content changes also contribute a change in character index to 
     * any item that comes after them on the last line that was replaced by the content change. 
     *
     * For example, consider the document (where the numbers on the left denote line indices):
     *
     *     0 | Hello World
     *     1 | 
     *     2 | I am a cat!
     *     3 | 
     *     4 | Meow!
     *
     * Consider a content change that replaces the range (line 0, char 6) to (line 2, char 7) with 
     * the text "adorable ". The document after the content change is:
     *
     *     0 | Hello adorable cat!
     *     1 | 
     *     2 | Meow!
     *
     * As expected, the text to the right of the replaced range ("cat!") and the two lines below it 
     * are shifted upwards (line index decreases). But notice that "cat" is shifted rightwards 
     * (character index increases). The character index change is what we are recording as the 
     * horizontal carry.
     */
    public get horzCarry(): { 
        
        /** 
         * Which line the horizontal carry applies to.
         *
         * The horizontal carry only applies to items on the last line that the most recently popped
         * content change replaced. See the doc-comment of `horzCarry` for more information.
         */
        affectsLine: number, 
        
        value: number 
    
    } {
        return this._horzCarry;
    }

    public constructor(contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>) {

        // We do not have to sort the content changes array from a `TextDocumentChangeEvent` because 
        // it was discovered that whether it be replacing a bunch of text via the 'Find and Replace' 
        // feature, or replacing a bunch of text via a single `edit` command, such as:
        // 
        //     window.activeTextEditor.edit(
        //         (editBuilder) => {
        //             editBuilder.replace(new Range(0, 10, 0, 20), 'hey');
        //             editBuilder.replace(new Range(1, 50, 2, 90), '\nwoah!\n');
        //             editBuilder.replace(new Range(0, 50, 0, 70), 'yo');
        //             editBuilder.replace(new Range(10, 4, 11, 12), '');
        //             editBuilder.replace(new Range(3, 0, 4, 30), '\n\n\n\t\d');
        //         }
        //     );
        // 
        // vscode will always fire a `TextDocumentChangeEvent` containing content changes ordered by 
        // the range that they replace, from the end to the start of the document. The ordering that 
        // vscode gives us is already what we want, albeit in reverse.
        // 
        // However, do note that there is no explicit guarantee from vscode's API that content 
        // change events will yield contain content changes with such a sort order.
        this.src = contentChanges;
        this.top = contentChanges.length;
    }

    /** 
     * Pop the content change that's currently at the top of the stack.
     * 
     * This method does nothing if the stack is empty.
     * 
     * The carry values will be updated to include the popped content change.
     */
    public pop(): void {

        if (this.top === 0) {
            return;
        }

        // Range that the top of stack content change replaced.
        const replaced            = this.src[this.top - 1].range;
        const replacedLineCount   = replaced.end.line - replaced.start.line + 1;
        const replacedLastLineLen = replaced.end.character - (replacedLineCount === 1 ? replaced.start.character : 0);

        // Text that was inserted in place of the replaced range.
        const inserted = this.src[this.top - 1].text;
        const { lines: insertedLineCount, lastLineLen: insertedLastLineLen } = countLines(inserted);

        // This content change contributes to a change in line index to any item after it.
        this._vertCarry += insertedLineCount - replacedLineCount;

        // This content change also contributes to a change in character index to any item to the 
        // right of the replaced range's end position.
        //
        // For each content change there are four possibilities:
        //
        // 1. Single line replaced with single line text.
        //
        //    Consider the document:
        //
        //        0 | Hello World, I am a cat!
        //        1 |
        //        2 | Meow!
        //
        //    where line 0 from character 6 to character 11 is replaced with the text "Universe". 
        //    This results in the document:
        //
        //        0 | Hello Universe, I am a cat!
        //        1 |
        //        2 | Meow!
        //
        //    In this case, the horizontal shift of the text to the right of the replaced range 
        //    (", I am a cat!") is the length of the inserted text, less the length of the replaced 
        //    range.
        //  
        // 2. Single line replaced with multiple lines of text.
        //
        //    Consider the document:
        //
        //        0 | Hello World, I am a cat!
        //        1 |
        //        2 | Meow!
        //
        //    where line 0 from character 5 to character 13 is replaced with the text "\n\nLook! ". 
        //    This results in the document: 
        //
        //        0 | Hello
        //        1 | 
        //        2 | Look! I am a cat!
        //        3 | 
        //        4 | Meow!
        //  
        //    In this case, the horizontal shift of the text to the right of the replaced range 
        //    ("I am a cat!") is the length of the last line of the inserted text, less the length 
        //    from the start of line 0 until the start of the replaced range, and further less the 
        //    length of the replaced range.
        //   
        // 3. Multiple lines replaced with single line text.
        //
        //    Consider the document:
        //
        //        0 | Hello World
        //        1 | 
        //        2 | I am a cat!
        //        3 | 
        //        4 | Meow!
        //  
        //    where the range spanning the ending newline of line 0 up to (line 2, character 7) is
        //    replaced with the text " ". This results in the document:
        //
        //        0 | Hello cat!
        //        1 | 
        //        2 | Meow!
        //
        //    In this case, the horizontal shift of the text to the right of the last line of the 
        //    replaced range ("cat!\n") is the length of the inserted text, plus the length from the 
        //    start of line 0 until the start of the replaced range, less the length of the last 
        //    line of the replaced range.
        //
        // 4. Multiple lines replaced with multiple lines of text.
        //  
        //    Consider the document:
        //
        //        0 | Hello World
        //        1 | 
        //        2 | I am a cat!
        //        3 | 
        //        4 | Meow!
        //  
        //    where the range spanning (line 0, character 6) to (line 2, character 6) is replaced 
        //    with the text "white rabbit!\nHello black". This results in the document:
        //    
        //        0 | Hello white rabbit!
        //        1 | Hello black cat!
        //        2 | 
        //        3 | Meow!
        //  
        //    In this case, the horizontal shift of the text to the right of the last line of the 
        //    replaced range (" cat!\n") is the length of the last line of the inserted text, less 
        //    the length of the last line of the replaced range.
        // 
        let horzCarry = insertedLastLineLen - replacedLastLineLen;
        if (replacedLineCount === 1 && insertedLineCount > 1) {
            horzCarry -= replaced.start.character;
        } else if (replacedLineCount > 1 && insertedLineCount === 1) {
            horzCarry += replaced.start.character;
        }

        // Note that we also have to take into account the previous horizontal carry which may need 
        // to be added to the newly calculated horizontal carry value.
        //
        // For example, consider the document: 
        // 
        //        0 | Hello World
        //        1 | 
        //        2 | I am a cat!
        //        3 | 
        //        4 | Meow!
        // 
        // Let's say there are two content changes, the first of which replaces the range from 
        // (line 0, character 0) to (line 2, character 6) with the text "Look! A " and the second of 
        // which inserts the text "blue" at (line 2, character 6). This results in the document:
        //
        //        0 | Look! A blue cat!
        //        1 | 
        //        2 | Meow!
        // 
        // Notice that the text ("cat!") is shifted by the horizontal carries of the second content 
        // change (+4) *and* the first content change (+6).
        if (insertedLineCount === 1 && replaced.start.line === this._horzCarry.affectsLine) {
            horzCarry += this._horzCarry.value;
        }

        this._horzCarry = { affectsLine: replaced.end.line, value: horzCarry };
        this.top       -= 1;
        
    }

    /** 
     * Get a reference to the content change at the top of the stack.
     * 
     * The return value is `undefined` if the stack is empty.
     */
    public peek(): TextDocumentContentChangeEvent | undefined {
        return this.top > 0 ? this.src[this.top - 1] : undefined;
    }

}

/** 
 * Count the number of lines of a string, as well as the length of its last line. 
 */
function countLines(str: string): { lines: number, lastLineLen: number } {
    let lines       = 1;
    let lastLineLen = 0;

    // We have to count the length like this instead of using `for (const char of str) { ... } ` 
    // because that way of iterating iterates through code points while this way iterates through
    // 16-bit code units, which is the correct units for string length. 
    for (let i = 0; i < str.length; ++i) {
        if (str[i] === '\n') {
            ++lines;
            lastLineLen = 0;
        } else {
            ++lastLineLen;
        }
    }
    return { lines, lastLineLen };
}
