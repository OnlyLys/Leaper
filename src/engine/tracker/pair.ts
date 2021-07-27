import { Position, TextEditorDecorationType } from 'vscode';

/** 
 * A pair that is being tracked for a cursor.
 * 
 * A `Pair` is a live object that is constantly updated until the pair is dropped. 
 * 
 * # Indices
 * 
 * Both `line` and `character` indices in a `Position` are zero-based. Furthermore, `character` 
 * indices are in units of UTF-16 code units, which notably does not have the same units as the 
 * column number shown in the bottom right of vscode, as the latter corresponds to the physical 
 * width of characters in the editor.
 */
export interface Pair {

    /**
     * The position of the opening side of this pair.
     */
    open: Position,

    /**
     * The position of the closing side of this pair.
     */
    close: Position,

    /**
     * The decoration applied to the closing side of this pair. 
     * 
     * `undefined` if this pair is undecorated. 
     */
    decoration: TextEditorDecorationType | undefined;

}
