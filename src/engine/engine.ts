import { TextEditor, Range, Selection, window, DecorationRenderOptions, Position, workspace } from 'vscode';
import { Configuration } from './configuration';
import { Tracker } from './tracker/tracker';
import { ImmediateReusable } from './immediate-reusable';
import { WhenContext } from './when-context';

/** 
 * The core logic of this extension.
 * 
 * This class is responsible for:
 * 
 *  - Tracking autoclosed pairs within the bound text editor.
 *  - Moving the cursor when the `leap` command is called by the user.
 *  - Updating keybinding contexts which enable or disable the extension's keybindings.
 *  - Decorating the closing side of pairs. 
 *
 * # Binding
 * 
 * Each instance of this class is bound to a specific text editor and configuration during 
 * instantiation.
 * 
 * If a new binding is required, a new instance must be created.
 * 
 * # Safety
 * 
 * Each instance of this class must be disposed of when it is no longer needed, such as when the 
 * extension is shut down.
 */
export class Engine {

    /**
     * The text editor that this engine is bound to.
     */
    public readonly editor: TextEditor;

    /**
     * The decoration style to apply to closing side of pairs.
     */
    private readonly decorationOptions: DecorationRenderOptions;

    /** 
     * A data structure to manage the pairs for each cursor. 
     * 
     * This data structure also contains the decorations of pairs.
     */
    private readonly tracker: Tracker;

    /**
     * Keybinding context that represents whether there are currently any pairs being tracked.
     * 
     * This context is used to toggle all of this extension's keybindings.
     */
    private readonly inLeaperModeContext = new WhenContext(
        'leaper.inLeaperMode', 
        () => !this.tracker.isEmpty(),
    );

    /**
     * Keybinding context that represents whether the path from the cursor to the closing side of 
     * its nearest tracked pair is unobstructed.
     *  
     * We need this context because the `Tab` key is very overloaded. This context is used to enable 
     * the keybinding for the 'Leap' command when the cursor is at a position where leaping is 
     * possible, and used to disable the keybinding when leaping is not possible. 
     * 
     * Disabling the 'Leap' keybinding when it is not needed allows `Tab` keypresses to continue up 
     * the keybinding heirarchy, preventing this extension from unnecessarily intercepting `Tab` 
     * keypresses.
     */
    private readonly hasLineOfSightContext = new WhenContext(
        'leaper.hasLineOfSight', 
        () => this.tracker.hasLineOfSight(this.editor.document),
    );

    /**
     * A timer to synchronize decorations and keybinding contexts at the end the current event loop 
     * cycle.
     * 
     * # Why Use a Timer?
     * 
     * Decorations are only synchronized at the end of the current event loop cycle for reasons 
     * stated in `Tracker.syncDecorations`. 
     * 
     * For keybinding contexts, we only broadcast keybinding contexts at the end of each event loop 
     * cycle to cut down on the number of calculations we have to make, since those could be 
     * expensive. Instead of doing it after each content change event or selection change event in
     * an event loop cycle, we calculate it once at the end of each event loop.
     */
    private readonly endOfLoopSync = new ImmediateReusable(() => {

        // Only decorate the closing side of pairs.
        const decoratePair = (pair: { open: Position, close: Position }) => {
            const decoration       = window.createTextEditorDecorationType(this.decorationOptions);
            const closingSideRange = [ new Range(pair.close, pair.close.translate(0, 1)) ];
            this.editor.setDecorations(decoration, closingSideRange);
            return decoration;
        };
        this.tracker.syncDecorations(decoratePair);
        this.inLeaperModeContext.syncExternal();
        this.hasLineOfSightContext.syncExternal();
    });

    /**
     * Watcher that keeps track of any textual changes in the bound text editor.
     */
    private readonly contentChangesWatcher = workspace.onDidChangeTextDocument((event) => {
        if (event.document !== this.editor.document) {
            return;
        }
        this.tracker.syncToContentChanges(event);
        this.inLeaperModeContext.markStale();
        this.hasLineOfSightContext.markStale();
        this.endOfLoopSync.set();
    });
    
