import { commands, ConfigurationTarget, extensions, TextDocumentShowOptions, TextEditor, window, workspace } from 'vscode';
import * as path from 'path';
import { TestAPI } from '../../extension';

/**
 * Generate an array of sequential integers.
 */
export function range(start: number, endNotInclusive: number): number[] {
    const result = [];
    for (let i = start; i < endNotInclusive; ++i) {
        result.push(i);
    }
    return result;
}

/** 
 * Add a number to each element within a slice of numbers.
 */
export function sliceAdd(arr: number[], start: number, endNotInclusive: number, add: number): void {
    for (let i = start; i < endNotInclusive; ++i) {
        arr[i] += add;
    }
}

/** 
 * Subtract a number from each element within a slice of numbers.
 */
export function sliceSub(arr: number[], start: number, endNotInclusive: number, sub: number): void {
    for (let i = start; i < endNotInclusive; ++i) {
        arr[i] -= sub;
    }
}

/**
 * Randomly pick an element from an array.
 * 
 * Will throw an error if the input array is empty.
 */
export function pickRandom<T>(arr: ReadonlyArray<T>): T {
    if (arr.length < 1) {
        throw new Error('Input array cannot be empty.');
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

/** 
 * Timeout by `n` milliseconds. 
 */
export async function waitFor(n: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, n));
}

/**
 * Halt the control flow until the `callback` yields `true`.
 */
export async function waitUntil(callback: () => boolean): Promise<void> {
    while (!callback()) {}
}

/**
 * Zip two iterables together.
 */
export function* zip<T>(a: Iterable<T>, b: Iterable<T>): Generator<[T, T], undefined, undefined> {
    const iterA = a[Symbol.iterator]();
    const iterB = b[Symbol.iterator]();
    while (true) {
        let nextA = iterA.next();
        let nextB = iterB.next();
        if (!nextA.done && !nextB.done) {
            yield [nextA.value, nextB.value];
        } else {
            return;
        }
    }
}

/**
 * Open an existing file in the testing workspace.
 * 
 * @param rel The path relative to the root of the multi-root testing workspace. 
 * @param options Specifies the behavior when showing the opened file.
 * @return The text editor of the opened file.
 */
export async function openFile(rel: string, options?: TextDocumentShowOptions): Promise<TextEditor> {
    const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
    const filePath = path.join(rootPath, rel);
    const document = await workspace.openTextDocument(filePath);
    const editor   = await window.showTextDocument(document, options);
    return editor;
}

/**
 * Open a new text editor containing a new text document.
 * 
 * @param languageId The language of the opened text document. Defaults to `'typescript'`.
 */
export async function openNewTextEditor(languageId: string = 'typescript'): Promise<TextEditor> {
    const document = await workspace.openTextDocument({ language: languageId });
    const editor   = await window.showTextDocument(document);
    return editor;
}

/**
 * Get a handle to the extension.
 */
export function getHandle(): TestAPI {
    const handle = extensions.getExtension<TestAPI>(`OnlyLys.leaper`)?.exports;
    if (!handle) {
        throw new Error('Unable to access Leaper API for testing!');
    }
    return handle;
}

/**
 * Get a reference to the active editor.
 * 
 * @throws Will throw an error if there is no active text editor.
 */
export function getActiveEditor(): TextEditor {
    if (!window.activeTextEditor) {
        throw new Error('Unable to obtain active text editor!');
    }
    return window.activeTextEditor;
}

/**
 * Close the active text editor.
 */
export async function closeActiveEditor(): Promise<void> {
    const toClose = window.activeTextEditor;
    await commands.executeCommand('workbench.action.closeActiveEditor');
    await waitUntil(() => toClose === undefined || window.activeTextEditor !== toClose);
}

/**
 * Close all text editors.
 */
export async function closeAllEditors(): Promise<void> {
    await commands.executeCommand('workbench.action.closeAllEditors');
    await waitUntil(() => window.visibleTextEditors.length === 0);
}

/**
 * Object returned by the `setConfiguration` function, which allows for restoring the previous
 * configuration value.
 */
export interface ConfigurationRestore {
    restore(): Promise<void>;
}

/**
 * Set a configuration value scoped to the active text editor's document.
 * 
 * A `ConfigurationRestore` type is returned that allows for restoring the previous configuration.
 * 
 * @param partialName The name of the configuration after the `leaper.` prefix.
 * @param value Value to set the configuration to.
 * @param target Which scope to set the configuration in.
 * @param overrideInLanguage Whether to set the configuration scoped to the language of the active 
 *                           text editor's document.
 */
export async function setConfiguration<T>(
    partialName:         string, 
    value:               T, 
    target:              ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder,
    overrideInLanguage?: boolean
): Promise<ConfigurationRestore> {
    const activeDocument         = window.activeTextEditor?.document;
    const workspaceConfiguration = workspace.getConfiguration('leaper', activeDocument);
    const prev                   = workspaceConfiguration.get<T>(partialName);
    await workspaceConfiguration.update(partialName, value, target, overrideInLanguage);
    return {
        async restore(): Promise<void> {
            return workspaceConfiguration.update(partialName, prev, target, overrideInLanguage);
        }
    };
}
