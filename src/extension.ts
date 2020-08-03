import { ExtensionContext, commands, workspace, window } from 'vscode';
import { Controller } from './controller';
import { Configuration } from './configuration';

/** 
 * Note that as of 1.32, `activate` is called each time a new workspace is opened - each workspace
 * as its own instance of the extension.
 */
export function activate(context: ExtensionContext): LeaperAPI {

    const controller = Controller.start(Configuration.read());

    const leapCommand = commands.registerTextEditorCommand(
        `leaper.leap`, 
        () => controller.leap()
    );

    // Keybinding to untrack all the pairs and disable all keybinding contexts.
    const escapeLeaperModeCommand = commands.registerTextEditorCommand(
        `leaper.escapeLeaperMode`, 
        () => controller.reset(undefined)
    );

    // Watcher that restarts the controller on editor focus change.
    const activeTextEditorChangeWatcher = window.onDidChangeActiveTextEditor(() => {

        // We have to reload the configuration when the active text editor changes as there could be
        // workspace folder specific configurations within a multi-root workspace.
        controller.reset(Configuration.read());
    });

    // Watcher that resets the controller on configuration change.
    const configurationChangeWatcher = workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(`leaper`)) {
            controller.reset(Configuration.read());
        }
    });

    context.subscriptions.push(
        controller,
        leapCommand,
        escapeLeaperModeCommand,
        activeTextEditorChangeWatcher,
        configurationChangeWatcher
    );

    // Expose parts of the controller for tests.
    return {
        get isEmpty(): boolean {
            return controller.isEmpty;
        },
        get snapshot(): [number, number, number, number, boolean][][] {
            return controller.snapshot;
        },
        get snapshotBare(): [number, number, number, number][][] {
            return controller.snapshot.map(
                subarray => subarray.map(
                    pair => [pair[0], pair[1], pair[2], pair[3]] as [number, number, number, number]
                )
            );
        }
    };

} 

export function deactivate() {
    // Intentionally empty.
}

export interface LeaperAPI {

    /** `true` if there are currently no pairs being tracked by the extension. Otherwise `false`. */
    readonly isEmpty: boolean;

    /** 
     * Get a snapshot of all the pairs that are being tracked. That means getting information about:
     * - The positions of each pair.
     * - Whether each pair is currently decorated.
     * 
     * The snapshot returned is a 2D array. The first dimension is enumerated based on the trackers: 
     * i.e. `snapshot[0]` gives us the sub-snapshot of the first tracker, `snapshot[1]` for the 
     * second tracker and so on.
     * 
     * The elements within each subarray are quintuplets with the following values:
     * `[openLine, openCharacter, closeLine, closeCharacter, isDecorated]`. Each quintuplet describes
     * a pair's opening and closing positions in addition to its current decoration state.
     */ 
    readonly snapshot: [number, number, number, number, boolean][][];

    /** Get a snapshot of all the pairs but without information about decorations. */
    readonly snapshotBare: [number, number, number, number][][];

}