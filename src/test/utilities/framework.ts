//! The following module defines the test framework for this extension.

import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextDocumentShowOptions, TextEditor, workspace, extensions, window, ConfigurationTarget, ViewColumn } from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { Snapshot, TestAPI } from '../../engine/test-api';
import { CompactCursors, CompactClusters, CompactRange, CompactPosition } from './compact';
import { pickRandom, waitFor, zip } from './other';

/**
 * A collection of `TestGroup`s.
 */
export class TestCategory {

    public constructor(private readonly args: {
        readonly name:       string,
        readonly testGroups: ReadonlyArray<TestGroup>
    }) {}

    public run(): void {
        const testGroups = this.args.testGroups;
        describe(this.args.name, function () {
            testGroups.forEach((testGroup) => testGroup.run());
        });
    }
    
}

/**
 * A collection of `TestCase`s.
 */
export class TestGroup {
    
    public constructor(private readonly args: {
        readonly name:      string,
        readonly testCases: ReadonlyArray<TestCase>
    }) {}

    public run(): void {
        const testCases = this.args.testCases;
        describe(this.args.name, function () {
            testCases.forEach((testCase) => testCase.run());
        });
    }

}

/**
 * Each test case is given its own empty editor.  
 */
export class TestCase {

    public constructor(private readonly args: {

        readonly name: string,

        /** 
         * The language of the editor that is provided to this test case.
         * 
         * Defaults to 'typescript'.
         */
        readonly editorLanguageId?: string,

        /**
         *  Callback to setup the editor before running the test case.
         */
        readonly prelude?: (executor: Executor) => Promise<void>,

        /** 
         * Callback to execute as part of the test case. 
         */
        readonly task: (executor: Executor) => Promise<void>

    }) {}

    public run(): void {
        const { name, editorLanguageId, prelude, task } = this.args;
        it(name, async function () {

            // Sometimes tests can fail due to the editor lagging.
            this.retries(1);

            // To allow test cases to modify and check the state of the running vscode instance.
            const executor = new ExecutorExtended();

            try {
                
                // Open a new editor for the test case.
                await executor.openNewTextEditor({ languageId: editorLanguageId });
    
                // Setup the opened editor for the test.
                if (prelude) {
                    executor.inPrelude = true;
                    await prelude(executor);
                    executor.inPrelude = false;
                }
    
                // Run the actual test.            
                await task(executor);

            } finally {

                // Leave no trace behind.
                await executor.dispose();
            }

        });
    }

}

/**
 * A convenience class that allows a test case to:
 * 
 *  1. Call commands.
 *  2. Modify the state of the active text editor.
 *  3. Assert the state of the extension.
 *  4. Temporarily change configuration values of the test workspace and the folders within it.
 *  5. Open documents in the test workspace.
 */
export class Executor {

    /**
     * Callbacks to restore configurations then this executor is cleaned up.
     * 
     * The callbacks of this array must be executed in reverse ordering.
     */
    protected configurationRestorers: (() => Promise<void>)[];

    /**
     * Text to print at the front of an assertion failure message.
     */
    protected assertFailMsgHeader: string;

    public constructor() {
        this.configurationRestorers = [];
        this.assertFailMsgHeader    = '';
    }

    /**
     * Assert the position of pairs being tracked within the active text editor.
     * 
     * # Decorations
     * 
     * The value of `expectDecorations` determines if decorations are checked:
     * 
     *  - `'all'`: Assert that all pairs are decorated.
     *  - `'nearest'`: Assert that only the pairs nearest to each cursor are decorated.
     *  - `undefined`: Will not check the decorations.
     */
    public assertPairs(
        expected:           CompactClusters, 
        expectDecorations?: 'all' | 'nearest'
    ): void {

        // Representation of a pair that displays better during assertion failures.
        type PairPartial = { open: [number, number], close: [number, number] };

        // Is `Pair` but with information about whether the pair is decorated.
        type PairFull = { open: [number, number], close: [number, number], isDecorated: boolean };

        // The actual pairs (including decorations) but in a more print friendly form.
        const actualFull: PairFull[][] = getSnapshot().map((cluster) => 
            cluster.map(({ open, close, isDecorated }) =>
                ({ 
                    open:  [open.line,  open.character], 
                    close: [close.line, close.character],
                    isDecorated
                })
            )
        );

        // The expected pairs (including decorations) but in a more print friendly form.
        const expectedFull: PairFull[][] = expected.map((cluster) => {
            if (cluster === 'None') {
                return [];
            } else {
                const line    = cluster.line;
                const openers = cluster.sides.slice(0, cluster.sides.length / 2);
                const closers = cluster.sides.slice(cluster.sides.length / 2).reverse();
                const pairs: PairFull[] = [...zip(openers, closers)].map(([opener, closer]) => 
                    ({ open: [line, opener], close: [line, closer], isDecorated: false })
                );
                if (expectDecorations === 'all') {
                    pairs.forEach(pair => pair.isDecorated = true);
                } else if (expectDecorations === 'nearest' && pairs.length > 0) {
                    pairs[pairs.length - 1].isDecorated = true;
                }
                return pairs;
            }
        });

        // The message to show on assertion failure.
        const errMsg = this.assertFailMsgHeader + 'Pairs Mismatch';

        if (expectDecorations) {
            assert.deepStrictEqual(actualFull, expectedFull, errMsg);
        } else {

            function strip(full: PairFull[][]): PairPartial[][] {
                return full.map((cluster) => cluster.map(({ open, close}) => ({ open, close })));
            }

            // Since `expectDecorations` was not specified, we strip the `isDecorated` flag before
            // performing assertions.
            const actualPartial   = strip(actualFull);
            const expectedPartial = strip(expectedFull);

            assert.deepStrictEqual(actualPartial, expectedPartial, errMsg);
        }
    }

