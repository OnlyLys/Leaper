import { ExtensionContext } from 'vscode';
import { Engine } from './engine/engine';
import { TestAPI } from './engine/test-api';

/**
 * This function is called by vscode in order to start the extension.
 */
export function activate(context: ExtensionContext): TestAPI {

    // This starts the extension.
    const engine = new Engine();

    // So that the engine will be automatically disposed of when the extension is shut down.
    context.subscriptions.push(engine);

    // Expose the engine for tests.
    return engine;
} 

export function deactivate() {
    // Intentionally empty.
}
