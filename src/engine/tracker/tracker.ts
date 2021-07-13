import { Range, Position, Selection, TextEditorDecorationType, window, TextEditor, DecorationRenderOptions, TextDocumentContentChangeEvent, EventEmitter, Event } from 'vscode';
import { Unchecked } from '../configurations/unchecked';
import { ImmediateReusable } from './immediate-reusable';
import { ContentChangeStack } from './content-change-stack';
import { TrackerSnapshot } from '../test-handle';

/** 
 * A 'tracker' assigned to a text editor that:
 * 
 *  - Detects then tracks autoclosing pairs that are inserted into the text editor.
 *  - Decorates pairs that are being tracked.
 *  - Moves the cursor when the 'Leap' command is called.
 *  - Untracks all pairs when the 'Escape Leaper Mode' command is called.
 * 
 * A tracker does not on its own listen to changes or commands. It relies entirely on the engine to
 * drive it.
 *  
 * # Safety
 * 
 * A tracker must be `dispose`d of when the text editor that owns it is no longer visible.
 */
export class Tracker {

    /**
     * The most recently seen cursors, sorted by increasing `anchor` positions.
     * 
     * # Why Sort the Cursors?
     * 
     * We prefer working with sorted cursors because vscode is inconsistent with how cursors are 
     * ordered within the `selections` array of a `TextEditor`. For example, an operation like 
     * pasting with multi-cursors may reorder the cursors in the `selections` array.
     * 
     * Only handling sorted cursors means that we can make our `clusters` array parallel to this
     * array of sorted cursors without worrying about cursor reordering operations messing things 
     * up. 
     * 
     * # `anchor` as Sort Key
     * 
     * A cursor in vscode is actually a `Selection` type, which has two positions, an `active` and
     * and `anchor` position. When there is no selection being made, both positions point to the 
     * same location in the document. 
     * 
     * When sorting this array, we use the `anchor` position as the sort key. It actually does not 
     * matter whether we use the `active` or `anchor` position as the sort key, since no two cursors 
     * have overlapping selections. Sorting with either will yield the same result.
     */
    private sortedCursors: ReadonlyArray<{ 

        cursor: Selection,

        /** 
         * The index of the cursor before it was sorted. 
         * 
         * In other words, this is the index of this cursor in the `selections` array of the owning
         * text editor.
         */
        originalIndex: number

    }>;

    /**
     * Pairs that are being tracked for each cursor.
     * 
     * Each `Pair[]` subarray in this array is called a 'cluster'. All the pairs in a cluster are
     * ordered from least nested to most nested, and they always enclose the cursor that corresponds 
     * to that cluster. 
     * 
     * This array is parallel to `sortedCursors`, meaning the `i`th cursor in `sortedCursors`
     * corresponds to the `i`th cluster.
     */
    private clusters: Pair[][];

    /**
     * The total number of pairs that are being tracked.
     */
    private pairCount: number = 0;

    /**
     * Whether there are currently any pairs being tracked.
     */
    public get hasPairs(): boolean {
        return this.pairCount > 0;
    }

    /**
     * Notifies listeners of `onDidUpdateHasPairs`.
     * 
     * For consistency with `onDidUpdateHasLineOfSightEventEmitter`, the updated value is not sent 
     * when firing this event.
     */
    private readonly onDidUpdateHasPairsEventEmitter = new EventEmitter<undefined>();

    /**
     * Subscribe to be notified when the `hasPairs` property has been updated.
     */
    public get onDidUpdateHasPairs(): Event<undefined> {
        return this.onDidUpdateHasPairsEventEmitter.event;
    }

    /**
     * We only recalculate this value when necessary since the calculation could be expensive.
     */
    private _hasLineOfSight = { stale: true, value: false };

