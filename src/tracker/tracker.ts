import { TextEditor, TextDocumentContentChangeEvent, Range, Position } from 'vscode';
import { Pair } from './pair';
import { Configuration } from '../configuration';

/** A container used to manage the tracking of pairs and manage their respective decorations. */
export class Tracker {

    /** 
     * Data structure used to store the pairs created by each cursor. The pairs are always ordered 
     * from outermost to innermost.
     */
    private pairs: Pair[] = [];

    /** 
     * Flag for whether the pairs tracked by this `Tracker` is visible. If `false`, decoration of 
     * pairs will be disabled.
     */
    private _visible: boolean = false;

    /** 
     * Create a new container to track pairs created by a cursor in a text editor. 
     * 
     * @param configuration The extension's current configuration. 
     * @param editor The text editor that the pairs are being tracked in.
     * @param cursorIndex The index of the cursor that this `Tracker` tracks the pairs of.
     */
    public constructor(
        private readonly configuration: Configuration, 
        private readonly editor: TextEditor,
        private cursorIndex: number,
    ) {}

    /** `true` if no pairs are being tracked. Otherwise `false`. */
    public get isEmpty(): boolean {
        return !this.pairs.length;
    }

    /** 
     * Get a snapshot of all the pairs that are being tracked in this `Tracker`. 
     * 
     * The elements of the return array are quintuplets with the following values: 
     * `[openLine, openCharacter, closeLine, closeCharacter, isDecorated]`. Each quintuplet describes
     * a pair's opening and closing positions in addition to its current decoration state.
     */
    public get snapshot(): [number, number, number, number, boolean][] {
        const retVal: [ number, number, number, number, boolean ][] = [];
        for (const { open, close, isDecorated } of this.pairs) {
            retVal.push([ open.line, open.character, close.line, close.character, isDecorated ]);
        }
        return retVal;
    }

    /** 
     * Get the line that the pairs within this `Tracker` are on. 
     * 
     * Return value is `-1` if no pairs are being tracked.
     */
    public get line(): number {

        // Since all pairs in each tracker are on the same line, we can just return the line number 
        // of any pair.
        return this.pairs[0] ? this.pairs[0].open.line : -1;
    }

    /** 
     * Check if there is line of sight between cursor position and the `close` position of the
     * nearest available pair. Having line of sight means having no non-whitespace text between 
     * position and the `close` position.
     */
    public get hasLineOfSight(): boolean {
        const innermostPair: Pair | undefined = this.pairs[this.pairs.length - 1];
        const selection = this.editor.selections[this.cursorIndex];
        if (innermostPair && selection) {
            return !this.editor.document.getText(
                new Range(selection.active, innermostPair.close)
            ).trim();
        } else {
            return false;
        }
    }

    /** Pop the innermost pair being tracked. */
    public pop(): Pair | undefined {
        const popped = this.pairs.pop();
        if (popped) {
            popped.undecorate();
            // Decorate the new nearest pair (if it exists)
            if (this.pairs[this.pairs.length - 1] && !this.pairs[this.pairs.length - 1].isDecorated) {
                this.pairs[this.pairs.length - 1].decorate();
            }
        }
        return popped;
    }

    /** Toggle decorations for the pairs being tracked by this `Tracker`.  */
    public set visible(v: boolean) {
        if (this._visible !== v) {
            this._visible = v;
            if (this._visible) {
                if (this.pairs[this.pairs.length - 1]) {
                    this.pairs[this.pairs.length - 1].decorate();
                }
                if (this.configuration.decorateAll) {
                    for (let i = 0; i < this.pairs.length - 1; ++i) {
                        this.pairs[i].decorate();
                    }
                }
            } else {
                for (const pair of this.pairs) {
                    pair.undecorate();
                }
            }
        }
    }

