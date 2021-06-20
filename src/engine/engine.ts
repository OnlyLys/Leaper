import { commands, Disposable, TextEditor, ViewColumn, window } from 'vscode';
import { Snapshot, TestAPI } from './test-api';
import { ContextBroadcaster } from './context-broadcaster';
import { Tracker } from './tracker/tracker';

/**
 * Creating an instance of this class starts the extension. 
 * 
 * # Overview
 * 
 * Firstly, an engine instance tracks which text editors are currently visible and gives each visible 
 * text editor its own "state" such that each text editor can separately track the pairs within it. 
 * 
 * Secondly, upon instantiation of this class, this extension's keybindings are registered with 
 * vscode.
 * 
 * Finally, an engine instance manages the toggling of the [keybinding contexts] for this extension's
 * keybindings to make sure that the keybindings are only enabled when they need to be. For instance,
 * the `Tab` keybinding to jump out of pairs is disabled when there is no pair to jump out of, and 
 * thus ensures that any `Tab` keypresses from the user is not intercepted when they do not need to 
 * be. To maintain correct keybinding toggling, the global keybinding contexts are always synchronized 
 * to the private keybinding contexts of the active text editor (for more info about 'global' and 
 * 'private' contexts, please see the `PrivateContext` type).
 * 
 * [keybinding contexts]: https://code.visualstudio.com/api/references/when-clause-contexts
 * 
 * # Safety
 * 
 * Only one instance of this class should be active at any time. 
 * 
 * Any created instance must be disposed of when the extension is shut down.
 */
export class Engine implements TestAPI {

    /**
     * The trackers owned by each visible text editor.
     * 
     * Each tracker is responsible for listening to changes and applying decorations in its owning 
     * text editor. See the `Tracker` type for more info.
     * 
     * # Why Does Each Visible Text Editor Have Its Own Tracker?
     * 
     * By giving each visible text editor its own `Tracker` instance, pairs within each visible
     * text editor can be independently tracked. For instance, say there are 2 open tabs. With 
     * independent tracking of pairs per text editor, the user can type in an autoclosed pair into
     * the first tab (which will be tracked), switch to the second tab and do other stuff (maybe
     * insert more pairs or jump out pairs in the second tab), then come back to the first tab with
     * the pair previously inserted still being tracked, just as how it was when the user left it.
     * 
     * Note that as decorations are managed by `Tracker` instances, it follows that decorations are
     * also managed on a per-text editor basis, which greatly simplifies the decoration management
     * logic. 
     */
    private trackers: Map<TextEditor, Tracker>;

    /**
     * A pointer to tracker of the text editor that is active (i.e. in focus).
     * 
     * This pointer exists so that the `leap` and `escapeLeaperMode` commands, when triggered, can
     * be routed to the active text editor's tracker such that the intended command is executed in 
     * the text editor that is in focus. (See `leapCommand` and `escapeLeaperModeCommand` for more
     * info).
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
    private readonly activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor(
        (activeTextEditor) => {
            this.activeTracker = activeTextEditor ? this.trackers.get(activeTextEditor): undefined;
            this.resetGlobalContextsAutoSync();
        }
    );

    /**
     * Watcher to make sure that the engine is keeping track of which text editors are currently 
     * visible.
     */
    private readonly visibleTextEditorsChangeWatcher = window.onDidChangeVisibleTextEditors(
        (visible: ReadonlyArray<TextEditor>) => {
            const newTrackers = new Map<TextEditor, Tracker>();

            // Clean up the trackers for text editors that are no longer visible and preserve the 
            // trackers for text editors that still are visible.
            for (const [editor, tracker] of this.trackers.entries()) {
                visible.includes(editor) ? newTrackers.set(editor, tracker) : tracker.dispose();
            }

            // Assign fresh trackers for text editors that are newly visible.
            for (const visibleTextEditor of visible) {
                if (!newTrackers.has(visibleTextEditor)) {
                    newTrackers.set(visibleTextEditor, new Tracker(visibleTextEditor));
                }
            }

            this.trackers = newTrackers;
        }
    )