    /**
     * Assert the positions of the cursors within the active text editor.
     */
    public assertCursors(expected: CompactCursors): void {
        const actual: CompactCursors = getVisibleTextEditor().selections.map(({ active, anchor }) =>
            ({ anchor: [anchor.line, anchor.character], active: [active.line, active.character] })
        );
        const _expected: CompactCursors = expected.map((cursor) => 
            Array.isArray(cursor) ? { anchor: [cursor[0], cursor[1]], active: [cursor[0], cursor[1]] }
                                  : cursor
        );
            
        assert.deepStrictEqual(actual, _expected, this.assertFailMsgHeader + 'Cursors Mismatch');
    }

    /**
     * Get the cursors of a visible text editor.
     * 
     * Defaults to the visible text editor if `viewColumn is `undefined`.
     */
    public getCursors(viewColumn?: ViewColumn): CompactCursors {
        return getVisibleTextEditor(viewColumn).selections.map((selection) => {
            const anchorLine = selection.anchor.line;
            const anchorChar = selection.anchor.character;
            const activeLine = selection.active.line;
            const activeChar = selection.active.character;
            if (anchorLine === activeLine && anchorChar === activeChar) {
                return [anchorLine, anchorChar];
            } else {
                return { anchor: [anchorLine, anchorChar], active: [activeLine, activeChar] };
            }
        });
    }

    /**
     * Assert the most recently broadcasted value of `leaper.inLeaperMode` keybinding context.
     */
    public assertMRBInLeaperModeContext(expect: boolean): void {
        assert.deepStrictEqual(
            getHandle().MRBInLeaperModeContext, 
            expect,
            this.assertFailMsgHeader + 'Most Recently Broadcasted `leaper.inLeaperMode` Context Mismatch'
        );
    }

    /**
     * Assert the most recently broadcasted value of `leaper.hasLineOfSight` keybinding context.
     */
    public assertMRBHasLineOfSightContext(expect: boolean): void {
        assert.deepStrictEqual(
            getHandle().MRBHasLineOfSightContext, 
            expect,
            this.assertFailMsgHeader + 'Most Recently Broadcasted `leaper.hasLineOfSight` Context Mismatch'
        );
    }

    // --------------------------------------
    // All of the methods below are `async` because they modify the state of the vscode instance 
    // running the tests. 
    //
    // Because we are 'writing' to vscode, we need some delay time (configurable by passing 
    // `RepetitionDelayOptions`) after each repetition of the methods to make sure the writes have 
    // been processed by vscode before proceeding. Furthermore, the delay time gives time for this 
    // extension to acknowledge those changes, since this extension receives input asynchronously.

