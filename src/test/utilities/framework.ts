//! The following module defines the test framework for this extension.

import * as assert from 'assert';
import * as path from 'path';
import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextDocumentShowOptions, TextEditor, workspace, window, ViewColumn, Uri, ConfigurationTarget } from 'vscode';
import { ResolvedViewColumn, TrackerSnapshot } from '../../engine/test-api';
import { CompactCluster, CompactRange, CompactPosition, CompactCursor, CompactSelection } from './compact';
import { waitFor, zip } from './other';
import { testHandle } from '../../extension';

/**
 * A collection of `TestGroup`s.
 */
export class TestCategory {

    public constructor(
        private readonly name: string,
        private readonly testGroups: ReadonlyArray<TestGroup>
    ) {}

    public run(): void {
        const testGroups = this.testGroups;
        describe(this.name, function () {
            testGroups.forEach((group) => group.run());
        });
    }
    
}

/**
 * A collection of `TestCase`s.
 */
export class TestGroup {
    
    public constructor(
        private readonly name: string,
        private readonly testCases: ReadonlyArray<TestCase>
    ) {}

    public run(): void {
        const testCases = this.testCases;
        describe(this.name, function () {
            testCases.forEach((testCase) => testCase.run());
        });
    }

}

/**
 * Represents a task to be executed in order to verify a behavior of this extension.
 */
export class TestCase {

    public constructor(private readonly args: {

        readonly name: string,

        /*
         * Setup to perform before executing the test.
         */
        readonly prelude?: (executor: Executor) => Promise<void>,

        /** 
         * The test to run.
         * 
         * The `executor` parameter provides the necessary facilities for test execution.
         */
        readonly task: (executor: Executor) => Promise<void>

    }) {}

    public run(): void {
        const { name, prelude, task } = this.args;
        it(name, async function () {

            // To allow test cases to modify and check the state of the running vscode instance.
            const executor = new ExecutorFull();

            try {
                
                // Perform setup for the test.
                if (prelude) {
                    executor.inPrelude = true;
                    await prelude(executor);
                    executor.inPrelude = false;
                }
    
                // Run the actual test.            
                await task(executor);

            } finally {

                // Cleanup after the test.
                await executor.dispose();
            }

        });
    }

}

/**
 * A convenience class that allows a test case to:
 * 
 *  1. Call commands.
 *  2. Modify the state of visible text editors.
 *  3. Assert the state of the engine.
 *  4. Temporarily change configuration values of the test workspace and the folders within it.
 *  5. Open documents in the test workspace.
 */
export type Executor = Omit<ExecutorFull, 'inPrelude' | 'dispose'>;

/**
 * The full `Executor` class that has some methods and properties that are only exposed to this 
 * module.
 */
class ExecutorFull {

    /**
     * Callbacks to restore configurations when this executor is cleaned up.
     * 
     * The callbacks of this array must be executed in reverse order.
     */
    private configurationRestorers: (() => Promise<void>)[];

    /**
     * Whether or not the executor is executing commands as part of a prelude.
     */
    public inPrelude: boolean;

    public constructor() {
        this.configurationRestorers = [];
        this.inPrelude = false;
    }

    /**
     * Perform deep strict equality comparison between two objects. 
     * 
     * If the `inPrelude` flag of this executor is `true`, then on assertion failure, the message
     * shown will have a header denoting that the assertion failed in a test prelude.
     */
    private assertEq(actual: any, expect: any, message: string): void {
        const _message = this.inPrelude ? `(Prelude Failure) ${message}` : message;
        assert.deepStrictEqual(actual, expect, _message);
    }