    /** 
     * A value which is `true` only if a leap is possible in the owning text editor.
     * 
     * More specifically, this value is `true` only if:
     * 
     *  1. There is at least one pair being tracked in the owning text editor.
     *  2. All cursors in the owning text editor have empty selections.
     *  3. There is at least one cursor with _line-of-sight_* to its nearest pair being tracked.
     * 
     * *By 'line-of-sight' we mean that the text between the cursor and the closing side of its 
     * nearest pair is empty or consists of only whitespace.
     */
    public get hasLineOfSight(): boolean {
        if (this._hasLineOfSight.stale) {
            const value = this.hasPairs 
                       && this.sortedCursors.every(({ cursor }) => cursor.isEmpty)
                       && this.clusters.some((cluster, i) => {
                            if (cluster.length > 0) {
                                const cursor       = this.sortedCursors[i].cursor;
                                const nearestPair  = cluster[cluster.length - 1];
                                const rangeBetween = new Range(cursor.anchor, nearestPair.close);
                                return !this.owner.document.getText(rangeBetween).trim();
                            } else {
                                return false;
                            }
                        });
            this._hasLineOfSight = { stale: false, value };
        }
        return this._hasLineOfSight.value;
    }

    /**
     * Notifies listeners of `onDidUpdateHasLineOfSight`.
     * 
     * Note that we do not send the updated value when firing this event, because then we don't have
     * to calculate the updated value when no one is listening.
     */
    private readonly onDidUpdateHasLineOfSightEventEmitter = new EventEmitter<undefined>();

    /**
     * Subscribe to be notified when the `hasLineOfSight` property has been updated.
     */
    public get onDidUpdateHasLineOfSight(): Event<undefined> {
        return this.onDidUpdateHasLineOfSightEventEmitter.event;
    }

    /**
     * A timer that fixes decorations at the end of the current event loop cycle.
     * 
     * When this timer executes, it will go through all the pairs and ensure that every pair is 
     * decorated if `decorateAll` is enabled. Otherwise, if `decorateAll` is disabled, this timer
     * will ensure that the pairs nearest to each cursor is decorated and that every other pair is 
     * not decorated.
     * 
     * This timer should be set whenever pairs are added or when pairs are dropped from a cluster 
     * such that the cluster has a new 'nearest pair'. This timer does not need to be set when the 
     * nearest pair for a cluster has not changed or when the entire cluster is dropped because in 
     * both cases there are no pairs within it that need decorating.
     *
     * # Why Do We Wait Until the End of Event Loop Cycles to Apply Decorations?
     * 
     * We cannot apply decorations within the `notifySelectionChanges` or `notifyContentChanges` 
     * methods because vscode does not immediately apply decorations when requested. Instead, it 
     * waits until the next event loop cycle to apply decorations. 
     * 
     * The aforementioned behavior causes problems when we have an event loop cycle consisting of 
     * multiple content changes. Consider for example an event loop cycle consisting of two content 
     * change events, the first of which inserts a pair at line X, character Y and the second of 
     * which inserts the text "hello" in between the pair. Had we applied decorations when processing
     * the first content change event, we would have asked vscode to decorate the closing side of 
     * the pair at line X, character Y + 1. However, when vscode finally processes the request to 
     * decorate the pair, it will end up decorating the letter 'h' of the word "hello" since by the 
     * time vscode gets around to processing the decoration request, the text document is in a state
     * where both content changes have been applied and consequently the closing side of the pair is
     * not at line X, character Y + 1 but at line X, character Y + 1 + "hello".length.
     * 
     * Therefore, by only applying decorations after all content changes in an event loop cycle have 
     * been processed, we ensure that the decorations will be applied at the correct positions.
     */
    private readonly decorationsFixer = new ImmediateReusable(() => {
        for (const cluster of this.clusters) {
            if (this._decorateAll) {

                // Make sure all pairs are decorated since `leaper.decorateAll` is enabled.
                for (const pair of cluster) {
                    if (!pair.decoration) {
                        pair.decoration = decorate(this.owner, pair, this._decorationOptions);
                    }
                }
            } else {

                // Make sure every pair aside from the one nearest to the cursor is not decorated
                // since `leaper.decorateAll` is disabled.
                for (let i = 0; i < cluster.length - 1; ++i) {
                    cluster[i].decoration?.dispose();
                    cluster[i].decoration = undefined;
                }
                if (cluster.length > 0) {
                    const nearest = cluster[cluster.length - 1];
                    if (!nearest.decoration) {
                        nearest.decoration = decorate(this.owner, nearest, this._decorationOptions);
                    }
                }
            }
        }
    });

