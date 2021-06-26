import { Range, Position, Selection, TextEditorDecorationType, TextDocument, TextDocumentChangeEvent, TextEditorSelectionChangeEvent, window, TextEditor } from 'vscode';
import { Snapshot } from '../../test-api';
import { Configuration } from '../configuration';
import { ContentChangeStack } from './content-change-stack';

/** 
 * A pair within a cluster.
 */
interface Pair {

    /**
     * Opening (i.e. left) side of the pair.
     */
    open: Position,

    /**
     * Closing (i.e. right) side of the pair.
     */
    close: Position,

    /**
     * Decoration of this pair. 
     * 
     * `undefined` if this pair is undecorated. 
     */
    decoration: TextEditorDecorationType | undefined;

}

/** 
 * A class that is used to abstract out of most the calculations from the `Tracker` class. 
 * 
 * By abstracting out most of the calculations from `Tracker`, we can separate the management of 
 * control flow from the heavy logic. In a sense, `Tracker` drives `TrackerCore`.
 * 
 * # The `syncTo*` Methods
 * 
 * This class is primarily driven through the `syncToSelectionChanges` and `syncToContentChanges` 
 * methods, which respectively take in the latest cursor positions and latest text edits in the 
 * owning editor in order to determine the current state of the owning editor. 
 * 
 * Through the `syncTo*` methods, the following is done:
 * 
 *  1. Any autoclosing pairs which have been inserted are tracked and decorated.
 *  2. Any pairs that are being tracked which have had the cursor move out of them, or which have 
 *     been deleted are untracked and undecorated. 
 */
export class TrackerCore {

    /**
     * The most recently seen cursors, sorted by increasing `anchor` positions.
     * 
     * Accompanying each cursor is an `unsortedIndex` which is the index of the cursor in the 
     * cursors array before it was sorted.
     * 
     * # Why Sort the Cursors?
     * 
     * We prefer working with sorted cursors because vscode is inconsistent with how cursors are 
     * ordered within `TextEditor.selections`.
     * 
     * For example, an operation like pasting with multi-cursors may reorder the cursors in the
     * `TextEditor.selections` array.
     * 
     * Only handling sorted cursors means that we can make the `clusters` array parallel to this
     * array of sorted cursors without worrying about cursor reordering operations messing things 
     * up. 
     * 
     * # Cursor Positions
     * 
     * A cursor in vscode is actually a `Selection` type, which has two positions, an `active` and
     * and `anchor` position. When there is no selection being made, both positions point to the 
     * same location in the document. 
     * 
     * Here we use the `anchor` position as the sort key. It actually does not matter whether we use 
     * the `active` or `anchor` position as the sort key, since cursor selections do not overlap. 
     * Either will yield the same result.
     */
    private prevSortedCursors: ReadonlyArray<{ 
        unsortedIndex: number, 
        cursor:        Selection 
    }>;

    /**
     * Pairs that are being tracked for each cursor.
     * 
     * Each `Pair[]` subarray in this array is called a 'cluster'. All the pairs in a cluster are
     * ordered from least nested to most nested, and they always enclose the cursor that corresponds 
     * to that cluster. 
     * 
     * This array is parallel to `prevSortedCursors`, meaning the `i`th cursor in `prevSortedCursors`
     * corresponds to the `i`th cluster. Because `prevSortedCursors` has been sorted, it follows 
     * that this array is also sorted. That pairs of the `i`th cluster in this array are all located
     * before the `i + 1`th cluster in the document. 
     */
    private clusters: Pair[][];

    /**
     * The number of pairs that are being tracked.
     * 
     * This number is at all times equivalent to the total number of `Pair`s in `this.clusters`. 
     * Storing this number here means we do not have to iterate through `this.clusters` each time
     * we want to know how many pairs are being tracked, therefore improving efficiency.
     */
    private pairCount: number;

    /** 
     * Pairs to undecorate during the next `syncDecorations` call.
     */
    private toUndecorate: Pair[];

    /**
     * Whether the decorations are stale.
     * 
     * This flag determines whether we have to do any actual work when `syncDecorations` is called.
     */
    private decorationsStale: boolean;

    /**
     * @param cursors Current cursors of the owning text editor.
     * @param configuration The configuration values to use. 
     */
    public constructor(
        cursors: ReadonlyArray<Selection>,
        private configuration: Configuration
    ) {
        this.prevSortedCursors = sortCursors(cursors);
        this.pairCount         = 0;
        this.toUndecorate      = [];
        this.decorationsStale  = false;

        // Each cursor is given its own cluster.
        this.clusters = (new Array(this.prevSortedCursors.length)).fill([]);
    }