    /**
     * Assert the position of pairs being tracked for a visible text editor.
     */
    public async assertPairs(
        expect: CompactCluster[],
        options?: ViewColumnOption & {

            /**
             * Determines whether decorations are checked:
             * 
             *  - `'all'` asserts that all pairs are decorated.
             *  - `'nearest'` asserts that only the pairs nearest to each cursor are decorated.
             *  - `undefined` means no decoration checks are performed.
             * 
             * This option defaults to `undefined`
             * 
             * Note that this option only relates to checking for the presence of decorations (i.e. 
             * checking whether decorations are applied or not). We do not check for the style of 
             * the decoration.
             */
            expectDecorations?: 'all' | 'nearest' | undefined;
        }
    ): Promise<void> {
        
        // Print friendly representation of a pair.
        type Pretty = { open: CompactPosition, close: CompactPosition, isDecorated: boolean };

        // Print friendly representation of a pair without a decoration flag.
        type PrettyPartial = Omit<Pretty, "isDecorated">;

        function stripDecorationFlag(pairs: Pretty[][]): PrettyPartial[][] {
            return pairs.map(cluster => cluster.map(({ open, close }) => ({ open, close })));
        }

        // Query the state of the engine.
        const snapshot = await getSnapshot(options);

        // Convert the actual and expected pairs to a print friendly form before asserting them.
        const actual: Pretty[][] = snapshot.pairs.map((cluster) => 
            cluster.map((pair) => {
                const open:  CompactPosition = [pair.open.line,  pair.open.character];
                const close: CompactPosition = [pair.close.line, pair.close.character];
                const isDecorated = pair.isDecorated;
                return { open, close, isDecorated };
            })
        );
        const _expect: Pretty[][] = expect.map((cluster) => {
            if (cluster === 'None') {
                return [];
            }
            const line    = cluster.line;
            const openers = cluster.sides.slice(0, cluster.sides.length / 2);
            const closers = cluster.sides.slice(cluster.sides.length / 2).reverse();
            return [...zip(openers, closers)].map(([opener, closer]) => (
                { open: [line, opener], close: [line, closer], isDecorated: false }
            ));
        });

        const expectDecorations = options?.expectDecorations;
        const message           = 'Pairs Mismatch';
        if (expectDecorations === 'all') {
            _expect.flat().forEach(pair => pair.isDecorated = true);
            this.assertEq(actual, _expect, message);
        } else if (expectDecorations === 'nearest') {
            _expect.filter(cluster => cluster.length > 0)
                   .map(cluster => cluster[cluster.length - 1])
                   .forEach(nearestPair => nearestPair.isDecorated = true);
            this.assertEq(actual, _expect, message);
        } else {
            this.assertEq(stripDecorationFlag(actual), stripDecorationFlag(_expect), message);
        }
    }

    /**
     * Assert the state of the cursors of a visible text editor.
     */
    public async assertCursors(
        expect:   CompactCursor[],
        options?: RepetitionOption & ViewColumnOption
    ): Promise<void> {
        const editor = await getVisibleTextEditor(options);

        // Convert the actual and expected cursors to a print friendly form before asserting them.
        const actual: CompactSelection[] = editor.selections.map((cursor) => (
            { 
                anchor: [cursor.anchor.line, cursor.anchor.character], 
                active: [cursor.active.line, cursor.active.character]
            }
        ));
        const _expect: CompactSelection[] = expect.map((cursor) => 
            Array.isArray(cursor) ? { anchor: cursor, active: cursor } : cursor
        );

        this.assertEq(actual, _expect, 'Cursors Mismatch');
    }

    /**
     * Assert the most recently broadcasted value of `leaper.inLeaperMode` keybinding context.
     */
    public async assertMRBInLeaperModeContext(expect: boolean): Promise<void> {
        const message = 'Most Recently Broadcasted `leaper.inLeaperMode` Context Mismatch';
        this.assertEq(await getMRBInLeaperModeContext(), expect, message);
    }

    /**
     * Assert the most recently broadcasted value of `leaper.hasLineOfSight` keybinding context.
     */
    public async assertMRBHasLineOfSightContext(expect: boolean): Promise<void> {
        const message = 'Most Recently Broadcasted `leaper.hasLineOfSight` Context Mismatch';
        this.assertEq(await getMRBHasLineOfSightContext(), expect, message);
    }

    /**
     * Type text into the active text editor, codepoint by codepoint.
     */
    public async typeText(text: string, options?: RepetitionOption): Promise<void> {
        return executeWithRepetition(async () => {
            for (const char of text) {
                await commands.executeCommand('default:type', { text: char });
            }
        }, options);
    }

