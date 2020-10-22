import { ExtensionContext, Position } from 'vscode';
import { Engine } from './engine/engine';

/**
 * Entry point of the extension.
 */
export function activate(context: ExtensionContext): TestAPI {

    // This starts the extension.
    const engine = new Engine();

    // So that the engine will be disposed of when the extension is shut down.
    context.subscriptions.push(engine);

    // Expose the engine for tests.
    return engine;
} 

export interface TestAPI {

    /** 
     * Get a snapshot of all the pairs that are being tracked in the active text editor. 
     * 
     * The return value is an array of subarrays, where each subarray contains the pairs belonging 
     * to each cursor. The top level array is parallel to the array of cursors in the active text
     * editor (i.e. `activeTextEditor.selections`).
     * 
     * The return value can be mutated without affecting the extension's state.
     */
    activeSnapshot(): { open: Position, close: Position, isDecorated: boolean }[][];
    
}

export function deactivate() {
    // Intentionally empty.
}
