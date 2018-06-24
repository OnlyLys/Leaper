'use strict';

import { Position, TextDocumentContentChangeEvent, window, Range, TextEditor, TextEditorDecorationType, DecorationRenderOptions } from 'vscode';
import { Pair } from './pair';
import { Settings } from '../settings';

/** 
 * A container of `Pair`s, which are each representations of pairs that are currently being tracked 
 * in the active text editor.
 */
export class Pairs {
    
    /** The actual data structure that contains the pairs. */
    private data: Pair[] = [];

    /** The decorations for the closing characters of the pairs. */
    private decorations: TextEditorDecorationType[] = [];

    /** A view of the extension's settings. The controller is responsible for keeping this updated. */
    private settings: Readonly<Settings>;

    /** 
     * List of recently removed pairs by the cursor change updater. 
     * 
     * VS Code is fairly inconsistent with whether the cursor move triggers first or whether the
     * content change is applied first when inserting or replacing text. For example, normal text 
     * insertion has the content change come before the cursor movement, while snippet insertions 
     * have it the other way around, which removes pairs that shouldn't be removed.
     * 
     * More specifically, when the cursor moves first, the `updateGivenCursorChanges()` method that 
     * is triggered by a cursor move can erroneously remove pairs from tracking even though the cursor 
     * is actually within the pair after the entire text edit is complete.
     * 
     * Therefore when `Pair`s are removed by the cursor updater, we should store them in a temporarily
     * list to then give the content change watcher one chance to rescue any erroneously removed ones.
     */
    private recentlyRemovedDueToCursorMove: Pair[] = [];

    /** @return `true` only if no pairs are being tracked. */
    public get isEmpty(): boolean {
        return this.data.length < 1;
    }

    /** @return A list of `Pair`s which each represent a pair that is being tracked in the document. */
    public get raw(): Pair[] {
        return this.data;
    }

    /**
     * Check if there is a line of sight from the current cursor position to the nearest available pair.
     * Having line of sight means having no non-whitespace text between the cursor position and the
     * closing character of the pair.
     *
     * @return `true` only if
     * - There is *no* non-whitespace text between the cursor and the closing side of the nearest pair.
     * - There are pairs available to jump out of.
     */
    public get hasLineOfSight(): boolean {
        if (!window.activeTextEditor || this.data.length < 1) {
            return false;
        }
        const cursorPos: Position = window.activeTextEditor.selection.active;
        const textInBetween: string = window.activeTextEditor.document.getText(
            new Range(cursorPos, this.data[this.data.length - 1].close)
        );
        return textInBetween.trim().length === 0;
    }

    /** @return (If any) the most nested `Pair` in the list. */
    public get mostNested(): Pair | undefined {
        // The most nested pair is also the most recently added pair
        return this.data[this.data.length -1];
    }

    /** @param settings A reference to the current settings for the extension. */
    constructor(settings: Readonly<Settings>) {
        this.settings = settings;
    }

    /** 
     * Update the pairs due to content changes in the document. The content changes may move/delete
     * existing pairs.
     * 
     * @param contentChanges A list of content changes that have occurred in the text document.
     * @param textEditor The text editor in which the changes occurred in.
     */
    public updateGivenContentChanges(contentChanges: TextDocumentContentChangeEvent[], textEditor: TextEditor): void {
        // Recover any erroneously removed pairs by applying the content changes and checking if the
        // cursor is within them
        const [pending] = applyContentChanges(this.recentlyRemovedDueToCursorMove, contentChanges);
        const [recovered] = removeEscapedPairs(pending, textEditor.selection.active);
        // Update the existing list then add the recovered ones back in
        const [updated, removed] = applyContentChanges(this.data, contentChanges);
        this.data = updated;
        this.data.push(...recovered);
        // Add any new pairs into the list
        const newPair: Pair | undefined = checkForNewPair(contentChanges, this.settings.triggerPairs);
        if (newPair) { 
            this.data.push(newPair);
        }
        if (removed.length > 0 || recovered.length > 0 || newPair) {
            this.updateDecorations(textEditor);
        }
    }

