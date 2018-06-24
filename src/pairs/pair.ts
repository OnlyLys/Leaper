'use strict';

import { Position, Range } from 'vscode';

/** Represents a pair that is being tracked in the document. */
export class Pair {

    /**
     * @param open Position of the open side of the pair.
     * @param close Position of the closing side of the pair.
     * @param decorationOptions Decoration option for the closing character of the pair.
     */
    constructor(public open: Position, public close: Position) {}
    
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

}