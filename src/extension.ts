import { ExtensionContext, commands, workspace, window, Position } from 'vscode';
import { Engine } from './engine/engine';
import { Configuration } from './engine/configuration';

/**
 * Entry point of the extension.
 */
export function activate(context: ExtensionContext): TestAPI {

    let engine: Engine | undefined = undefined;
    if (window.activeTextEditor) {
        engine = new Engine(window.activeTextEditor, Configuration.read());
    }

    // Keybinding to move the cursor past the nearest available pair.
    const leapCommand = commands.registerTextEditorCommand(
        `leaper.leap`, 
        () => engine?.leap()
    );

    // Keybinding to untrack all the pairs and disable all keybinding contexts.
    const escapeLeaperModeCommand = commands.registerTextEditorCommand(
        `leaper.escapeLeaperMode`, 
        () => engine?.clear()
    );

    // Watcher that restarts a new engine on configuration change.
    const configurationChangeWatcher = workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`leaper`) && engine) {
            engine.dispose();
            engine = new Engine(engine.editor, Configuration.read());
        }
    });

    // Watcher that restarts a new engine on editor focus change.
    const activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor((newEditor) => {

        // We require fresh configuration values to be loaded when the active text editor is changed 
        // because of the existence of multi-root workspaces.
        // 
        // Multi-root workspaces allow for workspace specific configurations. But when switching 
        // between editors in separate workspaces, the `onDidChangeConfiguration` emitter does not 
        // fire, even though the effective configuration could change. 
        engine?.dispose();
        engine = newEditor ? new Engine(newEditor, Configuration.read()) : undefined;
    });

    context.subscriptions.push(
        { 
            dispose: () => engine?.dispose() 
        },
        leapCommand,
        escapeLeaperModeCommand,
        configurationChangeWatcher,
        activeTextEditorChangeWatcher,
    );

    // Expose the engine for tests.
    return { 
        snapshot: () => engine?.snapshot() ?? [] 
    };

} 

export interface TestAPI {

    /** 
     * Get a snapshot of all the pairs that are being tracked. 
     * 
     * The return value is an array of subarrays, where each subarray contains the pairs belonging 
     * to each cursor. The top level array is parallel to the array of cursors obtained from 
     * `TextEditor.selections`. 
     * 
     * The returned array can be mutated without affecting the extension's state.
     */
    snapshot(): { open: Position, close: Position, isDecorated: boolean }[][];

}

export function deactivate() {
    // Intentionally empty.
}
