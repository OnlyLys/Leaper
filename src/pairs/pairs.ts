'use strict';

import { Position, TextDocumentContentChangeEvent, window, DecorationRenderOptions, Range } from 'vscode';
import { Pair } from './pair';
import { Settings } from '../settings';

/** 
 * A list of containing `Pair`s, which are representations of pairs that are currently being tracked
 * in the text editor.
 */
export class Pairs {
    
    /** Data structure that contains the `Pair`s. */
    private list: Pair[] = [];

    /** Cached settings of the extension. */
    private settings: Settings;

    /** 
     * Update the settings cached in `Pairs`. 
     * 
     * @param newSettings The `Settings` object containing the new settings.
     */
    public updateCachedSettings(newSettings: Settings) {
        this.settings = newSettings;
    }
    
    /** @return `true` if empty. Otherwise `false`. */
    get isEmpty(): boolean {
        return this.list.length < 1;
    }

    /** 
     * Check if there is a line of sight from the current cursor position to the nearest available pair.
     * Having line of sight means having no non-whitespace text between the cursor position and the
     * closing character of the pair.
     *
     * @return `false` if
     * - There is non-whitespace text between the cursor and the closing character of the nearest pair.
     * - There are no pairs currently being tracked.
     * 
     * `true` otherwise.
     */
    get hasLineOfSight(): boolean {
        if (!window.activeTextEditor || this.list.length < 1) {
            return false;    // False if there no pairs being tracked
        }
        const cursorPos: Position = window.activeTextEditor.selection.active;
        const textInBetween: string = window.activeTextEditor.document.getText(
            new Range(cursorPos, this.list[this.list.length - 1].close)
        );
        return textInBetween.trim().length === 0;
    }

    /** @return (If any) a reference to the most nested `Pair` in the list. */
    get mostNested(): Pair | undefined {
        return this.list[this.list.length - 1];
    }

    /**
     * Construct a new container of `Pair`s, which each represent pairs within the document that are 
     * being tracked.
     * 
     * @param settings The settings for the extension.
     */
    constructor(settings: Settings) {
        this.settings = settings;
    }

    /** Clears the list of `Pair`s and any decorations. */
    public clear(): void {
        this.list.forEach((pair) => pair.undecorate());
        this.list.length = 0;
    }

    /** 
     * Update the list due to text content changes in the document. 
     * - Deleted `Pair`s are removed.
     * - Existing `Pair`s are updated to reflect their new positions.
     * - New `Pair`s are added.
     * - Decorations are updated.
     * 
     * @param contentChanges The text content change events.
     */
    public updateFromContentChanges(contentChanges: TextDocumentContentChangeEvent[]): void {
        if (contentChanges.length < 1) {
            return;
        }
        // Update the existing `Pair`s due to text changes in the document.
        const [retained, removed] = filterTranslate(this.list, contentChanges); 
        // Check if a new pair has been inserted.
        const newPair = getNewPair(contentChanges, this.settings.languageRule, this.settings.decorationOptions);  
        if (newPair) {
            retained.push(newPair);        // Add new `Pair` to be tracked.
        }
        // Update decorations only if there were `Pair`s removed or added.
        if (removed.length > 0 || newPair) {
            undecorateList(removed);
            undecorateList(retained);
            decorateList(retained, this.settings.decorateOnlyNearestPair);
        }
        this.list = retained;
    }
    
    /** 
     * Update the list due to changes in cursor position. 
     * - `Pair`s that the cursor has moved out of are removed from tracking.
     * - Decorations are updated.
     * 
     * This step implicitly removes any copy-pasted pair from tracking because their cursor positions 
     * after pasting is outside of the pair. This is in contrast to autoclosing pairs where the cursor 
     * position is within the pair after creation.
     */
    public updateFromCursorChange(): void {
        if (this.list.length < 1 || !window.activeTextEditor) {
            return;
        }
        const cursorPos: Position = window.activeTextEditor.selection.active;
        const retained: Pair[] = [];
        const removed: Pair[] = [];
        // Remove from tracking any `Pair`s that the cursor has moved out of.
        for (const pair of this.list) {
            pair.enclosesPos(cursorPos) ? retained.push(pair) : removed.push(pair);
        }
        // Update decorations only if `Pair`s were removed.
        if (removed.length > 0) {
            undecorateList(removed);
            decorateList(retained, this.settings.decorateOnlyNearestPair);
        }
        this.list = retained;
    }

}

/** 
 * Does two things given a list of `Pair`s and content changes:
 * - Filter out `Pair`s that have been deleted by the content changes.
 * - Filter out `Pair`s that have had a multiline text inserted in between it.
 * - Update the remaining `Pair`s to reflect the new positions of the pairs in the document.
 * 
 * This function does not perform any form of decoration.
 * 
 * @param list The list of `Pair`s to update. *The list is consumed by this function*.
 * @param contentChanges The content changes that deleted or move the pairs.
 * @return A tuple containing the list of updated `Pair` followed by the list of removed `Pair`s.
 */