    /**
     * Apply text edits to a visible text editor.
     *   
     * All the edits will be done in parallel.
     */
    public async editText(
        edits: ReadonlyArray<
            {
                /** Replace a range of text. */
                kind:  'replace'; range: CompactRange; with: string;
            } | 
            {
                /** Insert text at a position. */
                kind: 'insert'; at: CompactPosition; text: string;
            } |
            {
                /** Delete a range of text. */
                kind: 'delete'; range: CompactRange;
            }
        >,
        options?: RepetitionOption & ViewColumnOption
    ): Promise<void> {
        await executeWithRepetition(async () => {
            const editor = await getVisibleTextEditor(options);
            await editor.edit((builder: TextEditorEdit) => {
                for (const edit of edits) {
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
            });
        }, options);
    }

    /** 
     * Perform a backspace for each cursor in the active text editor.
     */
    public async backspace(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('deleteLeft', options);
    }

    /**
     * Backspace a word for each cursor in the active text editor.
     */
    public async backspaceWord(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('deleteWordLeft', options);
    }

    /**
     * Delete a character to the right of each cursor in the active text editor.
     */
    public async deleteRight(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('deleteRight', options);
    }

    /**
     * Delete all text in a visible text editor.
     */
    public async deleteAll(options?: RepetitionOption & ViewColumnOption): Promise<void> {
        await executeWithRepetition(async () => {
            const editor   = await getVisibleTextEditor(options);
            const document = editor.document;
            const startPos = new Position(0, 0);
            const endPos   = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
            const docRange = new Range(startPos, endPos);
            await editor.edit(builder => builder.delete(docRange));
        }, options); 
    }

    /**
     * Move each cursor in the active text editor.
     */
    public async moveCursors(
        where:    'left' | 'right' | 'up' | 'down' | 'home' | 'end',
        options?: RepetitionOption
    ): Promise<void> {
        const commandId = (() => {
            switch (where) {
                case 'left':  return 'cursorLeft';
                case 'right': return 'cursorRight';
                case 'up':    return 'cursorUp';
                case 'down':  return 'cursorDown';
                case 'home':  return 'cursorHome';
                case 'end':   return 'cursorEnd';
            }
        })();
        await executeCommandWithRepetition(commandId, options);
    }

    /**
     * Set the cursors in a visible text editor to specific positions.
     */
    public async setCursors(
        to:       CompactCursor[],
        options?: RepetitionOption & ViewColumnOption
    ): Promise<void> {
        await executeWithRepetition(async () => {
            const editor = await getVisibleTextEditor(options);
            editor.selections = to.map((cursor) => {
                const anchorLine = Array.isArray(cursor) ? cursor[0] : cursor.anchor[0];
                const anchorChar = Array.isArray(cursor) ? cursor[1] : cursor.anchor[1];
                const activeLine = Array.isArray(cursor) ? cursor[0] : cursor.active[0];
                const activeChar = Array.isArray(cursor) ? cursor[1] : cursor.active[1];
                return new Selection(anchorLine, anchorChar, activeLine, activeChar);
            });
        }, options);
    }

    /**
     * Call the 'Leap' command.
     */
    public async leap(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('leaper.leap', options);
    }

    /**
     * Call the 'Escape Leaper Mode' command.
     */
    public async escapeLeaperMode(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('leaper.escapeLeaperMode', options);
    }

    /**
     * Insert a snippet into a visible text editor.
     */
    public async insertSnippet(
        snippet: SnippetString,
        options?: RepetitionOption & ViewColumnOption & {

            /**
             * Where to insert the snippet.
             * 
             * Defaults to the target text editor's cursor(s).
             */
            at?: CompactPosition | CompactRange;
        }
    ): Promise<void> {
        await executeWithRepetition(async () => { 
            const at = options?.at;
            let location: Position | Range | undefined = undefined;
            if (Array.isArray(at)) {
                location = new Position(at[0], at[1]);
            } else if (typeof at === 'object') {
                location = new Range(at.start[0], at.start[1], at.end[0], at.end[1]);
            }
            const editor = await getVisibleTextEditor(options);
            await editor.insertSnippet(snippet, location);
        }, options);
    }

    /**
     * Jump to a snippet tabstop in the active text editor. 
     */
    public async jumpToTabstop(
        which:    'next' | 'prev', 
        options?: RepetitionOption
    ): Promise<void> {
        const commandId = (() => {
            switch (which) {
                case 'next': return 'jumpToNextSnippetPlaceholder';
                case 'prev': return 'jumpToPrevSnippetPlaceholder';
            }
        })();
        await executeCommandWithRepetition(commandId, options);
    }

    /**
     * Trigger an autocomplete suggestion in the active text editor then accept the first suggestion.
     */
    public async triggerAndAcceptSuggestion(options?: RepetitionOption): Promise<void> {
        await executeWithRepetition(async () => {
            await commands.executeCommand('editor.action.triggerSuggest');
            await waitFor(100);    // Wait for the suggestion box to appear.
            await commands.executeCommand('acceptSelectedSuggestion');
        }, options);
    }

    /**
     * Perform an undo in the active text editor.
     */
    public async undo(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('undo', options);
    }

    /**
     * Switch to another text editor in the active editor tab group.
     */
    public async switchToEditorInGroup(
        which:   'next' | 'prev', 
        options?: RepetitionOption
    ): Promise<void> {
        const commandId = (() => {
            switch (which) {
                case 'next': return 'workbench.action.nextEditorInGroup';
                case 'prev': return 'workbench.action.previousEditorInGroup';
            }
        })();
        await executeCommandWithRepetition(commandId, options);
    }

    /**
     * Move the active text editor to another editor tab group.
     */
    public async moveEditorToGroup(
        which:    'left' | 'right', 
        options?: RepetitionOption
    ): Promise<void> {
        const commandId = (() => {
            switch (which) {
                case 'left':  return 'workbench.action.moveEditorToLeftGroup';
                case 'right': return 'workbench.action.moveEditorToRightGroup';
            }
        })();
        await executeCommandWithRepetition(commandId, options);
    }

    /**
     * Focus on the explorer side bar.
     */
    public async focusExplorerSideBar(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('workbench.view.explorer', options);
    }

    /**
     * Focus on an editor tab group.
     */
    public async focusEditorGroup(
        which:    'left' | 'right' | 'first' | 'second' | 'third' | 'fourth',
        options?: RepetitionOption
    ): Promise<void> {
        const commandId = (() => {
            switch (which) {
                case 'left':   return 'workbench.action.focusLeftGroup';
                case 'right':  return 'workbench.action.focusRightGroup';
                case 'first':  return 'workbench.action.focusFirstEditorGroup';
                case 'second': return 'workbench.action.focusSecondEditorGroup';
                case 'third':  return 'workbench.action.focusThirdEditorGroup';
                case 'fourth': return 'workbench.action.focusFourthEditorGroup';
            }
        })();
        await executeCommandWithRepetition(commandId, options);
    }

    /**
     * Open a file within the test workspace.
     * 
     * Each file is within a workspace folder, and has different preconfigured configuration values 
     * that override the root workspace's values. Below is a table of the relevant configuration 
     * values for each available file:
     * 
     * ```      
     * -------------------------------------------------------------------------------------------------            
     * Workspace Folder               | 0          | 1          | 2          | 3          | 4          |
     * File                           | text.ts    | text.txt   | text.ts    | text.md    | text.ts    |
     * -------------------------------------------------------------------------------------------------
     * Language                       | Typescript | Plaintext  | Typescript | Markdown   | Typescript |
     * Autoclosing Pairs              | (A1)       | (A3)       | (A1)       | (A2)       | (A1)       |
     *                                |            |            |            |            |            |
     * leaper.decorateAll Value       |            |            |            |            |            |
     *   - Workspace                  | false      | false      | false      | false      | false      |
     *   - Workspace Folder           | undefined  | undefined  | undefined  | undefined  | true       |
     *   - Language Workspace         | undefined  | undefined  | undefined  | undefined  | undefined  | 
     *   - Language Workspace Folder  | undefined  | undefined  | undefined  | undefined  | undefined  | 
     *   - Effective                  | false      | false      | false      | false      | true       | 
     *                                |            |            |            |            |            |
     * leaper.detectedPairs Value     |            |            |            |            |            |
     *   - Workspace                  | (P1)       | (P1)       | (P1)       | (P1)       | (P1)       | 
     *   - Workspace Folder           | undefined  | undefined  | [ "()" ]   | []         | undefined  | 
     *   - Language Workspace         | undefined  | []         | undefined  | undefined  | undefined  | 
     *   - Language Workspace Folder  | undefined  | undefined  | undefined  | (P2)       | undefined  | 
     *   - Effective                  | (P1)       | []         | [ "()" ]   | (P2)       | (P1)       | 
     * -------------------------------------------------------------------------------------------------
     * 
     * (A1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
     * *(A2): [ "()", "[]", "{}", "<>" ]
     * (A3): [ "()", "[]", "{}" ]
     * (P1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
     * (P2): [ "{}", "<>" ]
     * 
     * *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
     * consistently autoclosed.
     * ```
     */
    public async openFile(
        file: './workspace-0/text.ts'
            | './workspace-1/text.txt'
            | './workspace-2/text.ts'
            | './workspace-3/text.md'
            | './workspace-4/text.ts', 
        options?: RepetitionOption & Pick<TextDocumentShowOptions, 'viewColumn' | 'preserveFocus'>
    ): Promise<void> {
        await executeWithRepetition(async () => {
            const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
            const filePath = path.join(rootPath, file);
            const document = await workspace.openTextDocument(filePath);
            await window.showTextDocument(document, options);
        }, options);
    }

    /**
     * Close the active text editor.
     */
    public async closeActiveEditor(options?: RepetitionOption): Promise<void> {
        await executeCommandWithRepetition('workbench.action.closeActiveEditor', options);
    }

    /**
     * Set a configuration value, scoped to either the root of the test workspace or a workspace 
     * folder within it.
     * 
     * @param partialName The name of the configuration after the `leaper.` prefix.
     * @param value Value to set the configuration to.
     * @param targetWorkspaceFolder The name of the workspace folder to set the configuration in. If
     *                              not specified, will set the configuration in the root workspace.
     * @param targetLanguage The language to scope the configuration to. If not specified, will not 
     *                       scope to any language.
     */
    public async setConfiguration<T>(
        args: {
            partialName:            'decorateAll' | 'decorationOptions' | 'detectedPairs', 
            value:                  T | undefined,
            targetWorkspaceFolder?: 'workspace-0' | 'workspace-1' | 'workspace-2' | 'workspace-3' | 'workspace-4',
            targetLanguage?:        'typescript' | 'markdown' | 'plaintext'
        },
        options?: RepetitionOption
    ): Promise<void> {
        const { partialName, value, targetWorkspaceFolder, targetLanguage } = args;

        let workspaceUri: Uri | undefined;
        if (targetWorkspaceFolder) {
            workspaceUri = workspace.workspaceFolders?.find(folder => folder.name === targetWorkspaceFolder)?.uri;
        } else {
            workspaceUri = workspace.workspaceFile;
        }
        if (!workspaceUri) {
            throw new Error('Unable to obtain workspace uri!');
        }

        // Tag the workspace uri with the language identifier if one was specified.
        const fullUri = targetLanguage ? { uri: workspaceUri, languageId: targetLanguage } : workspaceUri;

        // Whether we set the configuration at the workspace folder level or the workspace level.
        const targetScope = targetWorkspaceFolder ? ConfigurationTarget.WorkspaceFolder 
                                                  : ConfigurationTarget.Workspace;

        await executeWithRepetition(async () => {

            // The object that allows us to get and set the configuration value.
            const configuration = workspace.getConfiguration('leaper', fullUri);

            // Save the previous value so that we can restore it later.
            let prevValue: any;
            const inspect = configuration.inspect(partialName);
            if (targetWorkspaceFolder && targetLanguage) {
                prevValue = inspect?.workspaceFolderLanguageValue;
            } else if (targetWorkspaceFolder && !targetLanguage) {
                prevValue = inspect?.workspaceFolderValue;
            } else if (!targetWorkspaceFolder && targetLanguage) {
                prevValue = inspect?.workspaceLanguageValue;
            } else {
                prevValue = inspect?.workspaceValue;
            }

            // Set the configuration value.
            await configuration.update(partialName, value, targetScope, !!targetLanguage);

            // Store the callback that allows the configuration change we just did to be reverted.
            this.configurationRestorers.push(async () => {
                const configuration = workspace.getConfiguration('leaper', fullUri);
                await configuration.update(partialName, prevValue, targetScope, !!targetLanguage);
            });
        }, options);
    }

    /**
     * Perform cleanup by closing all opened text editors and restoring all configurations to their 
     * original values.
     */
    public async dispose(): Promise<void> {
        for (const restorer of this.configurationRestorers.reverse()) {
            await restorer();
        }

        // Undo all changes in all the opened text editors. 
        //
        // This step is required because vscode only discards unsaved changes when the test instance 
        // is closed, and not when the tab containing the unsaved changes is closed. That means if 
        // we are retrying tests (or if we have multiple tests that open the same text file), we 
        // could be opening text documents with unsaved changes in them, which will mess up the test 
        // as the starting state of the text document is different for each test. By undoing all 
        // changes before closing them, we prevent such a thing from happening.
        //
        // Note that we only need to perform this step for titled documents, since untitled ones 
        // immediately discard their unsaved changes on close. Furthermore, we cannot wait on 
        // `isDirty` of untitled documents since they are always considered dirty even though there
        // is no text content in them.
        for (const document of workspace.textDocuments) {
            if (!document.isUntitled) {
                await window.showTextDocument(document);
                while (document.isDirty) {
                    await commands.executeCommand('undo');
                }
            }
        }

        await commands.executeCommand('workbench.action.closeAllEditors');
    }

}

/**
 * Delay to apply before quering the state of vscode or the engine.
 * 
 * Sometimes it takes a while after a change in text editors or a change in focus before vscode 
 * acknowledges the change. Thus, we require some delay before getting a visible text editor. 
 * 
 * Furthermore, the engine of this extension is also driven asynchronously, meaning that it can take
 * a while before changes in the state of the running vscode instance are acknowledged by the engine.
 * Thus, we require some delay before querying the engine.
 */
const QUERY_DELAY_MS = 50;

function resolveViewColumnOption(
    viewColumnOption: ViewColumnOption | undefined
): ResolvedViewColumn {
    const viewColumn = viewColumnOption?.viewColumn ?? ViewColumn.Active;
    if (viewColumn === ViewColumn.Active) {
        if (!window.activeTextEditor|| window.activeTextEditor.viewColumn === undefined) {
            throw new Error('Unable to resolve `ViewColumn.Active`!');
        }

        // vscode only stores resolved view column numbers, so this cast is safe.
        return window.activeTextEditor.viewColumn as ResolvedViewColumn;
    } else {
        return viewColumn;
    }
}

/**
 * Get a snapshot of all the pairs being tracked for a visible text editor.
 */
async function getSnapshot(
    viewColumnOption: ViewColumnOption | undefined
): Promise<TrackerSnapshot> {
    if (!testHandle) {
        throw new Error('Unable to access the running engine instance!');
    }
    await waitFor(QUERY_DELAY_MS);
    const viewColumn = resolveViewColumnOption(viewColumnOption);
    const snapshot   = testHandle.snapshot().get(viewColumn);
    if (!snapshot) {
        throw new Error(`Unable to obtain snapshot of text editor in view column ${viewColumn}.`);
    }
    return snapshot;
}

/**
 * Get the most recently broadcasted value of the `leaper.inLeaperMode` keybinding context.
 */
async function getMRBInLeaperModeContext(): Promise<boolean | undefined> {
    if (!testHandle) {
        throw new Error('Unable to access the running engine instance!');
    }
    await waitFor(QUERY_DELAY_MS);
    return testHandle.MRBInLeaperModeContext;
}

/**
 * Get the most recently broadcasted value of the `leaper.hasLineOfSight` keybinding context.
 */
async function getMRBHasLineOfSightContext(): Promise<boolean | undefined> {
    if (!testHandle) {
        throw new Error('Unable to access the running engine instance!');
    }
    await waitFor(QUERY_DELAY_MS);
    return testHandle.MRBHasLineOfSightContext;
}

/**
 * Get a reference to a visible text editor.
 */
async function getVisibleTextEditor(
    viewColumnOption: ViewColumnOption | undefined
): Promise<TextEditor> {
    await waitFor(QUERY_DELAY_MS);
    const viewColumn = resolveViewColumnOption(viewColumnOption);
    const editor     = window.visibleTextEditors.find(editor => editor.viewColumn === viewColumn);
    if (!editor) {
        throw new Error(`Unable to obtain text editor in view column ${viewColumn}.`);
    }
    return editor;
}

/**
 * Execute a callback `options.repetitions` amount of times.
 */
async function executeWithRepetition(
    callback: () => Promise<any>, 
    options:  RepetitionOption | undefined
): Promise<void> {
    const DEFAULT_REPETITIONS = 1;
    let repetitions = options?.repetitions ?? DEFAULT_REPETITIONS;
    while (repetitions-- > 0) {
        await callback();
    }
}

/**
 * Execute a command `options.repetitions` amount of times.
 */
async function executeCommandWithRepetition(
    commandId: string,
    options:   RepetitionOption | undefined
): Promise<void> {
    return executeWithRepetition(async () => await commands.executeCommand(commandId), options);
}

interface ViewColumnOption {

    /**
     * The view column of the visible text editor to perform the check or action in.
     * 
     * Defaults to `ViewColumn.Active`.
     */
    viewColumn?: ViewColumn.Active | ViewColumn.One | ViewColumn.Two | ViewColumn.Three | ViewColumn.Four;
    
}

interface RepetitionOption {

    /** 
     * How many times to execute this action. 
     * 
     * Defaults to `1`. 
     */
    repetitions?: number;

}