    /** 
     * Synchronize the tracking after selection changes (i.e. cursor changes) in the owning text 
     * editor.
     * 
     * Calling this method does the following:
     * 
     *  1. Untracks pairs if cursors have moved out of them. This makes it such that when a user has 
     *     clicked out of a tracked pair, the pair will cease to be tracked. 
     *  2. Adjusts the internal capacity to match number of active cursors. This step is required 
     *     for the `syncToContentChanges` method to correctly detect pairs that are inserted.
     * 
     * **Note that `syncDecorations` must be called at the end of the event loop cycle in which this 
     * method was called.**
     */
    public syncToSelectionChanges(selectionChangeEvent: TextEditorSelectionChangeEvent): void {

        // There are 4 possible kinds of selection changes. 
        //
        //  1. Movement of cursors.
        //  2. Addition or removal of cursors.
        //  3. Expansion or shrinking of cursor selections.
        //  4. Reordering of cursors.
        //
        // However, we can obviate the need for dealing with the fourth kind by sorting the cursors 
        // here.
        const sortedCursors = sortCursors(selectionChangeEvent.selections);

        // --------------------------------
        // STEP 1 - Add or remove clusters to match the new cursor count. 
        // --------------------------------
        // 
        // This step is only done when there is a change in the number of cursors and utilizes the 
        // following assumption: 
        // 
        //  When there is a change in the number of cursors, the cursor add or remove operation is 
        //  the only operation being done. Other cursors that were neither added nor removed remain 
        //  at their previous positions. 
        //
        // In theory, a single selection change event can contain any combination of changes. For
        // example, it is possible for a single selection change event to change the cursor count,
        // expand certain cursors and move cursors around. However, such a selection change event 
        // is not possible through regular keyboard input, and is only possible through something 
        // like an extension command. 
        //
        // Since selection changes due to extension commands are rare and unpredictable, we should
        // not support handling those here. Furthermore, the above assumption allows us to greatly 
        // simplify the logic of this code, since we can (with the assumption applied) simply 
        // compare the new sorted cursors to the most recently seen sorted cursors to determine 
        // which cursor was removed or added. 
        if (sortedCursors.length !== this.prevSortedCursors.length) {
            let prev = 0;
            const newClusters = sortedCursors.map(({ cursor }) => {

                // Drop the clusters of previous cursors positioned before `cursor`.
                //
                // We have to perform cleanup for these previous cursors because they have been 
                // removed by the user. We know they have been removed because there are no 
                // matching cursors for them in the latest sorted cursors array.
                while (this.prevSortedCursors[prev]?.cursor.anchor.isBefore(cursor.anchor)) {
                    this.pairCount -= this.clusters[prev].length;
                    this.toUndecorate.push(...this.clusters[prev++]);
                }

                if (this.prevSortedCursors[prev]?.cursor.anchor.isEqual(cursor.anchor)) {

                    // A matching cursor is found.
                    //
                    // This implies that `cursor` must have previously existed, and so we simply 
                    // transfer its cluster over.
                    return this.clusters[prev++];
                } else {

                    // Either there are no more previous cursors or that the current previous cursor
                    // is positioned after `cursor`. 
                    //
                    // Both cases imply that `cursor` is a newly added cursor, and so it gets a new 
                    // empty cluster.
                    return [];
                }
            });
    
            // Any cursors still remaining in `prevSortedCursors` have not matched with any cursors
            // in the latest sorted cursors array. 
            //
            // Therefore they must also be cursors that were removed. 
            while (prev < this.prevSortedCursors.length) {
                this.pairCount -= this.clusters[prev].length;
                this.toUndecorate.push(...this.clusters[prev++]);
            }

            this.clusters = newClusters;
        }

        // --------------------------------
        // STEP 2 - For each cluster untrack any pairs that its cursor has moved out of.
        // --------------------------------
        //
        // The point of this step is so that when the user has moved the cursors out of pairs, the 
        // pairs will no longer be tracked.
        for (const [i, cluster] of this.clusters.entries()) {

            // It is worth noting that the 'cursor' is not necessarily at a singular position, since 
            // it could have been expanded to a selection. 
            //
            // Here we use the `anchor` of the cursor as the reference point to decide whether or 
            // not a cursor has moved out of a pair. The choice of using the `anchor` position makes 
            // sense as we do not want to untrack pairs if the user is just making a selection from 
            // within a pair to outside of it.
            const anchor = sortedCursors[i].cursor.anchor;

            // Iterate through the cluster in reverse, removing all pairs that do not enclose the 
            // cursor.
            //
            // Iterating in reverse is faster, since the pairs in each cluster are ordered from 
            // least nested to most nested. By iterating in reverse, we can stop the iteraton once 
            // we encounter a pair that encloses the cursor, since we know the remaining pairs also 
            // enclose the cursor.
            for (let i = cluster.length - 1; i >= 0; --i) {
                if (anchor.isBeforeOrEqual(cluster[i].open) || anchor.isAfter(cluster[i].close)) {
                    this.pairCount -= 1;
                    this.toUndecorate.push(cluster.pop() as Pair);
                } else {
                    break;
                }
            }
        }

        this.prevSortedCursors = sortedCursors;
        this.decorationsStale  = this.decorationsStale || this.toUndecorate.length > 0;
    }

