import { Position } from 'vscode';

/** 
 * A pair within a cluster.
 */
export interface Pair {

    /**
     * Opening (i.e. left) side of the pair.
     */
    readonly open: Position,

    /**
     * Closing (i.e. right) side of the pair.
     */
    readonly close: Position

}