    /**
     * Call the command to type an autoclosing pair into the document.
     * 
     * Which kind of pair is typed in is randomly picked between `{}`, `[]` and `()`. 
     */
    public async typePair(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const opener = pickRandom([ '{', '[', '(' ]);
            return commands.executeCommand('default:type', { text: opener });
        }, options);
    }

    /**
     * Type text into the document, codepoint by codepoint.
     * 
     * Each codepoint is typed in via a `default:type` command call.
     */
    public async typeText(args: TypeTextArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            for (const char of args.text) {
                await commands.executeCommand('default:type', { text: char });
            }
        }, args);
    }

    /**
     * Apply text edits to a visible text document. 
     */
    public async editText(args: EditTextArgs): Promise<void> {
        const applyAllEdits = (builder: TextEditorEdit) => {
            for (const edit of args.edits) {
                if (edit.kind === 'replace') {
                    const { start: [startLine, startChar], end: [endLine, endChar] } = edit.range;
                    builder.replace(new Range(startLine, startChar, endLine, endChar), edit.with);
                } else if (edit.kind === 'insert') {
                    builder.insert(new Position(edit.at[0], edit.at[1]), edit.text);
                } else {
                    const { start: [startLine, startChar], end: [endLine, endChar] } = edit.range;
                    builder.delete(new Range(startLine, startChar, endLine, endChar));
                }
            }
        };
        return executeWithRepetitionDelay(async () => {
            return getVisibleTextEditor(args.viewColumn).edit(applyAllEdits);
        }, args);
    }

    /**
     * Call the command to move all the cursors once in a specific direction.
     */
    public async moveCursors(args: MoveCursorsArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            switch (args.direction) {
                case 'right': return commands.executeCommand('cursorRight');
                case 'left':  return commands.executeCommand('cursorLeft');
                case 'up':    return commands.executeCommand('cursorUp');
                case 'down':  return commands.executeCommand('cursorDown');
                default:      throw new Error('Unreachable!');
            }
        }, args);
    }

    /**
     * Set the cursors in a visible text editor to specific positions in the document.
     */
    public async setCursors(args: SetCursorsArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            getVisibleTextEditor(args.viewColumn).selections = args.to.map((cursor) => {
                const anchorLine = Array.isArray(cursor) ? cursor[0] : cursor.anchor[0];
                const anchorChar = Array.isArray(cursor) ? cursor[1] : cursor.anchor[1];
                const activeLine = Array.isArray(cursor) ? cursor[0] : cursor.active[0];
                const activeChar = Array.isArray(cursor) ? cursor[1] : cursor.active[1];
                return new Selection(anchorLine, anchorChar, activeLine, activeChar);
            });
        }, args);
    }

    /**
     * Call the 'Leap' command.
     */
    public async leap(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand(`leaper.leap`);
        }, options);
    }

    /**
     * Call the 'Escape Leaper Mode' command.
     */
    public async escapeLeaperMode(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand(`leaper.escapeLeaperMode`);
        }, options);
    }

    /** 
     * Backspace a character in the active text editor.
     */
    public async backspace(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('deleteLeft');
        }, options);
    }

    /**
     * Backspace a word in the active text editor.
     */
    public async backspaceWord(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('deleteWordLeft');
        }, options);
    }

    /**
     * Delete right a character in the active text editor.
     */
    public async deleteRight(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('deleteRight');
        }, options);
    }

    /**
     * Insert a snippet into a visible text editor.
     * 
     * The snippet will be inserted at cursor position.
     */
    public async insertSnippet(args: InsertSnippetArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => { 
            return getVisibleTextEditor(args.viewColumn).insertSnippet(args.snippet);
        }, args);
    }

    /**
     * Jump to the next tabstop in the current snippet in the active text editor. 
     */
    public async jumpToNextTabstop(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('jumpToNextSnippetPlaceholder');
        }, options);
    }

    /** 
     * Jump to the previous tabstop in the current snippet in the active text editor.
     */
    public async jumpToPrevTabstop(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('jumpToPrevSnippetPlaceholder');
        }, options);
    }

    /**
     * Trigger an autocomplete suggestion then accept the first one in the active text editor.
     */
    public async triggerAndAcceptSuggestion(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('editor.action.triggerSuggest');
            await waitFor(100);    // Wait for the suggestion box to appear.
            await commands.executeCommand('acceptSelectedSuggestion');
        }, options);
    }

    /**
     * Perform an undo in the active text editor.
     */
    public async undo(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('undo');
        }, options);
    }

    /**
     * Move the cursors in the active text editor to the start of their respective lines.
     */
    public async home(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('cursorHome');
        }, options);
    }

    /**
     * Move the cursors in the active text editor to the end of their respective lines.
     */
    public async end(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('cursorEnd');
        }, options);
    }

    /**
     * Move the cursors in the active text editor to the end of the document.
     */
    public async cursorBottom(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('cursorBottom');
        }, options);
    }

    /**
     * Open a file in the test workspace.
     */
    public async openFile(args: OpenFileArgs): Promise<void> {
        const { rel, showOptions } = args;
        return executeWithRepetitionDelay(async () => {
            const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
            const filePath = path.join(rootPath, rel);
            const document = await workspace.openTextDocument(filePath);
            await window.showTextDocument(document, showOptions);
        }, args);
    }

    /**
     * Open a new text editor containing an empty text document.
     */
    public async openNewTextEditor(args: OpenNewTextEditorArgs): Promise<void> {
        const languageId = args.languageId ?? 'typescript';
        return executeWithRepetitionDelay(async () => {
            const document = await workspace.openTextDocument({ language: languageId });
            await window.showTextDocument(document, args.showOptions);
        }, args);
    }

    /**
     * Move the active text editor one tab group to the right.
     */
    public async moveEditorToRight(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.moveEditorToRightGroup');
        }, options);
    }

    /**
     * Move the active text editor one tab group to the left.
     */
    public async moveEditorToLeft(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.moveEditorToLeftGroup');
        }, options);
    }

    /**
     * Switch focus to the text editor tab group on the right.
     */
    public async focusRightEditorGroup(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.focusRightGroup');
        }, options);
    }

    /**
     * Switch focus to the text editor tab group on the left. 
     */
    public async focusLeftEditorGroup(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.focusLeftGroup');
        }, options);
    }

    /**
     * Close the active text editor.
     */
    public async closeActiveEditor(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.closeActiveEditor');
        }, options);
    }

    /**
     * Close all text editors.
     */
    public async closeAllEditors(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.closeAllEditors');
        }, options);
    }

    /**
     * Set a configuration value scoped to the text document of a visible text editor.
     * 
     * @param partialName The name of the configuration after the `leaper.` prefix.
     * @param value Value to set the configuration to.
     * @param targetWorkspaceFolder The name of the workspace folder to set the configuration in. If
     *                              not specified, will set the configuration in the root workspace.
     * @param targetLanguage The language to scope the configuration to. Defaults to none.
     * @param options Options to configure repetitions and delay.
     */
    public async setConfiguration<T>(args: {
        partialName:            string, 
        value:                  T,
        targetWorkspaceFolder?: string,
        targetLanguage?:        string,
        options?:               RepetitionDelayOptions
    }): Promise<void> {
        const { partialName, value, targetWorkspaceFolder, targetLanguage, options } = args;
        return executeWithRepetitionDelay(async () => {

            // Get the resource identifier of the workspace / workspace folder.
            const targetUri = workspace.workspaceFolders?.find(
                (workspaceFolder) => workspaceFolder.name === targetWorkspaceFolder
            )?.uri ?? workspace.workspaceFile;
            if (!targetUri) {
                throw new Error('Unable to find workspace to set configurations for!');
            }

            // The scope to to confine where we get the `WorkspaceConfiguration` object from.
            const receiveScope = targetLanguage ? { uri: targetUri, languageId: targetLanguage } : targetUri;

            // Get the object that is used to get / set configuration values.
            const configuration = workspace.getConfiguration('leaper', receiveScope);

            // Save the previous value (so that we can restore it later).
            const prevValue = configuration.get<T>(partialName);    

            // Scope to set the configuration in.
            const targetScope = targetWorkspaceFolder ? ConfigurationTarget.WorkspaceFolder 
                                                      : ConfigurationTarget.Workspace;
            
            // Set the configuration.
            await configuration.update(partialName, value, targetScope, !!targetLanguage);

            // Store the callback that allows this configuration change to be reverted.
            this.configurationRestorers.push(async () => {
                const configuration = workspace.getConfiguration('leaper', receiveScope);
                await configuration.update(partialName, prevValue, targetScope, !!targetLanguage);
            });
        }, options);
    }

}

