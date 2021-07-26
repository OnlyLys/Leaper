import { TextDocumentContentChangeEvent } from 'vscode';

/** 
 * An adaptor over the immutable content change array yielded by vscode that accumulates the shifts
 * due to prior content changes in the array.
 * 
 * This adaptor behaves like a stack, yielding content changes ordered by increasing `start` positions
 *
 * # Why This Exists
 * 
 * With this stack, we can accumulate the effect of content changes without having to backtrack. 
 * 
 * For example, consider the following sentence:
 * 
 *     cat dog cat cat dog {} cat cat dog cat {}
 * 
 * where the two `{}` represent pairs that we want to know the positions of after some content changes. 
 * Suppose we used the search-and-replace feature of vscode to replace all instances of the word "dog" 
 * with "dinosaur". In that case, vscode will fire a content change event containing an array of 
 * three content changes:
 * 
 *     1. { range: { start: { line: 0, character: 31 }, end: { line: 0, character: 34 } }, text "dinosaur" },
 *     2. { range: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } }, text "dinosaur" },
 *     3. { range: { start: { line: 0, character:  4 }, end: { line: 0, character:  7 } }, text "dinosaur" } 
 * 
 * which results in the following sentence:
 * 
 *     cat dinosaur cat cat dinosaur {} cat cat dinosaur cat {}
 * 
 * Observe that the effect of content changes 2 and 3 on both `{}` pairs is the same: a rightwards 
 * shift of 10 characters. Thus, if we were to consider the pairs from left to right, and if we were 
 * to accumulate the effects of the content changes as we go along, when it comes time to consider 
 * the second pair, we do not have to backtrack to recalculate the effects of content changes 2 and 
 * 3 on it since they have already been accounted for in the accumulated value, and we can just apply 
 * the accumulated value to get the effect that those content changes would have on the second pair.
 */
export class ContentChangeStack {

    /**
     * The index one past the top of the stack.
     */
    private end: number;

    /** 
     * The content change at the top of the stack.
     * 
     * This is `undefined` if the stack is empty.
     */
    public get top(): TextDocumentContentChangeEvent | undefined {
        return this.end > 0 ? this.src[this.end - 1] : undefined;
    }

    /** 
     * The immutable content change array from vscode that we are adapting over.
     */
    private src: ReadonlyArray<TextDocumentContentChangeEvent>;

    private _vertCarry: number = 0;

    /** 
     * Vertical shift to apply to all items located after the most recently popped content change.
     */
    public get vertCarry(): number {
        return this._vertCarry;
    }

    private _horzCarry: { affectsLine: number, value: number } = { affectsLine: -1, value: 0 };

    /**
     * Horizontal shift to apply to all items located on the last line affected by the most recently 
     * popped content change.
     * 
     * # Why This Exists
     * 
     * Aside from vertical shifts, a content change also contributes a shift in character index to 
     * any item that comes immediately after.
     *
     * For example, consider the document (where the numbers on the left denote line indices):
     *
     *     0 | Hello World
     *     1 | 
     *     2 | I am a cat!
     *     3 | 
     *     4 | Meow!
     *
     * Consider a content change that replaces the range:
     * 
     *     { start: { line: 0, character: 6 }, end: { line: 2, character: 7 } }
     * 
     * with the text "adorable ". The document after the content change is:
     *
     *     0 | Hello adorable cat!
     *     1 | 
     *     2 | Meow!
     *
     * As expected, the text to the right of the replaced range ("cat!") and the two lines below it 
     * are shifted vertically (line index decreases). But notice that "cat" is shifted horizontally
     * (character index increases). This character index change is what we are recording as the 
     * horizontal carry.
     */
    public get horzCarry(): { 
        
        /** 
         * Which line this horizontal carry applies to.
         */
        affectsLine: number, 
        
        value: number 
    
    } {
        return this._horzCarry;
    }

    public constructor(contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>) {

        // A content change array yielded by vscode is always ordered by decreasing `range`s. Thus,
        // to adapt it into a stack, all we have to do is have a `top` pointer that we decrement as
        // we 'pop' the stack.
        //
        // However, do note that there is no explicit guarantee from vscode's API that content change
        // arrays yielded by it will always have that ordering.
        this.src = contentChanges;
        this.end = contentChanges.length;
    }

    /** 
     * Pop the content change that's currently at the top of the stack.
     * 
     * This method returns `undefined` if the stack is empty.
     * 
     * The carry values will be updated to include the popped content change.
     */
    public pop(): TextDocumentContentChangeEvent | undefined {

        if (this.end === 0) {
            return undefined;
        }

        // Range that the top of stack content change replaced.
        const replaced            = this.src[this.end - 1].range;
        const replacedLineCount   = replaced.end.line - replaced.start.line + 1;
        const replacedLastLineLen = replaced.end.character - (replacedLineCount === 1 ? replaced.start.character : 0);

        // Text that was inserted in place of the replaced range.
        const inserted = this.src[this.end - 1].text;
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
        return this.src[--this.end];
    }

}

/** 
 * Count the number of lines in a string, as well as the length of its last line. 
 */
function countLines(str: string): { lines: number, lastLineLen: number } {

    // # Optimization on V8
    // 
    // When the string is short, counting is faster with a `for` loop:
    // 
    //  - https://jsbench.me/brkreuetca
    //  - https://jsbench.me/5fkreuh2kb
    //
    // But when the string is long (around 40 characters or more), counting using the built-in 
    // `split` method can be up to 10 times faster:
    //
    //  - https://jsbench.me/u0krfw819t
    //  - https://jsbench.me/m0krfw2h3k
    //  - https://jsbench.me/n9kreu03sr
    // 
    // Thus, we use a hybrid of both:
    //
    //  - https://jsbench.me/h4krfxs8n5/
    //
    if (str.length <= 40) {
        let lines       = 1;
        let lastLineLen = 0;
    
        // IMPORTANT: When counting with a `for` loop, we have to count like this instead of using 
        // `for (const char of str) { ... }` because that way of iterating iterates through code 
        // points while this way iterates through 16-bit code units, which is the correct units for 
        // string length. 
        for (let i = 0; i < str.length; ++i) {
            if (str[i] === '\n') {
                ++lines;
                lastLineLen = 0;
            } else {
                ++lastLineLen;
            }
        }
        return { lines, lastLineLen };
    } else {
        const split = str.split('\n');
        return {
            lines:       split.length,
            lastLineLen: split[split.length - 1].length
        };
    }
}
