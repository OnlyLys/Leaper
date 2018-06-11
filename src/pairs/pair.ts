'use strict';

import { Position, Range, TextEditorDecorationType, window, DecorationRenderOptions } from 'vscode';

/** 
 * Represents a pair that is being tracked in the document. 
 *
 * At this time, there is no support for pairs with sides that are more than 1 character wide.
 */
export class Pair {

    /** Contains the decoration for this pair. When disposed, the decoration will be removed from the editor. */
    private decoration: TextEditorDecorationType | undefined;

    /** 
     * Construct an object that is a representation of a pair that being tracked in the document. 
     * 
     * @param open Position of the open side of the pair.
     * @param close Position of the closing side of the pair.
     * @param decorationOptions Decoration option for the closing character of the pair.
     */
    constructor(public open: Position, public close: Position, private decorationOptions: DecorationRenderOptions) {}
    
    /** 
     * Checks if this `Pair` encloses a position. 
     * 
     * @param pos A position in the text editor.
     * @return `true` if so. Otherwise `false`.
     */ 
    public enclosesPos(pos: Position): boolean {
        return pos.isAfter(this.open) && pos.isBeforeOrEqual(this.close);
    } 

    /** 
     * Checks if this `Pair` encloses a range.
     * 
     * @param range A range in the text editor.
     * @return `true` if so. Otherwise `false`.
     */
    public enclosesRange(range: Range): boolean {
        return range.start.isAfter(this.open) && range.end.isBeforeOrEqual(this.close);
    }

    /** 
     * Check if either side of the `Pair` is overlapped by a range.
     * 
     * @param range A range in the text editor.
     * @return `true` if so. Otherwise `false`.
     */
    public overlappedBy(range: Range): boolean {
        const overlapsOpen  = range.start.isBeforeOrEqual(this.open) && range.end.isAfter(this.open);
        const overlapsClose = range.start.isBeforeOrEqual(this.close) && range.end.isAfter(this.close);
        return overlapsOpen || overlapsClose;
    }

    /** 
     * Decorate the closing character of the pair. If decoration is already active then this method
     * does nothing.
     */
    public decorate(): void {
        if (!window.activeTextEditor || this.decoration) {
            return;
        }
        this.decoration = window.createTextEditorDecorationType(this.decorationOptions);
        window.activeTextEditor.setDecorations(
            this.decoration,
            [new Range(
                this.close,
                this.close.translate({ characterDelta: 1 })
            )]
        );
    }

    /**
     * Undecorate the closing character of the pair. If decoration does not have an active decoration
     * then this method does nothing.
     */  
    public undecorate(): void {
        if (this.decoration) {
            this.decoration.dispose();
            this.decoration = undefined;
        }
    }
}