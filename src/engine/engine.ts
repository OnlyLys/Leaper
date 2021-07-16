import { commands, Disposable, TextEditor, window, workspace } from 'vscode';
import { ResolvedViewColumn, TrackerSnapshot, TestHandle } from './test-handle';
import { KeybindingContextSetter } from './keybinding-context-setter';
import { Tracker } from './tracker/tracker';
import { Configurations } from './configurations/configurations';

/**
 * Creating an instance of this class starts the extension. 
 * 
 * Once started, the engine continuously tracks each visible text editor for any changes. When 
 * autoclosing pairs are inserted into a visible text editor, the engine begins tracking it and 
 * provides the user the ability to 'leap' out of the pairs by triggering a command.
 * 
 * # Safety
 * 
 * Only one instance of this class should be active at any time, and the created instance must be 
 * disposed of when the extension is shut down.
 */
export class Engine implements TestHandle {

    /**
     * The trackers owned by each visible text editor.
     * 
     * By giving each visible text editor its own `Tracker` instance, pairs within each visible
     * text editor can be independently tracked. For instance, say there are 2 open tabs. With 
     * independent tracking of pairs per text editor, the user can type in an autoclosed pair into
     * the first tab (which will be tracked), switch to the second tab and do other stuff (maybe
     * insert more pairs or jump out pairs in the second tab), then come back to the first tab with
     * the pair previously inserted still being tracked, just as how it was when the user left it.
     * 
     * The decorations for each text editor are also managed by its tracker, which greatly simplifies 
     * the management of decorations.
     */
    private trackers: Map<TextEditor, Tracker>;

    /**
     * Command to move the cursor in the active text editor past the nearest available pair.
     */
    private readonly leapCommand = commands.registerTextEditorCommand(
        'leaper.leap', 
        (activeTextEditor) => this.trackers.get(activeTextEditor)?.leap()
    );

    /**
     * Command to untrack all the pairs in the active text editor.
     */
    private readonly escapeLeaperModeCommand = commands.registerTextEditorCommand(
        'leaper.escapeLeaperMode', 
        (activeTextEditor) => this.trackers.get(activeTextEditor)?.clear()
    );

    /** 
     * Setter for the `leaper.inLeaperMode` [keybinding context].
     * 
     * The `leaper.inLeaperMode` keybinding context is used to toggle all of the extension's 
     * keybindings. The keybinding context is only `true` when there are pairs being tracked in the
     * active text editor. Otherwise, the keybinding context is `false`, which disables all of the
     * extension's keybindings and allows this extension to "get out of the way" when there are no
     * pairs being tracked.
     */
    private readonly inLeaperModeContext = new KeybindingContextSetter(
        'leaper.inLeaperMode', 
        false
    );

    /** 
     * Setter for the `leaper.hasLineOfSight` [keybinding context].
     * 
     * # What The `leaper.hasLineOfSight` Keybinding Context is for
     * 
     * We need this keybinding context because the `Tab` key is very overloaded. We want the `Tab` 
     * keybinding for the 'Leap' command to only be enabled when it is actually desirable for the 
     * command to be triggered. When a leap is neither desirable nor possible, we disable the
     * keybinding, which prevents this extension from intercepting `Tab` keypresses. 
     * 
     * For an example of a situation where a leap is undesirable, suppose there are pairs being
     * tracked in the user's active text editor, and suppose that there is non-whitespace text 
     * between the cursor and the nearest pair being tracked for that cursor. At that point, if the
     * user presses `Tab`, clearly the intention was to insert an indentation and not to perform a
     * leap. So, having the `Tab` keybinding for the 'Leap' command be disabled at that point prevents 
     * this extension from intercepting any `Tab` keypresses, and allows any `Tab` keypress to 
     * continue up the [keybinding rules file].
     * 
     * [keybinding context]: https://code.visualstudio.com/api/references/when-clause-contexts
     * [keybinding rules file]: https://code.visualstudio.com/docs/getstarted/keybindings#_keyboard-rules
     */
    private readonly hasLineOfSightContext = new KeybindingContextSetter(
        'leaper.hasLineOfSight', 
        false
    );

    /**
     * Watcher to ensure the `leaper.inLeaperMode` keybinding context is synchronized to the 
     * `hasPairs` property of the active text editor's tracker.
     */
    private activeTrackerHasPairsWatcher: Disposable | undefined;

    /**
      * Watcher to ensure the `leaper.hasLineOfSight` keybinding context is synchronized to the
      * `hasLineOfSight` property of the active text editor's tracker.
      */
    private activeTrackerHasLineOfSightWatcher: Disposable | undefined;

    /**
     * Watcher to ensure that the keybinding contexts are synchronized to the correct tracker (i.e. 
     * the active text editor's tracker).
     */
    private readonly activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor(() => 
        this.resyncKeybindingContexts()
    );

    /**
     * Watcher to keep track of which text editors are currently visible.
     */
    private readonly visibleTextEditorsChangeWatcher = window.onDidChangeVisibleTextEditors(
        (visibleTextEditors: ReadonlyArray<TextEditor>) => {
            const newTrackers = new Map<TextEditor, Tracker>();

            // Preserve trackers of text editors that are still visible and assign fresh trackers
            // to text editors that are newly visible.
            for (const editor of visibleTextEditors) {
                const existingTracker = this.trackers.get(editor);
                if (existingTracker) {
                    newTrackers.set(editor, existingTracker);
                } else {
                    const document = editor.document;
                    newTrackers.set(editor, new Tracker(editor, {
                        decorateAll:       Configurations.decorateAll.read(document).effectiveValue,
                        decorationOptions: Configurations.decorationOptions.read(document).effectiveValue,
                        detectedPairs:     Configurations.detectedPairs.read(document).effectiveValue
                    }));
                }
            }

            // Clean up the trackers of text editors that are no longer visible.
            for (const [editor, tracker] of this.trackers.entries()) {
                if (!newTrackers.has(editor)) {
                    tracker.dispose();
                }
            }

            this.trackers = newTrackers;
        }
    )

