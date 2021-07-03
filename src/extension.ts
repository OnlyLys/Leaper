import { ExtensionContext } from 'vscode';
import { Engine } from './engine/engine';
import { TestAPI } from './engine/test-api';

/**
 * Handle to the running engine instance to allow tests to query the engine's state.
 */
export let testHandle: TestAPI | undefined;

/**
 * This function is called by vscode in order to start the extension.
 */
export function activate(context: ExtensionContext) {

    // This starts the extension.
    const engine = new Engine();

    // So that the engine will be automatically disposed of when the extension is shut down.
    context.subscriptions.push(engine);

    // Expose the engine for tests.
    testHandle = engine;
} 

export function deactivate() {
    // Intentionally empty.
}