    /** 
     * Synchronize the tracking after content changes (i.e. text edits) in the document.
     * 
     * This step also adds any pairs that were inserted by text edits. 
     * 
     * **Note that `syncDecorations` must be called at the end of the event loop cycle in which this 
     * method was called.**
     */
    public syncToContentChanges(contentChangeEvent: TextDocumentChangeEvent): void {

        /** 
         * Apply a shift in position due to content changes.
         * 
         * This function advances the content change stack. 
         *
         * Note that the return value is `undefined` if the content changes overwrite `position`. 
         */
        function shift(stack: ContentChangeStack, position: Position): Position | undefined {

            // Pop the content change stack until a content change that either overlaps or occurs 
            // after `position` is encountered.
            //  
            // Doing this allows us to 'build up' all of the shifts that would apply to a position 
            // due to content changes before it. The built up shift values can then be retrieved 
            // through the `vertCarry` and `horzCarry` properties.
            while (stack.peek()?.range.end.isBeforeOrEqual(position)) {
                stack.pop();
            }

            // Return `undefined` if position is deleted.
            if (stack.peek()?.range.start.isBeforeOrEqual(position)) {
                return undefined;
            }

            // We get here if either the content change stack has been exhausted, or if the content 
            // change at the top of the stack occurs after `position`. 
            //
            // Since content changes do not overlap, all of the content changes still remaining on 
            // the stack must occur after `position`, and therefore cannot affect `position`. 
            // 
            // The carry values on the content stack now represent the net shift that would applied
            // on `position` by the content changes.
            return position.translate(
                stack.vertCarry,
                position.line === stack.horzCarry.affectsLine ? stack.horzCarry.value : 0
            );
        }

        // Make the immutable content changes array behave like a mutable stack.
        //
        // A stack is appropriate because:
        //
        //  1. We iterate through clusters from the top to the bottom of the document.
        //  2. We iterate through the pairs in each cluster from the outermost pair's opening side 
        //     to the innermost pair's opening side, and then from the innermost pair's closing side 
        //     to the outermost pair's closing side.
        // 
        // This means that there is no need to backtrack when going through the content changes, 
        // making a stack a good choice.
        const stack = new ContentChangeStack(contentChangeEvent);

        // Apply the content changes.
        this.clusters = this.clusters.map((cluster, iCursor) => {

            // --------------------------------
            // STEP 1 - Shift (or delete) the opening side of pairs.
            // --------------------------------

            // Contains pairs where only the opening side has been processed.
            const openDone: Pair[] = [];

            for (const pair of cluster) {
                const newOpen = shift(stack, pair.open);
                if (newOpen) {
                    pair.open = newOpen;
                    openDone.push(pair);
                } else {

                    // Pair deleted.
                    this.pairCount -= 1;
                    this.toUndecorate.push(pair);
                }
            }

            // --------------------------------
            // STEP 2 - Check if an autoclosing pair has been inserted. 
            // --------------------------------

            // A possible new autoclosing pair.
            //
            // Note that the position of this new pair (if detected) is already "finalized" and does 
            // not require further shifting.
            let newPair: Pair | undefined;

            // The cursor that is enclosed within the pairs of this cluster.
            //
            // Note that we consider a cursor to be enclosed when the `anchor` part of the cursor
            // is between the opening and closing sides of a pair.
            const cursor = this.prevSortedCursors[iCursor].cursor;

            // Advance the stack until the content change at the top of the stack is one that begins 
            // at or after the cursor.
            //
            // If, after this step, the stack is not empty, then the content change at the top of 
            // the stack is the only content change that could possibly have inserted an autoclosing 
            // pair since the rest of the content changes still in the stack are modifications of 
            // text that come after the content change at the top of the stack.
            while (stack.peek()?.range.start.isBefore(cursor.anchor)) {
                stack.pop();
            }

            // Check whether the content change at the top of the stack is one that inserted an 
            // autoclosing pair.
            //
            // There are four conditions that have to be satisfied before a content change is
            // considered an autoclosing pair insertion:
            //
            //  1. The text insertion must have occurred at a cursor. 
            //  2. The text inserted must have a length of 2.
            //  3. The text inserted must not have overwritten any text in the document.
            //  4. The cursor which inserted this pair must have an empty selection.
            //
            // Before we explain why each condition is required, we must first mention that there 
            // are two kinds of autoclosing pairs in vscode:
            //
            //  - The first kind is when nothing is selected and the user presses an opener (such as 
            //    `{`), vscode then automatically inserts the complementary closer (in this example, 
            //    `}`), then moves the cursor to in between the autoclosed pair.
            //
            //    This kind of autoclosing pair always manifests as a single content change that 
            //    inserts a pair (such as `{}`) at a cursor and overwrites no text in the document.
            // 
            //  - The second kind is when there is text selected and the user presses an opener
            //    (such as `{`), vscode then automatically wraps the selected text on both sides 
            //    (in this example, resulting in `{<selected_text>}`). 
            //
            //    This kind of autoclosing pair always manifests as two content changes, one which
            //    inserts the opening side of the pair and another which inserts the closing side 
            //    (for instance, the first one would insert `{` before the selected text and the 
            //    second would insert `}` after the selected text).
            //
            // In this extension, we do not support tracking of the second kind of autoclosing pair 
            // due to the complexity involved. Thus, by only considering one content change at a 
            // time, we will have implicitly excluded the second kind of autoclosing pair.
            //
            // It is now clear why we require the conditions listed above. By filtering out content
            // changes that do not satisfy the conditions, we can exclude content changes that are 
            // not insertions of the first kind of autoclosing pair. However, note that the filtering
            // is not perfect. The conditions listed above would not be able to help us distinguish 
            // between a pasted pair and an autoclosed one, and therefore we will end up tracking 
            // both kinds of pairs (when really we only want to track an autoclosed one). But because 
            // the cursor ends up at different positions afterwards (an autoclosed pair will have 
            // the cursor end up in between the pair, like so `{|}`, while a pasted one will have 
            // the cursor end up after the pair, like so `{}|`), we can rely on the subsequent 
            // `TrackerCore.syncToSelectionChanges` call to untrack a pasted pair.
            //
            // OPTIMIZATION NOTE: We check for condition 2 first since the most common content 
            // changes that occur are single alphbet text insertions at the cursor due to the user
            // typing stuff into the editor.
            if (
                stack.peek()?.text.length === 2
                && stack.peek()?.range.start.isEqual(cursor.anchor) 
                && stack.peek()?.range.isEmpty
                && cursor.isEmpty
                && this.configuration.detectedPairs.includes(stack.peek()?.text ?? "")
            ) {

                // The position of the cursor after the content changes have been applied.
                //
                // The `cursor` object we have actually represents the position of the cursor before
                // the content changes have been applied. Thus, we have to calculate the cursor's 
                // position after the content changes have been applied so that we know where the 
                // new autoclosed pair will be located.
                const anchorAfter = cursor.anchor.translate(
                    stack.vertCarry,
                    cursor.anchor.line === stack.horzCarry.affectsLine ? stack.horzCarry.value : 0
                );

                newPair = { 
                    open:       anchorAfter,
                    close:      anchorAfter.translate(0, 1),
                    decoration: undefined
                };
            }

            // --------------------------------
            // STEP 3 - Shift (or delete) the closing side of remaining pairs. 
            // --------------------------------

            // Contains (in reverse ordering) pairs where both sides have been processed.
            const doneReversed: Pair[] = [];

            // We iterate through `openDone` in reverse so that we can go through the closing side 
            // of pairs from innermost to outmost pair. 
            //
            // Since the iteration order follows the document order, we do not have to backtrack 
            // when going through the content changes.
            for (let i = openDone.length - 1; i >= 0; --i) {
                const pair     = openDone[i];
                const newClose = shift(stack, pair.close);

                // We additionally require that both sides of the pair are on the same line because 
                // want multi-line text insertions between pairs to cause them to be untracked.
                if (newClose && newClose.line === pair.open.line) {
                    pair.close = newClose;
                    doneReversed.push(pair);
                } else {

                    // Pair deleted.
                    this.pairCount -= 1;
                    this.toUndecorate.push(pair);
                }
            }

            // Reverse `doneReversed` to get the finalized cluster (less the newly detected pair).
            const done = doneReversed.reverse();

            // --------------------------------
            // STEP 4 - Store the newly detected pair (if there is one).
            // --------------------------------

            if (newPair) {

                // We can append new pairs to the end of the finalized cluster because the new pair 
                // (being closest to the cursor) is enclosed by all the other pairs in the cluster. 
                done.push(newPair);
                this.pairCount += 1;
                this.decorationsStale = true;
            }

            return done;
        });

        this.decorationsStale = this.decorationsStale || this.toUndecorate.length > 0;
    }

