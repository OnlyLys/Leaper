'use strict';

import { Position, TextDocumentContentChangeEvent, window, Range, TextEditor } from 'vscode';
import { Pair } from './pair';
import { Settings } from '../settings';

/** 
 * A list of containing `Pair`s, which are each representations of pairs that are currently being 
 * tracked in the text editor.
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
        // The most nested pair is also the most recently added pair. It is also the pair that is 
        // nearest to the current cursor position.
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
        // cursor is within them.
        const [pending] = applyContentChanges(this.recentlyRemovedDueToCursorMove, contentChanges);
        const recovered = pending.filter((pair) => pair.enclosesPos(activeTextEditor.selection.active));
        this.recentlyRemovedDueToCursorMove = [];
        // Update the existing list then add the recovered ones back in
        const [updated, removed] = applyContentChanges(this.data, contentChanges);
        this.data = updated;
        this.data.push(...recovered);
        // Add any new pairs into the list then redecorate
        const newPair: Pair | undefined = getNewPair(contentChanges, this.settings);
        if (newPair) {
            this.data.push(newPair);
        }
        removeDecorations(removed);
        reapplyDecorations(this.data, this.settings.decorateOnlyNearestPair);
    }

    /** 
     * Update the pairs due to cursor changes in the text editor: when the cursor is moved out of a 
     * pair, the pair is removed from tracking.
     * 
     * @param activeTextEditor The currently active text editor.
     */
    public updateGivenCursorChanges(activeTextEditor: TextEditor): void {
        const [retained, removed] = removeEscapedPairs(this.data, activeTextEditor);
        this.recentlyRemovedDueToCursorMove = removed;
        this.data = retained;
        if (removed.length > 0) {
            removeDecorations(removed);
            reapplyDecorations(this.data, this.settings.decorateOnlyNearestPair);
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
            for (const contentChange of contentChanges) {
                const newOpen: Position | undefined = getNewPos(pair.open, contentChange);
                const newClose: Position | undefined = getNewPos(pair.close, contentChange);
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

    /** 
     * Get a new position as a result of a text content change that occurred anywhere in the document.
     * The position is considered deleted if the content change overwrites the position.
     * 
     * @param pos Initial position that is shifted/deleted by the content change.
     * @param contentChange The relevant content change.
     * @return The new shifted position. However `undefined` is returned if the content change deleted 
     * the position.
     */
    function getNewPos(pos: Position, contentChange: TextDocumentContentChangeEvent): Position | undefined {
        if (pos.isAfterOrEqual(contentChange.range.start) && pos.isBefore(contentChange.range.end)) {
            return undefined;   // Position overwritten by content change
        } else if (pos.isBefore(contentChange.range.start)) {
            return pos;         // Content change occurred after the position: no change
        }
        // What's left is content change that occured before the position
        //
        // Define gap range as the range between the overwritten range and `pos`
        const gapRange: Range = new Range(contentChange.range.end, pos); 
        // Get end position of the newly inserted text
        const textEndPos: Position = getEndPos(contentChange.range.start, contentChange.text);
        // Append the gap range to the end of the newly inserted text and find the ending position
        return getEndPos(textEndPos, gapRange);

        /** Get the end position of a string or a range that is appended to the end of `startPos`. */
        function getEndPos(startPos: Position, arg: string | Range): Position {
            let deltaLines: number;
            let argLastLineLength: number;
            if (typeof arg === 'string') {
                const splitText = arg.split('\n');
                argLastLineLength = splitText[splitText.length - 1].length;
                deltaLines = splitText.length - 1;
            } else {
                argLastLineLength = arg.end.character - (arg.isSingleLine ? arg.start.character : 0);
                deltaLines = arg.end.line - arg.start.line;
            }
            return new Position(
                startPos.line + deltaLines,
                argLastLineLength + (deltaLines > 0 ? 0 : startPos.character),
            );
        }
    }

}

/** 
 * Get any new pairs introduced by the content changes.
 * 
 * @param contentChanges The content changes that may have introduced pairs.
 * @param settings The current settings of the extension.
 * @return (If any) a pair that was added by the content changes.
 */
function getNewPair(contentChanges: TextDocumentContentChangeEvent[], settings: Readonly<Settings>): Pair | undefined {
    // languageRule - A list of 'trigger pairs' that will be compared against the text of the content 
    // changes. If a content change's text matches any entry in the language rule, that means that
    // the content change is a pair that we want to track, so we create a `Pair` object that points 
    // to that actual pair in the document.
    // 
    // decorationOptions - The decoration options for the closing character of the pair. 
    const { languageRule, decorationOptions } = settings;
    const { range, text } = contentChanges[0];
    // Return a new `Pair` on rule match
    if (text.length === 2 && range.isEmpty && languageRule.some((rule) => text === rule)) {
        return new Pair(
            range.start,
            range.start.translate({ characterDelta: 1 }),
            decorationOptions
        );
    }
    return undefined;
}

/** 
 * Remove any `Pair`s that the cursor has moved out of.
 * 
 * @param pairs The list of `Pair`s to update.
 * @param activeTextEditor The currently active text editor.
 * @return A tuple containing a list of retained `Pair`s followed by a list of removed `Pair`s.
 */
function removeEscapedPairs(pairs: Pair[], activeTextEditor: TextEditor): [Pair[], Pair[]] {
    const cursorPos: Position = activeTextEditor.selection.active;
    const retained: Pair[] = [];
    const removed: Pair[] = [];
    for (const pair of pairs) {
        pair.enclosesPos(cursorPos) ? retained.push(pair) : removed.push(pair);
    }
    return [retained, removed];
}

/**
 * @param pairs Redecorate this list of `Pair`s.
 * @param decorateOnlyNearestPair If `true` will only decorate the most nested `Pair` in `pairs`. 
 * Otherwise decorates all `Pair`s.
 */
function reapplyDecorations(pairs: Pair[], decorateOnlyNearestPair: boolean): void {
    if (pairs.length < 1) {
        return;
    }
    removeDecorations(pairs);
    if (decorateOnlyNearestPair) {
            pairs[pairs.length - 1].decorate();
    } else {
        pairs.forEach((pair) => pair.decorate());
    }
}

/** @param pairs Undecorate this list of `Pair`s. */
function removeDecorations(pairs: Pair[]): void {
    pairs.forEach((pair) => pair.undecorate());
}