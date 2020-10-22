//! The following module defines the test framework for this extension.

import { TextEditor, commands, Range, Selection, Position, SnippetString, TextEditorEdit } from 'vscode';
import * as assert from 'assert';
import { TestAPI } from '../../extension';
import { CompactCursors, CompactClusters, CompactRange, CompactPosition } from './compact';
import { closeActiveEditor, getHandle, openNewTextEditor, pickRandom, waitFor, zip } from './other';

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
         *  Callback to setup the editor for this test case. 
         */
        readonly prelude?: (executor: PreludeActionExecutor) => Promise<void>,

        /** 
         * Callback to execute as part of the test case. 
         */
        readonly action: (executor: ActionExecutor) => Promise<void>

    }) {}

    public run(): void {
        const { name, editorLanguageId, prelude, action } = this.args;
        it(name, async function () {

            // Sometimes tests can fail due to the editor lagging.
            this.retries(1);

            // Open a new editor for the tests.
            const editor = await openNewTextEditor(editorLanguageId);

            // Get a handle to the active editor instance.
            const handle = getHandle();

            // Setup the editor for the test.
            if (prelude) {
                await prelude(new PreludeActionExecutor(editor, handle));
            }

            // Run the actual test.
            await action(new ActionExecutor(editor, handle));

            // Close the opened editor.
            await closeActiveEditor();
        });
    }

}


/**
 * A convenience class that allows a test case to:
 * 
 *  1. Modify and assert the state of the editor that it is bound to.
 *  2. Assert the state of the extension.
 */
export class ActionExecutor {

    /**
     * @param editor The fresh text editor that is provided ot each test case.
     * @param handle A handle to the active extension instance.
     */
    public constructor(
        protected readonly editor: TextEditor, 
        protected readonly handle: TestAPI
    ) {
        this.editor = editor;
        this.handle = handle;
    }
    
    public assertPairs(expected: CompactClusters): void {
        this._assertPairs(expected, 'Pairs Mismatch');
    }

    protected _assertPairs(expected: CompactClusters, msg: string): void {

        // Convert the clusters to a simpler form that displays better during assertion failures.
        type Simple = { open: [number, number], close: [number, number] }[][];
        const actual: Simple = this.handle.activeSnapshot().map((cluster) => 
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

        assert.deepStrictEqual(actual, _expected, msg);
    }

    public assertCursors(expected: CompactCursors): void {
        this._assertCursors(expected, 'Cursors Mismatch');
    }

    protected _assertCursors(expected: CompactCursors, msg: string): void {
        const actual: CompactCursors = this.editor.selections.map(({ active, anchor }) => {
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
            
        assert.deepStrictEqual(actual, _expected, msg);
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
            return this.editor.edit(applyAllEdits);
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
            this.editor.selections = args.cursors.map((cursor) => {
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
     * Insert a snippet into the editor.
     * 
     * The snippet will be inserted at cursor position.
     */
    public async insertSnippet(args: InsertSnippetArgs): Promise<void> {
        return executeWithRepetitionDelay(async () => { 
            return this.editor.insertSnippet(args.snippet);
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

}

/**
 * Same as `ActionExecutor` except that the `assertPairs` and `assertCursors` method show slightly 
 * different error messages that indicate that the assertions failed in test case preludes.
 */
export class PreludeActionExecutor extends ActionExecutor {

    public assertPairs(expected: CompactClusters): void {
        this._assertPairs(expected, '(Prelude Failure) Pairs Mismatch');
    }

    public assertCursors(expected: CompactCursors): void {
        this._assertCursors(expected, '(Prelude Failure) Cursors Mismatch');
    }

}

/**
 * This function is a way for us to abstract out the handling of repetitions and delays from the
 * method definitions in `TestContext`.
 */
async function executeWithRepetitionDelay(
    callback: () => Promise<any>, 
    options?: RepetitionDelayOptions
): Promise<void> {
    const delay     = options?.delay ?? 30;
    let repetitions = options?.repetitions ?? 1;
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
    edits: ReadonlyArray<ReplaceTextEdit | InsertTextArgs | DeleteTextArgs>;
}

interface ReplaceTextEdit {

    /** 
     * Replace a range of text in the document. 
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

interface InsertTextArgs {

    /** 
     * Insert text at a position in the document.
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

interface DeleteTextArgs {

    /**
     * Delete a range of text in the document.
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
     * Set all the cursors in the editor.
     */
    cursors: CompactCursors;
}

interface InsertSnippetArgs extends RepetitionDelayOptions {

    /**
     * Insert a snippet into the editor at where the cursors are at.
     */
    snippet: SnippetString;
}
