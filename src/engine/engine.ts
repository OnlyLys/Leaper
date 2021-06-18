import { commands, Disposable, TextEditor, ViewColumn, window } from 'vscode';
import { Snapshot, TestAPI } from './test-api';
import { ContextBroadcaster } from './context-broadcaster';
import { Tracker } from './tracker/tracker';

/**
 * Creating an instance of this class starts the extension. 
 * 
 * # Overview of What This Class Does
 * 
 * This class tracks which text editors are currently visible and gives each visible text editor its
 * own "state" such that each text editor can separately track the pairs within it. 
 * 
 * Upon instantiation, this class also registers the extension's keybindings with vscode.
 * 
 * Finally, this class manages the toggling of the [keybinding contexts] for this extension's
 * keybindings to make sure that the keybindings are only enabled when they need to be. For instance,
 * this class ensures that the `Tab` keybinding to jump out of pairs is disabled when there is no
 * pair to jump out of, and thus ensures that any `Tab` keypresses from the user is not intercepted 
 * when they do not need to be. 
 * 
 * [keybinding contexts]: https://code.visualstudio.com/api/references/when-clause-contexts
 * 
 * # Safety
 * 
 * Only one instance of this class should be active at any time. 
 * 
 * All instances of this class must be disposed of when the extension is shut down.
 */
export class Engine implements TestAPI {

    /**
     * The trackers paired to each visible text editor.
     * 
     * By giving each visible text editor its own `Tracker` instance, pairs within each visible
     * text editor can be independently tracked. For instance, say there are 2 open tabs. With 
     * independent tracking of pairs per text editor, the user can type in an autoclosed pair into
     * the first tab (which will be tracked), switch to the second tab and do other stuff (maybe
     * insert more pairs or jump out pairs in the second tab), then come back to the first tab with
     * the pair previously inserted still being tracked, just as how it was when the user left it.
     * 
     * Note that as decorations are managed by `Tracker` instances, it follows that decorations are
     * also managed on a per-text editor basis, which greatly simplifies decoration management. 
     */
    private trackers: Map<TextEditor, Tracker>;

    /**
     * A pointer to the tracker paired to the active text editor.
     * 
     * This is `undefined` if there is no active text editor.
     */
    private activeTracker: Tracker | undefined;

    /**
     * Keybinding to move the cursor in the active text editor past the nearest available pair.
     * 
     * This is the 'leap' or 'jump' out of pairs command.
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
     * Watcher to make sure that the engine is always aware of which text editor is currently active.
     */
    private readonly activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor(() => {
        this.rebindActiveTracker();
    });

    /**
     * Watcher to make sure that the engine can keep track of which text editors are currently 
     * visible.
     */
    private readonly visibleTextEditorsChangeWatcher = window.onDidChangeVisibleTextEditors(
        (_visibleTextEditors) => {

            const visibleSet  = new Set(_visibleTextEditors);
            const newTrackers = new Map<TextEditor, Tracker>();

            // Preserve the trackers of text editors that are still visible and clean up the rest.
            for (const [editor, tracker] of this.trackers.entries()) {
                visibleSet.has(editor) ? newTrackers.set(editor, tracker) : tracker.dispose();
            }

            // Assign trackers for text editors that are newly visible.
            for (const visibleTextEditor of visibleSet) {
                if (!newTrackers.has(visibleTextEditor)) {
                    newTrackers.set(visibleTextEditor, new Tracker(visibleTextEditor));
                }
            }

            this.trackers = newTrackers;
        }
    )

    /**
     * To broadcast the `leaper.inLeaperMode` context of the active tracker to vscode.
     */
    private readonly inLeaperModeContextBroadcaster = new ContextBroadcaster(
        'leaper.inLeaperMode',
        () => this.activeTracker?.inLeaperModeContext.get() ?? false
    );

    /**
     * Watcher that schedules for a broadcast when the `leaper.inLeaperMode` context of the active 
     * tracker has been updated.
     */
    private activeInLeaperModeContextUpdateWatcher: Disposable | undefined;

    /**
     * To broadcast the `leaper.hasLineOfSight` context of the active tracker to vscode.
     */
    private readonly hasLineOfSightContextBroadcaster = new ContextBroadcaster(
        'leaper.hasLineOfSight',
        () => this.activeTracker?.hasLineOfSightContext.get() ?? false
    );

    /**
     * Watcher that schedules for a broadcast when the `leaper.hasLineOfSight` context of the active 
     * tracker has been updated.
     */
    private activeHasLineOfSightContextUpdateWatcher: Disposable | undefined;

    public constructor() {
        
        // Assign to each text editor its own tracker.
        this.trackers = new Map(window.visibleTextEditors.map((e) => [e, new Tracker(e)]));

        // Bind this engine to the active text editor's tracker.
        this.rebindActiveTracker();
    }

    /**
     * Rebind this engine to the currently active text editor's tracker.
     * 
     * This switches vscode's context to the context of the active tracker.
     */
    private rebindActiveTracker(): void {

        const { activeTextEditor } = window;

        // Point to the current active text editor's tracker.
        this.activeTracker = activeTextEditor ? this.trackers.get(activeTextEditor): undefined;

        // Stop the previous context watchers since they might be listening to a now inactive tracker.
        this.activeInLeaperModeContextUpdateWatcher?.dispose();
        this.activeHasLineOfSightContextUpdateWatcher?.dispose();

        // Begin to watch the active tracker's context values.
        this.activeInLeaperModeContextUpdateWatcher = this.activeTracker?.inLeaperModeContext.onDidUpdate(() => {
            this.inLeaperModeContextBroadcaster.set();
        });
        this.activeHasLineOfSightContextUpdateWatcher = this.activeTracker?.hasLineOfSightContext.onDidUpdate(() => {
            this.hasLineOfSightContextBroadcaster.set();
        });
            
        // Switch vscode's context to the active tracker's context.
        this.inLeaperModeContextBroadcaster.set();
        this.hasLineOfSightContextBroadcaster.set();
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
        this.leapCommand.dispose();
        this.escapeLeaperModeCommand.dispose();
        this.activeTextEditorChangeWatcher.dispose();
        this.visibleTextEditorsChangeWatcher.dispose();
        this.inLeaperModeContextBroadcaster.dispose();
        this.activeInLeaperModeContextUpdateWatcher?.dispose();
        this.hasLineOfSightContextBroadcaster.dispose();
        this.activeHasLineOfSightContextUpdateWatcher?.dispose();
    }

    // -------------------------------------------------------------------------------------
    // Below this point are properties or functions exposed for testing purposes only.
    //
    // Please consult the `TestAPI` interface for more info.

    public get MRBInLeaperModeContext(): boolean | undefined {
        return this.inLeaperModeContextBroadcaster.prevBroadcasted;
    }

    public get MRBHasLineOfSightContext(): boolean | undefined {
        return this.hasLineOfSightContextBroadcaster.prevBroadcasted;
    }

    public snapshots(): Map<ViewColumn, Snapshot> {
        const map = new Map<ViewColumn, Snapshot>();
        for (const [visibleTextEditor, tracker] of this.trackers) {
            if (visibleTextEditor.viewColumn !== undefined) {
                map.set(visibleTextEditor.viewColumn, tracker.snapshot());
            }
        }
        return map;
    }

}
