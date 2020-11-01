import { Position, ViewColumn } from 'vscode';

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
     * Get a snapshot of all the pairs that are being tracked for each visible text editor.
     * 
     * The return value is a hash map, mapping the view column of each visible text editor to a
     * snapshot of all the pairs being tracked for it.
     */
    snapshots(): Map<ViewColumn, Snapshot>;
    
}

/** 
 * Each snapshot of a visible text editor is an array of subarrays, where each subarray (called a 
 * _cluster_) contains the pairs belonging to a cursor. 
 * 
 * The clusters in a snapshot are ordered parallel to the array of cursors (obtained through 
 * `TextEditor.selections`) of its corresponding text editor. 
 * 
 * Snapshots can be mutated without affecting the extension's state.
 */
export type Snapshot = { open: Position, close: Position, isDecorated: boolean }[][];