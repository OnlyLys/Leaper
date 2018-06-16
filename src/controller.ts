'use strict';

import { Disposable, workspace, window, commands, Selection, Range, Position, TextEditor } from 'vscode';
import { Pair } from './pairs/pair';
import { Pairs } from './pairs/pairs'; 
import { EXT_IDENT } from './extension';
import { Settings } from './settings';

/** 
 * A controller that tracks any autoclosing pairs that are entered by the user. The pairs that will
 * be tracked are specified in the `languageRule` contribution.
 * 
 * Once tracked, the user can leap out of them via a `Tab` keypress.
 * 
 * The controller has have `dispose()` called on it upon shut down of the extension.
 */
export class Controller {

    /** Current settings for the extension. */
    private settings: Settings = Settings.load();

    /** List of `Pair`s which each represent a pair that is being tracked in the document. */
    private pairs: Pairs = new Pairs(this.settings);

    /** A watcher that monitors for any content changes in the currently active document. */
    private contentChangeWatcher: Disposable = workspace.onDidChangeTextDocument( (event) => {
        if (!this.settings.isEnabled || !window.activeTextEditor || event.document !== window.activeTextEditor.document) {
            return;
        }
        this.pairs.updateGivenContentChanges(event.contentChanges, window.activeTextEditor);
        // Update the extension's contexts so that the keybindings are appropriately activated
        setInLeaperModeContext(!this.pairs.isEmpty);
        setHasLineOfSightContext(this.pairs.hasLineOfSight);
    });

    /** A watcher that monitors for any change in cursor position. */
    private cursorChangeWatcher: Disposable = window.onDidChangeTextEditorSelection( (event) => {
        if (!this.settings.isEnabled || !window.activeTextEditor || event.textEditor !== window.activeTextEditor) {
            return;
        }
        if (window.activeTextEditor.selections.length > 1) {     
            // Clear all tracked pairs if multicursors engaged as Leaper doesn't support them
            this.clearInternalState();
            return;
        }
        this.pairs.updateGivenCursorChanges(window.activeTextEditor);
        // Update the extension's contexts so that the keybindings are appropriately activated
        setInLeaperModeContext(!this.pairs.isEmpty);
        setHasLineOfSightContext(this.pairs.hasLineOfSight);
    });

    /** A watcher that monitors for settings changes relevant to the extension. */
    private settingsChangeWatcher: Disposable = workspace.onDidChangeConfiguration( (event) => {
        if (event.affectsConfiguration(`${EXT_IDENT}`)) {
            this.clearInternalState();
            this.settings.update();
        }
    });

    /** A watcher that monitors for if the active text editor is switched to another one. */
    private activeTextEditorChangeWatcher: Disposable = window.onDidChangeActiveTextEditor( (_) => {
        this.clearInternalState();
        this.settings.update();    // New active text editor may have a different language ID.
    });
    
    /** A command that allows users to leap out of the nearest pair. */
    private leapCommand: Disposable = commands.registerTextEditorCommand(
        `${EXT_IDENT}.leap`, (textEditor: TextEditor) => {
            const pair: Pair | undefined = this.pairs.mostNested;   // Get nearest pair (if any)
            if (pair) {
                const posPastClose: Position = pair.close.translate({ characterDelta: 1 });
                textEditor.selection = new Selection(posPastClose, posPastClose);
                // Reveal the range so that the text editor's view follows the cursor after the leap
                textEditor.revealRange(new Range(posPastClose, posPastClose));
            }
        }
    );

    /** A command that allows users to clear all pairs that are being tracked. */
    private escapeLeaperModeCommand: Disposable = commands.registerTextEditorCommand(
        `${EXT_IDENT}.escapeLeaperMode`, (_) => this.clearInternalState()
    );

    /** 
     * Clear all internal state of the extension by clearing the list of tracked pairs and deactivating 
     * the keybinding contexts.
     */
    private clearInternalState(): void {
        this.pairs.clear();
        setInLeaperModeContext(false);
        setHasLineOfSightContext(false);
    }

    private disposables: Disposable[] = [
        this.contentChangeWatcher,
        this.cursorChangeWatcher,
        this.settingsChangeWatcher,
        this.activeTextEditorChangeWatcher,
        this.leapCommand,
        this.escapeLeaperModeCommand
    ];

    /** To be called when the extension is shut down. */
    public dispose(): void {
        this.clearInternalState();
        this.disposables.forEach((disposable) => disposable.dispose());
        this.disposables = [];
    }

}

/** 
 * Set the `leaper.inLeaperMode` context. When this context is active, the keybindings of Leaper are 
 * enabled. Therefore this context should only be activated when there are pairs being tracked by the 
 * extension. Otherwise we should set it to `false` in order to release control of the keybindings.
 * 
 * @param enable When `true`, the context is active. Otherwise the context is inactive.
 */
function setInLeaperModeContext(enable: boolean): void {
    // Note: `setContext` is an undocumented feature, for more info: https://github.com/Microsoft/vscode/issues/10471
    commands.executeCommand('setContext', 'leaper.inLeaperMode', enable);
}

/**
 * Set the `leaper.hasLineOfSight` context. It signals that there is line of sight to a pair from the
 * current cursor position.
 * 
 * @param enable When `true`, the context is active. Otherwise the context is inactive.
 */
function setHasLineOfSightContext(enable: boolean): void {
    // Note: `setContext` is an undocumented feature, for more info: https://github.com/Microsoft/vscode/issues/10471
    commands.executeCommand('setContext', 'leaper.hasLineOfSight', enable);
}

