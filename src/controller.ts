'use strict';

import { Disposable, workspace, window, commands, Selection, Range, Position } from 'vscode';
import { Pair } from './pairs/pair';
import { Pairs } from './pairs/pairs'; 
import { EXT_IDENT } from './extension';
import { Settings } from './settings';

/** The primary controller of the extension. Start one to begin the tracking of pairs. */
export class Controller {

    /** List of `Pair`s which each represent a pair that is being tracked in the document. */
    private pairs: Pairs;

    /** Contains subscriptions to watchers and commands. */
    private disposables: Disposable[] = [];

    /** The cursor change watcher will ignore the next n events where n is the value of this property. */
    private cursorChangeWatcherIgnoreCount: number = 0;
    
    /** 
     * Start a new controller that begins tracking for any detected pairs. The user can then press 
     * leap out of any of the pairs that are being tracked.
     * 
     * The `Controller` has to be disposed of when the extension is shut down.
     */
    public constructor() {
        const settings: Settings = Settings.getLatest();
        this.pairs = new Pairs(settings);
        if (settings.languageRule.length !== 0) {
            // Only start the watchers if there are rules for this language.
            this.startWatchersAndCommands();
        } else {
            // If the langauge rule is empty, it means the user has turned off the extension for this 
            // language, so we should not start the watchers and commands for it.
            //
            // Instead, we start a 'restart watcher' that can start them at a later time.
            this.startRestartWatcher();
        }
    }

    /** Registering the watchers and commands of the Controller. */
    private startWatchersAndCommands(): void {
        this.startContentChangeWatcher();
        this.startCursorChangeWatcher();
        this.startSettingsChangeWatcher();
        this.registerLeapCommand();
        this.registerEscapeLeaperModeCommand();        
        this.acceptSelectedSuggestionCommand();
    }

    /** To be called when the extension is shut down. */
    public dispose(): void {
        this.escapeLeaperMode();
        this.disposables.forEach((disposable) => disposable.dispose());
        this.disposables.length = 0;
    }

    /** Start a watcher that monitors for any content changes in the currently active document. */
    private startContentChangeWatcher(): void {
        const disposable = workspace.onDidChangeTextDocument( (event) => {
            if (!window.activeTextEditor || event.document !== window.activeTextEditor.document) {
                return;
            }
            // When there are content changes, update the list of `Pair`s to reflect the new position 
            // of the pairs within the document.
            this.pairs.updateFromContentChanges(event.contentChanges);
            setInLeaperModeContext(!this.pairs.isEmpty);
            setHasLineOfSightContext(this.pairs.canLeap());
        });
        this.disposables.push(disposable);
    }

    /** Start a watcher that monitors for any change in cursor position. */
    private startCursorChangeWatcher(): void {
        const disposable = window.onDidChangeTextEditorSelection( (event) => {
            if (!window.activeTextEditor || event.textEditor !== window.activeTextEditor) {
                return;    
            }
            if (this.cursorChangeWatcherIgnoreCount > 0) {
                this.cursorChangeWatcherIgnoreCount -= 1;
                return;
            }
            if (event.selections.length > 1) {     
                // Clear all pairs on multicursors as Leaper doesn't support them.
                this.escapeLeaperMode();
                return;
            }
            // The cursor moving out of a pair removes it from tracking.
            this.pairs.updateFromCursorChange();
            setInLeaperModeContext(!this.pairs.isEmpty);
            setHasLineOfSightContext(this.pairs.canLeap());
        });
        this.disposables.push(disposable);
    }

