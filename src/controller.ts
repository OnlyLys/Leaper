'use strict';

import { Disposable, workspace, window, commands, Selection, Range, Position, TextEditor } from 'vscode';
import { Pair } from './pairs/pair';
import { Pairs } from './pairs/pairs'; 
import { Settings } from './settings';

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

    /** Triggers when text is modified in the document. */
    private contentChangeWatcher: Disposable = workspace.onDidChangeTextDocument( (event) => {
        if (!window.activeTextEditor || event.document !== window.activeTextEditor.document) {
            return;
        }
        // Update the pairs that are being tracked by the extension
        // Also add new pairs to be tracked
        this.pairs.updateGivenContentChanges(event.contentChanges, window.activeTextEditor);
        // Update the extension's contexts so that the keybindings are appropriately activated
        setInLeaperModeContext(!this.pairs.isEmpty);
        setHasLineOfSightContext(this.pairs.hasLineOfSight);
    });

    /** Triggers when the cursor is moved. */
    private cursorChangeWatcher: Disposable = window.onDidChangeTextEditorSelection( (event) => {
        if (!window.activeTextEditor || event.textEditor !== window.activeTextEditor) {
            return;
        }
        if (window.activeTextEditor.selections.length > 1) {     
            // Clear all tracked pairs if multicursors engaged as Leaper doesn't support them
            this.clearInternalState();
            return;
        }
        // Remove any pairs that the cursor has moved out of
        this.pairs.updateGivenCursorChanges(window.activeTextEditor);
        // Update the extension's contexts so that the keybindings are appropriately activated
        setInLeaperModeContext(!this.pairs.isEmpty);
        setHasLineOfSightContext(this.pairs.hasLineOfSight);
    });

    /** Triggers when there is a settings change. */
    private settingsChangeWatcher: Disposable = workspace.onDidChangeConfiguration( (event) => {
        // When the settings is changed we immediately want to reload them 
        // Pairs that were previously being tracked are immediately discarded
        if (event.affectsConfiguration(`${EXT_IDENT}`)) {
            this.clearInternalState();
            this.settings.update();
        }
    });

    /** Triggers when there is a change in the currently active text editor. */
    private activeTextEditorChangeWatcher: Disposable = window.onDidChangeActiveTextEditor( (_) => {
        this.clearInternalState();
        // We update on every active text editor change because there is a chance that there has been
        // a switch to a different workspace with different settings that we need to load
        this.settings.update();
    });
    
    /** A command that allows users to leap out of the nearest pair. */
    private leapCommand: Disposable = commands.registerTextEditorCommand(
        `${EXT_IDENT}.leap`, (textEditor: TextEditor) => {
            const pair: Pair | undefined = this.pairs.mostNested;
            if (pair) {
                const posPastClose: Position = pair.close.translate({ characterDelta: 1 });
                // Move cursor to position past the closing side of the pair
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

    public dispose(): void {
        this.clearInternalState();
        this.disposables.forEach((disposable) => disposable.dispose());
        this.disposables = [];
    }

}

/** 
 * Set the `leaper.inLeaperMode` keybinding context. This context should only be active when there 
 * are pairs being tracked by the extension.
 * 
 * @param enable When `true`, the context is active. 
 */
function setInLeaperModeContext(enable: boolean): void {
    commands.executeCommand('setContext', 'leaper.inLeaperMode', enable);
}

/**
 * Set the `leaper.hasLineOfSight` context. It signals that there is line of sight to a tracked pair 
 * from the current cursor position. When active, this context enables the `Tab` keybinding to leap.
 * 
 * @param enable When `true`, the context is active.
 */
function setHasLineOfSightContext(enable: boolean): void {
    commands.executeCommand('setContext', 'leaper.hasLineOfSight', enable);
}

