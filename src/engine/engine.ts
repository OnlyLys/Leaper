//! The following module defines the 'starting point' class of the extension.
//! 
//! The `Engine` class defined here mainly acts as a coordinator, assigning to each visible text 
//! editor a `Tracker` instance. The `Tracker` instance belonging to each class is then responsible 
//! for tracking and decorating the pairs in its owning text editor.

import { commands, Disposable, Position, TextEditor, window } from 'vscode';
import { ContextBroadcaster } from './context-broadcaster';
import { Tracker } from './tracker/tracker';

/**
 * The engine of this extension.
 * 
 * Creating an instance of this class starts the extension. 
 * 
 * Only one instance should be active at any time.
 * 
 * # Safety
 * 
 * The created instance of this class must be disposed of when the extension is shut down.
 */
export class Engine {

    /**
     * The trackers assigned to each visible text editor.
     */
    private trackers: Map<TextEditor, Tracker>;

    /**
     * The tracker assigned to the active text editor.
     * 
     * This is `undefined` if there is no active text editor.
     */
    private activeTracker: Tracker | undefined;

    /**
     * Keybinding to move the cursor in the active text editor past the nearest available pair.
     */
    private readonly leapCommand = commands.registerTextEditorCommand(
        'leaper.leap', 
        () => this.activeTracker?.leap()
    );

    /**
     * Keybinding to untrack all the pairs in the active text editor. 
     */
    private readonly escapeLeaperModeCommand = commands.registerTextEditorCommand(
        'leaper.escapeLeaperMode', 
        () => this.activeTracker?.escapeLeaperMode()    
    );

    /**
     * Watcher that keeps track of the visible text editors.
     */
    private readonly visibleTextEditorsChangeWatcher = window.onDidChangeVisibleTextEditors(
        (_visibleTextEditors) => {

            const visibleTextEditors = new Set(_visibleTextEditors);

            // Preserve the trackers of text editors that are still visible, and clean up those that 
            // are no longer visible.
            const newTrackers = new Map<TextEditor, Tracker>();
            for (const [editor, tracker] of this.trackers.entries()) {
                if (visibleTextEditors.has(editor)) {
                    newTrackers.set(editor, tracker);
                } else {
                    tracker.dispose();
                }
            }

            // Create trackers for text editors that are newly visible.
            for (const visibleTextEditor of visibleTextEditors) {
                if (!newTrackers.has(visibleTextEditor)) {
                    newTrackers.set(visibleTextEditor, new Tracker(visibleTextEditor));
                }
            }

            this.trackers = newTrackers;
        }
    )

    /**
     * Watcher that tracks which text editor is the active one.
     */
    private readonly activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor(() => {
        this.rebindActiveTracker();
    });

    /**
     * To broadcast the `leaper.hasLineOfSight` context of the active tracker to vscode.
     */
    private readonly hasLineOfSightContextBroadcaster = new ContextBroadcaster(
        'leaper.hasLineOfSight',
        () => this.activeTracker?.getHasLineOfSightContext() ?? false
    );

    /**
     * To broadcast the `leaper.inLeaperMode` context of the active tracker to vscode.
     */
    private readonly inLeaperModeContextBroadcaster = new ContextBroadcaster(
        'leaper.inLeaperMode',
        () => this.activeTracker?.getInLeaperModeContext() ?? false
    );

    /**
     * Watcher that schedules for a broadcast when the keybinding context values of the active 
     * tracker have been updated.
     */
    private activeTrackerContextValuesUpdateWatcher: Disposable | undefined;

    public constructor() {
        
        const { visibleTextEditors } = window;

        // Assign to each text editor its own tracker.
        this.trackers = new Map(visibleTextEditors.map((editor) => [editor, new Tracker(editor)]));

        // Bind to the active text editor's tracker.
        this.rebindActiveTracker();
    }

    /**
     * Rebind to the current active text editor's tracker.
     */
    private rebindActiveTracker(): void {

        const { activeTextEditor } = window;

        // Point to the current active text editor's tracker.
        this.activeTracker = activeTextEditor ? this.trackers.get(activeTextEditor): undefined;

        // Stop the previous watcher since it might be listening to a now non-active tracker.
        this.activeTrackerContextValuesUpdateWatcher?.dispose();

        // Start watcher that broadcasts the active tracker's context values when they have changed.
        this.activeTrackerContextValuesUpdateWatcher = this.activeTracker?.onDidUpdateContextValues(
            () => {
                this.hasLineOfSightContextBroadcaster.set();
                this.inLeaperModeContextBroadcaster.set();
            }
        );

        // Make the active tracker's context values the global context values.
        this.hasLineOfSightContextBroadcaster.set();
        this.inLeaperModeContextBroadcaster.set();
    }

    /**
     * Get a snapshot of all the pairs that are being tracked in the active text editor.
     * 
     * The return value can be mutated without affecting the extension's state.
     */
    public snapshot(): { open: Position, close: Position, isDecorated: boolean }[][] {
        return this.activeTracker?.snapshot() ?? [];
    }

    /**
     * Terminate the engine.
     * 
     * Calling this method does the following:
     * 
     *   1. Unregister the extension's commands.
     *   2. Remove all pairs from being tracked.
     *   3. Remove all decorations.
     *   4. Disable tracking of the editors.
     *   5. Disable the extension's keybinding contexts.
     * 
     * In other words, calling this method removes all traces of the extension. 
     */
    public dispose(): void {
        this.trackers.forEach((tracker) => tracker.dispose());  
        this.activeTrackerContextValuesUpdateWatcher?.dispose();
        this.hasLineOfSightContextBroadcaster.dispose();
        this.inLeaperModeContextBroadcaster.dispose();
        this.leapCommand.dispose();
        this.escapeLeaperModeCommand.dispose();
        this.visibleTextEditorsChangeWatcher.dispose();
        this.activeTextEditorChangeWatcher.dispose();
    }

}
