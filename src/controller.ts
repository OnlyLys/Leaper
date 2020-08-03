import { Disposable, workspace, window, commands, Selection, TextEditor, TextDocumentContentChangeEvent } from 'vscode';
import { Pair } from './tracker/pair';
import { Tracker } from './tracker/tracker';
import { Configuration } from './configuration';

/** 
 * A controller that is responsible for:
 * 
 * - Detecting and tracking pairs.
 * - Executing the `leap` command that moves the cursor to the nearest available pair.
 */
export class Controller {

    /** 
     * An array of trackers for each active cursor. 
     * 
     * Each cursor is assigned a tracker that is responsible for managing the pairs belonging to it.
     * The trackers in this array follow the order of the cursors. The first tracker tracks the 
     * pairs of the first cursor, the second for the second cursor, and so on.
     */
    private trackers: Tracker[] = [];

    /** 
     * Use a Node JS `Immediate` Timer to queue an event at the end of the current event loop to 
     * execute `selectionChangeUpdate()`s on the `Tracker`s. 
     * 
     * This is required because when inserting text, such as when using autocompletion, multiple 
     * transient cursor movements can occur during the text insertion sequence. 
     * 
     * When text is autocompleted, the cursor is moved _before_ the autocompleted text is inserted. 
     * This is in contrast to normal text insertion via typing or copy-paste where the cursor is 
     * moved _after_ the text is inserted. 
     * 
     * The above is important, because when we autocomplete text between a pair, the cursor will be 
     * moved outside the pair to its final position before the text is inserted. Only once the text 
     * is inserted will it push the closing side of the pair past the cursor. Had we called 
     * `selectionChangeUpdate()` after each cursor movement, the pair would have been untracked 
     * during the transient phase where it was outside the pair. The user does not see the transient
     * phase at all, so it would be incorrect to untrack pairs during it. 
     * 
     * The solution to the above problem was to recognize that text insertions are always completed
     * within one event loop. Thus only applying `selectionChangeUpdate()`s at the end of every 
     * event loop allows us to filter out any transient movements that can occur in between.
     * 
     * For more information about `Immediate` timers and Node JS event loops, see:
     * - https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
     * - https://nodejs.org/en/docs/guides/timers-in-node/ 
     */
    private endOfEventLoopTimer: NodeJS.Immediate | undefined = undefined;

    /** 
     * Current configuration of this extension. 
     * 
     * The configuration can be updated by calling `reset()` with new configuration values.
     */
    private configuration: Configuration;

    private constructor(configuration: Configuration) {
        this.configuration = configuration;
        if (window.activeTextEditor) {
            initializeTrackers(this.trackers, window.activeTextEditor, configuration);
        }
    }

    /** 
     * Start an instance of the controller, which immediately begins tracking pairs.
     * 
     * Only one instance should be active at a time. Behavior is undefined if there are multiple 
     * active instances.
     * 
     * Each `Controller` instance created must be `dispose()`d of when the extension is shut down.
     * 
     * @param configuration The current configuration of the extension.
     */
    public static start(configuration: Configuration): Controller {
        return new Controller(configuration);
    }

    /** `true` if there are no pairs being tracked. Otherwise `false`. */
    public get isEmpty(): boolean {
        return this.trackers.every(tracker => tracker.isEmpty);
    }

    /** 
     * Get a snapshot of all the pairs that are being tracked. That means getting information about:
     * - The positions of each pair.
     * - Whether each pair is currently decorated.
     * 
     * The snapshot returned is a 2D array. The first dimension is enumerated based on the trackers: 
     * i.e. `snapshot[0]` gives us the sub-snapshot of the first tracker, `snapshot[1]` for the 
     * second tracker and so on.
     * 
     * For information about the format of the elements in the subarrays, see `Tracker.snapshot`.
     */
    public get snapshot(): [number, number, number, number, boolean][][] {
        return this.trackers.map(tracker => tracker.snapshot);
    }

    /** 
     * Watcher to update pairs that are being tracked after content change (i.e. textual change) in 
     * the active editor. 
     */
    private contentChangeWatcher: Disposable = workspace.onDidChangeTextDocument(event => {
        if (!window.activeTextEditor || event.document !== window.activeTextEditor.document) {
            return;
        }
        for (const tracker of this.trackers) {

            // FIXME: Fix `Tracker.contentChangeUpdate()` to accept a readonly array.
            //
            // This previously wasn't an issue but vscode changed its api to return `ReadonlyArray`
            // for `event.contentChanges` so this method call no longer compiles. 
            //
            // We cast to a mutable array as a temporary fix for the problem.
            tracker.contentChangeUpdate(event.contentChanges as TextDocumentContentChangeEvent[]);
        }
        updateContexts(this.trackers);
    });

    /** 
     * Watcher to update pairs that are being tracked after each selection change. 
     * 
     * A selection change is any one of the following:  
     * 1. Cursor movement
     * 2. Expansion or shrinking of cursor selection
     * 3. Addition or removal of cursors
     */
    private selectionChangeWatcher: Disposable = window.onDidChangeTextEditorSelection(event => {
        if (!window.activeTextEditor || event.textEditor !== window.activeTextEditor) {
            return;
        }
        // Update the number of trackers only if the number of cursors have changed
        if (this.trackers.length !== window.activeTextEditor.selections.length) {
            initializeTrackers(this.trackers, window.activeTextEditor, this.configuration);
        }

        // When a cursor movement has been detected, we schedule a delayed event to apply 
        // `selectionChangeUpdate()`s on each tracker only at the end of the current event loop. 
        //
        // For the rationale of the delay, see the comment for `this.endOfEventLoopTimer`. 
        //
        // We have an `if` guard here to make sure that there is only at most one timer scheduled 
        // per event loop.
        if (this.endOfEventLoopTimer === undefined) {
            this.endOfEventLoopTimer = setImmediate(() => {
                for (const tracker of this.trackers) {
                    tracker.selectionChangeUpdate();
                }
                updateContexts(this.trackers);
                this.endOfEventLoopTimer = undefined;
    });
        }
    });
    
