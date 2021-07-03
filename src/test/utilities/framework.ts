//! The following module defines the test framework for this extension.

import * as assert from 'assert';
import * as path from 'path';
import { commands, Range, Selection, Position, SnippetString, TextEditorEdit, TextDocumentShowOptions, TextEditor, workspace, extensions, window, ViewColumn, Uri, ConfigurationTarget } from 'vscode';
import { ResolvedViewColumn, TrackerSnapshot, TestAPI } from '../../engine/test-api';
import { CompactCluster, CompactRange, CompactPosition, CompactCursor, CompactSelection } from './compact';
import { pickRandom, waitFor, zip } from './other';

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
 * 
 * Each test case is provided a fresh text editor. Additional text editors can be opened by calling
 * the appropriate `Executor` methods.
 */
export class TestCase {

    public constructor(private readonly args: {

        readonly name: string,

        /** 
         * The language of the text editor that is provided to this test case.
         * 
         * Defaults to 'typescript'.
         */
        readonly editorLanguageId?: string,

        /**
         * Callback to setup the provided text editor before running the test case.
         */
        readonly prelude?: (executor: Executor) => Promise<void>,

        /** 
         * Callback to execute as part of the test case. 
         * 
         * The `executor` parameter provides the necessary facilities for test execution.
         */
        readonly task: (executor: Executor) => Promise<void>

    }) {}

