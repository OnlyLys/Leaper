'use strcit';

import { window, workspace, TextDocument, TextEditor, Position, commands, Range } from 'vscode';
import * as assert from 'assert';

/** 
 * Send commands that type text to the editor. Each string separated by a comma in the argument
 * list is sent as a separate command.
 */
export async function type(...text: string[]): Promise<void> {
    for (const t of text) {
        await commands.executeCommand('default:type', { text: t });
    }
}

/** 
 * Perform a validated leap that checks the final position after the leap. If no argument is provided
 * then no validation is done.
 * 
 * @param textEditor The text editor that the leap occurs in.
 * @param expectMove The expected number of unit characters that is leapt.
 * @param expectClosing The expected closing character of the pair that was leapt out of. Leave
 * this parameter `undefined` to skip this check.
 * @param errMsg Error message to print to debug console on assertion fail.
 * @return The position after the leap.
 */
export async function leap(arg?: {textEditor: TextEditor, expectMove: number, expectClosing?: string, errMsg?: string} ): Promise<void> {
    if (!arg) {
        await commands.executeCommand('leaper.leap');
        return;
    }
    const { textEditor, expectMove, expectClosing, errMsg } = arg;
    const pre: Position = textEditor.selection.active;      // Position before leap
    await commands.executeCommand('leaper.leap');
    const post: Position = textEditor.selection.active;     // Position after leap
    assert.deepStrictEqual(post, pre.translate({ characterDelta: expectMove }), errMsg);
    if (expectClosing) {
        const oneBeforePost: Position = new Position(post.line, post.character - 1);
        assert.deepStrictEqual(textEditor.document.getText(new Range(oneBeforePost, post)), expectClosing, errMsg);
    }
}

/** Specify negative to move leftwards. */
export async function moveCursorRight(by: number): Promise<void> {
    await commands.executeCommand('cursorMove', { to: 'right', by: 'character', value: by });
}

/** Specify negative to move upwards. */
export async function moveCursorDown(by: number): Promise<void> {
    await commands.executeCommand('cursorMove', { to: 'down', by: 'line', value: by });
}

/** 
 * Open a new text document in the current workspace. If `content` is supplied then the text
 * document will open with that in the document.
 */
export async function openNewTextDocument(content?: string): Promise<TextEditor> {
    const document: TextDocument = await workspace.openTextDocument({ content });
    return await window.showTextDocument(document);
}