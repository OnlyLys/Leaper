import { TextEditor, Selection, window, workspace } from 'vscode';
import { Snapshot } from '../test-api';
import { Configuration } from './configuration';
import { ImmediateReusable } from './immediate-reusable';
import { PrivateContext } from './private-context/private-context';
import { PrivateContextLazy } from './private-context/private-context-lazy';
import { TrackerCore } from './tracker-core/tracker-core';

/** 
 * A 'tracker' assigned to a text editor that:
 * 
 *  - Detects then tracks autoclosing pairs that are inserted into the owning text editor.
 *  - Decorates pairs that are being tracked.
 *  - Moves the cursor when the 'Leap' command is called by the user.
 *  - Untracks all pairs when the 'Escape Leaper Mode' command is called by the user.
 *  - Updates keybinding contexts which enable or disable the extension's keybindings.
 *  - Watches for changes in configuration values and reloads them when necessary.
 * 
 * The text editor that a tracker is assigned to is referred to as the owning text editor.
 * 
 * # Safety
 * 
 * A tracker must be disposed of when the editor that owns it is closed or no longer visible.
 */
export class Tracker {

    /** 
     * Where a majority of the logic in this class is delegated to.
     */
    private readonly core: TrackerCore;

    private readonly _inLeaperModeContext = new PrivateContextLazy(
        false, 
        () => !this.core.isEmpty,
    );

    /**
     * A keybinding context that is only `true` when there are currently pairs being tracked.
     * 
     * ## What This Keybinding Context is for
     * 
     * This keybinding context is used to disable all of this extension's keybindings when there are
     * no pairs being tracked. 
     */
    public get inLeaperModeContext(): PrivateContext {
        return this._inLeaperModeContext;
    }

    private readonly _hasLineOfSightContext = new PrivateContextLazy(
        false,
        () => this.core.hasLineOfSight(this.owner.document),
    );

    /** 
     * A keybinding context that is only `true` under the following conditions:
     * 
     * 1. There are currently pairs being tracked.
     * 2. None of the cursors have selections.
     * 3. The path from each cursor to the closing side of its nearest available pair is unobstructed. 
     * 
     * Otherwise, this keybinding context is `false`.
     * 
     * ## What This Keybinding Context is for
     * 
     * We need this keybinding context because the `Tab` key is very overloaded. We want the `Tab` 
     * keybinding bound to the 'leap' command to only be enabled when it is actually intended and 
     * possible for a `Tab` keypress to trigger the command that causes the cursor to move out of 
     * the nearest available pair.
     * 
     * Thus, we use the `leaper.hasLineOfSight` keybinding context to guard against the `Tab` 
     * keybinding of this extension intercepting `Tab` keypresses unnecessarily. For instance, 
     * suppose that between the nearest available pair and the cursor there is some text. When the 
     * user presses `Tab`, what the user meant was to insert an indentation into the text and not
     * to jump out of the nearest pair. So, having the `leaper.hasLineOfSight` keybinding context be
     * disabled at this point prevents this extension from receiving the `Tab` keypress, and allows
     * the `Tab` keypress to continue up the keybinding heirarchy.
     * 
     * See https://code.visualstudio.com/api/references/when-clause-contexts for more info about how
     * keybinding contexts are used to toggle keybindings.
     */
    public get hasLineOfSightContext(): PrivateContext {
        return this._hasLineOfSightContext;
    }

    /**
     * A timer to synchronize decorations at the end of the current event loop cycle.
     * 
     * See `TrackerCore.syncDecorations` for why we do this.
     */
    private readonly decorationSyncTimer = new ImmediateReusable(() => {
        this.core.syncDecorations(this.owner);
    });

    /**
     * Watcher that keeps track of any textual changes in the owning text editor.
     */
    private readonly contentChangesWatcher = workspace.onDidChangeTextDocument((event) => {
        if (event.document === this.owner.document) {
            this.core.syncToContentChanges(event);
            this.markStaleSetSync();
        }
    });
    