    public run(): void {
        const { name, editorLanguageId, prelude, task } = this.args;
        it(name, async function () {

            // We should retry once because sometimes tests can fail due to vscode lagging.
            this.retries(1);

            // To allow test cases to modify and check the state of the running vscode instance.
            const executor = new ExecutorFull();

            try {
                
                // Open a fresh text editor for the test case.
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
 *  3. Assert the state of the extension.
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
    public assertPairs(
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
    ): void {
        
        // Print friendly representation of a pair.
        type Pretty = { open: CompactPosition, close: CompactPosition, isDecorated: boolean };

        // Print friendly representation of a pair without a decoration flag.
        type PrettyPartial = Omit<Pretty, "isDecorated">;

        function stripDecorationFlag(pairs: Pretty[][]): PrettyPartial[][] {
            return pairs.map(cluster => cluster.map(({ open, close }) => ({ open, close })));
        }

        // Convert the actual and expected pairs to a print friendly form before asserting them.
        const snapshot = getSnapshot(options);
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
    public assertCursors(
        expect:   CompactCursor[],
        options?: RepetitionDelayOptions & ViewColumnOption
    ): void {
        const editor = getVisibleTextEditor(options);

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
     * Get the cursors of a visible text editor.
     */
    public getCursors(options?: ViewColumnOption): CompactCursor[] {
        const editor = getVisibleTextEditor(options);
        return editor.selections.map((cursor) => {
            const anchorLine = cursor.anchor.line;
            const anchorChar = cursor.anchor.character;
            const activeLine = cursor.active.line;
            const activeChar = cursor.active.character;
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
        const message = 'Most Recently Broadcasted `leaper.inLeaperMode` Context Mismatch';
        this.assertEq(getHandle().MRBInLeaperModeContext, expect, message);
    }

    /**
     * Assert the most recently broadcasted value of `leaper.hasLineOfSight` keybinding context.
     */
    public assertMRBHasLineOfSightContext(expect: boolean): void {
        const message = 'Most Recently Broadcasted `leaper.hasLineOfSight` Context Mismatch';
        this.assertEq(getHandle().MRBHasLineOfSightContext, expect, message);
    }

    /**
     * Call the command to type a random autoclosing pair into the active text document.
     * 
     * The pair typed in is randomly picked between `{}`, `[]` and `()`. 
     */
    public async typeRandomPair(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const opener = pickRandom([ '{', '[', '(' ]);
            return commands.executeCommand('default:type', { text: opener });
        }, options);
    }

    /**
     * Type text into the active text document, codepoint by codepoint.
     */
    public async typeText(text: string, options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            for (const char of text) {
                await commands.executeCommand('default:type', { text: char });
            }
        }, options);
    }

    /**
     * Apply text edits to a visible text document.
     *   
     * All the edits will be done in parallel.
     */
    public async editText(
        edits: ReadonlyArray<
            {
                /** Replace a range of text. */
                kind:  'replace';
                range: CompactRange;
                with:  string;
            } | 
            {
                /** Insert text at a position. */
                kind: 'insert';
                at:   CompactPosition;
                text: string;
            } |
            {
                /** Delete a range of text. */
                kind: 'delete';
                range: CompactRange;
            }
        >,
        options?: RepetitionDelayOptions & ViewColumnOption
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const editor = getVisibleTextEditor(options);
            return editor.edit((builder: TextEditorEdit) => {
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
    public async backspace(options?: RepetitionDelayOptions): Promise<void> {
        return executeCommandWithRepetitionDelay('deleteLeft', options);
    }

    /**
     * Backspace a word for each cursor in the active text editor.
     */
    public async backspaceWord(options?: RepetitionDelayOptions): Promise<void> {
        return executeCommandWithRepetitionDelay('deleteWordLeft', options);
    }

    /**
     * Delete a character to the right of each cursor in the active text editor.
     */
    public async deleteRight(options?: RepetitionDelayOptions): Promise<void> {
        return executeCommandWithRepetitionDelay('deleteRight', options);
    }

    /**
     * Delete all text in the active text editor.
     */
    public async deleteAll(options?: RepetitionDelayOptions): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            await commands.executeCommand('editor.action.selectAll');
            await commands.executeCommand('deleteLeft');
        }, options); 
    }

    /**
     * Move each cursor in the active text document.
     */
    public async moveCursors(
        where:    'left' | 'right' | 'up' | 'down' | 'home' | 'end' | 'endOfDocument',
        options?: RepetitionDelayOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            switch (where) {
                case 'left':          return commands.executeCommand('cursorLeft');
                case 'right':         return commands.executeCommand('cursorRight');
                case 'up':            return commands.executeCommand('cursorUp');
                case 'down':          return commands.executeCommand('cursorDown');
                case 'home':          return commands.executeCommand('cursorHome');
                case 'end':           return commands.executeCommand('cursorEnd');
                case 'endOfDocument': return commands.executeCommand('cursorBottom');
                default: throw new Error('Unreachable!');
            }
        }, options);
    }

    /**
     * Set the cursors in a visible text editor to specific positions.
     */
    public async setCursors(
        to:       CompactCursor[],
        options?: RepetitionDelayOptions & ViewColumnOption
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const editor = getVisibleTextEditor(options);
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
    public async leap(options?: RepetitionDelayOptions): Promise<void> {
        return executeCommandWithRepetitionDelay('leaper.leap', options);
    }

    /**
     * Call the 'Escape Leaper Mode' command.
     */
    public async escapeLeaperMode(options?: RepetitionDelayOptions): Promise<void> {
        return executeCommandWithRepetitionDelay('leaper.escapeLeaperMode', options);
    }

    /**
     * Insert a snippet into a visible text editor.
     */
    public async insertSnippet(
        snippet: SnippetString,
        options?: RepetitionDelayOptions & ViewColumnOption & {

            /**
             * Where to insert the snippet.
             * 
             * Defaults to the target text editor's cursor(s).
             */
            at?: CompactPosition | CompactRange;
        }
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => { 
            const at = options?.at;
            let location: Position | Range | undefined = undefined;
            if (Array.isArray(at)) {
                location = new Position(at[0], at[1]);
            } else if (typeof at === 'object') {
                location = new Range(at.start[0], at.start[1], at.end[0], at.end[1]);
            }
            const editor = getVisibleTextEditor(options);
            return editor.insertSnippet(snippet, location);
        }, options);
    }

    /**
     * Jump to a snippet tabstop in the active text editor. 
     */
    public async jumpToTabstop(
        which:    'next' | 'prev',
        options?: RepetitionDelayOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            switch (which) {
                case 'next': return commands.executeCommand('jumpToNextSnippetPlaceholder');
                case 'prev': return commands.executeCommand('jumpToPrevSnippetPlaceholder');
                default: throw new Error('Unreachable!');
            }
        }, options);
    }