    private _decorateAll: boolean;

    /**
     * Whether to decorate all pairs or just the ones nearest to each cursor.
     */
    public set decorateAll(v: boolean) {
        this._decorateAll = v;
        this.decorationsFixer.set();
    }

    private _decorationOptions: Unchecked<DecorationRenderOptions>;

    /**
     * The style of the decorations applied.
     */
    public set decorationOptions(v: Unchecked<DecorationRenderOptions>) {
        this._decorationOptions = v;

        // Reapply all the decorations.
        this.clusters.forEach(cluster => cluster.forEach(pair => {
            pair.decoration?.dispose();
            pair.decoration = undefined;
        }));
        this.decorationsFixer.set();
    }
    
    private _detectedPairs: ReadonlyArray<string>;

    /**
     * Which pairs to detect and then track.
     */
    public set detectedPairs(v: ReadonlyArray<string>) {
        this._detectedPairs = v;
    }

    /**
     * @param owner The text editor that this tracker is assigned to (i.e. the owning text editor).
     * @param configuration The configuration values scoped to `owner`.
     */
    public constructor(
        private readonly owner: TextEditor,
        configuration: {

            /** Whether to decorate all pairs or just the ones nearest to each cursor. */
            decorateAll: boolean,
            
            /** The style of the decorations applied. */
            decorationOptions: Unchecked<DecorationRenderOptions>,

            /** Which pairs to detect and then track. */
            detectedPairs: ReadonlyArray<string>
        }
    ) {
        this._decorateAll       = configuration.decorateAll;
        this._decorationOptions = configuration.decorationOptions;
        this._detectedPairs     = configuration.detectedPairs;
        this.sortedCursors      = sortCursors(this.owner.selections);
        this.clusters           = Array(this.sortedCursors.length).fill([]);
    }

