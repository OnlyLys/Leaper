//! The following module defines the test framework for this extension.

import * as assert from 'assert';
import * as path from 'path';
import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextEditor, workspace, window, ViewColumn, Uri, ConfigurationTarget, WorkspaceEdit, DecorationRenderOptions, DecorationRangeBehavior } from 'vscode';
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
     */
    private async execute(commandId: string, repetitions: number): Promise<void> {
        while (repetitions-- > 0) {
            await commands.executeCommand(commandId);
            await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
        }
    }

    /**
     * Assert the positions of pairs being tracked for a visible text editor.
     * 
     * This method does not check for decorations. Please use `assertPairsFull` if that is required.
     */
    public async assertPairs(
        expect:     ReadonlyArray<CompactCluster>,
        viewColumn: AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {
    
        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS);

        // The actual pairs being tracked for the target text editor, with the `isDecorated` flags
        // stripped since we are not checking for decorations.
        const actual = getSnapshot(viewColumn).pairs.map(cluster => 
            cluster.map(({ open, close }) => ({ open, close }))
        );

        // Convert the expected pairs to the same form as the actual pairs.
        const _expect: { open: CompactPosition, close: CompactPosition }[][] = expect.map(cluster => {
            if (cluster === 'None') {
                return [];
            } else {
                const line    = cluster.line;
                const openers = cluster.sides.slice(0, cluster.sides.length / 2);
                const closers = cluster.sides.slice(cluster.sides.length / 2).reverse();
                return [...zip(openers, closers)].map(([opener, closer]) => (
                    { open: [line, opener], close: [line, closer] }
                ));
            }
        });

        this.assertEq(actual, _expect, 'Pairs Mismatch');
    }

    /**
     * Assert the positions of pairs being tracked for a visible text editor and check their 
     * decorations.
     * 
     * The `expectDecorations` parameter determines how decorations are checked:
     * 
     *  - `'all'` asserts that all pairs are decorated.
     *  - `'nearest'` asserts that only the pairs nearest to each cursor are decorated.
     * 
     * Note that here we only check for the presence of decorations. We do not check the style of 
     * the decorations.
     */
    public async assertPairsFull(
        expect:             ReadonlyArray<CompactCluster>,
        expectDecorations: 'all' | 'nearest',
        viewColumn:         AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {

        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS);

        const actual = getSnapshot(viewColumn).pairs;

        // Convert the expected pairs to the same form as the actual pairs.
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
        if (expectDecorations === 'all') {
            _expect.forEach(cluster => cluster.forEach(pair => pair.isDecorated = true));
        } else if (expectDecorations === 'nearest') {
            _expect.forEach(cluster => {
                cluster.forEach((pair, i) => pair.isDecorated = (i === cluster.length - 1));
            });
        }

        this.assertEq(actual, _expect, 'Pairs Mismatch');
    }

    /**
     * Assert the state of the cursors of a visible text editor.
     */
    public async assertCursors(
        expect:     ReadonlyArray<CompactCursor>,
        viewColumn: AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {

        // Note that this function is not actually `async` since it does not wait on anything. But 
        // we keep the `async` in the function declaration in case in the future we want to wait on
        // something here.

        const editor = getVisibleTextEditor(viewColumn);

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
     * Assert the most recently set values of this extension's keybinding contexts.
     */
    public async assertMostRecentContexts(
        expect: { 
            inLeaperMode:   boolean, 
            hasLineOfSight: boolean
        }
    ): Promise<void> {
        
        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS);
        
        this.assertEq(getMostRecentContexts(), expect, 'Keybinding Context Mismatch');
    }

    /**
     * Assert the effective decoration options for a visible text editor.
     * 
     * Keep in mind that `expect` is not compared against the exact effective value specified by the 
     * user, but rather against the effective value after it has been converted to the desired form 
     * by the engine's configuration reader. For that reason, we do not allow `rangeBehavior` to be 
     * specified in `expect` since we always expect it to be `ClosedClosed` as the engine's 
     * configuration reader always forces it to that value. Please see the `configurations` module 
     * for more info.
     */
    public async assertEffectiveDecorationOptions(
        expect:     Readonly<Omit<DecorationRenderOptions, 'rangeBehavior'>>,
        viewColumn: AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {

        // Wait in case the engine has not caught up.
        await waitFor(ExecutorFull.PRE_ENGINE_QUERY_DELAY_MS);

        const actual  = getSnapshot(viewColumn).decorationOptions.cast();
        const _expect = { ...expect,  rangeBehavior: DecorationRangeBehavior.ClosedClosed };
        this.assertEq(actual, _expect, 'Decoration Options Mismatch');
    }

    /** 
     * Perform a backspace for each cursor in the active text editor.
     */
    public async backspace(repetitions: number = 1): Promise<void> {
        await this.execute('deleteLeft', repetitions);
    }

    /**
     * Backspace a word for each cursor in the active text editor.
     */
    public async backspaceWord(repetitions: number = 1): Promise<void> {
        await this.execute('deleteWordLeft', repetitions);
    }

    /**
     * Delete a character to the right of each cursor in the active text editor.
     */
    public async deleteRight(repetitions: number = 1): Promise<void> {
        await this.execute('deleteRight', repetitions);
    }

    /**
     * Move each cursor in the active text editor.
     */
    public async moveCursors(
        where:       'left' | 'right' | 'up' | 'down' | 'home' | 'end',
        repetitions: number = 1
    ): Promise<void> {
        switch (where) {
            case 'left':  return this.execute('cursorLeft',  repetitions);
            case 'right': return this.execute('cursorRight', repetitions);
            case 'up':    return this.execute('cursorUp',    repetitions);
            case 'down':  return this.execute('cursorDown',  repetitions);
            case 'home':  return this.execute('cursorHome',  repetitions);
            case 'end':   return this.execute('cursorEnd',   repetitions);
        }
    }

    /**
     * Use smart select to expand the current selection of each cursor.
     */
    public async expandSelection(repetitions: number = 1): Promise<void> {
        await this.execute('editor.action.smartSelect.expand', repetitions);
    }
    
    /**
     * Execute the 'Add Selection to Next Find Match' Command.
     */
    public async addSelectionToNextFindMatch(repetitions: number = 1): Promise<void> {
        await this.execute('editor.action.addSelectionToNextFindMatch', repetitions);
    }

    /**
     * Call the 'Leap' command.
     */
    public async leap(repetitions: number = 1): Promise<void> {
        await this.execute('leaper.leap', repetitions);
    }

    /**
     * Call the 'Escape Leaper Mode' command.
     */
    public async escapeLeaperMode(repetitions: number = 1): Promise<void> {
        await this.execute('leaper.escapeLeaperMode', repetitions);
    }

    /**
     * Jump to a snippet tabstop in the active text editor. 
     */
    public async jumpToTabstop(which: 'next' | 'prev', repetitions: number = 1): Promise<void> {
        switch (which) {
            case 'next': return this.execute('jumpToNextSnippetPlaceholder', repetitions);
            case 'prev': return this.execute('jumpToPrevSnippetPlaceholder', repetitions);
        }
    }

    /**
     * Trigger an autocomplete suggestion in the active text editor then accept the first suggestion.
     */
    public async triggerAndAcceptSuggestion(): Promise<void> {
        await this.execute('editor.action.triggerSuggest', 1);
        await waitFor(100);    // Wait for the suggestion box to appear.
        await this.execute('acceptSelectedSuggestion', 1);
    }

    /**
     * Perform an undo in the active text editor.
     */
    public async undo(repetitions: number = 1): Promise<void> {
        await this.execute('undo', repetitions);
    }

    /**
     * Type text into the active text editor, codepoint by codepoint.
     */
    public async typeText(text: string, repetitions: number = 1): Promise<void> {
        while (repetitions-- > 0) {
            for (const char of text) {
                await commands.executeCommand('default:type', { text: char });
            }
            await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
        }
    }

    /**
     * Simulate inserting (into the active text editor) an autoclosing pair via an opening character 
     * that is behind a dead key.
     * 
     * The pairs being simulated here are quotes, as quotation marks are commonly behind dead keys
     * in "international" keyboard layouts.
     * 
     * Note that instead of relying on vscode to autoclose the pair, here we autoclose the pair 
     * ourselves. This also means that this method is safe to call multiple times in a row for the
     * same pair, as we are at no risk of the cursor being moved out of a previously inserted pair's 
     * closing side when an opening side (which has the same character) is inserted, since vscode 
     * only does that for pairs that it has autoclosed.
     */
    public async simulateDeadKeyAutoclosingPairInsertion(pair: "\'\'" | '""' | '``'): Promise<void> {
        const activeTextEditor = getVisibleTextEditor(ViewColumn.Active);

        if (activeTextEditor.selections.some(cursor => !cursor.isEmpty)) {
            throw new Error('Cursors must be empty!');
        }

        // Simulate the dead key preview being inserted.
        //
        // Note that the dead key preview could be another character, or it could be the opening
        // character of the pair itself. The exact preview character is determined by the user's
        // language and keyboard layout. For convenience, we use the opening character of the pair 
        // as the previewed dead key.
        await activeTextEditor.edit(builder => {
            activeTextEditor.selections.forEach(({ anchor }) => builder.insert(anchor, pair[0]));
        });

        // Now simulate the user choosing to insert the opening character of the pair which will
        // replace the dead key preview in one content change event. While the closing side will be 
        // inserted (automatically by vscode for the user, though we are doing it manually here) in 
        // another content change event that immediately follows.
        await activeTextEditor.edit(builder => {
            activeTextEditor.selections.forEach(({ anchor }) => 
                builder.replace(new Range(anchor.translate(0, -1), anchor), pair[0])
            );
        });
        await activeTextEditor.edit(builder => {
            activeTextEditor.selections.forEach(({ anchor }) => builder.replace(anchor, pair[1]));
        });

        // The last step we just did which inserted the closing sides of pairs will have caused each 
        // cursor to expand into a selection, where the anchor is within the pairs but the active is 
        // outside them. However, the pair we autoclosed should still be tracked, since the engine 
        // uses a cursor's anchor as the basis for whether or not a cursor is enclosed by a pair. 
        // 
        // Cursors being expanded after the closing side is inserted is different from vscode's 
        // behavior where the cursor is not expanded after the insertion, so our simulation here
        // does not exactly simulate the way vscode does things. However, we can get close by
        // cancelling the selection here.
        await this.moveCursors('left');

        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
    }

    /**
     * Delete all text in a visible text editor.
     */
    public async deleteAll(viewColumn: AllowedViewColumns = ViewColumn.Active): Promise<void> {
        const editor   = getVisibleTextEditor(viewColumn);
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
        viewColumn: AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {
        const editor = getVisibleTextEditor(viewColumn);
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
     * 
     * @param location Where to insert the snippet in the target text editor. Defaults to the target
     *                 text editors' cursor(s).
     */
    public async insertSnippet(
        snippet:    SnippetString,
        viewColumn: AllowedViewColumns = ViewColumn.Active,
        location?:  CompactPosition | CompactRange
    ): Promise<void> {
        let _location: Position | Range | undefined = undefined;
        if (Array.isArray(location)) {
            _location = new Position(location[0], location[1]);
        } else if (typeof location === 'object') {
            _location = new Range(location.start[0], location.start[1], location.end[0], location.end[1]);
        }       
        const editor = getVisibleTextEditor(viewColumn);
        await editor.insertSnippet(snippet, _location);
        await waitFor(ExecutorFull.POST_REPETITION_DELAY_MS);
    }
    
    /**
     * Set the cursors in a visible text editor to specific positions.
     */
    public async setCursors(
        to:         CompactCursor[], 
        viewColumn: AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {
        const editor = getVisibleTextEditor(viewColumn);
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
            await this.execute('workbench.action.nextEditorInGroup', 1);
        } else if (which === 'prev') {
            await this.execute('workbench.action.previousEditorInGroup', 1);
        }
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Move the active text editor to another editor tab group.
     */
    public async moveEditorToGroup(which: 'left' | 'right'): Promise<void> {
        if (which === 'left') {
            await this.execute('workbench.action.moveEditorToLeftGroup', 1);
        } else if (which === 'right') {
            await this.execute('workbench.action.moveEditorToRightGroup', 1);
        }
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Focus on the explorer side bar.
     */
    public async focusExplorerSideBar(): Promise<void> {
        await this.execute('workbench.view.explorer', 1);
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
        await this.execute(commandId, 1);
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Close the side bar.
     */
    public async closeSideBar(): Promise<void> {
        await this.execute('workbench.action.closeSidebar', 1);
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    /**
     * Close the active text editor.
     */
    public async closeActiveEditor(): Promise<void> {
        await this.execute('workbench.action.closeActiveEditor', 1);
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
     *   - Workspace Folder           | undefined  | null       | (DO-4)     | undefined  | undefined  |
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
        viewColumn: AllowedViewColumns = ViewColumn.Active
    ): Promise<void> {
        const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
        const filePath = path.join(rootPath, file);
        const document = await workspace.openTextDocument(filePath);
        await window.showTextDocument(document, viewColumn);
        await waitFor(ExecutorFull.POST_VIEW_STATE_CHANGE_DELAY_MS);
    }

    private async _setConfiguration(
        args: {
            name:                    ConfigurationNames | DeprecatedConfigurationNames,
            value:                   any,
            targetWorkspaceFolder?:  WorkspaceFolderNames,
            targetLanguage?:         AllowedLanguages
        }
    ): Promise<void> {
        const { name, value, targetWorkspaceFolder, targetLanguage } = args;

        if (typeof value === 'object' && value !== null && Reflect.ownKeys(value).length === 0) {
            throw new Error('Now allowed to set configuration value to `{}`!');
        }

        // The name of the configuration after the `leaper.` prefix.
        const childName = name.slice(7);

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
        const inspect = configuration.inspect(childName);
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
        await configuration.update(childName, value, targetScope, !!targetLanguage);

        // Store the callback that allows the configuration change we just did to be reverted.
        this.configurationRestorers.push(async () => {
            const configuration = workspace.getConfiguration('leaper', fullUri);
            await configuration.update(childName, prevValue, targetScope, !!targetLanguage);
        });

    }

    /**
     * Set a configuration value within the test workspace.
     * 
     * @param name The full name of the configuration.
     * @param value Value to set the configuration to. **NOTE**: You may not set a configuration to
     *              `{}` because setting a configuration to that value occasionally does not count 
     *              as a change in value by vscode.
     * @param targetWorkspaceFolder The name of the workspace folder to set the configuration in. If
     *                              not specified, will set the configuration in the root workspace.
     * @param targetLanguage The language to scope the configuration to. If not specified, will not 
     *                       scope to any language.
     */
    public async setConfiguration(
        args: {
            name:                    ConfigurationNames,
            value:                   any,
            targetWorkspaceFolder?:  WorkspaceFolderNames,
            targetLanguage?:         AllowedLanguages
        }
    ): Promise<void> {
        await this._setConfiguration(args);
    }

    /**
     * Set a deprecated configuration value within the test workspace.
     * 
     * The deprecated configurations do not support workspace folder or language-specific scopes.
     */
    public async setDeprecatedConfiguration(
        args: {
            name:  DeprecatedConfigurationNames,
            value: any,
        }
    ): Promise<void> {
        await this._setConfiguration(args);
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
            throw new Error('Unable to get active text editor!');
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
function getSnapshot(viewColumn: AllowedViewColumns): TrackerSnapshot {
    if (!testHandle) {
        throw new Error('Unable to retrive test handle!');
    }
    const resolved = resolveViewColumn(viewColumn);
    const snapshot = testHandle.snapshot().get(resolved);
    if (!snapshot) {
        throw new Error(`Unable to get snapshot for view column ${viewColumn}`);
    }
    return snapshot;
}

/**
 * Get the most recently set keybinding contexts.
 * 
 * Note that this function should not be called immediately after a executing command that affects 
 * the view state, because it takes a while for changes in the view state to become effective.
 */
function getMostRecentContexts(): { inLeaperMode: boolean, hasLineOfSight: boolean } {
    if (!testHandle) {
        throw new Error('Unable to retrive test handle!');
    }
    return testHandle.mostRecentContexts;
}

/**
 * Get a visible text editor at a specific view column.
 * 
 * Defaults to the active text editor if no `viewColumn` is specified.
 * 
 * Note that this function should not be called immediately after a executing command that affects 
 * the view state, because it takes a while for changes in the view state to become effective.
 */
function getVisibleTextEditor(viewColumn: AllowedViewColumns): TextEditor {
    const resolved = resolveViewColumn(viewColumn);
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

type ConfigurationNames = 'leaper.decorateAll' | 'leaper.decorationOptions' | 'leaper.detectedPairs';

type DeprecatedConfigurationNames = 'leaper.decorateOnlyNearestPair' | 'leaper.customDecorationOptions' | 'leaper.additionalTriggerPairs';

type WorkspaceFolderNames = 'workspace-0' | 'workspace-1' | 'workspace-2' | 'workspace-3' | 'workspace-4';

type AllowedLanguages = 'typescript' | 'markdown' | 'plaintext';
