import { workspace, TextEditor, commands, Range, WorkspaceEdit, window, extensions } from 'vscode';
import * as assert from 'assert';
import { TestAPI } from '../extension';

/** 
 * Type text into the text editor. Each string in the input array is sent as a separate command.
 * 
 * Because `default:type` command used in this function is not a well documented feature, it's 
 * unclear whether or not argument text with input length greater than 1 is allowed even though it 
 * currently works. So, if possible, avoid providing arguments that are more than 1 character long.
 */
export async function type(...inputs: string[]): Promise<void> {
    for (const input of inputs) {
        await commands.executeCommand('default:type', { text: input });
    }
}
 
/** Clear all text in the document in the active text editor. */
export async function clearDocument(): Promise<void> {
    await commands.executeCommand('editor.action.selectAll');
    await commands.executeCommand('deleteLeft');
}

/** Execute a `backspace` command. */
export async function backspace(): Promise<void> {
    await commands.executeCommand('deleteLeft');
}

/** Execute a 'jump to next tabstop' command `n` times. `n` defaults to 1. */
export async function jumpToNextTabstop(n: number = 1): Promise<void> {
    for (let i = 0; i < n; ++i) {
        await commands.executeCommand('jumpToNextSnippetPlaceholder');
    }
}

/** Execute a 'jump to previous tabstop' command `n` times. `n` defaults to 1. */
export async function jumpToPrevTabstop(n: number = 1): Promise<void> {
    for (let i = 0; i < n; ++i) {
        await commands.executeCommand('jumpToPrevSnippetPlaceholder');
    }
}

/** 
 * Perform a `leaper.leap` command, then validate the post-leap position.
 * 
 * @param editor The text editor that the leap occurs in.
 * @param expectedDelta The expected translation as a result of the leap. Format: `[line, character]`.
 * @param expectChar The expected closing character of the pair that was leapt out of. Leave empty
 * to skip the check.
 */
export async function leap(
        editor: TextEditor, 
        expectDelta: [number, number],
        expectChar?: string, 
    ): Promise<void> {
    const preLeapPos = editor.selection.active;    
    await commands.executeCommand(`leaper.leap`);
    await wait(20);
    const postLeapPos = editor.selection.active;
    assert.deepStrictEqual(
        [postLeapPos.line - preLeapPos.line, postLeapPos.character - preLeapPos.character],
        expectDelta
    );
    // Optionally check that the closing side of the pair that was leaped out of is correct
    if (expectChar) {
        assert.deepStrictEqual(
            editor.document.getText(new Range(postLeapPos.translate(0, -1), postLeapPos)), 
            expectChar
        );
    }
}

/** Move the cursor right by `n` number of characters. Specify negative to move backwards. */
export async function moveCursorRight(n: number): Promise<void> {
    await commands.executeCommand('cursorMove', { to: 'right', by: 'character', value: n });
    /* Since selection change updates are only done at the end of each loop, we put in a small delay
    after moving the cursor to let the trackers update. */
    return wait(5);
}

/** Move the cursor down by `n` number of lines. Specify negative to move upwards. */
export async function moveCursorDown(n: number): Promise<void> {
    await commands.executeCommand('cursorMove', { to: 'down', by: 'line', value: n });
    /* Since selection change updates are only done at the end of each loop, we put in a small delay
    after moving the cursor to let the trackers update. */
    return wait(5);
}

/** Timeout by `n` milliseconds. */
async function wait(n: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const expiryTimeout = setTimeout(() => reject('`wait` expired after 2s'), 2000);
        setTimeout(() => { 
            clearTimeout(expiryTimeout); 
            resolve(); 
        }, n);
    });
}

/** 
 * Replace a range text in a text editor. The cursor does not follow the change. 
 * 
 * @param editor The text editor that the leap occurs in.
 * @param replace The range of text to replace. Format: `[startLine, startCharacter, endLine, endCharacter]`.
 * @param insert String to insert at the start of the replaced range.
 */
export async function insertText(
        editor: TextEditor, 
        replace: [number, number, number, number], 
        insert: string
    ): Promise<void> {
    const workspaceEditBuilder = new WorkspaceEdit();
    workspaceEditBuilder.replace(
        editor.document.uri, 
        new Range(replace[0], replace[1], replace[2], replace[3]), 
        insert
    );
    if (!await workspace.applyEdit(workspaceEditBuilder)) {
        throw new Error('Text Insertion Failed!');
    }
}

/** 
 * Check that the primary cursor has the expected position within the text editor. 
 * 
 * The expected position is specified as a doublet: `[line, character]`.
 */
export function verifyCursor(editor: TextEditor, expectedPos: [number, number]): void {
    const { line: cursorLine, character: cursorCharacter } = editor.selection.active;
    assert.deepStrictEqual([ cursorLine, cursorCharacter ], expectedPos);
}

/** 
 * Get a bare snapshot of all the pairs being tracked and check that they have the expected 
 * positions. 
 * 
 * The decoration state of pairs are not checked.
 */
export function verifyPairs(testAPI: TestAPI, expected: [number, number, number, number][][]): void {
    assert.deepStrictEqual(
        (testAPI.snapshot() ?? []).map(
            (cluster) => cluster.map(
                (pair): [number, number, number, number] => 
                    [pair.open.line, pair.open.character, pair.close.line, pair.close.character]
                        
            )
        ), 
        expected
    );
}

/** 
 * Verify that there are no pairs being tracked by the engine. 
 */
export function verifyEmpty(testAPI: TestAPI): void {
    assert.ok(testAPI.snapshot()?.every(cluster => cluster.length === 0));
}

/** 
 * Open a new text editor in the current workspace which will immediately take focus. 
 */
export async function openNewTextEditor(): Promise<TextEditor> {
    return window.showTextDocument(await workspace.openTextDocument());
}

/** 
 * Access testing methods to the active extension instance. 
 */
export function getTestAPI(): TestAPI {
    const extension = extensions.getExtension<TestAPI>(`OnlyLys.leaper`);
    if(!extension) {
        throw new Error('Cannot access extension API');
    }
    return extension.exports;
}

/** 
 * Long arbitrary text 1 used for tests.
 * 
 * Line count: 7
 * Last line length: 89
 */
export const ALICE_TEXT_1 = 
`Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to 
do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'

So she was considering in her own mind (as well as she could, for the hot day made her feel very 
sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.`;

/**
 * Long arbitrary text 2 used for tests.
 * 
 * Line count: 8
 * Last line length: 16
 */
export const ALICE_TEXT_2 = 
`There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
under the hedge.`;