    /** 
     * Notify this tracker of cursor changes in the owning text editor.
     */
    public notifySelectionChanges(newCursors: ReadonlyArray<Selection>): void {

        // This method does the following:
        // 
        // 1. Untracks pairs if cursors have moved out of them. This makes it such that when a user 
        //    has clicked out of a tracked pair, the pair will cease to be tracked. 
        // 2. Adjusts the internal capacity to match number of active cursors. This step is required 
        //    for the `notifyContentChanges` method to correctly detect pairs that are inserted.

        const prevCursors  = this.sortedCursors;
        const prevHasPairs = this.hasPairs;

        // There are 4 possible kinds of selection changes. 
        //
        //  1. Movement of cursors.
        //  2. Addition or removal of cursors.
        //  3. Expansion or shrinking of cursor selections.
        //  4. Reordering of cursors.
        //
        // By sorting the cursors here, we obviate the need for dealing with the fourth kind.
        this.sortedCursors = sortCursors(newCursors);

        // --------------------------------
        // STEP 1 - Add or drop clusters to match the latest cursor count. 
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
        // simplify the logic of this code, since we can (with the assumption applied) compare the 
        // latest sorted cursors to the previous sorted cursors to determine which cursor was 
        // removed or added. 
        if (this.sortedCursors.length !== prevCursors.length) {

            // The approach here is simple: We compare the latest sorted cursors with the previous
            // sorted cursors. Where the two arrays intersect are cursors which were neither added 
            // nor removed, so we just bring forward their clusters. Where the two arrays differ are 
            // either cursors which were added (if the cursor is only in the latest sorted cursors
            // array) or removed (if the cursor is only in the previous sorted cursors array). When
            // a cursor is added, we give it a new empty cluster, while if a cursor is removed, we 
            // drop its cluster.

            const prevClusters  = this.clusters;
            this.clusters       = [];

            let i = 0;
            for (const { cursor } of this.sortedCursors) {

                // Drop clusters for cursors which have been removed.
                while (i < prevCursors.length && prevCursors[i].cursor.anchor.isBefore(cursor.anchor)) {
                    this.pairCount -= prevClusters[i].length;
                    prevClusters[i++].forEach(pair => pair.decoration?.dispose());
                }

                // Note that we consider cursors to be equal as long as their `anchor`s match.
                if (i < prevCursors.length && prevCursors[i].cursor.anchor.isEqual(cursor.anchor)) {

                    // Bring forward the clusters of cursors which were neither added nor deleted.
                    this.clusters.push(prevClusters[i++]);
                } else {

                    // Provide empty clusters for new cursors.
                    this.clusters.push([]);
                }
            }
    
            // `prevCursors[i..]` does not intersect with the latest sorted cursors array. Therefore,
            // it contains cursors that were removed.
            while (i < prevCursors.length) {
                this.pairCount -= prevClusters[i].length;
                prevClusters[i++].forEach(pair => pair.decoration?.dispose());
            }
        }

        // --------------------------------
        // STEP 2 - For each cluster untrack any pairs that its cursor has moved out of.
        // --------------------------------
        //
        // This step ensures that when the user has moved a cursor out of a pair that encloses it, 
        // the pair will no longer be tracked.
        for (const [i, cluster] of this.clusters.entries()) {

            // Here we use the `anchor` of the cursor to decide whether or not a cursor has moved 
            // out of a pair. The choice of using the `anchor` position makes sense as we do not 
            // want to untrack pairs if the user is just making a selection from within a pair to 
            // outside of it.
            const anchor = this.sortedCursors[i].cursor.anchor;

            // Drop all pairs that do not enclose the cursor.
            //
            // Iterating in reverse is faster, since the pairs in each cluster are ordered from 
            // least nested to most nested. By iterating in reverse, we can stop the iteraton once 
            // we encounter a pair that encloses the cursor, since we know the remaining pairs also 
            // enclose the cursor.
            let pairsDropped = false;
            for (let j = cluster.length - 1; j >= 0; --j) {
                if (anchor.isBeforeOrEqual(cluster[j].open) || anchor.isAfter(cluster[j].close)) {
                    this.pairCount -= 1;
                    cluster.pop()?.decoration?.dispose();
                    pairsDropped = true;
                } else {
                    break;
                }
            }

            // If pairs were dropped from the cluster but the cluster still contains pairs afterwards, 
            // then we have to fix the decorations as there is now a new nearest pair.
            if (pairsDropped && cluster.length > 0) {
                this.decorationsFixer.set();
            }
        }

        if (this.hasPairs !== prevHasPairs) {
            this.onDidUpdateHasPairsEventEmitter.fire(undefined);
        }

        // The `hasLineOfSight` property can only change if there were previously pairs, since 
        // changes in cursors never introduce new pairs.
        if (prevHasPairs) {
            this._hasLineOfSight.stale = true;
            this.onDidUpdateHasLineOfSightEventEmitter.fire(undefined);
        }

    }