    /** 
     * Watcher that keeps track of any cursor changes in the bound text editor.
     */
    private readonly selectionChangesWatcher = window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor !== this.editor) {
            return;
        }
        this.tracker.syncToSelectionChanges(event);
        this.inLeaperModeContext.markStale();
        this.hasLineOfSightContext.markStale();
        this.endOfLoopSync.set();
    });

    /** 
     * @param editor The text editor to bind to.
     * @param configuration The configuration values to bind to.
     */
    public constructor(editor: TextEditor, configuration: Configuration) {
        this.editor            = editor;
        this.decorationOptions = configuration.decorationOptions;
        this.tracker           = new Tracker(
            editor.selections, 
            configuration.detectedPairs, 
            configuration.decorateAll
        );
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

        // Check whether leaping is actually possible before executing it.
        //
        // There are two reasons why we do this: 
        //
        //  1. Even though the 'Leap' keybinding is disabled by the falsy `leaper.hasLineOfSight` 
        //     context when it is not possible to perform a cursor jump, prior broadcasts of a falsy 
        //     context value could possibly be pending acknowledgement by vscode.
        //  2. Even if the 'Leap' keybinding is disabled, a user could still call 'Leap' via the 
        //     command pallete. 
        //
        // Both reasons lead to the possibility of flow of execution reaching here even though we
        // have disabled the keybinding. For this reason, we have to perform the following check.
        if (!this.inLeaperModeContext.get() || !this.hasLineOfSightContext.get()) {
            return;
        }

        // Perform the leap. 
        //
        // Note that we do not call `syncToSelectionChanges` after moving the cursors here. Instead 
        // we rely on the selection change event that is fired due to cursors being modified to call 
        // `syncToSelectionChanges`.
        const innermostPairs   = this.tracker.getInnermostPairs();
        this.editor.selections = this.editor.selections.map((cursor, i) => {
            const innermostPair = innermostPairs[i];
            if (innermostPair) {
                const leapTo = innermostPair.close.translate(0, 1);
                return new Selection(leapTo, leapTo);
            } else {
                return cursor;
            }
        });

        // If there is only a single cursor after the leap, we reveal it so that the editor's 
        // viewport follows the cursor afterwards.
        //
        // We do not reveal when there are multiple cursors as there is no intuitive way to approach 
        // such a reveal.
        if (this.editor.selections.length === 1) {
            this.editor.revealRange(this.editor.selection.with());
        }

    }

    /** 
     * Untrack all pairs and disable all keybinding contexts.
     */
    private clear(): void {
        this.tracker.clear();
        this.inLeaperModeContext.clear();
        this.hasLineOfSightContext.clear();
        this.endOfLoopSync.clear();
    }

    /**
     * Untrack all pairs and disable all keybinding contexts.
     */
    public escapeLeaperMode(): void {

        // We only execute this command if the 'leaper.inLeaperMode' keybinding context is actually 
        // enabled.
        //
        // Note that this check is not really necessary. 
        //
        // Unlike the 'Leap' command, where it is likely for the control flow to reach the `leap` 
        // method (when say the user holds down the `Tab` key) during the transient period after the 
        // 'setContext' command to disable the `leaper.hasLineOfSight` keybinding context was fired, 
        // but before that command is acknowledged by vscode, it is unlikely for the user to press 
        // the keybinding for the 'Escape Leaper Mode' command (which is bound to `Shift + Esc`) 
        // during transient periods of the `leaper.inLeaperMode` keybinding context.
        //
        // That said, for purposes of consistency with the 'Leap' command, we do this check here.
        if (!this.inLeaperModeContext.get()) {
            return;
        }

        this.clear();
    }

    /** 
     * Terminate this instance by calling `clear` then disabling tracking.
     */
    public dispose(): void {
        this.clear();
        this.contentChangesWatcher.dispose();
        this.selectionChangesWatcher.dispose();
    }

    /**
     * Get a snapshot of what pairs are currently being tracked.
     * 
     * The returned snapshot can be mutated without affecting the extension's state.
     */
    public snapshot(): { open: Position, close: Position, isDecorated: boolean }[][] {
        return this.tracker.snapshot();
    }

}
