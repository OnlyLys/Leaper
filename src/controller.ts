'use strict';

import { Disposable, workspace, window, commands, Selection, Range, Position, TextEditor } from 'vscode';
import { Pair, Pairs } from './pairs'; 
import { Settings } from './settings';

export const EXT_NAME = "Leaper";      // Name of extension
export const EXT_IDENT = "leaper";     // Identifier of extension

/** 
 * A controller that tracks any autoclosing pairs that are entered by the user. Once tracked, the 
 * user can leap out of them via a `Tab` keypress.
 * 
 * The controller has to have `.dispose()` called on it upon shut down of the extension.
 */
export class Controller {

    private settings: Settings = Settings.load();

    private pairs: Pairs = new Pairs(this.settings);

    private constructor() {}

    /** 
     * Start an instance of the controller. The controller starts running on instantiation.
     * 
     * @return An instance of the controller. 
     */
    public static start(): Controller {
        return new Controller();
    }

    /**
     * Query the controller to see if there are currently any pairs being tracked.
     * 
     * @return `true` only if there are pairs being tracked.
     */
    public get hasPairs(): boolean {
        return !this.pairs.isEmpty;
    }

    /** @return A copy of the list of the positions of the pairs that are currently being tracked. */
    public listPairs(): { open: Position, close: Position }[] {
        const retVal: { open: Position, close: Position }[] = [];
        this.pairs.raw.forEach(pair => retVal.push({ open: pair.open, close: pair.close }));
        return retVal;
    }

    /** Triggers when text is modified in the document. */
    private contentChangeWatcher: Disposable = workspace.onDidChangeTextDocument( event => {
        if (!window.activeTextEditor || event.document !== window.activeTextEditor.document) {
            return;
        }
        // Update the tracking of existing pairs and also add new pairs to be tracked
        this.pairs.updateGivenContentChanges(event.contentChanges, window.activeTextEditor);
        // Update the contexts to that the extension's keybindings are appropriately activated
        setContexts({ inLeaperMode: !this.pairs.isEmpty, hasLineOfSight: this.pairs.hasLineOfSight });
    });

    /** Triggers when the cursor is moved. */
    private cursorChangeWatcher: Disposable = window.onDidChangeTextEditorSelection( event => {
        if (!window.activeTextEditor || event.textEditor !== window.activeTextEditor) {
            return;
        }
        if (window.activeTextEditor.selections.length > 1) {     
            // Clear all tracked pairs if multicursors engaged as Leaper doesn't support them
            this.pairs.clear();
        } else {
            // Update the list of by pairs by removing any pairs that the cursor has moved out of
            this.pairs.updateGivenCursorChanges(window.activeTextEditor);
        }
        // Update the contexts to that the extension's keybindings are appropriately activated
        setContexts({ inLeaperMode: !this.pairs.isEmpty, hasLineOfSight: this.pairs.hasLineOfSight });
    });

    /** Triggers when there is a settings change. */
    private settingsChangeWatcher: Disposable = workspace.onDidChangeConfiguration( event => {
        // When the settings is changed we immediately want to reload them 
        // Pairs that were previously being tracked are immediately discarded
        if (event.affectsConfiguration(`${EXT_IDENT}`)) {
            this.clearPairsAndDisableContexts();
            this.settings.update();
        }
    });

    /** Triggers when there is a change in the currently active text editor. */
    private activeTextEditorChangeWatcher: Disposable = window.onDidChangeActiveTextEditor( _ => {
        this.clearPairsAndDisableContexts();
        // We update on every active text editor change because there is a chance that there has been
        // a switch to a different workspace with different settings that we need to load
        this.settings.update();
    });
    
    /** A command that allows users to leap out of the nearest pair. */
    private leapCommand: Disposable = commands.registerTextEditorCommand(
        `${EXT_IDENT}.leap`, (textEditor: TextEditor) => {
            const pair: Pair | undefined = this.pairs.pop(textEditor);
            if (pair) {
                const posPastClose: Position = pair.close.translate({ characterDelta: 1 });
                // Move cursor to position past the closing side of the pair
                textEditor.selection = new Selection(posPastClose, posPastClose);
                // Reveal the range so that the text editor's view follows the cursor after the leap
                textEditor.revealRange(new Range(posPastClose, posPastClose));
                // Moving the cursor with a selection change does not trigger the cursor watcher, so 
                // we need to update the contexts here
                setContexts({ inLeaperMode: !this.pairs.isEmpty, hasLineOfSight: this.pairs.hasLineOfSight });
            }
        }
    );

    /** A command that allows users to clear all pairs that are being tracked. */
    private escapeLeaperModeCommand: Disposable = commands.registerTextEditorCommand(
        `${EXT_IDENT}.escapeLeaperMode`, _ => this.clearPairsAndDisableContexts()
    );

    private clearPairsAndDisableContexts(): void {
        this.pairs.clear();
        setContexts({ inLeaperMode: false, hasLineOfSight: false });
    }

    private disposables: Disposable[] = [
        this.contentChangeWatcher,
        this.cursorChangeWatcher,
        this.settingsChangeWatcher,
        this.activeTextEditorChangeWatcher,
        this.leapCommand,
        this.escapeLeaperModeCommand
    ];

    public dispose(): void {
        this.clearPairsAndDisableContexts();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }

}

/**
 * Set the extension's contexts that enable/disable keybindings.
 * 
 * @param inLeaperMode This context signals that there are currently pairs being tracked. Without 
 * this context active all of the extension's keybindings are disabled.
 * @param hasLineOfSight This context signals that there is no non-whitespace text between the cursor 
 * and the closing side of the nearest available pair. When this context is true (in addition to the 
 * `inLeaperMode` context being true), the `Tab` key engages the `leap` command.
 */
function setContexts(contexts: { inLeaperMode: boolean, hasLineOfSight: boolean }): void {
    const { inLeaperMode, hasLineOfSight } = contexts;
    commands.executeCommand('setContext', 'leaper.inLeaperMode', inLeaperMode);
    commands.executeCommand('setContext', 'leaper.hasLineOfSight', hasLineOfSight);
}