/**
 * An extension of the `Executor` class to add a few methods that should not be exposed to the test
 * cases.
 * 
 * This class is strictly meant to be used within this module.
 */
class ExecutorExtended extends Executor {

    /**
     * Whether the assertion messages should denote that the assertions failed in a prelude.
     */
    public set inPrelude(value: boolean) {
        this.assertFailMsgHeader = value ? '(Prelude Failure) ' : '';
    }

    /**
     * Perform cleanup of this executor by:
     * 
     *  1. Closing all opened text editors.
     *  2. Restoring configuration values that were changed.
     */
    public async dispose(): Promise<void> {
        for (const restorer of this.configurationRestorers.reverse()) {
            await restorer();
        }
        await this.closeAllEditors();
    }

}

/**
 * Get a handle to the running extension instance.
 * 
 * @throws Will throw an error if the API for this extension cannot be reached.
 */
function getHandle(): TestAPI {
    const handle = extensions.getExtension<TestAPI>(`OnlyLys.leaper`)?.exports;
    if (!handle) {
        throw new Error("Unable to access Leaper's API for testing!");
    }
    return handle;
}

// Get the snapshot for the visible text editor at view column `viewColumn`.
// 
// Defaults to the active text editor if `viewColumn` is `undefined`.
function getSnapshot(viewColumn: ViewColumn = ViewColumn.Active): Snapshot {
    if (viewColumn === ViewColumn.Active) {
        if (!window.activeTextEditor || window.activeTextEditor.viewColumn === undefined) {
            throw new Error("Unable to obtain snapshot of active text editor!");
        }
        viewColumn = window.activeTextEditor.viewColumn;
    }
    const snapshot = getHandle().snapshots().get(viewColumn);
    if (!snapshot) {
        throw new Error('Unable to obtain requested snapshot!');
    }
    return snapshot;
}

