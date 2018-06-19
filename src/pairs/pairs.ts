'use strict';

import { Position, TextDocumentContentChangeEvent, window, Range, TextEditor } from 'vscode';
import { Pair } from './pair';
import { Settings } from '../settings';

/** 
 * A container of `Pair`s, which are each representations of pairs that are currently being tracked 
 * in the active text editor.
 */
export class Pairs {
    
    /** The actual data structure that contains the pairs. */
    private data: Pair[] = [];

    private settings: Readonly<Settings>;

    /** 
     * List of recently removed pairs by the cursor change updater. 
     * 
     * VS Code is fairly inconsistent with whether the cursor move triggers first or whether the
     * content change is applied first when inserting or replacing text. For example, normal text 
     * insertion has the content change come before the cursor movement, while snippet insertions 
     * have it the other way around, which removes pairs that shouldn't be removed.
     * 
     * More specifically, when the cursor moves first, the `updateGivenCursorChanges()` method that triggers
     * on a cursor move can erroneously remove pairs from tracking even though the cursor is actually
     * within the pair after the entire text edit is complete.
     * 
     * Therefore when `Pair`s are removed by the cursor updater, we should store them in a temporarily
     * list to then give the content change watcher one chance to rescue any erroneously removed ones.
     */
    private recentlyRemovedDueToCursorMove: Pair[] = [];

    /** @return `true` only if no pairs are being tracked. */
    public get isEmpty(): boolean {
        return this.data.length < 1;
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
     * @param activeTextEditor The currently active text editor in which the changes occurred in.
     */
    public updateGivenContentChanges(contentChanges: TextDocumentContentChangeEvent[], activeTextEditor: TextEditor): void {
        // Recover any erroneously removed pairs by applying the content changes and checking if the
        // cursor is within them
        const [pending] = applyContentChanges(this.recentlyRemovedDueToCursorMove, contentChanges);
        const [recovered] = removeEscapedPairs(pending, activeTextEditor.selection.active);
        this.recentlyRemovedDueToCursorMove = [];
        // Update the existing list then add the recovered ones back in
        const [updated, removed] = applyContentChanges(this.data, contentChanges);
        this.data = updated;
        this.data.push(...recovered);
        // Add any new pair into the list
        const newPair: Pair | undefined = checkForNewPair(contentChanges, this.settings);
        if (newPair) { 
            this.data.push(newPair);
        }
        undecorate(removed);
        decorate(this.data, this.settings.decorateOnlyNearestPair);
    }

    /** 
     * Update the pairs due to cursor changes in the text editor: when the cursor is moved out of a 
     * pair, the pair is removed from tracking. This step implicitly removes any copy pasted pairs 
     * from being tracked and leaves only autoclosing pairs (which is what we want), because copy 
     * pasted pairs have a final cursor position that is outside the pair.
     * 
     * @param activeTextEditor The currently active text editor.
     */
    public updateGivenCursorChanges(activeTextEditor: TextEditor): void {
        const [retained, removed] = removeEscapedPairs(this.data, activeTextEditor.selection.active);
        this.recentlyRemovedDueToCursorMove = removed;
        this.data = retained;
        if (removed.length > 0) {
            undecorate(removed);
            decorate(this.data, this.settings.decorateOnlyNearestPair);
        }
    }

    /** Clears the list of `Pair`s and any decorations. */
    public clear(): void {
        this.data.forEach((pair) => pair.undecorate());
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
 * @param pairs The list of `Pair`s to update.
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
 * Check if a new pair was inserted into the document.
 * 
 * @param contentChanges - The content changes that may have introduced a pair.
 * @param settings - The extension's current settings.
 * @return A `Pair` if the content changes introduced a pair. Otherwise `undefined`.
 */
function checkForNewPair(contentChanges: TextDocumentContentChangeEvent[], settings: Readonly<Settings>): Pair | undefined {
    // We only consider the first element of content changes because when autoclosing pairs are 
    // inserted they only manifest as a single content change that overwrites no text
    const { range, text } = contentChanges[0];
    const { triggerPairs, decorationOptions } = settings;
    return range.isEmpty && triggerPairs.some(tp => text[0] === tp.open && text[1] === tp.close) ?
        new Pair(range.start, range.start.translate({ characterDelta: 1 }), decorationOptions) : undefined;
}

/** 
 * Remove any `Pair`s that the cursor has moved out of.
 * 
 * @param pairs The list of `Pair`s to update.
 * @param cursorPos The current cursor position.
 * @return A tuple containing a list of retained `Pair`s followed by a list of removed `Pair`s.
 */
function removeEscapedPairs(pairs: Pair[], cursorPos: Position): [Pair[], Pair[]] {
    const retained: Pair[] = [];
    const removed: Pair[] = [];
    for (const pair of pairs) {
        pair.enclosesPos(cursorPos) ? retained.push(pair) : removed.push(pair);
    }
    return [retained, removed];
}

/**
 * @param pairs Decorate all `Pair`s this list.
 * @param decorateOnlyNearestPair If `true` will only decorate the most nested `Pair` in `pairs`. 
 * Otherwise decorates all `Pair`s.
 */
function decorate(pairs: Pair[], decorateOnlyNearestPair: boolean): void {
    if (pairs.length < 1) {
        return;
    }
    undecorate(pairs);   // Remove old decorations before redecorating because it's easier to manage this way
    decorateOnlyNearestPair ? pairs[pairs.length - 1].decorate() : pairs.forEach((pair) => pair.decorate());
}

/** @param pairs Undecorate all `Pair`s this list. */
function undecorate(pairs: Pair[]): void {
    pairs.forEach((pair) => pair.undecorate());
}