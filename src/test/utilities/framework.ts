//! The following module defines the test framework for this extension.

import * as assert from 'assert';
import * as path from 'path';
import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextDocumentShowOptions, TextEditor, workspace, window, ViewColumn, Uri, ConfigurationTarget, WorkspaceEdit } from 'vscode';
import { ResolvedViewColumn, TrackerSnapshot } from '../../engine/test-handle';
import { CompactCluster, CompactRange, CompactPosition, CompactCursor, CompactSelection, CompactPair } from './compact';
import { waitFor, zip } from './helpers';
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

            // Allow one retry for each test case because sometimes they spuriously fail due to
            // vscode lagging or acting weird. Seriously, I don't know why but sometimes vscode does 
            // not autoclose the first pair inserted in a test case.
            this.retries(1);

            before(async function () {

                // If the previous test run did not terminate properly, then during the next test 
                // run, vscode might restore the previous run's view state. That might cause tests
                // to fail since the initial view state is unpredictable. We solve that issue by 
                // closing all text editors the moment the test instance opens.
                await commands.executeCommand('workbench.action.closeAllEditors');

                // Make sure side bar is closed so that it does not take up space.
                await commands.executeCommand('workbench.action.closeSidebar');

                // Wait for the engine and vscode to "catch up" before starting the tests.
                await waitFor(100);
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
     * The amount of delay to apply before querying the engine.
     * 
     * This delay exists because it may take a while for changes we have made to be reflected in the
     * engine as the engine receives information asynchronously.
     */
    private static readonly PRE_ENGINE_QUERY_DELAY_MS = 50;

    /**
     * The delay to apply after each repetition of a command.
     * 
     * This delay exists to allow some time for the engine and vscode to "catch up" before executing
     * the next command.
     */
    private static readonly POST_REPETITION_DELAY_MS = 10;

    /**
     * The delay to apply after a command that affects the view state is executed.
     * 
     * This delay exists because it may take a while before requests to change the view state (e.g.
     * focusing on a different text editor or opening a new text editor) are acknowledged by vscode.
     */
    private static readonly POST_VIEW_STATE_CHANGE_DELAY_MS = 50;

    /**
     * Whether or not the executor is executing commands as part of a prelude.
     * 
     * When this flag is `true`, the assertion message of `this.assertEq` will have a header denoting
     * that the assertion failed in a prelude.
     */
    public inPrelude: boolean = false;

    /**
     * Perform deep strict equality comparison between two objects. 
     * 
     * If the `inPrelude` flag of this executor is `true`, then on assertion failure, the message
     * shown will have a header denoting that the assertion failed in a prelude.
     */
    private assertEq<T>(actual: T, expect: T, message: string): void {
        const _message = this.inPrelude ? `(Prelude Failure) ${message}` : message;
        assert.deepStrictEqual(actual, expect, _message);
    }

    /**
     * Execute a command `repetitions` amount of times.
     * 
     * A delay of `ExecutorFull.POST_REPETITION_DELAY_MS` is applied after each repetition.
     * 
     * `repetitions` defaults to `1` if not specified.
     */
    private async execute(commandId: string, repetitions: number = 1): Promise<void> {
        while (repetitions-- > 0) {
            await commands.executeCommand(commandId);
            await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
        }
    }

    /**
     * Assert the position of pairs being tracked for a visible text editor.
     */
    public async assertPairs(
        expect: ReadonlyArray<CompactCluster>,
        options?: ViewColumnOption & {

            /**
             * Determines whether decorations are checked:
             * 
             *  - `'all'` asserts that all pairs are decorated.
             *  - `'nearest'` asserts that only the pairs nearest to each cursor are decorated.
             *  - `undefined` means no decoration checks are performed.
             * 
             * This option defaults to `undefined`.
             * 
             * Note that this option only relates to checking for the presence of decorations (i.e. 
             * checking whether decorations are applied or not). We do not check the style of the 
             * decorations here.
             */
            expectDecorations?: 'all' | 'nearest' | undefined;
        }
    ): Promise<void> {
    
        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS * 2);

        // The actual pairs being tracked for the target text editor.
        const actual = getSnapshot(options?.viewColumn).pairs;

        // Convert the expected pairs to a form suited for comparison with the actual pairs.
        const _expect: CompactPair[][] = expect.map(cluster => {
            if (cluster === 'None') {
                return [];
            } else {
                const line    = cluster.line;
                const openers = cluster.sides.slice(0, cluster.sides.length / 2);
                const closers = cluster.sides.slice(cluster.sides.length / 2).reverse();
                return [...zip(openers, closers)].map(([opener, closer]) => (
                    { open: [line, opener], close: [line, closer], isDecorated: false }
                ));
            }
        });

        const assertionMsg = 'Pairs Mismatch';
        if (options?.expectDecorations === 'all') {

            // We expect every pair to be decorated.
            _expect.forEach(cluster => cluster.forEach(pair => pair.isDecorated = true));
            this.assertEq(actual, _expect, assertionMsg);
        } else if (options?.expectDecorations === 'nearest') {

            // We expect only the pair nearest to each cursor to be decorated.
            _expect.forEach(cluster => {
                cluster.forEach((pair, i) => pair.isDecorated = (i === cluster.length - 1));
            });
            this.assertEq(actual, _expect, assertionMsg);
        } else {
            function stripIsDecoratedFlag(pairs: CompactPair[][]) {
                return pairs.map(cluster => cluster.map(({ open, close }) => ({ open, close })));
            }
            
            // We are not checking decorations here.
            this.assertEq(stripIsDecoratedFlag(actual), stripIsDecoratedFlag(_expect), assertionMsg);
        };
    }

    /**
     * Assert the state of the cursors of a visible text editor.
     */
    public async assertCursors(
        expect:   ReadonlyArray<CompactCursor>,
        options?: RepetitionOption & ViewColumnOption
    ): Promise<void> {

        // Note that this function is not actually `async` since it does not wait on anything. But 
        // we keep the `async` in the function declaration in case in the future we want to wait on
        // something here.

        const editor = getVisibleTextEditor(options?.viewColumn);

        // Convert the actual and expected cursors to a print friendly form before asserting them.
        const actual: CompactSelection[] = editor.selections.map((cursor) => {
            const anchor: CompactPosition = [cursor.anchor.line, cursor.anchor.character];
            const active: CompactPosition = [cursor.active.line, cursor.active.character];
            return { anchor, active };
        });
        const _expect: CompactSelection[] = expect.map((cursor) => 
            Array.isArray(cursor) ? { anchor: cursor, active: cursor } : cursor
        );

        this.assertEq(actual, _expect, 'Cursors Mismatch');
    }

    /**
     * Assert the most recently set value of the `leaper.inLeaperMode` keybinding context.
     */
    public async assertMostRecentInLeaperModeContext(expect: boolean): Promise<void> {
        
        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS);

        const message = 'Most Recently Set `leaper.inLeaperMode` Keybinding Context Mismatch';
        this.assertEq(getMostRecentInLeaperModeContext(), expect, message);
    }

    /**
     * Assert the most recently set value of the `leaper.hasLineOfSight` keybinding context.
     */
    public async assertMostRecentHasLineOfSightContext(expect: boolean): Promise<void> {

        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS);

        const message = 'Most Recently Set `leaper.hasLineOfSight` Keybinding Context Mismatch';
        this.assertEq(getMostRecentHasLineOfSightContext(), expect, message);
    }

    /** 
     * Perform a backspace for each cursor in the active text editor.
     */
    public async backspace(options?: RepetitionOption): Promise<void> {
        await this.execute('deleteLeft', options?.repetitions);
    }

    /**
     * Backspace a word for each cursor in the active text editor.
     */
    public async backspaceWord(options?: RepetitionOption): Promise<void> {
        await this.execute('deleteWordLeft', options?.repetitions);
    }

    /**
     * Delete a character to the right of each cursor in the active text editor.
     */
    public async deleteRight(options?: RepetitionOption): Promise<void> {
        await this.execute('deleteRight', options?.repetitions);
    }

    /**
     * Move each cursor in the active text editor.
     */
    public async moveCursors(
        where:    'left' | 'right' | 'up' | 'down' | 'home' | 'end',
        options?: RepetitionOption
    ): Promise<void> {
        switch (where) {
            case 'left':  return this.execute('cursorLeft',  options?.repetitions);
            case 'right': return this.execute('cursorRight', options?.repetitions);
            case 'up':    return this.execute('cursorUp',    options?.repetitions);
            case 'down':  return this.execute('cursorDown',  options?.repetitions);
            case 'home':  return this.execute('cursorHome',  options?.repetitions);
            case 'end':   return this.execute('cursorEnd',   options?.repetitions);
        }
    }

    /**
     * Call the 'Leap' command.
     */
    public async leap(options?: RepetitionOption): Promise<void> {
        await this.execute('leaper.leap', options?.repetitions);
    }

    /**
     * Call the 'Escape Leaper Mode' command.
     */
    public async escapeLeaperMode(options?: RepetitionOption): Promise<void> {
        await this.execute('leaper.escapeLeaperMode', options?.repetitions);
    }

    /**
     * Jump to a snippet tabstop in the active text editor. 
     */
    public async jumpToTabstop(which: 'next' | 'prev', options?: RepetitionOption): Promise<void> {
        switch (which) {
            case 'next': return this.execute('jumpToNextSnippetPlaceholder', options?.repetitions);
            case 'prev': return this.execute('jumpToPrevSnippetPlaceholder', options?.repetitions);
        }
    }

    /**
     * Trigger an autocomplete suggestion in the active text editor then accept the first suggestion.
     */
    public async triggerAndAcceptSuggestion(): Promise<void> {
        await this.execute('editor.action.triggerSuggest');
        await waitFor(100);    // Wait for the suggestion box to appear.
        await this.execute('acceptSelectedSuggestion');
    }

    /**
     * Perform an undo in the active text editor.
     */
    public async undo(options?: RepetitionOption): Promise<void> {
        await this.execute('undo', options?.repetitions);
    }

    /**
     * Type text into the active text editor, codepoint by codepoint.
     */
    public async typeText(text: string, options?: RepetitionOption): Promise<void> {
        let repetitions = options?.repetitions ?? 1;
        while (repetitions-- > 0) {
            for (const char of text) {
                await commands.executeCommand('default:type', { text: char });
            }
            await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
        }
    }

    /**
     * Delete all text in a visible text editor.
     */
    public async deleteAll(options?: ViewColumnOption): Promise<void> {
        const editor   = getVisibleTextEditor(options?.viewColumn);
        const document = editor.document;
        const startPos = new Position(0, 0);
        const endPos   = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
        const docRange = new Range(startPos, endPos);
        await editor.edit(builder => builder.delete(docRange));
        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
    }

    /**
     * Apply text edits to a visible text editor.
     *   
     * All the edits will be done in parallel.
     */
    public async editText(
        edits: ReadonlyArray<
            { kind: 'replace'; range: CompactRange; with: string; } 
          | { kind: 'insert';  at: CompactPosition; text: string; } 
          | { kind: 'delete';  range: CompactRange; }
        >,
        options?: ViewColumnOption
    ): Promise<void> {
        const editor = getVisibleTextEditor(options?.viewColumn);
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
        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
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
        const editor = getVisibleTextEditor(options?.viewColumn);
        await editor.insertSnippet(snippet, location);
        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
    }
    
    /**
     * Set the cursors in a visible text editor to specific positions.
     */
    public async setCursors(to: CompactCursor[], options?: ViewColumnOption): Promise<void> {
        const editor = getVisibleTextEditor(options?.viewColumn);
        editor.selections = to.map((cursor) => {
            const anchorLine = Array.isArray(cursor) ? cursor[0] : cursor.anchor[0];
            const anchorChar = Array.isArray(cursor) ? cursor[1] : cursor.anchor[1];
            const activeLine = Array.isArray(cursor) ? cursor[0] : cursor.active[0];
            const activeChar = Array.isArray(cursor) ? cursor[1] : cursor.active[1];
            return new Selection(anchorLine, anchorChar, activeLine, activeChar);
        });
        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
    }

    /**
     * Switch to another text editor in the in-focus editor tab group.
     */
    public async switchToEditorInGroup(which: 'next' | 'prev'): Promise<void> {
        if (which === 'next') {
            await this.execute('workbench.action.nextEditorInGroup');
        } else if (which === 'prev') {
            await this.execute('workbench.action.previousEditorInGroup');
        }
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Move the active text editor to another editor tab group.
     */
    public async moveEditorToGroup(which: 'left' | 'right'): Promise<void> {
        if (which === 'left') {
            await this.execute('workbench.action.moveEditorToLeftGroup');
        } else if (which === 'right') {
            await this.execute('workbench.action.moveEditorToRightGroup');
        }
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Focus on the explorer side bar.
     */
    public async focusExplorerSideBar(): Promise<void> {
        await this.execute('workbench.view.explorer');
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Focus on an editor tab group.
     */
    public async focusEditorGroup(
        which: 'left' | 'right' | 'first' | 'second' | 'third' | 'fourth',
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
        await this.execute(commandId);
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Close the side bar.
     */
    public async closeSideBar(): Promise<void> {
        await this.execute('workbench.action.closeSidebar');
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Close the active text editor.
     */
    public async closeActiveEditor(): Promise<void> {
        await this.execute('workbench.action.closeActiveEditor');
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
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
     * Autoclosing Pairs              | (AP-1)     | (AP-3)     | (AP-1)     | (AP-2)     | (AP-1)     |
     *                                |            |            |            |            |            |
     * leaper.decorateAll Value       |            |            |            |            |            |
     *   - Workspace                  | false      | false      | false      | false      | false      |
     *   - Workspace Folder           | undefined  | undefined  | undefined  | undefined  | true       |
     *   - Language Workspace         | undefined  | undefined  | undefined  | undefined  | undefined  |
     *   - Language Workspace Folder  | undefined  | undefined  | undefined  | undefined  | undefined  |
     *   - Effective                  | false      | false      | false      | false      | true       |
     *                                |            |            |            |            |            |
     * leaper.detectedPairs Value     |            |            |            |            |            |
     *   - Workspace                  | (DP-1)     | (DP-1)     | (DP-1)     | (DP-1)     | (DP-1)     |
     *   - Workspace Folder           | undefined  | undefined  | [ "()" ]   | []         | undefined  |
     *   - Language Workspace         | undefined  | []         | undefined  | undefined  | undefined  |
     *   - Language Workspace Folder  | undefined  | undefined  | undefined  | (DP-2)     | undefined  |
     *   - Effective                  | (DP-1)     | []         | [ "()" ]   | (DP-2)     | (DP-1)     |
     *                                |            |            |            |            |            |
     * leaper.decorationOptions Value |            |            |            |            |            |
     *   - Workspace                  | (DO-1)     | (DO-1)     | (DO-1)     | (DO-1)     | (DO-1)     |
     *   - Workspace Folder           | undefined  | {}         | (DO-4)     | undefined  | undefined  |
     *   - Language Workspace         | undefined  | undefined  | undefined  | (DO-2)     | undefined  |
     *   - Language Workspace Folder  | undefined  | (DO-3)     | (DO-5)     | undefined  | undefined  |
     *   - Effective                  | (DO-1)     | (DO-3)     | (DO-5)     | (DO-2)     | (DO-1)     |
     * -------------------------------------------------------------------------------------------------
     * 
     * (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
     * *(AP-2): [ "()", "[]", "{}", "<>" ]
     * (AP-3): [ "()", "[]", "{}" ]
     * 
     * (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
     * (DP-2): [ "{}", "<>" ]
     * 
     * (DO-1): {
     *              "outlineColor": "editorWarning.foreground",
     *              "outlineStyle": "solid",
     *              "outlineWidth": "1px",
     *              "fontWeight": "bolder"
     *         }
     * (DO-2): {
     *              "outlineColor": "editorInfo.foreground",
     *              "outlineStyle": "solid",
     *              "outlineWidth": "1px",
     *              "dark": {
     *                  "after": {
     *                      "contentText": "🖚",
     *                      "color": "editorInfo.foreground",
     *                  },
     *              },
     *              "light": {
     *                  "before": {
     *                      "contentText": "➝",
     *                      "color": "editorInfo.foreground"
     *                  },
     *              }
     *         }
     * (DO-3): {
     *              "backgroundColor": "#0000FF9E",
     *              "outlineColor": "editorBracketMatch.border",
     *              "outlineStyle": "outset",
     *              "outlineWidth": "1px",
     *              "fontWeight": "bolder",
     *              "light": {
     *                  "backgroundColor": "#0000001A",
     *              }
     *         }
     * (DO-4): {
     *              "outlineColor": "editorBracketMatch.border",
     *              "outlineStyle": "solid",
     *              "outlineWidth": "1px",
     *              "fontWeight": "bold"
     *         }
     * (DO-5): {
     *              "letterSpacing": "2px",
     *              "borderColor": "editorWarning.foreground",
     *              "borderStyle": "none solid none none",
     *              "borderWidth": "2px",
     *              "fontWeight": "bolder"
     *         }
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
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
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
        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);

        // Close all open text editors so that the next test case has a predictable starting state 
        // to work from.
        await commands.executeCommand('workbench.action.closeAllEditors');
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

}

/**
 * This function should not be called immediately after a executing command that affects the view 
 * state, because it takes a while for changes in the view state to become effective. For example, 
 * if this function is called too soon after a different text editor is focused, `window.activeTextEditor` 
 * might not yet have been updated to point at the new active text editor.
 */
function resolveViewColumn(viewColumn: AllowedViewColumns): ResolvedViewColumn {
    if (viewColumn === ViewColumn.Active) {
        if (!window.activeTextEditor|| window.activeTextEditor.viewColumn === undefined) {
            throw new Error('Unable to resolve `ViewColumn.Active`!');
        }

        // vscode only stores resolved view column numbers in `TextEditor`s, so this cast is safe.
        return window.activeTextEditor.viewColumn as ResolvedViewColumn;
    } else {
        return viewColumn;
    }
}

/**
 * Get a snapshot of the tracker of a visible text editor.
 * 
 * Defaults to the active text editor's tracker if no `viewColumn` is specified.
 * 
 * Note that this function should not be called immediately after a executing command that affects 
 * the view state, because it takes a while for changes in the view state to become effective.
 */
function getSnapshot(viewColumn?: AllowedViewColumns): TrackerSnapshot {
    if (!testHandle) {
        throw new Error('Unable to retrive test handle!');
    }
    const resolved = resolveViewColumn(viewColumn ?? ViewColumn.Active);
    const snapshot = testHandle.snapshot().get(resolved);
    if (!snapshot) {
        throw new Error(`Unable to get snapshot for view column ${viewColumn}`);
    }
    return snapshot;
}

/**
 * Get the most recently set value of the `leaper.inLeaperMode` keybinding context.
 * 
 * Note that this function should not be called immediately after a executing command that affects 
 * the view state, because it takes a while for changes in the view state to become effective.
 */
function getMostRecentInLeaperModeContext(): boolean {
    if (!testHandle) {
        throw new Error('Unable to retrive test handle!');
    }
    return testHandle.mostRecentInLeaperModeContext;
}

/**
 * Get the most recently set value of the `leaper.hasLineOfSight` keybinding context.
 * 
 * Note that this function should not be called immediately after a executing command that affects 
 * the view state, because it takes a while for changes in the view state to become effective.
 */
function getMostRecentHasLineOfSightContext(): boolean {
    if (!testHandle) {
        throw new Error('Unable to retrive test handle!');
    }
    return testHandle.mostRecentHasLineOfSightContext;
}


/**
 * Get a visible text editor at a specific view column.
 * 
 * Defaults to the active text editor if no `viewColumn` is specified.
 * 
 * Note that this function should not be called immediately after a executing command that affects 
 * the view state, because it takes a while for changes in the view state to become effective.
 */
function getVisibleTextEditor(viewColumn?: AllowedViewColumns): TextEditor {
    const resolved = resolveViewColumn(viewColumn ?? ViewColumn.Active);
    const editor   = window.visibleTextEditors.find(editor => editor.viewColumn === resolved);
    if (!editor) {
        throw new Error(`No text editor in view column ${viewColumn}!`);
    }
    return editor;
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

type AllowedViewColumns = ViewColumn.Active | ViewColumn.One | ViewColumn.Two | ViewColumn.Three | ViewColumn.Four;

interface ViewColumnOption {

    /**
     * The view column of the visible text editor to perform the check or action in.
     * 
     * Defaults to `ViewColumn.Active`.
     */
    viewColumn?: AllowedViewColumns;
    
}

interface RepetitionOption {

    /** 
     * How many times to execute this action. 
     * 
     * Defaults to `1`. 
     */
    repetitions?: number;

}