    /** 
     * Watcher that notifies trackers when the cursors in their owning text editor has changed.
     */
    private readonly selectionChangeWatcher = window.onDidChangeTextEditorSelection((event) => {
        this.trackers.get(event.textEditor)?.notifySelectionChanges(event.selections);
    });

    /**
     * Watcher that notifies trackers when the text document of their owning text editor has changed.
     */
    private readonly contentChangeWatcher = workspace.onDidChangeTextDocument((event) => {
        for (const [owner, tracker] of this.trackers) {
            if (event.document === owner.document) {
                tracker.notifyContentChanges(event.contentChanges);
            }
        }
    });
    
    /**
     * Watcher that reloads configurations and resets internal state if an effective configuration
     * value has changed for the owning text editor.
     */
    private readonly configurationChangeWatcher = workspace.onDidChangeConfiguration((event) => {
        for (const [owner, tracker] of this.trackers) {
            const document = owner.document;
            if (!event.affectsConfiguration('leaper', document)) {
                continue;
            }
            if (event.affectsConfiguration(Configurations.decorateAll.name, document)
             || event.affectsConfiguration(Configurations.decorateAll.deprName, document)) {
                tracker.decorateAll = Configurations.decorateAll.read(document).effectiveValue;
            }
            if (event.affectsConfiguration(Configurations.decorationOptions.name, document)
             || event.affectsConfiguration(Configurations.decorationOptions.deprName, document)) {
                tracker.decorationOptions = Configurations.decorationOptions.read(document).effectiveValue;
            }
            if (event.affectsConfiguration(Configurations.detectedPairs.name, document)
             || event.affectsConfiguration(Configurations.detectedPairs.deprName, document)) {
                tracker.detectedPairs = Configurations.detectedPairs.read(document).effectiveValue;
            }
        }
    });
    
    public constructor() {
        this.trackers = new Map(window.visibleTextEditors.map((editor) => {
            const document = editor.document;
            return [editor, new Tracker(editor, {
                decorateAll:       Configurations.decorateAll.read(document).effectiveValue,
                decorationOptions: Configurations.decorationOptions.read(document).effectiveValue,
                detectedPairs:     Configurations.detectedPairs.read(document).effectiveValue
            })];
        }));
        this.resyncKeybindingContexts();
    }

    private resyncKeybindingContexts(): void {

        // Stop synchronizing the keybinding contexts to the previous active text editor's tracker.
        this.activeTrackerHasPairsWatcher?.dispose();
        this.activeTrackerHasLineOfSightWatcher?.dispose();

        // Begin synchronizing the keybinding contexts to the new active text editor's tracker.
        const activeTextEditor = window.activeTextEditor;
        const activeTracker    = activeTextEditor ? this.trackers.get(activeTextEditor): undefined;
        if (activeTracker) {
            this.activeTrackerHasPairsWatcher = activeTracker.onDidUpdateHasPairs(() => 
                this.inLeaperModeContext.set(activeTracker.hasPairs)
            );
            this.activeTrackerHasLineOfSightWatcher = activeTracker.onDidUpdateHasLineOfSight(() => 
                this.hasLineOfSightContext.set(activeTracker.hasLineOfSight)
            );
            this.inLeaperModeContext.set(activeTracker.hasPairs);
            this.hasLineOfSightContext.set(activeTracker.hasLineOfSight);
        } else {
            this.inLeaperModeContext.set(false);
            this.hasLineOfSightContext.set(false);
        }
    }

    /**
     * Terminate the engine.
     */
    public dispose(): void {
        this.trackers.forEach((tracker) => tracker.dispose());  
        this.leapCommand.dispose();
        this.escapeLeaperModeCommand.dispose();
        this.inLeaperModeContext.set(false);
        this.hasLineOfSightContext.set(false);
        this.activeTrackerHasPairsWatcher?.dispose();
        this.activeTrackerHasLineOfSightWatcher?.dispose();
        this.activeTextEditorChangeWatcher.dispose();
        this.visibleTextEditorsChangeWatcher.dispose();
        this.selectionChangeWatcher.dispose();
        this.contentChangeWatcher.dispose();
        this.configurationChangeWatcher.dispose();
    }

    /** 
     * **For Tests Only**
     */
    public get mostRecentInLeaperModeContext(): boolean {
        return this.inLeaperModeContext.mostRecent;
    }

    /**
     * **For Tests Only**
     */
    public get mostRecentHasLineOfSightContext(): boolean {
        return this.hasLineOfSightContext.mostRecent;
    }

    /** 
     * **For Tests Only**
     */
    public snapshot(): Map<ResolvedViewColumn, TrackerSnapshot> {
        const map = new Map<ResolvedViewColumn, TrackerSnapshot>();
        for (const [{ viewColumn }, tracker] of this.trackers) {
            if (viewColumn !== undefined) {

                // This cast is safe because vscode only stores resolved view column numbers.
                const resolvedViewColumn = viewColumn as ResolvedViewColumn;
                map.set(resolvedViewColumn, tracker.snapshot());
            }
        }
        return map;
    }

}