    /** 
     * Notify this tracker of text content changes in the owning text editor's document.
     */
    public notifyContentChanges(contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>): void {

        // This method does the following:
        // 
        // 1. Stop tracking pairs that have been deleted.
        // 2. Start tracking new autoclosing pairs that have been inserted.
        // 3. Maintain tracking of pairs that have shifted in position due to changes in the document.

        const prevHasPairs = this.hasPairs;
        let newPairsAdded  = false;

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
        const stack = new ContentChangeStack(contentChanges);

        // Apply the content changes.
        this.clusters = this.clusters.map((_cluster, i) => {

            // So that we can delete array elements in place.
            const cluster = _cluster as (Pair | undefined)[];

            // --------------------------------
            // STEP 1 - Shift (or delete) the opening side of pairs.
            // --------------------------------
            //
            // After this step, `cluster` will contain pairs where only the opening side has been 
            // processed. Pairs which have been deleted are `undefined`.
            for (let j = 0; j < cluster.length; ++j) {
                const pair = cluster[j] as Pair;
                const shiftedOpen = shift(stack, pair.open);
                if (shiftedOpen) {
                    pair.open = shiftedOpen;
                } else {

                    // Pair deleted.
                    this.pairCount -= 1;
                    pair.decoration?.dispose();
                    cluster[j] = undefined;
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
            // Note that we consider a cursor to be enclosed by a pair when the `anchor` part of the 
            // cursor is between the opening and closing sides of said pair.
            const cursor = this.sortedCursors[i].cursor;

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
            // `Tracker.notifySelectionChanges` call to untrack a pasted pair.
            //
            // OPTIMIZATION NOTE: We check for condition 2 first since the most common content 
            // changes that occur are single alphbet text insertions at the cursor due to the user
            // typing stuff into the editor.
            if (
                stack.peek()?.text.length === 2
                && stack.peek()?.range.start.isEqual(cursor.anchor) 
                && stack.peek()?.range.isEmpty
                && cursor.isEmpty
                && this._detectedPairs.includes(stack.peek()?.text ?? "")
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
            //
            // After this step, `cluster` will contain pairs where both sides have been processed. 
            // Pairs which have been deleted are `undefined`.

            // We iterate through `cluster` in reverse so that we can go through the closing side 
            // of pairs from innermost to outermost. Doing so means we do not have to backtrack 
            // when going through the content changes.
            for (let j = cluster.length - 1; j >= 0; --j) {
                const pair = cluster[j];
                if (pair) {
                    const shiftedClose = shift(stack, pair.close);

                    // We additionally require that both sides of the pair are on the same line 
                    // because want multi-line text insertions between pairs to cause the pairs to 
                    // be invalidated.
                    if (shiftedClose && shiftedClose.line === pair.open.line) {
                        pair.close = shiftedClose;
                    } else {

                        // Pair deleted.
                        this.pairCount -= 1;
                        pair.decoration?.dispose();
                        cluster[j] = undefined;
                    }
                }
            }

            // --------------------------------
            // STEP 4 - Complete the new cluster.
            // --------------------------------

            // Omit all the deleted pairs.
            const done = cluster.filter(pair => !!pair) as Pair[];

            // If the previous 'nearest pair' was dropped, then we have to make sure the new nearest
            // pair is decorated.
            if (cluster.length > 0 && !cluster[cluster.length - 1]) {
                this.decorationsFixer.set();
            }

            // Append the new pair to the finalized cluster.
            if (newPair) {
                newPairsAdded = true;
                this.pairCount += 1;

                // We append the new pair to the end of the finalized cluster because the new pair 
                // (being nearest to the cursor) is enclosed by all the other pairs in the cluster. 
                done.push(newPair);

                // The newly inserted pair needs decorating.
                this.decorationsFixer.set();
            }

            return done;
        });

        if (this.hasPairs !== prevHasPairs) {
            this.onDidUpdateHasPairsEventEmitter.fire(undefined);
        }

        // If there was previously no pairs, and no new pairs were added, then there is no way for
        // the `hasLineOfSight` property to change.
        if (prevHasPairs || newPairsAdded) {
            this._hasLineOfSight.stale = true;
            this.onDidUpdateHasLineOfSightEventEmitter.fire(undefined);
        }
    }
    
    /** 
     * If possible, move all cursors out of their respective nearest pairs.
     * 
     * This method call only succeeds if there is _line-of-sight_. For what 'line-of-sight' means,
     * please see the `hasLineOfSight` property. Nothing is done if there is no line-of-sight.
     */
    public leap(): void {

        // Check whether there is actually line of sight before executing this command.
        //
        // We have to check because:
        //
        //   1. Even if the default 'Leap' keybinding is disabled by a falsy `leaper.hasLineOfSight` 
        //      keybinding context when it is not possible to perform a leap, prior requests to 
        //      disable the keybinding context could still be pending acknowledgement by vscode since 
        //      requests to set context values are put into a queue and asynchronously processed by 
        //      vscode.
        //   2. The user could define a custom keybinding that does not have `leaper.hasLineOfSight`
        //      in the `when` context guard, which means the engine is not able to disable that user 
        //      defined keybinding.
        //
        // Thus, it is possible for the flow of execution to reach here even though we have disabled 
        // the `leaper.hasLineOfSight` keybinding context, and so we must perform this check.
        if (!this.hasLineOfSight) {
            return;
        }

        // Find the cursors that would result after a leap is performed.
        //
        // The resulting array of cursors will have been restored to the "original order", i.e. an 
        // order parallel to the `selections` array of the owning text editor.
        //
        // IMPORTANT: We perform a leap on the cursors that this tracker last saw (`this.sortedCursors`) 
        // instead of the current cursors of the owning text editor (`this.owner.selections`) because 
        // the pairs in this tracker were synchronized to the cursors last seen, which might (at 
        // this point in time) be slightly behind the current cursors of the owning text editor.
        const result: (Selection | undefined)[] = Array(this.sortedCursors.length).fill(undefined);
        for (const [i, { cursor, originalIndex }] of this.sortedCursors.entries()) {

            // The pairs being tracked for this cursor.
            const cluster = this.clusters[i];
            
            if (cluster.length > 0) {

                // For each cursor that has pairs being tracked for it, move the cursor out of the
                // nearest pair. This is the 'leap'.
                const nearestPair     = cluster[cluster.length - 1];
                const posAfterLeap    = nearestPair.close.translate(0, 1);
                result[originalIndex] = new Selection(posAfterLeap, posAfterLeap);
            } else {

                // Cursors which do not have pairs to leap out of are left alone.
                result[originalIndex] = cursor;
            }
        }

        // Set the cursors.
        //
        // IMPORTANT: Notice that in the step above, we did not drop the pairs that the cursors have 
        // moved out of. Rather, since we are setting the cursors here, a selection change event will 
        // be fired, and that event will then trigger the `notifySelectionChanges` of this tracker, 
        // which will then drop the pairs that the cursors have moved out of.
        this.owner.selections = (result as Selection[]);

        // If there is only a single cursor after the leap, we reveal it so that the owning text 
        // editor's viewport follows the cursor afterwards.
        //
        // We do not reveal when there are multiple cursors as there is no intuitive way to approach 
        // such a reveal.
        if (this.owner.selections.length === 1) {
            this.owner.revealRange(this.owner.selection);
        }
    }

    /** 
     * Reset this tracker by untracking all pairs and removing all decorations.
     */
    public clear(): void {
        this.clusters.forEach(cluster => cluster.forEach(pair => pair.decoration?.dispose()));
        this.clusters.fill([]);
        this.pairCount = 0;
        this._hasLineOfSight.stale = true;
        this.onDidUpdateHasPairsEventEmitter.fire(undefined);
        this.onDidUpdateHasLineOfSightEventEmitter.fire(undefined);
        this.decorationsFixer.clear();
    }

    /**
     * Terminate this tracker by clearing it and ceasing further event emissions.
     */
    public dispose(): void {
        this.clear();
        this.onDidUpdateHasPairsEventEmitter.dispose();
        this.onDidUpdateHasLineOfSightEventEmitter.dispose();
    }

    /** 
     * **For tests only**
     * 
     * Get a snapshot of the internal state of this tracker.
     */
    public snapshot(): TrackerSnapshot {
        
        // Arrange the clusters back into the original order such that they are parallel to the 
        // `selections` array of the owning text editor.
        const pairs = Array(this.clusters.length).fill(undefined);
        for (const [i, cluster] of this.clusters.entries()) {
            const originalIndex  = this.sortedCursors[i].originalIndex;
            pairs[originalIndex] = cluster.map(pair => {
                const open  = [pair.open.line, pair.open.character];
                const close = [pair.close.line, pair.close.character];
                return { open, close, isDecorated: !!pair.decoration };
            });
        }

        // So that the decoration options cannot be mutated by whoever requested the snapshot.
        function recursiveFreeze(obj: any): void {
            if (obj !== 'object' || obj === null) {
                return;
            }
            for (const key of Reflect.ownKeys(obj)) {
                recursiveFreeze(Reflect.get(obj, key));
            }
            Object.freeze(obj);
        }
        recursiveFreeze(this._decorationOptions);

        return { pairs, decorationOptions: this._decorationOptions };
    }

}

/** 
 * An internal representation of a pair that is being tracked.
 */
interface Pair {

    /**
     * The opening (i.e. left) side of the pair.
     */
    open: Position,

    /**
     * The closing (i.e. right) side of the pair.
     */
    close: Position,

    /**
     * The decoration applied to the closing side of this pair. 
     * 
     * `undefined` if this pair is undecorated. 
     */
    decoration: TextEditorDecorationType | undefined;

}

/** 
 * Return a new array containing the cursors sorted by increasing `anchor` positions. 
 * 
 * Accompanying each cursor in the return value is the index of the cursor before it was sorted.
 */
function sortCursors(unsorted: ReadonlyArray<Selection>): ReadonlyArray<{
    cursor:        Selection,
    originalIndex: number
}> {
    return unsorted.map((cursor, i) => ({ cursor, originalIndex: i }))
                   .sort((a, b) => a.cursor.anchor.compareTo(b.cursor.anchor));
}

/**
 * Decorate the closing side of a pair in a text editor.
 */
function decorate(
    editor:            TextEditor,
    pair:              Pair,
    decorationOptions: Unchecked<DecorationRenderOptions>
): TextEditorDecorationType {
    const decoration = window.createTextEditorDecorationType(decorationOptions.value);
    editor.setDecorations(decoration, [ new Range(pair.close, pair.close.translate(0, 1)) ]);
    return decoration;
};

/** 
 * Apply a shift in position due to content changes.
 * 
 * This function advances the content change stack. 
 *
 * The return value is `undefined` if the content changes overwrite `position`. 
 */
function shift(stack: ContentChangeStack, position: Position): Position | undefined {

    // Pop the content change stack until a content change that either overlaps or occurs after 
    // `position` is encountered.
    //  
    // Doing this allows us to 'build up' all of the shifts that would apply to a position due to 
    // content changes before it. The built up shift values can then be retrieved through the 
    // `vertCarry` and `horzCarry` properties.
    while (stack.peek()?.range.end.isBeforeOrEqual(position)) {
        stack.pop();
    }

    // Return `undefined` if position is deleted.
    if (stack.peek()?.range.start.isBeforeOrEqual(position)) {
        return undefined;
    }

    // We get here if either the content change stack has been exhausted, or if the content change 
    // at the top of the stack occurs after `position`. 
    //
    // Since content changes do not overlap, all of the content changes still remaining on the stack 
    // must occur after `position`, and therefore cannot affect `position`.
    // 
    // The carry values on the content stack now represent the net shift that would applied
    // on `position` by the content changes.
    return position.translate(
        stack.vertCarry,
        position.line === stack.horzCarry.affectsLine ? stack.horzCarry.value : 0
    );
}