    /** 
     * Start a watcher that monitors:
     * - For changes in the configuration that affect the extension. 
     * - For active text editor change.
     */
    private startSettingsChangeWatcher(): void {
        const configurationWatcher = workspace.onDidChangeConfiguration( (event) => {
            if (event.affectsConfiguration(`${EXT_IDENT}`)) {
                internalFn();
            }
        });
        const activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor( (_) => 
            internalFn()
        );
        this.disposables.push(configurationWatcher, activeTextEditorChangeWatcher);

        // If the configuration or active text editor is changed, we load the new language rules.
        var internalFn = () => {
            this.escapeLeaperMode();        // Clear all internal state.
            const latestSettings = Settings.getLatest();
            if (latestSettings.languageRule.length < 1) {
                // If there are no language rules for this language, we unregister the watchers and 
                // commands. We start a restart watcher that can revive them later.
                this.dispose();
                this.startRestartWatcher();
            } else {
                // Otherwise just update pairs with the new language rule.
                this.pairs.updateCachedSettings(latestSettings);
            }
        };
    }

    /** 
     * Start a restart watcher that will revive the controller when the user switches back to a 
     * language that the extension is enabled for.
     */
    private startRestartWatcher(): void {
        const watcher1 = workspace.onDidChangeConfiguration( (event) => {
            if (event.affectsConfiguration(`${EXT_IDENT}`)) {
                attemptRestart();
            }
        });
        const watcher2 = window.onDidChangeActiveTextEditor( (_) =>  {
            attemptRestart();
        });

        var attemptRestart = () => {
            this.escapeLeaperMode();        // Clear all internal state.
            const latestSettings: Settings = Settings.getLatest();
            // Only restart the watchers and commands if there are langauge rules for the current language.
            if (latestSettings.languageRule.length > 0) {
                this.pairs.updateCachedSettings(latestSettings);
                this.startWatchersAndCommands();
                watcher1.dispose();  
                watcher2.dispose();
            }
        };
    }

    /** Register a command that allows users to leap out of the nearest pair. */
    private registerLeapCommand(): void {
        const disposable = commands.registerCommand(`${EXT_IDENT}.leap`, (_) => {
            if (!window.activeTextEditor) {
                return;
            }
            const pair: Pair | undefined = this.pairs.pop();   // Get nearest pair (if any)
            if (pair) {
                this.cursorChangeWatcherIgnoreCount += 1;   // Ignore cursor change event from leap.
                const posPastClose: Position = pair.close.translate({ characterDelta: 1 });
                window.activeTextEditor.selection = new Selection(posPastClose, posPastClose);
                // Reveal the range so that the text editor's view follows the cursor after the leap.
                window.activeTextEditor.revealRange(new Range(posPastClose, posPastClose));
            }
            this.disposables.push(disposable);
        });
    }

    /** Register a command that allows users to clear all pairs that are being tracked. */
    private registerEscapeLeaperModeCommand(): void {
        const disposable = commands.registerCommand( `${EXT_IDENT}.escapeLeaperMode`, (_) => 
            this.escapeLeaperMode()
        );
        this.disposables.push(disposable);
    }

    /** 
     * Register a "passthrough" command that binds to `Tab` and `Enter` that detects suggestion 
     * insertion when `leaper.inLeaperMode` is active to ensure that pairs are not erroneously removed 
     * after accepting suggestions.
     */
    private acceptSelectedSuggestionCommand(): void {
        const disposable = commands.registerCommand(`${EXT_IDENT}.acceptSelectedSuggestion`, (_) => {
            // Suggested text insertions involve moving the cursor to the end of the text *before* the 
            // text is inserted. This is unlike typical text insertions (such as typing text into
            // the editor) where the cursor is moved after the text is inserted.
            //
            // Having the cursor move first will cause the cursor change watcher to erroneously 
            // remove pairs from being tracked since the cursor is temporarily moved outside of a 
            // pair.
            // 
            // For this reason, when we accept suggestions we ask that the cursor change watcher
            // ignore the immediate event.
            this.cursorChangeWatcherIgnoreCount += 1;
            commands.executeCommand('acceptSelectedSuggestion');
        });
        this.disposables.push(disposable);
    }

    /** Escape leaper mode by clearing the list of tracked pairs and deactivating the contexts. */
    private escapeLeaperMode(): void {
        this.pairs.clear();
        setInLeaperModeContext(false);
        setHasLineOfSightContext(false);
        this.cursorChangeWatcherIgnoreCount = 0;
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