    /** 
     * Get the innermost pair for each cursor. 
     * 
     * The value for a cursor can be `undefined` if there were previously no pairs for it.
     * 
     * # Ordering
     * 
     * The returned array is parallel to the cursors in the most recent `syncToSelectionChanges` 
     * call.
     */
    public getInnermostPairs(): ({ open: Position, close: Position } | undefined)[] {
        const innermostPairs = Array(this.clusters.length).fill(undefined);
        for (const [i, cluster] of this.clusters.entries()) {
            const unsortedIndex           = this.prevSortedCursors[i].unsortedIndex;
            innermostPairs[unsortedIndex] = cluster[cluster.length - 1];
        }
        return innermostPairs;
    }

    /**
     * Update the decorations of pairs.
     * 
     * This method does the following:
     * 
     *  1. Removes decorations for pairs that have been removed (for instance, due to cursor being 
     *     moved out of the pair or the pair being deleted) since the last call of this method.
     *  2. Applies decorations for pairs that have been added since the last call of this method.
     * 
     * Whether all pairs or just the ones nearest to each cursor is decorated is determined by the 
     * `decorateAll` configuration.
     * 
     * **This method must be called at the end of an event loop cycle where either 
     * `syncToSelectionChanges`, `syncToContentChanges` or `clearPairs` were called.**
     * 
     * # Why a Separate Method?
     * 
     * Theoretically, we could sync decorations immediately as pairs are deleted or created in the 
     * `syncToSelectionChanges` or `syncToContentChanges` methods. However, in practice, vscode does 
     * not immediately apply decorations when the `TextEditor.setDecorations` method is called, and 
     * instead waits for the next cycle to apply decorations. 
     * 
     * The aforementioned behavior causes problems when we have a single event loop cycle consisting 
     * of multiple content changes. Let's take for example a loop cycle consisting of two content 
     * changes, the first of which inserts a pair at line 10, character 10 and the second of which 
     * inserts the text "hello" in between the pair. Had we decorated the first pair as it was 
     * created, we would have asked vscode to decorate the closing side of the pair at line 10,
     * character 11. However, when vscode finally does decorate the pair, it would end up decorating
     * the letter 'h' since that is what is at position after the second content change is applied. 
     * 
     * Therefore we separate out the decoration updates to this dedicated method, so that we can 
     * only apply them once all content changes within an event loop cycle have been processed. 
     * 
     * @param owner The owning text editor.
     */
    public syncDecorations(owner: TextEditor) {

        // The code that follows can be expensive, so we only do it if necessary.
        if (!this.decorationsStale) {
            return;
        }

        // Decorate the closing side of a pair.
        const decoratePair = (pair: Pair) => {
            const decorationOptions = this.configuration.decorationOptions;
            const decoration        = window.createTextEditorDecorationType(decorationOptions);
            owner.setDecorations(decoration, [ new Range(pair.close, pair.close.translate(0, 1)) ]);
            return decoration;
        };

        // Synchronize the decorations.
        for (const cluster of this.clusters) {
            if (this.configuration.decorateAll) {

                // Make sure all pairs are decorated since `decorateAll` is enabled.
                for (const [i, pair] of cluster.entries()) {
                    if (!pair.decoration) {
                        cluster[i].decoration = decoratePair(pair);
                    }
                }
            } else {
    
                // Remove decorations for all pairs that are not the most nested pair.
                for (let i = 0; i < cluster.length - 1; ++i) {
                    cluster[i].decoration?.dispose();
                    cluster[i].decoration = undefined;
                }

                // Decorate the pair nearest to the each cursor (the most nested pair).
                if (cluster.length > 0 && !cluster[cluster.length - 1].decoration) {
                    cluster[cluster.length - 1].decoration = decoratePair(cluster[cluster.length - 1]);
                }
            }
        }
        this.toUndecorate.forEach((pair) => pair.decoration?.dispose());
        this.toUndecorate     = [];
        this.decorationsStale = false;
    }

