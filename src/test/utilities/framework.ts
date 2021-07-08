//! The following module defines the test framework for this extension.

import * as assert from 'assert';
import * as path from 'path';
import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextDocumentShowOptions, TextEditor, workspace, window, ViewColumn, Uri, ConfigurationTarget, WorkspaceEdit } from 'vscode';
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

            before(async function () {

                // If the previous test run did not terminate properly, then during the next test 
                // run, vscode might restore the previous run's view state. That might cause tests
                // to fail since the initial view state is unpredictable. We solve that issue by 
                // closing all text editors the moment the test instance opens.
                await commands.executeCommand('workbench.action.closeAllEditors');

                // Make sure side bar is closed so that it does not take up space.
                await commands.executeCommand('workbench.action.closeSidebar');
            });

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
            const executor = new ExecutorFull();
            try {
                if (prelude) {
                    executor.inPrelude = true;
                    await prelude(executor);
                    executor.inPrelude = false;
                }
                await task(executor);
            } finally {
                await executor.cleanup();
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
export type Executor = Omit<ExecutorFull, 'inPrelude' | 'cleanup'>;

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
    private configurationRestorers: (() => Promise<void>)[] = [];

    /**
     * Whether any delay should be applied before the next query of the state of vscode or the engine.
     */
    private queryDelayRequired: boolean = true;

    /**
     * Delay to apply before querying the state of vscode or the engine.
     * 
     * This delay exists because it may take a while for changes in the state of the running vscode 
     * instance to be reflected through the vscode API. For instance, suppose we change focus to 
     * another text editor. The `window.activeTextEditor` pointer does not update instantaneously, 
     * meaning that if we immediately query that pointer after changing focus, it will still point 
     * to the previous active text editor. So we need a small delay before any queries to ensure that
     * the API has "caught up". Similarly, this extension's engine also requires some time to reflect 
     * changes since it receives information asynchronously.
     */
    private static readonly QUERY_DELAY_MS = 70;

    /**
     * Delay to apply after each repetition of a command.
     * 
     * We need a small amount of delay after calling each command, otherwise, in the case of many
     * command calls in a short span of time, vscode might omit a few of them.
     */
    private static readonly REPETITION_DELAY_MS = 15;

    /**
     * Whether or not the executor is executing commands as part of a prelude.
     */
    public inPrelude: boolean = false;

    /**
     * Execute a command `options.repetitions` amount of times.
     */
    private async execute(commandId: string, options: RepetitionOption | undefined): Promise<void> {
        let repetitions = options?.repetitions ?? 1;
        while (repetitions-- > 0) {
            await commands.executeCommand(commandId);
        
            // We need some delay after each command call because calling commands too rapidly may
            // cause vscode to ignore some of them.
            await waitFor(ExecutorFull.REPETITION_DELAY_MS);
        }

        // It may take a while for vscode or the engine to acknowledge the commands we just called. 
        // Thus, we need some delay before the next query, otherwise there is a risk of the next 
        // query reading the state of vscode or the engine too soon.
        this.queryDelayRequired = true;
    }

    /**
     * Execute a command once.
     */
    private async executeOnce(commandId: string): Promise<void> {
        await this.execute(commandId, { repetitions: 1 });
    }

    /**
     * Get a snapshot of all the pairs being tracked for a visible text editor.
     */
    private async getSnapshot(
        viewColumnOption: ViewColumnOption | undefined
    ): Promise<TrackerSnapshot> {
        if (!testHandle) {
            throw new Error('Unable to access the running engine instance!');
        }
        if (this.queryDelayRequired) {
            await waitFor(ExecutorFull.QUERY_DELAY_MS);
            this.queryDelayRequired = false;
        }
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
    private async getMRBInLeaperModeContext(): Promise<boolean | undefined> {
        if (!testHandle) {
            throw new Error('Unable to access the running engine instance!');
        }
        if (this.queryDelayRequired) {
            await waitFor(ExecutorFull.QUERY_DELAY_MS);
            this.queryDelayRequired = false;
        }
        return testHandle.MRBInLeaperModeContext;
    }

    /**
     * Get the most recently broadcasted value of the `leaper.hasLineOfSight` keybinding context.
     */
    private async getMRBHasLineOfSightContext(): Promise<boolean | undefined> {
        if (!testHandle) {
            throw new Error('Unable to access the running engine instance!');
        }
        if (this.queryDelayRequired) {
            await waitFor(ExecutorFull.QUERY_DELAY_MS);
            this.queryDelayRequired = false;
        }
        return testHandle.MRBHasLineOfSightContext;
    }

    /**
     * Get a reference to a visible text editor.
     */
    private async getVisibleTextEditor(
        viewColumnOption: ViewColumnOption | undefined
    ): Promise<TextEditor> {
        if (this.queryDelayRequired) {
            await waitFor(ExecutorFull.QUERY_DELAY_MS);
            this.queryDelayRequired = false;
        }
        const viewColumn = resolveViewColumnOption(viewColumnOption);
        const editor     = window.visibleTextEditors.find(editor => editor.viewColumn === viewColumn);
        if (!editor) {
            throw new Error(`Unable to obtain text editor in view column ${viewColumn}.`);
        }
        return editor;
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
        const snapshot = await this.getSnapshot(options);

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
        const editor = await this.getVisibleTextEditor(options);

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
        this.assertEq(await this.getMRBInLeaperModeContext(), expect, message);
    }

    /**
     * Assert the most recently broadcasted value of `leaper.hasLineOfSight` keybinding context.
     */
    public async assertMRBHasLineOfSightContext(expect: boolean): Promise<void> {
        const message = 'Most Recently Broadcasted `leaper.hasLineOfSight` Context Mismatch';
        this.assertEq(await this.getMRBHasLineOfSightContext(), expect, message);
    }

    /** 
     * Perform a backspace for each cursor in the active text editor.
     */
    public async backspace(options?: RepetitionOption): Promise<void> {
        await this.execute('deleteLeft', options);
    }

    /**
     * Backspace a word for each cursor in the active text editor.
     */
    public async backspaceWord(options?: RepetitionOption): Promise<void> {
        await this.execute('deleteWordLeft', options);
    }

    /**
     * Delete a character to the right of each cursor in the active text editor.
     */
    public async deleteRight(options?: RepetitionOption): Promise<void> {
        await this.execute('deleteRight', options);
    }

    /**
     * Move each cursor in the active text editor.
     */
    public async moveCursors(
        where:    'left' | 'right' | 'up' | 'down' | 'home' | 'end',
        options?: RepetitionOption
    ): Promise<void> {
        switch (where) {
            case 'left':  return this.execute('cursorLeft',  options);
            case 'right': return this.execute('cursorRight', options);
            case 'up':    return this.execute('cursorUp',    options);
            case 'down':  return this.execute('cursorDown',  options);
            case 'home':  return this.execute('cursorHome',  options);
            case 'end':   return this.execute('cursorEnd',   options);
        }
    }

    /**
     * Call the 'Leap' command.
     */
    public async leap(options?: RepetitionOption): Promise<void> {
        await this.execute('leaper.leap', options);
    }

    /**
     * Call the 'Escape Leaper Mode' command.
     */
    public async escapeLeaperMode(options?: RepetitionOption): Promise<void> {
        await this.execute('leaper.escapeLeaperMode', options);
    }

    /**
     * Jump to a snippet tabstop in the active text editor. 
     */
    public async jumpToTabstop(which: 'next' | 'prev', options?: RepetitionOption): Promise<void> {
        switch (which) {
            case 'next': return this.execute('jumpToNextSnippetPlaceholder', options);
            case 'prev': return this.execute('jumpToPrevSnippetPlaceholder', options);
        }
    }

    /**
     * Trigger an autocomplete suggestion in the active text editor then accept the first suggestion.
     */
    public async triggerAndAcceptSuggestion(): Promise<void> {
        await this.executeOnce('editor.action.triggerSuggest');
        await waitFor(100);    // Wait for the suggestion box to appear.
        await this.executeOnce('acceptSelectedSuggestion');
    }

    /**
     * Perform an undo in the active text editor.
     */
    public async undo(options?: RepetitionOption): Promise<void> {
        await this.execute('undo', options);
    }

    /**
     * Switch to another text editor in the in-focus editor tab group.
     */
    public async switchToEditorInGroup(which: 'next' | 'prev', options?: RepetitionOption): Promise<void> {
        switch (which) {
            case 'next': return this.execute('workbench.action.nextEditorInGroup', options);
            case 'prev': return this.execute('workbench.action.previousEditorInGroup', options);
        }
    }

    /**
     * Move the active text editor to another editor tab group.
     */
    public async moveEditorToGroup(which: 'left' | 'right', options?: RepetitionOption): Promise<void> {
        switch (which) {
            case 'left':  return this.execute('workbench.action.moveEditorToLeftGroup', options);
            case 'right': return this.execute('workbench.action.moveEditorToRightGroup', options);
        }
    }

    /**
     * Focus on the explorer side bar.
     */
    public async focusExplorerSideBar(): Promise<void> {
        await this.executeOnce('workbench.view.explorer');
    }

    /**
     * Focus on an editor tab group.
     */
    public async focusEditorGroup(
        which: 'left' | 'right' | 'first' | 'second' | 'third' | 'fourth',
    ): Promise<void> {
        switch (which) {
            case 'left':   return this.executeOnce('workbench.action.focusLeftGroup');
            case 'right':  return this.executeOnce('workbench.action.focusRightGroup');
            case 'first':  return this.executeOnce('workbench.action.focusFirstEditorGroup');
            case 'second': return this.executeOnce('workbench.action.focusSecondEditorGroup');
            case 'third':  return this.executeOnce('workbench.action.focusThirdEditorGroup');
            case 'fourth': return this.executeOnce('workbench.action.focusFourthEditorGroup');
        }
    }

    /**
     * Close the side bar.
     */
    public async closeSideBar(): Promise<void> {
        await this.executeOnce('workbench.action.closeSidebar');
    }

    /**
     * Close the active text editor.
     */
    public async closeActiveEditor(options?: RepetitionOption): Promise<void> {
        await this.execute('workbench.action.closeActiveEditor', options);
    }

    /**
     * Type text into the active text editor, codepoint by codepoint.
     */
    public async typeText(text: string, options?: RepetitionOption): Promise<void> {
        const repetitions = options?.repetitions ?? 1;
        for (let _ = 0; _ < repetitions; ++_) {
            for (const char of text) {

                // Don't need delay after 'default:type' command calls, as vscode never omits any
                // of them even in the case of rapid calls.
                await commands.executeCommand('default:type', { text: char });
            }
        }
        this.queryDelayRequired = true;
    }

    /**
     * Delete all text in a visible text editor.
     */
    public async deleteAll(options?: ViewColumnOption): Promise<void> {
        const editor   = await this.getVisibleTextEditor(options);
        const document = editor.document;
        const startPos = new Position(0, 0);
        const endPos   = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
        const docRange = new Range(startPos, endPos);
        await editor.edit(builder => builder.delete(docRange));
        this.queryDelayRequired = true;
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
        options?: ViewColumnOption
    ): Promise<void> {
        const editor = await this.getVisibleTextEditor(options);
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
        this.queryDelayRequired = true;
    }

    /**
     * Insert a snippet into a visible text editor.
     */
    public async insertSnippet(
        snippet: SnippetString,
        options?: ViewColumnOption & {

            /**
             * Where to insert the snippet.
             * 
             * Defaults to the target text editor's cursor(s).
             */
            at?: CompactPosition | CompactRange;
        }
    ): Promise<void> {
        const at = options?.at;
        let location: Position | Range | undefined = undefined;
        if (Array.isArray(at)) {
            location = new Position(at[0], at[1]);
        } else if (typeof at === 'object') {
            location = new Range(at.start[0], at.start[1], at.end[0], at.end[1]);
        }
        const editor = await this.getVisibleTextEditor(options);
        await editor.insertSnippet(snippet, location);
        this.queryDelayRequired = true;
    }
    
    /**
     * Set the cursors in a visible text editor to specific positions.
     */
    public async setCursors(to: CompactCursor[], options?: ViewColumnOption): Promise<void> {
        const editor = await this.getVisibleTextEditor(options);
        editor.selections = to.map((cursor) => {
            const anchorLine = Array.isArray(cursor) ? cursor[0] : cursor.anchor[0];
            const anchorChar = Array.isArray(cursor) ? cursor[1] : cursor.anchor[1];
            const activeLine = Array.isArray(cursor) ? cursor[0] : cursor.active[0];
            const activeChar = Array.isArray(cursor) ? cursor[1] : cursor.active[1];
            return new Selection(anchorLine, anchorChar, activeLine, activeChar);
        });
        this.queryDelayRequired = true;
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
        options?: Pick<TextDocumentShowOptions, 'viewColumn'>
    ): Promise<void> {
        const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
        const filePath = path.join(rootPath, file);
        const document = await workspace.openTextDocument(filePath);
        await window.showTextDocument(document, options);
        this.queryDelayRequired = true;
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
    public async setConfiguration<T>(args: {
        partialName:            'decorateAll' | 'decorationOptions' | 'detectedPairs', 
        value:                  T | undefined,
        targetWorkspaceFolder?: 'workspace-0' | 'workspace-1' | 'workspace-2' | 'workspace-3' | 'workspace-4',
        targetLanguage?:        'typescript' | 'markdown' | 'plaintext'
    },): Promise<void> {
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

        this.queryDelayRequired = true;
    }

    /**
     * Perform cleanup after a test case.
     * 
     * Cleanup should be performed regardless of whether the test case succeeded or failed.
     */
    public async cleanup(): Promise<void> {

        // Restore all configurations.
        for (const restorer of this.configurationRestorers.reverse()) {
            await restorer();
        }

        // Undo all changes made to any of the files in the test workspace.
        await clearAllWorkspaceFiles();

        // Close all open text editors so that the next test case has a predictable starting state 
        // to work from.
        await commands.executeCommand('workbench.action.closeAllEditors');
    }

}

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
 * Empty each of the files in the test workspace.
 */
async function clearAllWorkspaceFiles(): Promise<void> {
    for (const document of workspace.textDocuments) {
        const builder  = new WorkspaceEdit();
        const startPos = new Position(0, 0);
        const endPos   = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
        const docRange = new Range(startPos, endPos);
        builder.delete(document.uri, docRange);
        await workspace.applyEdit(builder); 
    }
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