    /** Execute a leap out of the nearest available pair for each cursor. */
    public leap(): void {

        if (!this.trackers.some(tracker => tracker.hasLineOfSight) || !window.activeTextEditor) {
            return;
        }

        // The actual 'leap' execution occurs here, where for each cursor we jump out of any 
        // available pairs.
        window.activeTextEditor.selections = window.activeTextEditor.selections.map(
            (selection, i) => {
                const nearestPair: Pair | undefined = this.trackers[i].pop();
                if (nearestPair) {
                    const target = nearestPair.close.translate(0, 1);
                    return new Selection(target, target);
                } else {
                    return selection;
                }
            }
        );

        // If there is only a single cursor, we then reveal the new selection so that the editor's
        // viewport follows the cursor after the leap.
        //
        // We do not reveal when there are multiple cursors as there is no intuitive way to approach 
        // it.
        if (window.activeTextEditor.selections.length === 1) {
            window.activeTextEditor.revealRange(window.activeTextEditor.selection.with());
        }

        // After leaping, we have to readjust the keybinding contexts, because we may have just
        // leapt out of the last available pair, which then requires that `leaper.inLeaperMode` to
        // be false.
        updateContexts(this.trackers);
    }

    /** Clear the trackers, keybinding contexts and the immediate timer. */
    private clear(): void {
        this.trackers.forEach(tracker => tracker.dispose());
        this.trackers = [];
        updateContexts(this.trackers);
        if (this.endOfEventLoopTimer) {
            clearImmediate(this.endOfEventLoopTimer);
            this.endOfEventLoopTimer = undefined;
        }
    }

    /**
     * Clear all tracked pairs and disable all keybinding contexts. 
     * 
     * If a new configuration value is provided, then it will replace the older one. The older one
     * will continue to be used if `new_configuration` is `undefined`.
     */
    public reset(new_configuration: Configuration | undefined): void {
        if (new_configuration !== undefined) {
            this.configuration = new_configuration;
        }
        this.clear();
        if (window.activeTextEditor) {
            initializeTrackers(this.trackers, window.activeTextEditor, this.configuration);
        }
    }

    /**
     * Disable the controller.
     * 
     * All pairs that were being tracked are immediately untracked. All keybinding contexts are 
     * also disabled.
     * 
     * Then disable tracking. This controller cannot be restarted (by calling the `reset` method) 
     * after calling this method. 
     */
    public dispose(): void {
        this.clear();
        this.contentChangeWatcher.dispose();
        this.selectionChangeWatcher.dispose();
    }

}

/** 
 * Take an array of `Tracker`s and make sure that there are the same number of `Trackers` as there 
 * are cursors, such that each cursor has a corresponding `Tracker`.
 * 
 * This input array is mutated.
 * 
 * If the number of cursors:
 * - Is less than the number of trackers, the excess trackers are cleared and dropped.
 * - Is more than the number of trackers, additional fresh trackers are created until parity.
 */
function initializeTrackers(
    trackers:         Tracker[], 
    activeTextEditor: TextEditor,
    configuration:    Configuration
): void {
    const numOfCursors  = activeTextEditor.selections.length;
    const numOfTrackers = trackers.length;
    if (numOfTrackers < numOfCursors) {

        // If the num of trackers < num of cursors, add new trackers until parity.
        for (let i = numOfTrackers; i < numOfCursors; ++i) {
            trackers.push(new Tracker(configuration, activeTextEditor, i));
        }
    } else if (numOfTrackers > numOfCursors) {

        // If the num of trackers > num of cursors, drop excess trackers until parity.
        for (let i = numOfCursors; i < numOfTrackers; ++i) {
            trackers[i].dispose();
        }
        trackers.length = activeTextEditor.selections.length;
    }
}

/** 
 * Update the keybinding contexts of this extension. The two keybinding contexts of this extension
 * are:
 * * `leaper.inLeaperMode` which is a context that is set to `true` when there are currently pairs
 *   being tracked in the active editor. When this context is false, all the extension's keybindings
 *   are disabled. 
 * * `leaper.hasLineOfSight` which is a context that is set to `true` when there is no non-whitespace
 *   text between the cursor and the closing side of the nearest available pair. This context is used
 *   to manage when the `leap` keybinding is active. When the cursor is at a position where a leap
 *   is not possible, this context is `false` and if the user presses `Tab`, the keybinding is not
 *   captured by the `leap` command and instead continues to cascade down the keybinding heirarchy.
 */
function updateContexts(trackers: ReadonlyArray<Tracker>): void {
    setContext(`leaper.inLeaperMode`,   trackers.some(tracker => !tracker.isEmpty));
    setContext(`leaper.hasLineOfSight`, trackers.some(tracker => tracker.hasLineOfSight));
    function setContext(name: string, value: boolean): void {
        commands.executeCommand('setContext', name, value);
    }
}