    /**
     * Whether there are currently any pairs being tracked.
     */
    public get isEmpty(): boolean {
        return this.pairCount < 1;
    }

    /** 
     * Return `true` only if the following conditions are satisfied:
     * 
     *  1. There is at least one pair being tracked in the document.
     *  2. All cursors must have empty selections.
     *  3. For every cursor with pairs being tracked for it, there is _line of sight_ from it to its 
     *     nearest pair. 
     * 
     * By 'line of sight' we mean that the text between the cursor's `anchor` position and the 
     * closing side of its nearest tracked pair is empty or consists of only whitespace characters.
     * 
     * One can think of the above conditions as what is required to execute a leap.
     * 
     * @param document The text document of the owning text editor.
     */
    public hasLineOfSight(document: TextDocument): boolean {
        return this.pairCount >= 1 && this.clusters.every((cluster, i) => {
            if (this.prevSortedCursors[i].cursor.isEmpty) {
                const anchor  = this.prevSortedCursors[i].cursor.anchor;
                const nearest = cluster[cluster.length - 1];
                return !document.getText(new Range(anchor, nearest.close)).trim();
            } else {
                return false;
            }
        });
    }

    /** 
     * Forcibly untrack all pairs. 
     * 
     * **Note that `syncDecorations` must be called at the end of the event loop cycle in which this 
     * method was called.**
     */
    public untrackPairs(): void {
        this.toUndecorate.push(...this.clusters.flat());
        this.clusters         = (new Array(this.clusters.length)).fill([]);
        this.pairCount        = 0;
        this.decorationsStale = this.decorationsStale || this.toUndecorate.length > 0;
    }

