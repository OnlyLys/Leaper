import { Disposable, workspace, window, commands, Selection, TextEditor } from 'vscode';
import { Pair } from './tracker/pair';
import { Tracker } from './tracker/tracker';
import { Configuration } from './configuration';

/** 
 * A controller that is responsible for:
 * - Detecting and track pairs
 * - Activating appropriate keybindings (such as 'leap' command)
 * - Executing the leap command that causes the cursor to jump out of the nearest available pair
 */
export class Controller {

    /** 
     * An array of trackers. Each cursor is assigned a tracker that is responsible for managing the 
     * pairs belonging to the cursor.
     * 
     * The trackers are in order of cursors, meaning the nth tracker tracks the pairs of the nth
     * cursor.
     */
    private trackers: Tracker[] = [];

    /** 
     * Use a Node JS `Immediate` Timer to queue an event at the end of the current event loop to 
     * execute `selectionChangeUpdate()`s on the `Tracker`s. 
     * 
     * This is required because when inserting text, such as when using autocompletion, multiple 
     * transient cursor movements can occur during the text insertion sequence. 
     * 
     * Typically when text is autocompleted, the cursor is first moved _before_ the text is inserted.
     * This is in contrast to normal text insertion via typing or copy-paste where the cursor is moved 
     * _after_ the text is inserted. So, consider when we autocomplete text between a pair. The 
     * cursor will be temporarily moved outside the pair before the autocompleted text is inserted.
     * So while the overall effect is that the cursor remains between the pairs after the whole 
     * autocomplete sequence, had we called `selectionChangeUpdate()` after each cursor movement, 
     * then the pair would have been untracked during the 'transient' phase where the cursor was 
     * temporarily outside the pair.
     * 
     * The solution to the above problem was to recognize that text insertions are always completed
     * within one event loop. So if we only apply `selectionChangeUpdate()`s at the end of every
     * event loop, then we only capture the cursor movement at the end of every event loop, thus
     * filtering out the transient movements that can occur in between.
     * 
     * For more information about `Immediate` timers and Node JS event loops, see:
     * - https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
     * - https://nodejs.org/en/docs/guides/timers-in-node/ 
     */
    private endOfEventLoopEvent: NodeJS.Immediate | undefined = undefined;

    /** 
     * Start an instance of a `Controller` which immediately begins tracking the pairs that are 
     * inserted by the cursors in the editor. The instance of `Controller` created needs to be 
     * `dispose()`d of when the extension is shut down.
     * 
     * Note that behavior of a `Controller` is undefined if there are multiple active instances. 
     * 
     * @param configuration The current configuration of the extension.
     */
    public constructor(private configuration: Configuration) {
        if (window.activeTextEditor) {
            initializeTrackers(this.trackers, window.activeTextEditor, configuration);
        }
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
            tracker.contentChangeUpdate(event.contentChanges);
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
        /* Once a cursor movement has been detected, we schedule a delayed event to apply
        `selectionChangeUpdate()`s to each tracker at the end of the current event loop. For the 
        rationale of the delay, see the comment for `this.endOfEventLoopEvent`. We have an `if` 
        guard here to make sure that there is only a max of one immediate event schedueld per event
        loop. */
        if (this.endOfEventLoopEvent === undefined) {
            this.endOfEventLoopEvent = setImmediate(() => {
                for (const tracker of this.trackers) {
                    tracker.selectionChangeUpdate();
                }
                updateContexts(this.trackers);
                this.endOfEventLoopEvent = undefined;
            });
        }
    });
    
    /** 
     * Watcher to update the decorations when there is a change in visible ranges. We need this 
     * because we only keep the decorations for pairs that are within the viewport. 
     * 
     * Each time the viewport changes, we:
     * - Undecorate pairs that are outside the viewport.
     * - Decorate pairs that are within the viewport.
     */
    private visibleRangesChangeWatcher: Disposable = window.onDidChangeTextEditorVisibleRanges(event => {
        /* Note that at present `TextEditor.visibleRanges` only reports the vertical range of the
        of the viewport visible, even though a change in horizontal range triggers this watcher. */
        if (!window.activeTextEditor || window.activeTextEditor !== event.textEditor) {
            return;
        }
        const visible = event.visibleRanges[0];
        // Undecorate any trackers that are on a line that is not currently visible
        for (const tracker of this.trackers) {
            tracker.visible = tracker.line >= visible.start.line && tracker.line <= visible.end.line;
        }
    });
    
    /** Execute a leap out of the nearest available pair for each cursor. */
    public leap(): void {
        if (!this.trackers.some(tracker => tracker.hasLineOfSight) || !window.activeTextEditor) {
            return;
        }
        /* For each cursor, if it has an available pair to jump out of, we move the cursor to just
        past the closing side of the pair (i.e. jump out of the pair). We do nothing if there is no
        available pair. */
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
        /* If there is only a single cursor, we then reveal the new selection so that the editor's
        viewport follows the cursor after the leap. We do not reveal when there are multiple cursors 
        as there is no intuitive way to approach it. */
        if (window.activeTextEditor.selections.length === 1) {
            window.activeTextEditor.revealRange(window.activeTextEditor.selection.with());
        }
        /* After leaping, we need to readjust the keybinding contexts because we may have just 
        leaped out of the last available pair. */
        updateContexts(this.trackers);
    }

    /**
     * Clear all pairs and disable all keybinding contexts. 
     * 
     * @param configuration New configuration values to apply. If `undefined`, the previous values
     *                      will continue to be used.
     */
    public reset(configuration?: Configuration): void {
        if (configuration) {
            this.configuration = configuration;
        }
        this.clearState();
        if (window.activeTextEditor) {
            initializeTrackers(this.trackers, window.activeTextEditor, this.configuration);
        }
    }

    /**
     * Clear all pairs and disable all keybinding contexts. Then disable tracking. This controller 
     * cannot be restarted after calling this method. 
     */
    public dispose(): void {
        this.clearState();
        this.contentChangeWatcher.dispose();
        this.selectionChangeWatcher.dispose();
        this.visibleRangesChangeWatcher.dispose();
    }

    /** Clear the trackers, the keybindings and the immediate timer. */
    private clearState(): void {
        this.trackers.forEach(tracker => tracker.dispose());
        this.trackers = [];
        updateContexts(this.trackers);
        if (this.endOfEventLoopEvent) {
            clearImmediate(this.endOfEventLoopEvent);
            this.endOfEventLoopEvent = undefined;
        }
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
        // If the num of trackers < num of cursors, add new trackers until parity
        for (let i = numOfTrackers; i < numOfCursors; ++i) {
            trackers.push(new Tracker(configuration, activeTextEditor, i));
        }
    } else if (numOfTrackers > numOfCursors) {
        // If the num of trackers > num of cursors, drop excess trackers until parity
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