    /** 
     * Watcher that keeps track of any cursor changes in the owning text editor.
     */
    private readonly selectionChangesWatcher = window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor === this.owner) {
            this.core.syncToSelectionChanges(event);
            this.markStaleSetSync();
        }
    });

    /**
     * Watcher that reloads configurations and resets internal state if configuration change is 
     * detected in the owning text editor.
     */
    private readonly configurationChangeWatcher = workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('leaper', this.owner.document)) {
            this.core.changeConfiguration(Configuration.read(this.owner.document));
            this.markStaleSetSync();
        }
    });

    /** 
     * @param owner The text editor that this tracker is assigned to (i.e. the owning text editor).
     */
    public constructor(private readonly owner: TextEditor) {
        this.core  = new TrackerCore(owner.selections, Configuration.read(owner.document));
    }

    /** 
     * If possible, move all cursors out of their respective nearest pairs.
     * 
     * This command only succeeds if there is line of sight. By 'line of sight' we mean that for 
     * all cursors that have pairs, the path from the cursor to its nearest pair is unobstructed.
     * 
     * Nothing is done if there is no line of sight.
     */
    public leap(): void {

        // Check whether leaping is actually allowed before executing it.
        //
        // We do this check because even if the 'Leap' keybinding is disabled by a falsy 
        // `leaper.hasLineOfSight` keybinding context when it is not possible to perform a cursor 
        // jump, prior broadcasts of a falsy context value to disable the keybinding could still be 
        // pending acknowledgement by vscode, as broadcasted context values are asynchronously read 
        // by vscode.
        //
        // Therefore it is possible for the flow of execution to reach here even though we have 
        // disabled the keybinding. So we must perform this check.
        if (!this.inLeaperModeContext.get() || !this.hasLineOfSightContext.get()) {
            return;
        }

        // Perform the leap. 
        //
        // Note that we do not call `syncToSelectionChanges` after moving the cursors here. Instead 
        // we rely on the selection change event that is fired due to cursors being modified to call 
        // `syncToSelectionChanges`.
        const innermostPairs  = this.core.getInnermostPairs();
        this.owner.selections = this.owner.selections.map((cursor, i) => {
            const leapTo = innermostPairs[i]?.close.translate(0, 1);

            // Cursors which do not have a pair to jump out of are left unchanged.
            return leapTo ? new Selection(leapTo, leapTo) : cursor;
        });

        // If there is only a single cursor after the leap, we reveal it so that the text editor's 
        // viewport follows the cursor afterwards.
        //
        // We do not reveal when there are multiple cursors as there is no intuitive way to approach 
        // such a reveal.
        if (this.owner.selections.length === 1) {
            this.owner.revealRange(this.owner.selection);
        }

    }

    /**
     * Command to untrack all pairs.
     */
    public escapeLeaperMode(): void {

        // Note that this check is not really necessary, because unlike the 'Leap' command, where it 
        // is likely for the control flow to reach the `leap` method (when say the user holds down 
        // the `Tab` key) during the transient period after the broadcast to disable the keybinding 
        // context was made, but before it is acknowledged by vscode, it is unlikely for the user to 
        // press the keybinding for the 'Escape Leaper Mode' command (which is bound by default to 
        // `Shift + Esc`) during such transient periods.
        //
        // That said, for purposes of consistency with the 'Leap' command, we do this check here.
        if (!this.inLeaperModeContext.get()) {
            return;
        }

        this.core.untrackPairs();
        this.markStaleSetSync();
    }

    /**
     * Mark the context values as stale and set the timer to synchronize decorations.
     */
    private markStaleSetSync(): void {
        this._inLeaperModeContext.markStale();
        this._hasLineOfSightContext.markStale();
        this.decorationSyncTimer.set();
    }

    /** 
     * Terminate this instance by doing the following:
     * 
     *  1. Untrack all pairs.
     *  2. Remove all decorations.
     *  3. Cease watching the editor for any changes in the text content or cursors.
     *  4. Cease informing listeners when context values are updated.
     */
    public dispose(): void {
        this.core.dispose();
        this._inLeaperModeContext.dispose();
        this._hasLineOfSightContext.dispose();
        this.decorationSyncTimer.clear();
        this.contentChangesWatcher.dispose();
        this.selectionChangesWatcher.dispose();
        this.configurationChangeWatcher.dispose();
    }

    /**
     * Get a snapshot of the pairs that are currently being tracked.
     * 
     * The returned snapshot can be mutated without affecting the internal state.
     */
    public snapshot(): Snapshot {
        return this.core.snapshot();
    }

}