    /**
     * Change the configuration that is being used.
     * 
     * This will untrack all pairs which were previously being tracked.
     */
    public changeConfiguration(newConfiguration: Configuration): void {
        this.untrackPairs();
        this.configuration = newConfiguration;
    }

    /**
     * Terminate this instance by:
     * 
     *  1. Untracking all pairs.
     *  2. Immediately removing all decorations.
     * 
     * This method is the same as `untrackPairs` except that decorations are immediately removed,
     * which means that a subsequent `syncDecorations` call is not necessary.
     */
    public dispose(): void {
        this.untrackPairs();
        this.toUndecorate.forEach((pair) => pair.decoration?.dispose());
        this.toUndecorate     = [];
        this.decorationsStale = false;
    }

    /** 
     * Get a copy of the internal state.
     * 
     * The returned copy can be mutated affecting the internal state.
     * 
     * # Ordering
     * 
     * The returned array is parallel to the cursors in the most recent `syncToSelectionChanges` 
     * call.
     */
    public snapshot(): Snapshot {
        const snapshot = Array(this.clusters.length).fill(undefined);
        for (const [i, cluster] of this.clusters.entries()) {
            snapshot[this.prevSortedCursors[i].unsortedIndex] = cluster.map((pair) => {
                return { open: pair.open, close: pair.close, isDecorated: !!pair.decoration };
            });
        }
        return snapshot;
    }

}

/** 
 * Create a new array containing the cursors sorted by increasing `anchor` positions. 
 * 
 * Accompanying each cursor is a number representing the original index of the cursor within the
 * unsorted cursors array.
 */
function sortCursors(unsorted: ReadonlyArray<Selection>): ReadonlyArray<{ 
    unsortedIndex: number, 
    cursor:        Selection 
}> {
    return unsorted.map((cursor, i) => ({ unsortedIndex: i, cursor }))
                   .sort((a, b) => a.cursor.anchor.compareTo(b.cursor.anchor));
}