/**
 * Get a reference to the visible text editor at view column `viewColumn`.
 * 
 * Defaults to the active text editor if `viewColumn` is `undefined`.
 * 
 * @throws Will throw an error if the requested text editor cannot be found.
 */
function getVisibleTextEditor(viewColumn: ViewColumn = ViewColumn.Active): TextEditor {
    const textEditor = viewColumn === ViewColumn.Active ? window.activeTextEditor 
                       : window.visibleTextEditors.find((v) => v.viewColumn === viewColumn);
    if (!textEditor) {
        throw new Error('Unable to obtain requested text editor!');
    }
    return textEditor;
}

/**
 * Default amount of time to delay after each action repetition.
 */
const DEFAULT_DELAY_MS = 30;

/**
 * Default number of times to execute each action.
 */
const DEFAULT_REPETITIONS = 1;

/**
 * Execute a callback `options.repetitions` amount of times, applying a `options.delay` wait after
 * each repetition.
 */
async function executeWithRepetitionDelay(
    callback: () => Promise<any>, 
    options?: RepetitionDelayOptions
): Promise<void> {
    const delay     = options?.delay       ?? DEFAULT_DELAY_MS;
    let repetitions = options?.repetitions ?? DEFAULT_REPETITIONS;
    while (repetitions-- > 0) {
        await callback();
        await waitFor(delay);
    }
}

interface RepetitionDelayOptions {

    /** 
     * How many times to execute this action. 
     * 
     * Default is `1`. 
     */
    repetitions?: number;

    /** 
     * Milliseconds of delay to apply after each action execution. 
     * 
     * Default is `30`. 
     * 
     * Some delay is necessary because the extension receives information about any changes that 
     * have occurred in the editor asynchronously, which means we have to wait until the extension 
     * has acknowledged the changes before proceeding with the next action.
     * 
     * This delay is applied after each repetition of this action.
     */
    delay?: number;
}

interface TypeTextArgs extends RepetitionDelayOptions {
    text: string;
}

interface MoveCursorsArgs extends RepetitionDelayOptions {
    direction: 'up' | 'down' | 'left' | 'right';
}

interface EditTextArgs extends RepetitionDelayOptions {

    /** 
     * All edits specified in this array will be done simultaneously. 
     */
    edits: ReadonlyArray<
        {
            /** Replace a range of text.*/
            kind: 'replace';
        
            /** Range of text to replace. */
            range: CompactRange;
        
            /** Text to insert in place of the replaced range. */
            with: string;
        } | 
        {
            /** Insert text at a position. */
            kind: 'insert';
        
            /** Position to insert `text` at. */
            at: CompactPosition;
        
            /** Text to insert. */
            text: string;
        } |
        {
            /** Delete a range of text. */
            kind: 'delete';
        
            /** Range of text to delete. */
            range: CompactRange;
        }
    >;

    /**
     * View column of the text editor to perform the edits in.
     * 
     * Defaults to `ViewColumn.Active`.
     */
    viewColumn?: ViewColumn;
}

interface SetCursorsArgs extends RepetitionDelayOptions {

    to: CompactCursors;

    /**
     * View column of the text editor to set the cursors of.
     * 
     * Defaults to `ViewColumn.Active`.
     */
    viewColumn?: ViewColumn;
}

interface InsertSnippetArgs extends RepetitionDelayOptions {
    
    snippet: SnippetString;

    /**
     * View column of the text editor to insert the snippet in.
     * 
     * Defaults to `ViewColumn.Active`.
     */
    viewColumn?: ViewColumn;
}

interface OpenFileArgs extends RepetitionDelayOptions {

    /** 
     * The path of the file relative to the root of the workspace. 
     */
    rel: string;

    /** 
     * How to show the opened file. 
     */
    showOptions?: TextDocumentShowOptions;
}

interface OpenNewTextEditorArgs extends RepetitionDelayOptions {

    /** 
     * The language of the opened text document.
     * 
     * Defaults to `'typescript'`.
     */
    languageId?: string;

    /** 
     * How to show the opened file.
     */
    showOptions?: TextDocumentShowOptions;
}