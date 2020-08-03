import { Position, Range } from 'vscode';

/** 
 * Calculate a new position after text replacement in a document.
 * 
 * @param pos Initial position.
 * @param replaced The range of text that was replaced.
 * @param inserted New text that was inserted at the start of the replaced region.
 * @return The new shifted position. This is `undefined` if `pos` was deleted by the replacement. 
 *         `pos` is considered deleted if `replaced` encloses it.
 */
export function shift(pos: Position, replaced: Range, inserted: string): Position | undefined {
    if (replaced.start.isBeforeOrEqual(pos) && replaced.end.isAfter(pos)) {

        // The text replacement encloses `pos`. 
        //
        // In other words, `pos` was deleted from the text.
        return undefined;
    } else if (replaced.start.isAfter(pos)) {
        
        // The text replacement begins after `pos`. 
        //
        // Thus `pos` is not affected at all.
        return pos;
    } else if (replaced.end.line < pos.line) {

        // The text replacement ends on a line above `pos`. 
        //
        // Only the vertical position of `pos` could be shifted. There is no possible way for the 
        // text replacement to affect the horizontal position of `pos`, since none of the text 
        // before `pos` on the line that `pos` is on is affected. 
        const newLinesRemoved = replaced.end.line - replaced.start.line;
        const newLinesAdded   = count(inserted).newLines;
        return pos.translate(newLinesAdded - newLinesRemoved, 0);
    } else {

        // The text replacement ends to the left of `pos`. 
        //
        // `pos` could be shifted both horizontally and vertically.
        const newLinesRemoved = replaced.end.line - replaced.start.line;
        const remainder       = pos.character - replaced.end.character;
        const { newLines: newLinesAdded, lastLineLen: insertedLastLineLen } = count(inserted);
        return new Position(
            pos.line + newLinesAdded - newLinesRemoved,
            insertedLastLineLen + remainder + (newLinesAdded > 0 ? 0 : replaced.start.character)
        );
    }
}

/** Count the number of newlines of a string, as well as the length of its last line. */
function count(str: string): { newLines: number, lastLineLen: number } {
    let newLines    = 0;
    let lastLineLen = 0;

    // We have to count the length like this instead of using `for (const char of str) { ... } ` 
    // because that way of iterating iterates through code points while this way iterates through
    // 16-bit code units, which is the correct units for string length. 
    for (let i = 0; i < str.length; ++i) {
        if (str[i] === '\n') {
            ++newLines;
            lastLineLen = 0;
        } else {
            ++lastLineLen;
        }
    }
    return { newLines, lastLineLen };
}