'use strict';

import { Position } from 'vscode';

/** Represents a pair that is being tracked in the document. */
export class Pair {

    /**
     * @param open Position of the open side of the pair.
     * @param close Position of the closing side of the pair.
     */
    constructor(public open: Position, public close: Position) {}
    
    /** 
     * @param pos A position in the text editor.
     * @return `true` only if this `Pair` encloses `pos`.
     */ 
    public enclosesPos(pos: Position): boolean {
        return pos.isAfter(this.open) && pos.isBeforeOrEqual(this.close);
    } 

}