    /**
     * Trigger an autocomplete suggestion in the active text editor then accept the first suggestion.
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
        return executeCommandWithRepetitionDelay('undo', options);
    }

    /**
     * Switch to another text editor in the active editor tab group.
     */
     public async switchToEditorInGroup(
        which:    'next' | 'prev',
        options?: RepetitionDelayOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            switch (which) {
                case 'next': return commands.executeCommand('workbench.action.nextEditorInGroup');
                case 'prev': return commands.executeCommand('workbench.action.previousEditorInGroup');
                default: throw new Error('Unreachable!');
            }
        }, options);
    }

    /**
     * Move the active text editor to another editor tab group.
     */
    public async moveEditorToGroup(
        which:    'left' | 'right',
        options?: RepetitionDelayOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            switch (which) {
                case 'left':  return commands.executeCommand('workbench.action.moveEditorToLeftGroup');
                case 'right': return commands.executeCommand('workbench.action.moveEditorToRightGroup');
                default: throw new Error('Unreachable!');
            }
        }, options);
    }

    /**
     * Focus on an editor tab group.
     */
    public async focusEditorGroup(
        which:    'left' | 'right' | 'first' | 'second' | 'third' | 'fourth',
        options?: RepetitionDelayOptions
    ): Promise<void> {
        const commandId = (() => {
            switch (which) {
                case 'left':   return 'workbench.action.focusLeftGroup';
                case 'right':  return 'workbench.action.focusRightGroup';
                case 'first':  return 'workbench.action.focusFirstEditorGroup';
                case 'second': return 'workbench.action.focusSecondEditorGroup';
                case 'third':  return 'workbench.action.focusThirdEditorGroup';
                case 'fourth': return 'workbench.action.focusFourthEditorGroup';
                default: throw new Error('Unreachable!');
            }
        })();
        return executeWithRepetitionDelay(async () => {
            return commands.executeCommand(commandId);
        }, options);
    }

    /**
     * Open a file within the test workspace.
     * 
     * @param relPath The path of the file relative to the root of the test workspace.
     */
    public async openFile(
        relPath:  string, 
        options?: RepetitionDelayOptions & ShowOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const rootPath = path.dirname(workspace.workspaceFile?.path ?? '');
            const filePath = path.join(rootPath, relPath);
            const document = await workspace.openTextDocument(filePath);
            return window.showTextDocument(document, options);
        }, options);
    }

    /**
     * Open a new text editor containing an empty text document.
     * 
     * @param languageId Specifies the language of the opened document. Defaults to `'typescript'`.
     */
    public async openNewTextEditor(
        languageId: string = 'typescript',
        options?:   RepetitionDelayOptions & ShowOptions
    ): Promise<void> {
        return executeWithRepetitionDelay(async () => {
            const document = await workspace.openTextDocument({ language: languageId });
            return window.showTextDocument(document, options);
        }, options);
    }

    /**
     * Close the active text editor.
     */
    public async closeActiveEditor(options?: RepetitionDelayOptions): Promise<void> {
        return executeCommandWithRepetitionDelay('workbench.action.closeActiveEditor', options);
    }

    /**
     * Set a configuration value, scoped to either the root of the test workspace or a workspace 
     * folder within it.
     * 
     * @param partialName The name of the configuration after the `leaper.` prefix.
     * @param value Value to set the configuration to.
     * @param targetWorkspaceFolder The name of the workspace folder to set the configuration in. If
     *                              not specified, will set the configuration in the root workspace.
     * @param targetLanguage The language to set the configuration to. Defaults to none.
     */
    public async setConfiguration<T>(
        args: {
            partialName:            string, 
            value:                  T,
            targetWorkspaceFolder?: string,
            targetLanguage?:        string,
        },
        options?: RepetitionDelayOptions
    ): Promise<void> {
        const { partialName, value, targetWorkspaceFolder, targetLanguage } = args;
        return executeWithRepetitionDelay(async () => {
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

            // The object that allows us to get and set the configuration value.
            const configuration = workspace.getConfiguration('leaper', fullUri);

            // Whether we set the configuration at the workspace folder level or the workspace level.
            const targetScope = targetWorkspaceFolder ? ConfigurationTarget.WorkspaceFolder 
                                                      : ConfigurationTarget.Workspace;

            // Save the previous value so that we can restore it later.
            const prevValue = configuration.get<T>(partialName); 

            // Set the configuration.
            await configuration.update(partialName, value, targetScope, !!targetLanguage);

            // Store the callback that allows configuration change we just did to be reverted.
            this.configurationRestorers.push(async () => {
                const configuration = workspace.getConfiguration('leaper', fullUri);
                return configuration.update(partialName, prevValue, targetScope, !!targetLanguage);
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
        // we are retrying tests, we could be reopening text documents with unsaved changes in them,
        // which will mess up the test as the starting state of the text document is different the 
        // second time around. By undoing all changes before closing them, we prevent such a thing 
        // from happening.
        //
        // Note that we only perform this step for titled documents, since untitled ones immediately
        // discard their unsaved changes on close.
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
 * Get a handle to the running extension instance.
 */
function getHandle(): TestAPI {
    const handle = extensions.getExtension<TestAPI>(`OnlyLys.leaper`)?.exports;
    if (!handle) {
        throw new Error(`Unable to access Leaper's API!`);
    }
    return handle;
}

function resolveViewColumnOption(viewColumnOption: ViewColumnOption | undefined): ResolvedViewColumn {
    const viewColumn = viewColumnOption?.viewColumn ?? ViewColumn.Active;
    if (viewColumn === ViewColumn.Active) {
        if (window.activeTextEditor === undefined || window.activeTextEditor.viewColumn === undefined) {
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
 * 
 * Defaults to the active text editor if no view column is specified.
 */
function getSnapshot(viewColumnOption: ViewColumnOption | undefined): TrackerSnapshot {
    const viewColumn = resolveViewColumnOption(viewColumnOption);
    const snapshot   = getHandle().snapshot().get(viewColumn);
    if (!snapshot) {
        throw new Error(`Unable to obtain snapshot of text editor in view column ${viewColumn}.`);
    }
    return snapshot;
}

/**
 * Get a reference to a visible text editor.
 * 
 * Defaults to the active text editor if no view column is specified.
 */
function getVisibleTextEditor(viewColumnOption: ViewColumnOption | undefined): TextEditor {
    const viewColumn = resolveViewColumnOption(viewColumnOption);
    const editor     = window.visibleTextEditors.find(editor => editor.viewColumn === viewColumn);
    if (!editor) {
        throw new Error(`Unable to obtain text editor in view column ${viewColumn}.`);
    }
    return editor;
}

/**
 * Execute a callback `options.repetitions` amount of times, applying a `options.delay` wait after
 * each repetition.
 * 
 * If no `options` are provided, then `options.repetitions` defaults to `1` while `options.delay`
 * defaults to `30`.
 */
async function executeWithRepetitionDelay(
    callback: () => Promise<any>, 
    options: RepetitionDelayOptions | undefined
): Promise<void> {
    const DEFAULT_DELAY_MS    = 30;
    const DEFAULT_REPETITIONS = 1;
    const delay     = options?.delay       ?? DEFAULT_DELAY_MS;  
    let repetitions = options?.repetitions ?? DEFAULT_REPETITIONS;
    while (repetitions-- > 0) {
        await callback();
        await waitFor(delay);
    }
}

/**
 * Execute a command `options.repetitions` amount of times, applying a `options.delay` wait after
 * each repetition.
 * 
 * If no `options` are provided, then `options.repetitions` defaults to `1` while `options.delay`
 * defaults to `30`.
 */
async function executeCommandWithRepetitionDelay(
    commandId: string,
    options:   RepetitionDelayOptions | undefined
): Promise<void> {
    return executeWithRepetitionDelay(async () => commands.executeCommand(commandId), options);
}

interface ViewColumnOption {

    /**
     * The view column of the visible text editor to perform the check or action in.
     * 
     * Defaults to `ViewColumn.Active`.
     */
    viewColumn?: ViewColumn.Active | ViewColumn.One | ViewColumn.Two | ViewColumn.Three | ViewColumn.Four;
    
}

interface RepetitionDelayOptions {

    /** 
     * How many times to execute this action. 
     * 
     * Defaults to `1`. 
     */
    repetitions?: number;

    /** 
     * Milliseconds of delay to apply after each action execution. 
     * 
     * Defaults to `30`. 
     *
     * # Why This Option Even Exists
     * 
     * When are writing to vscode, we need some delay time after each write to make sure that the
     * engine has acknowledged them before proceeding, because the engine gets passed information
     * about changes in the text editor asynchronously. 
     */
    delay?: number;

}

type ShowOptions = Pick<TextDocumentShowOptions, 'viewColumn' | 'preserveFocus'>;
