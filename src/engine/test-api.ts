import { Position } from 'vscode';

/**
 * The parts of the extension's engine exposed to tests.
 */
export interface TestAPI {

    /**
     * The most recently broadcasted value of the `leaper.inLeaperMode` keybinding context.
     */
    readonly MRBInLeaperModeContext: boolean | undefined;

    /**
     * The most recently broadcasted value of the `leaper.hasLineOfSight` keybinding context.
     */
    readonly MRBHasLineOfSightContext: boolean | undefined;

    /** 
     * Get a snapshot of all the pairs that are being tracked in the active text editor. 
     * 
     * The return value is an array of subarrays, where each subarray contains the pairs belonging 
     * to each cursor. The top level array is parallel to the array of cursors in the active text
     * editor (i.e. `activeTextEditor.selections`).
     * 
     * The return value can be mutated without affecting the extension's state.
     */
    activeSnapshot(): { open: Position, close: Position, isDecorated: boolean }[][];
    
}