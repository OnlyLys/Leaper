import { DecorationRenderOptions, ViewColumn } from 'vscode';
import { CompactPair } from '../test/utilities/compact';
import { Unchecked } from './configurations/unchecked';

/**
 * The parts of the engine exposed to tests.
 */
export interface TestHandle {
    
    /**
     * The most recently set value of the `leaper.inLeaperMode` keybinding context.
     */
    readonly mostRecentInLeaperModeContext: boolean;

    /**
     * The most recently set value of the `leaper.hasLineOfSight` keybinding context.
     */
    readonly mostRecentHasLineOfSightContext: boolean;

    /**
     * Get a snapshot of the internal state of the engine.
     * 
     * The return value maps the view column of each visible text editor to a snapshot of its tracker. 
     * The snapshots can be mutated without affecting the engine's state.
     */
    readonly snapshot: () => Map<ResolvedViewColumn, TrackerSnapshot>;
    
}

/** 
 * A snapshot of the internal state of a tracker.
 */
export interface TrackerSnapshot {

    /**
     * The pairs in this tracker.
     * 
     * The subarrays (i.e. the clusters) are parallel to the `selections` array of cursors of the 
     * corresponding text editor. 
     */
    pairs: CompactPair[][];

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
