'use strict';

import { Position, Range, TextEditorDecorationType, window, DecorationRenderOptions } from 'vscode';

/** Represents a pair that is being tracked in the document. */
export class Pair {

    /** Decoration for this pair. When disposed, the decoration will be removed from the editor. */
    private decoration: TextEditorDecorationType | undefined;

    /**
     * @param open Position of the open side of the pair.
     * @param close Position of the closing side of the pair.
     * @param decorationOptions Decoration option for the closing character of the pair.
     */
    constructor(public open: Position, public close: Position, private decorationOptions: DecorationRenderOptions) {}
    
    /** 
     * @param pos A position in the text editor.
     * @return `true` only if this `Pair` encloses `pos`.
     */ 
    public enclosesPos(pos: Position): boolean {
        return pos.isAfter(this.open) && pos.isBeforeOrEqual(this.close);
    } 

    /** 
     * @param range A range in the text editor.
     * @return `true` only if this `Pair` encloses `range`.
     */
    public enclosesRange(range: Range): boolean {
        return range.start.isAfter(this.open) && range.end.isBeforeOrEqual(this.close);
    }

    /** 
     * @param range A range in the text editor.
     * @return `true` only if either side of the pair is overlapped by the range.
     */
    public overlappedBy(range: Range): boolean {
        const overlapsOpen  = range.start.isBeforeOrEqual(this.open) && range.end.isAfter(this.open);
        const overlapsClose = range.start.isBeforeOrEqual(this.close) && range.end.isAfter(this.close);
        return overlapsOpen || overlapsClose;
    }

    /** 
     * Decorate the closing character of the pair. If decoration is already active then reapplying 
     * the decoration does nothing.
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
     * Undecorate the closing character of the pair. If this `Pair` does not have an active decoration 
     * then undecorating does nothing.
     */  
    public undecorate(): void {
        if (this.decoration) {
            this.decoration.dispose();
            this.decoration = undefined;
        }
    }
}