    private readonly inLeaperModeContextBroadcaster = new ContextBroadcaster(
        'leaper.inLeaperMode',
        () => this.activeTracker?.inLeaperModeContext.get() ?? false
    );

    /**
     * Watcher to make sure that the global `leaper.inLeaperMode` keybinding context is always 
     * synchronized to the private keybinding context of the active tracker.
     */
    private activeInLeaperModeContextUpdateWatcher: Disposable | undefined;

    private readonly hasLineOfSightContextBroadcaster = new ContextBroadcaster(
        'leaper.hasLineOfSight',
        () => this.activeTracker?.hasLineOfSightContext.get() ?? false
    );

    /**
     * Watcher to make sure that the global `leaper.hasLineOfSight` keybinding context is always 
     * synchronized to the private keybinding context of the active tracker.
     */
    private activeHasLineOfSightContextUpdateWatcher: Disposable | undefined;
    
    public constructor() {
        this.trackers = new Map(window.visibleTextEditors.map(
            (editor) => [editor, new Tracker(editor)]
        ));
        if (window.activeTextEditor !== undefined) {
            this.activeTracker = this.trackers.get(window.activeTextEditor);
        }
        this.resetGlobalContextsAutoSync();
    }

    /**
     * Set up automatic synchronization of the global keybinding contexts to the keybinding contexts 
     * of the active text editor.
     * 
     * Calling this method will halt synchronization of the global keybinding contexts to any other
     * text editor.
     * 
     * This method must be called if the active text editor has changed, otherwise the watchers
     * responsible for synchronizing the global keybinding contexts might be synchronizing to a no
     * longer extant or visible text editor.
     */
    private resetGlobalContextsAutoSync(): void {

        // Stop the previous keybinding context watchers since they might be listening to a text 
        // editor that is no longer active.
        this.activeInLeaperModeContextUpdateWatcher?.dispose();
        this.activeHasLineOfSightContextUpdateWatcher?.dispose();

        // Set up watchers that synchronize the global keybinding contexts to the active text 
        // editor's keybinding contexts.
        this.activeInLeaperModeContextUpdateWatcher = this.activeTracker?.inLeaperModeContext.onDidUpdate(
            () => this.inLeaperModeContextBroadcaster.requestBroadcast()
        );
        this.activeHasLineOfSightContextUpdateWatcher = this.activeTracker?.hasLineOfSightContext.onDidUpdate(
            () => this.hasLineOfSightContextBroadcaster.requestBroadcast()
        );
            
        // The watchers set up above do not fire upon instantiation, so we manually request for a
        // broadcast to set the global keybinding context values.
        this.inLeaperModeContextBroadcaster.requestBroadcast();
        this.hasLineOfSightContextBroadcaster.requestBroadcast();
    }

    /**
     * Terminate the engine and remove all traces of this extension.
     */
    public dispose(): void {

        // Stop the tracking of any text editors.
        this.trackers.forEach((tracker) => tracker.dispose());  

        // Unregister all keybinding commands.
        this.leapCommand.dispose();
        this.escapeLeaperModeCommand.dispose();

        // Stop watching vscode for any changes in the window.
        this.activeTextEditorChangeWatcher.dispose();
        this.visibleTextEditorsChangeWatcher.dispose();

        // Stop synchronizing and disable the global keybinding contexts.
        this.activeInLeaperModeContextUpdateWatcher?.dispose();
        this.activeHasLineOfSightContextUpdateWatcher?.dispose();
        this.inLeaperModeContextBroadcaster.dispose();
        this.hasLineOfSightContextBroadcaster.dispose();
        
    }

    // ------------------------------------------------------------------------------
    // TEST FUNCTIONS
    //
    // What follows are properties or functions exposed for testing purposes only. Please consult 
    // the `TestAPI` type for more info.

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