    /** 
     * Update the pairs due to cursor changes in the text editor: when the cursor is moved out of a 
     * pair, the pair is removed from tracking. This step implicitly removes any copy pasted pairs 
     * from being tracked and leaves only autoclosing pairs (which is what we want), because copy 
     * pasted pairs have a final cursor position that is outside the pair.
     * 
     * @param textEditor The text editor that the cursor moved in.
     */
    public updateGivenCursorChanges(textEditor: TextEditor): void {
        const [retained, removed] = removeEscapedPairs(this.data, textEditor.selection.active);
        this.recentlyRemovedDueToCursorMove = removed;
        this.data = retained;
        if (removed.length > 0) {
            this.updateDecorations(textEditor);
        }
    }

    /**
     * Update decorations of the closing character of pairs. If `leaper.decorateOnlyNearestPair`
     * contribution is `true` (which it is by default) then only the most nested pair in `this.data`
     * will be decorated. Otherwise all pairs are decorated. 
     * 
     * Opening characters of pairs are not decorated.
     * 
     * For efficiency reasons we should only update decorations when pairs are removed or added. 
     * There is no need to update decorations when there is only a positional change as the editor
     * does that already.
     * 
     * @param textEditor The text editor to apply the decorations onto.
     */
    private updateDecorations(textEditor: TextEditor): void {
        // Strip old decorations first because it's easier to manage this way
        this.decorations.forEach(decoration => decoration.dispose());
        const {decorateOnlyNearestPair, decorationOptions} = this.settings;
        if (decorateOnlyNearestPair) {
            this.decorations = [ applyDecoration(
                this.data[this.data.length - 1], 
                textEditor, 
                decorationOptions
            )];
        } else {
            this.decorations = this.data.map(pair => applyDecoration(
                pair, 
                textEditor, 
                decorationOptions
            ));
        }
    }

    /** Clears the list of `Pair`s and any decorations. */
    public clear(): void {
        this.decorations.forEach(decoration => decoration.dispose());
        this.decorations = [];
        this.data = [];
        this.recentlyRemovedDueToCursorMove = [];
    }

}

/** 
 * Update the state of a list of pairs by applying content changes:
 * - Filter out `Pair`s that have been deleted by the content changes.
 * - Filter out `Pair`s that have had a multiline text inserted in between it.
 * - Update the remaining `Pair`s to reflect the new positions of the pairs in the document.
 * 
 * @param pairs The list of `Pair`s to update. The input list is consumed.
 * @param contentChanges The content changes that deleted or move the pairs.
 * @return A tuple containing a list of updated `Pair`s followed by a list of removed `Pair`s.
 */
function applyContentChanges(pairs: Pair[], contentChanges: TextDocumentContentChangeEvent[]): [Pair[], Pair[]] {
    const updated: Pair[] = [];
    const removed: Pair[] = [];
    outer:
        for (const pair of pairs) {
            for (const {range: replacedRange, text: insertedText} of contentChanges) {
                const newOpen: Position | undefined = shift(pair.open, replacedRange, insertedText);
                const newClose: Position | undefined = shift(pair.close, replacedRange, insertedText);
                // Remove if either side deleted or if multi-line text inserted in between                
                if (!newOpen || !newClose || newOpen.line !== newClose.line) {
                    removed.push(pair);
                    continue outer;
                }
                pair.open = newOpen;
                pair.close = newClose;
            }
            updated.push(pair);
        }
    pairs.length = 0;
    return [updated, removed];
}

/** 
 * Get a new position from an old one that is shifted or deleted due to a text replacement that
 * occurred anywhere in the document. The position is considered deleted if the text replacement 
 * overwrote the position.
 * 
 * @param pos Initial position.
 * @param replacedRange The range of text that was overwritten.
 * @param insertedText New text that was inserted at the start of the replaced region.
 * @return The new shifted position. However `undefined` is returned if the content change deleted 
 * the position.
 */