function filterTranslate(list: Pair[], contentChanges: TextDocumentContentChangeEvent[]): [Pair[], Pair[]] {
    const retained: Pair[] = [];
    const removed: Pair[] = [];
    outer:
        for (const pair of list) {
            for (const contentChange of contentChanges) {
                if (pair.overlappedBy(contentChange.range)) {
                    // Either side of pair overwritten: pair deleted.
                    removed.push(pair);
                    continue outer;
                } else if (pair.enclosesRange(contentChange.range)) {
                    // Text changed between pair.
                    if (countLines(contentChange.text) > 1) {
                        // Multiple lines inserted: pair invalidated.
                        removed.push(pair);
                        continue outer;
                    } else {
                        // Single line inserted: advance right side.
                        pair.close = shift(pair.close, contentChange);                        
                    }
                } else if (pair.open.isAfterOrEqual(contentChange.range.end)) {
                    // Text changed before pair: both sides moved.
                    pair.open = shift(pair.open, contentChange);
                    pair.close = shift(pair.close, contentChange);
                } else {
                    // Text inserted after pair: pair not moved or deleted so nothing to do.
                }
            }
            retained.push(pair);
        }
    list.length = 0;
    return [retained, removed];

    /** 
     * Get a new position as a result of a text change. 
     * 
     * @param pos Initial position.
     * @param contentChange The content change that caused the position to change.
     * @return The new shifted position.
     */
    function shift(pos: Position, contentChange: TextDocumentContentChangeEvent): Position {
        const { range, text, rangeLength } = contentChange;
        const textLines = countLines(text);
        let lineDelta = textLines - 1 - (range.end.line - range.start.line);  // Vertical shift
        let characterDelta = 0;   // Horizontal shift
        // Only shift horizontally if text to the left and on the same line as `pos` is modified.
        if (range.end.line === pos.line) {
            if (range.isSingleLine && textLines === 1) {
                // Single line shift.
                characterDelta = text.length - rangeLength;
            } else {
                // Multi line shift.
                const split = text.split('\n');
                const lastLineLength = split[split.length - 1].length;
                characterDelta = lastLineLength - range.end.character;
            }
        }
        return pos.translate({ lineDelta, characterDelta });
    }

    /** Count the number of lines in a string. */
    function countLines(text: string): number {
        let lines = 1;
        for (const ch of text) {
            if (ch === '\n') {
                ++lines;
            }
        }
        return lines;
    }
}

/** 
 * Check if a new pair was inserted.
 * 
 * @param contentChanges The content changes that may have introduced a pair.
 * @param languageRule A list of string pairs that will be compared against the text of the content 
 * changes. If a content change's text matches any element in the language rule, that means that it 
 * is a pair that we want to track, and so we return a `Pair` object that points that actual pair in 
 * the document. The pairs in `languageRule` are also known as 'trigger pairs' since if one of those
 * pairs is inserted into the document, it triggers the extension to start tracking it.
 * @param decorationOptions The decoration options for the new pair.
 * @return On match against any trigger pair, a `Pair` object that points to the pair in the text 
 * document is returned. Otherwise `undefined` is returned. 
 * */
function getNewPair(contentChanges: TextDocumentContentChangeEvent[], languageRule: ReadonlyArray<string>,
    decorationOptions: DecorationRenderOptions): Pair | undefined 
{  
    // Case 1: Regular autoclosing pair. It is registered as a single content change with a text length 
    // of two and an empty range.
    const { range, text } = contentChanges[0];
    if (contentChanges.length === 1 && text.length === 2 && range.isEmpty) {
        for (const rule of languageRule) {
            if (text === rule) {
                return new Pair(
                    range.start,
                    range.start.translate({ characterDelta: 1 }),
                    decorationOptions
                );
            }
        }
    }
    return undefined;
}

/**
 * Decorate a list of `Pair`s.
 * 
 * @param pairs Vararg list of `Pair`s to decorate.
 * @param decorateOnlyNearestPair If `true` will only decorate the most nested `Pair` in `pairs`. 
 * Otherwise decorates all `Pair`s.
 */
function decorateList(pairs: Pair[], decorateOnlyNearestPair: boolean): void {
    if (!decorateOnlyNearestPair) {
        // Decorate all pairs.
        pairs.forEach((pair) => pair.decorate());
    } else if (pairs[pairs.length - 1]) {
        // Only decorate most nested pair.
        pairs[pairs.length - 1].decorate();
    }
}

/**
 * Undecorate a list of `Pair`s.
 * 
 * @param pairs Vararg list of `Pair`s to remove the decorations of.
 */
function undecorateList(pairs: Pair[]): void {
    pairs.forEach((pair) => pair.undecorate());
}