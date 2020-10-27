//! The following module defines the test framework for this extension.

import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextDocumentShowOptions, TextEditor, workspace, extensions, window, ConfigurationTarget, ViewColumn } from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { TestAPI } from '../../extension';
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
                await executor.openNewTextEditor(editorLanguageId);
    
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
     * Message to print when `assertPairs` fails.
     */
    protected assertPairsFailMsg: string;

    /**
     * Message to print when `assertCursors` fails.
     */
    protected assertCursorsFailMsg: string;

    public constructor() {
        this.configurationRestorers = [];
        this.assertPairsFailMsg     = 'Pairs Mismatch';
        this.assertCursorsFailMsg   = 'Cursors Mismatch';
    }

    public assertPairs(expected: CompactClusters): void {

        // Convert the clusters to a simpler form that displays better during assertion failures.
        type Simple = { open: [number, number], close: [number, number] }[][];
        const actual: Simple = getHandle().activeSnapshot().map((cluster) => 
            cluster.map(({ open, close }) => 
                ({ open: [open.line,  open.character], close: [close.line, close.character] })
            )
        );
        const _expected: Simple = expected.map((cluster) => {
            const line = cluster.line;
            if (line === -1) {
                return [];
            } else {
                const openers = cluster.sides.slice(0, cluster.sides.length / 2);
                const closers = cluster.sides.slice(cluster.sides.length / 2).reverse();
                return [...zip(openers, closers)].map(([opener, closer]) => 
                    ({ open: [line, opener], close: [line, closer] })
                );
            }
        });

        assert.deepStrictEqual(actual, _expected, this.assertPairsFailMsg);
    }

    public assertCursors(expected: CompactCursors): void {
        const actual: CompactCursors = getActiveEditor().selections.map(({ active, anchor }) => {
            return { 
                anchor: [anchor.line, anchor.character], 
                active: [active.line, active.character]
            };
        });
        const _expected: CompactCursors = expected.map((cursor) => {
            if (Array.isArray(cursor)) {
                return { anchor: [cursor[0], cursor[1]], active: [cursor[0], cursor[1]] };
            } else {
                return cursor;
            }
        });
            
        assert.deepStrictEqual(actual, _expected, this.assertCursorsFailMsg);
    }

    /**
     * Get the cursors in the active text editor.
     */
    public getCursors(): CompactCursors {
        return getActiveEditor().selections.map((selection) => {
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
     * Type an autoclosing pair into the document.
     * 
     * Which kind of autoclosing pair is typed in is randomly determined. 
     */
    public async typePair(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const opener = pickRandom([ '{', '[', '(' ]);
            return commands.executeCommand('default:type', { text: opener });
        }, options);
    }

    /**
     * Type text into the document, codepoint by codepoint.
     */
    public async typeText(args: TypeTextArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            for (const char of args.text) {
                await commands.executeCommand('default:type', { text: char });
            }
        }, args);
    }

    /**
     * Edit text in the document. 
     * 
     * All the edits made for each call of this method will be done simultaneously.
     */
    public async editText(args: EditTextArgs): Promise<void> {
        const applyAllEdits = (builder: TextEditorEdit) => {
            for (const edit of args.edits) {
                if (edit.kind === 'replace') {
                    const { start: [startLine, startChar], end: [endLine, endChar] } = edit.replace;
                    builder.replace(new Range(startLine, startChar, endLine, endChar), edit.insert);
                } else if (edit.kind === 'insert') {
                    builder.insert(new Position(edit.position[0], edit.position[1]), edit.text);
                } else {
                    const { start: [startLine, startChar], end: [endLine, endChar] } = edit.range;
                    builder.delete(new Range(startLine, startChar, endLine, endChar));
                }
            }
        };
        return executeWithRepetitionDelay(async () => {
            return getActiveEditor().edit(applyAllEdits);
        }, args);
    }

    /**
     * Move all the cursors in a specific direction once.
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
     * Set the cursors to specific positions in the document.
     */
    public async setCursors(args: SetCursorsArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            getActiveEditor().selections = args.cursors.map((cursor) => {
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
     * Backspace once.
     */
    public async backspace(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('deleteLeft');
        }, options);
    }

    /**
     * Backspace a word (i.e. press 'ctrl + backspace').
     */
    public async backspaceWord(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('deleteWordLeft');
        }, options);
    }

    /**
     * Delete right once (i.e. press the 'delete' key).
     */
    public async deleteRight(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('deleteRight');
        }, options);
    }

    /**
     * Insert a snippet into the active text editor.
     * 
     * The snippet will be inserted at cursor position.
     */
    public async insertSnippet(args: InsertSnippetArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => { 
            return getActiveEditor().insertSnippet(args.snippet);
        }, args);
    }

    /** 
     * Jump to the next tabstop in the current snippet.
     */
    public async jumpToNextTabstop(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('jumpToNextSnippetPlaceholder');
        }, options);
    }

    /** 
     * Jump to the previous tabstop in the current snippet.
     */
    public async jumpToPrevTabstop(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('jumpToPrevSnippetPlaceholder');
        }, options);
    }

    /**
     * Trigger an autocomplete suggestion then accept the first suggestion.
     */
    public async triggerAndAcceptSuggestion(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('editor.action.triggerSuggest');
            await waitFor(100);    // Wait for the suggestion box to appear.
            await commands.executeCommand('acceptSelectedSuggestion');
        }, options);
    }

    /**
     * Perform an 'Undo' (i.e. press 'ctrl + z').
     */
    public async undo(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('undo');
        }, options);
    }

    /**
     * Press the 'Home' key.
     */
    public async home(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('cursorHome');
        }, options);
    }

    /**
     * Press the 'End' key.
     */
    public async end(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('cursorEnd');
        }, options);
    }

    /**
     * Move the cursor to the end of the document.
     */
    public async cursorBottom(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand('cursorBottom');
        }, options);
    }

    /**
     * Open an existing file in the testing workspace.
     * 
     * @param rel The path of the file relative to the root of the workspace.
     * @param showOptions How to show the opened file.
     * @param repDelayOptions Specify the repetitions and delay time after each repetition.
     */
    public async openFile(
        rel:              string, 
        showOptions?:     TextDocumentShowOptions, 
        repDelayOptions?: RepetitionDelayOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
            const filePath = path.join(rootPath, rel);
            const document = await workspace.openTextDocument(filePath);
            await window.showTextDocument(document, showOptions);
        }, repDelayOptions);
    }

    /**
     * Open a new text editor containing an empty text document.
     * 
     * @param languageId The language of the opened text document.
     * @param showOptions How to show the opened file.
     * @param repDelayOptions Specify the repetitions and delay time after each repetition.
     */
    public async openNewTextEditor(
        languageId:       string = 'typescript', 
        showOptions?:     TextDocumentShowOptions, 
        repDelayOptions?: RepetitionDelayOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const document = await workspace.openTextDocument({ language: languageId });
            await window.showTextDocument(document, showOptions);
        }, repDelayOptions);
    }

    /**
     * Move the active text editor to the right tab group.
     */
    public async moveEditorToRight(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.moveEditorToRightGroup');
        }, options);
    }

    /**
     * Move the active text editor to the left tab group.
     */
    public async moveEditorToLeft(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.moveEditorToLeftGroup');
        }, options);
    }

    /**
     * Switch focus to the text editor tab group to the right.
     */
    public async focusRightEditorGroup(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('workbench.action.focusRightGroup');
        }, options);
    }

    /** 
     * Switch focus to the text editor tab group to the left. 
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
     * @param target Which scope to set the configuration in.
     * @param overrideInLanguage Whether to set the configuration scoped to the language of the 
     *                           active text editor's document.
     * @param viewColumn Column of the visible text editor. Defaults to the active text editor.
     * @param options Options to configure repetitions and delay.
     */
    public async setConfiguration<T>(args: {
        partialName:         string, 
        value:               T, 
        target:              ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder,
        overrideInLanguage?: boolean,
        viewColumn?:         ViewColumn,
        options?:            RepetitionDelayOptions
    }): Promise<void> {
        const { partialName, value, target, overrideInLanguage, viewColumn, options } = args;
        return executeWithRepetitionDelay(async () => {
            const find          = window.visibleTextEditors.find((v) => v.viewColumn === viewColumn);
            const editor        = (viewColumn !== undefined && find) ? find : getActiveEditor();
            const configuration = workspace.getConfiguration('leaper', editor.document);
            const prevValue     = (() => {
                const inspect = configuration.inspect<T>(partialName);
                if (!inspect) {
                    throw new Error("Failed to inspect configuration!");
                }
                const { 
                    workspaceValue,
                    workspaceLanguageValue,
                    workspaceFolderValue,
                    workspaceFolderLanguageValue
                } = inspect;
                if (target === ConfigurationTarget.Workspace) {
                    return overrideInLanguage ? workspaceLanguageValue : workspaceValue;
                } else {
                    return overrideInLanguage ? workspaceFolderLanguageValue : workspaceFolderValue;
                }
            })();
            await configuration.update(partialName, value, target, overrideInLanguage);
            this.configurationRestorers.push(async () => {
                await workspace.getConfiguration('leaper', editor.document)
                               .update(partialName, prevValue, target, overrideInLanguage);
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
        this.assertPairsFailMsg   = value ? '(Prelude Failure) Pairs Mismatch'   : 'Pairs Mismatch';
        this.assertCursorsFailMsg = value ? '(Prelude Failure) Cursors Mismatch' : 'Cursors Mismatch';
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
 * Get a handle to the extension.
 */
function getHandle(): TestAPI {
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
function getActiveEditor(): TextEditor {
    if (!window.activeTextEditor) {
        throw new Error('Unable to obtain active text editor!');
    }
    return window.activeTextEditor;
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

    /**
     * Text which will be typed into the document, codepoint by codepoint.
     */
    text: string;
}

interface EditTextArgs extends RepetitionDelayOptions {

    /**
     * Edits to apply simultaneously.
     */
    edits: ReadonlyArray<ReplaceTextEdit | InsertTextEdit | DeleteTextEdit>;
}

interface ReplaceTextEdit {

    /** 
     * Replace a range of text in the active text document. 
     */
    kind: 'replace';

    /**
     * Range of text to replace.
     */
    replace: CompactRange;

    /**
     * Text to insert in place of the replaced range.
     */
    insert: string;
}

interface InsertTextEdit {

    /** 
     * Insert text at a position in the active text document.
     */
    kind: 'insert';

    /**
     * Position to insert `text` at.
     */
    position: CompactPosition;

    /**
     * Text to insert at that position.
     */
    text: string;
}

interface DeleteTextEdit {

    /**
     * Delete a range of text in the active text document.
     */
    kind: 'delete';

    /**
     * Range of text to delete.
     */
    range: CompactRange;
}

interface MoveCursorsArgs extends RepetitionDelayOptions {

    /**
     * Direction to move the cursors in.
     */
    direction: 'up' | 'down' | 'left' | 'right';
}

interface SetCursorsArgs extends RepetitionDelayOptions {

    /**
     * Set all the cursors in the active text editor to this.
     */
    cursors: CompactCursors;
}

interface InsertSnippetArgs extends RepetitionDelayOptions {

    /**
     * Insert this snippet into the active text editor.
     * 
     * The snippet will be inserted at the cursors.
     */
    snippet: SnippetString;
}
