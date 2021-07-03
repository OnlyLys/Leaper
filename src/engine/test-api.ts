import { DecorationRenderOptions, Position, ViewColumn } from 'vscode';
import { Unchecked } from './tracker/configuration/unchecked';

/**
 * The parts of the engine exposed to tests.
 */
export interface TestAPI {

    /**
     * The most recently broadcasted value of the `leaper.inLeaperMode` keybinding context.
     * 
     * This keybinding context is enabled whenever there are pairs being tracked in the active text
     * editor.
     */
    readonly MRBInLeaperModeContext: boolean | undefined;

    /**
     * The most recently broadcasted value of the `leaper.hasLineOfSight` keybinding context.
     * 
     * This keybinding context is enabled whenever a leap is possible in the active text editor. For 
     * more details, see `TrackerCore.hasLineOfSight`.
     */
    readonly MRBHasLineOfSightContext: boolean | undefined;

    /** 
     * Get a copy of the internal state of the engine.
     * 
     * The returned hash map maps the view column of each visible text editor to a snapshot of its 
     * tracker. The snapshots returned can be mutated without affecting the engine's state.
     */
    snapshot(): Map<ResolvedViewColumn, TrackerSnapshot>;
    
}

/** 
 * A copy of the internal state of a tracker.
 * 
 * A snapshot can be mutated without affecting the tracker's state.
 */
export interface TrackerSnapshot {

    /**
     * The pairs being tracked for each cursor.
     * 
     * The clusters (i.e. the subarrays) are parallel to the array of cursors (`TextEditor.selections`) 
     * of the corresponding text editor. 
     */
    pairs: { open: Position, close: Position, isDecorated: boolean }[][];

    /**
     * The style of the decorations.
     */
    decorationOptions: Unchecked<DecorationRenderOptions>;

}

/**
 * Absolute view column numbers.
 * 
 * A view column can be specified in absolute terms like `ViewColumn.Two` or in relative terms like 
 * `ViewColumn.Active`. This type contains only view column numbers which have been resolved into
 * absolute numbers.
 */
export type ResolvedViewColumn = Exclude<ViewColumn, ViewColumn.Active | ViewColumn.Beside>;