export function shift(pos: Position, replacedRange: Range, insertedText: string): Position | undefined {
    if (pos.isAfterOrEqual(replacedRange.start) && pos.isBefore(replacedRange.end)) {
        return undefined;   // Position overwritten by content change: position deleted
    } else if (pos.isBefore(replacedRange.start)) {
        return pos;         // Content change occurred after the position: no change
    }
    // What's left is content change before the position, which shifts the position

    // First get the end position of the inserted text
    const insertedTextEnd: Position = getAppendEnd(replacedRange.start, insertedText);
    // Then get range of the text between the end of the overwritten region and `pos`
    const remainder: Range = new Range(replacedRange.end, pos); 
    // Append the remainder to the end of the newly inserted text to get the final ending position
    return getAppendEnd(insertedTextEnd, remainder);

    /** 
     * Get the end position of a range that is appended to the end of `pos`. 
     * 
     * @param pos The position from which the range of `arg` is added to.
     * @param arg A range that is appended to `pos`. If `arg` is of type `string`, then the range of the 
     * string will be used.
     * @return The end position of the appended range. 
    */
    function getAppendEnd(pos: Position, arg: string | Range): Position {
        let deltaLines: number;
        let lastLineLengthOfArg: number;
        if (typeof arg === 'string') {
            const splitByNewline = arg.split('\n');
            deltaLines = splitByNewline.length - 1;
            lastLineLengthOfArg = splitByNewline[splitByNewline.length - 1].length;
        } else {
            deltaLines = arg.end.line - arg.start.line;
            lastLineLengthOfArg = arg.end.character - (arg.isSingleLine ? arg.start.character : 0);
        }
        return new Position(
            pos.line + deltaLines,
            lastLineLengthOfArg + (deltaLines === 0 ? pos.character : 0)
        );
    }
}

/** 
 * Check whether a new pair was inserted into the document.
 * 
 * @param contentChanges - The content changes that may have introduced a pair.
 * @param triggerPairs - The rule set that determines what pairs will be tracked by the extension.
 * @return A `Pair` if the content changes introduced a pair. Otherwise `undefined`.
 */
function checkForNewPair(
    contentChanges: TextDocumentContentChangeEvent[], 
    triggerPairs: ReadonlyArray<{ open: string, close: string }>
): Pair | undefined {
    // We only consider the first element of content changes because autoclosing pairs are only
    // inserted as a single content change that overwrites no text (so range is empty)
    const { range, text } = contentChanges[0];
    if (range.isEmpty && triggerPairs.some(tp => text[0] === tp.open && text[1] === tp.close)) {
        return new Pair(range.start, range.start.translate({ characterDelta: 1 }));
    } else {
        return undefined;
    }
}

/** 
 * Remove any `Pair`s that the cursor has moved out of.
 * 
 * @param pairs The list of `Pair`s to update. The input list is consumed.
 * @param cursorPos The current cursor position.
 * @return A tuple containing a list of retained `Pair`s followed by a list of removed `Pair`s.
 */
function removeEscapedPairs(pairs: Pair[], cursorPos: Position): [Pair[], Pair[]] {
    const retained: Pair[] = [];
    const removed: Pair[] = [];
    for (const pair of pairs) {
        pair.enclosesPos(cursorPos) ? retained.push(pair) : removed.push(pair);
    }
    pairs.length = 0;
    return [retained, removed];
}


/** 
 * Apply the closing character decoration of a pair onto a text editor.
 * 
 * @param pair The pair to apply the decoration for.
 * @param textEditor The text editor to apply the decoration onto.
 * @param decorationOptions The options for the closing character's decoration.
 * @return TextEditorDecorationType that when disposed will remove the decoration from the document. */
function applyDecoration(
    pair: Pair, 
    textEditor: TextEditor, 
    decorationOptions: DecorationRenderOptions
): TextEditorDecorationType {
    const decoration = window.createTextEditorDecorationType(decorationOptions);
    textEditor.setDecorations(
        decoration,
        [ new Range(
            pair.close, 
            pair.close.translate({ characterDelta: 1 })
        )]
    );
    return decoration;
}