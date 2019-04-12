import { Position, Range } from 'vscode';

/** 
 * Calculate a new position after a shift / deletion due to text replacement in a document. 
 * 
 * @param pos Initial position.
 * @param replaced The range of text that was overwritten.
 * @param inserted New text that was inserted at the start of the replaced region.
 * @return The new shifted position. `undefined` if `pos` is deleted by the replacement
 */
export function shift(pos: Position, replaced: Range, inserted: string): Position | undefined {
    if (replaced.end.line === pos.line) {
        if (replaced.end.character <= pos.character) {
            // Replacement that ends to the left of `pos`: `pos` will be shifted by the changes
            const remainder = pos.character - replaced.end.character;
            const { newLines: insertedNewLines, lastLineLength: insertedLastLineLength } = info(inserted);
            return new Position(
                pos.line + insertedNewLines - (replaced.end.line - replaced.start.line),
                insertedLastLineLength + remainder + (insertedNewLines === 0 ? replaced.start.character : 0)
            );
        } else if (replaced.start.character <= pos.character) {
            // Replacement overwrites `pos`: `pos` will be deleted
            return undefined;
        } else {
            // Replacement that comes after `pos`: `pos` is unaffected
            return pos;
        }
    } else if (replaced.end.line < pos.line) {
        // Replacement completely on lines above: `pos` is only shifted vertically
        return pos.translate(info(inserted).newLines - (replaced.end.line - replaced.start.line), 0);
    } else {
        if (replaced.start.line < pos.line)  {
            // Replacement that overwrites `pos`: `pos` is deleted
            return undefined;     
        } else if (replaced.start.line === pos.line && replaced.start.character <= pos.character) {
            // Replacement that overwrites `pos`: `pos` is deleted
            return undefined;
        } else {
            // Replacement that comes after `pos`: `pos` is unaffected
            return pos;
        }
    }
}

/** Get the number of the new lines as well as the length of the last line of a string. */
function info(str: string): { newLines: number, lastLineLength: number } {
    let newLines       = 0;
    let lastLineLength = 0;
    for (const char of str) {
        if (char === '\n') {
            ++newLines;
            lastLineLength = 0;
        } else {
            ++lastLineLength;
        }
    }
    return { newLines, lastLineLength };
}