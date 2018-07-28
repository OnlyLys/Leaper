'use strict';

import { window, workspace, TextDocument, TextEditor, Position, commands, Range, WorkspaceEdit } from 'vscode';
import * as assert from 'assert';

/** 
 * Send commands that simulate typing text to the editor. Each string separated by a comma in the 
 * argument list is sent as a separate command.
 * 
 * Because `default:type` is not a well documented feature, it's unclear whether or not `default:type`
 * commands with argument text with length greater than 1 is allowed even though it currently works. 
 * So, if possible, avoid providing arguments that are more than 1 character long.
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
export async function leap(arg?: { textEditor: TextEditor, expectMove: number, expectClosing?: string, 
    errMsg?: string }): Promise<void> 
{
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

/** @param by Move the cursor right by this amount of characters. Specify negative to move backwards. */
export async function moveCursorRight(by: number): Promise<void> {
    await commands.executeCommand('cursorMove', { to: 'right', by: 'character', value: by });
}

/** @param by Move the cursor down by this amount of lines. Specify negative to move upwards. */
export async function moveCursorDown(by: number): Promise<void> {
    await commands.executeCommand('cursorMove', { to: 'down', by: 'line', value: by });
}

/** 
 * Open a new text document in the current workspace. 
 * 
 * @param content Text context that the new document will start with.
 */
export async function openNewTextDocument(content?: string): Promise<TextEditor> {
    const document: TextDocument = await workspace.openTextDocument({ content });
    return await window.showTextDocument(document);
}

/**
 * Insert text into a text editor. If a range is given then the range will be replaced by the text.
 * 
 * @param textEditor The text editor that the replacement is to occur in.
 * @param start The starting position of the range to be replaced. If unspecified, will use the current 
 * cursor position.
 * @param end The ending position of the range to be replaced. If a `number` is given, the range will 
 * be single line and span that length. If a `Position` is given, then the range will end at that
 * position. If unspecified, the range will be empty.
 * @param insert Text to insert at the start of the range.
 * @param follow If `false`, the cursor will not move to the end of the inserted text after the edit.
 */
export async function insertText(arg: { textEditor: TextEditor, start?: Position, end?: number | Position, 
    text: string, follow?: boolean }): Promise<void> 
{
    const {textEditor, start = arg.textEditor.selection.active, end = 0, text, follow = true } = arg;
    const endPos = typeof end === 'number' ? start.translate({ characterDelta: end }) : end;

    if (follow) {
        // Text Editor edits have the cursor follow after the text edit
        await textEditor.edit((editBuilder) => editBuilder.replace(new Range(start, endPos), text));
    } else {
        // Workspace edits do not have the cursor follow after the text edit.
        const workspaceEditBuilder = new WorkspaceEdit();
        workspaceEditBuilder.replace(textEditor.document.uri, new Range(start, endPos), text);
        await workspace.applyEdit(workspaceEditBuilder);
    }
}