    /** 
     * Apply content changes from `TextDocumentContentChangeEvent`s which may move, delete or create 
     * pairs. 
     * 
     * Return value is `true` if there are still pairs being tracked by this `Tracker` after the
     * update. Otherwise return value is `false`.
     */
    public contentChangeUpdate(changes: TextDocumentContentChangeEvent[]): void {
        const selection = this.editor.selections[this.cursorIndex];
        if (!selection) {
            return;
        }
        const prunedChanges = pruneChanges(selection.active.line, changes);
        this.pairs          = applyChanges(this.pairs, prunedChanges);
        const newPair       = getNewPair(this.configuration, this.editor, selection.active, prunedChanges);
        if (newPair) {
            this.pairs.push(newPair);
            // If the new pair is the first pair inserted, we have to set the internal visibility flag
            if (this.pairs.length === 1) {
                // The usual rule of only decorating if visible within the viewport applies
                const { start, end } = this.editor.visibleRanges[0];
                this._visible = newPair.open.line >= start.line && newPair.open.line <= end.line;
            }
        }
        if (this._visible) {
            updateDecorations(this.configuration, this.pairs, newPair);
        }

        /** 
         * Drop `TextDocumentContentChangeEvent`s that occur on lines outside our interest. This is
         * an optimization step.
         */
        function pruneChanges(
            cursorLine: number,
            changes: TextDocumentContentChangeEvent[]
        ): TextDocumentContentChangeEvent[] {
            const retVal: TextDocumentContentChangeEvent[] = [];
            /* Since the pairs that a `Tracker` tracks are on the same line as the cursor, by 
            comparing the line that the cursor is on to the line that the changes occur in, we can
            drop unnecessary changes. */
            for (const change of changes) {
                const { range: { start, isSingleLine }, text } = change;
                /* Drop all changes that occur on a line below since they do not affect the pairs 
                that this `Tracker` is tracking. For the same reason, we can drop all changes that 
                occur on a line above, but only if they are single line. */
                if (start.line > cursorLine || (start.line < cursorLine && isSingleLine && !text.includes('\n'))) {
                    continue;
                } else {
                    retVal.push(change);
                }
            }
            return retVal;
        }

        /** 
         * Apply the `TextDocumentContentChangeEvent`s to each pair in the input array `pairs`. This
         * shifts or deletes pairs in `pairs`, but does not add new pairs introduced by the content
         * change.
         */
        function applyChanges(pairs: Pair[], changes: TextDocumentContentChangeEvent[]): Pair[] {
            const retVal: Pair[] = [];
            outer:
            for (const pair of pairs) {
                /* We can apply changes in order because the editor always returns content change
                events that were sorted with descending positions: i.e. ordered from end to start of 
                document. */
                for (const change of changes) {
                    const alive = pair.applyContentChange(change);
                    // Drop pair if it was deleted by content changes
                    if (!alive) {
                        pair.undecorate();
                        // No further application needed since the pair has been deleted
                        continue outer;
                    }
                }
                retVal.push(pair);
            }
            return retVal;
        }

        /** Get the new pair (if any) that was introduced by the content changes. */
        function getNewPair(
            configuration: Configuration,
            editor: TextEditor,
            cursorPosition: Position,
            changes: TextDocumentContentChangeEvent[]
        ): Pair | undefined {
            let newPair: Pair | undefined = undefined;
            /* Note: There is an assumption here that each array of `TextDocumentContentChangeEvent`s 
            obtained from the editor can only introduce one new pair at most. So far, this assumption 
            has held up in testing, but there is no explicit guarantee from the editor's API that 
            this should remain the case. */
            for (const change of changes) {
                if (newPair) {
                    /* If the new pair has been found, we proceed to apply any content changes that 
                    would have caused it to shift position away from where it was created. Recall 
                    that since `changes` is ordered from end to start of document, one the new pair 
                    has been found, further iterating through `changes` will give us changes that 
                    have occurred before the position of the new pair, which we have to take into 
                    account since they cause the new pair to shift. */
                    if (!newPair.applyContentChange(change)) {
                        newPair = undefined;      // New pair deleted by rest of the content changes
                        break;     
                    }
                } else if (
                    // Check if a new pair is inserted by the cursor paired to this `Tracker` 
                    change.range.start.isEqual(cursorPosition) 
                    && configuration.detectedPairs.includes(change.text)
                    && !change.rangeLength
                ) {
                    newPair = new Pair(editor, configuration.decorationOptions, cursorPosition);
                }
            }
            return newPair;
        }

        function updateDecorations(configuration: Configuration, pairs: Pair[], newPair: Pair | undefined) {
            if (pairs[pairs.length - 1] && !pairs[pairs.length - 1].isDecorated) {
                /* Make sure the nearest pair is always decorated. This step is necessary for two 
                reasons:
                1. When `configuration.decorateAll` is false, pairs that are not the nearest pair
                   will not be decorated. Thus if there were pairs removed in the earlier stages of 
                   the enclosing `Tracker.selectionChangeUpdate()` method, we need to make sure that 
                   the new nearest pair is decorated.
                2. When a new pair is added (and thus becomes the new nearest pair), it must be 
                   decorated. */
                pairs[pairs.length - 1].decorate();
            }
            if (!configuration.decorateAll && newPair && pairs[pairs.length - 2]) {
                /* If `configuration.decorateAll` is disabled and a new pair is inserted, then we 
                need to make sure that the previous nearest pair is undecorated. */
                pairs[pairs.length - 2].undecorate();
            }
        }

    }

    /** 
     * Call this method after any sort of selection changes to untrack any pairs that the cursor has 
     * moved out of.
     * 
     * This method should only be called at the end of the event loop because text insertion (for
     * instance) may move the cursor ahead of time before inserting the text. This may cause pairs 
     * to be erroneously removed, even though after the text is inserted the pairs will have been
     * shifted to a position where they enclose the cursor.
     */
    public selectionChangeUpdate(): void {
        const selection = this.editor.selections[this.cursorIndex];
        if (selection) {
            // Iterate through pairs from most nested to least nested as optimization
            for (let i = this.pairs.length - 1; i >= 0; --i) {
                /* Technically we use the selection's anchor to determine if the cursor is enclosed
                because we don't want to untrack pairs if the user is just making a selection from
                within the pairs to outside. */
                if (this.pairs[i].encloses(selection.anchor)) {
                    /* Since we started iterating from the most nested to least nested pair, the 
                    moment we encounter an inner pair that encloses the anchor means we can skip 
                    checking the outer pairs as they surely must also enclose the anchor. */
                    break;
                } else {
                    (this.pairs.pop() as Pair).undecorate();
                }
            }
        }
        /* If any pairs are removed in the step above then there might be a new nearest pair. Thus 
        it would be prudent for us to make sure that it is always decorated. */
        if (this.pairs[this.pairs.length - 1] && !this.pairs[this.pairs.length - 1].isDecorated) {
            this.pairs[this.pairs.length - 1].decorate();
        }
    }

    /** 
     * Clears all pairs from being tracked and remove all decorations. This instance of `Tracker`
     * cannot be used after it has been disposed of.
     */
    public dispose(): void {
        for (const pair of this.pairs) {
            pair.undecorate();
        }
        this.pairs       = [];
        this._visible    = false;
        this.cursorIndex = -1;
    }

}