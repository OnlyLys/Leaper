import { Range, Position, Selection, TextEditorDecorationType, window, TextEditor, DecorationRenderOptions, TextDocumentContentChangeEvent, EventEmitter, Event } from 'vscode';
import { Unchecked } from '../configurations/unchecked';
import { ImmediateReusable } from './immediate-reusable';
import { ContentChangeStack } from './content-change-stack';

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
     * The most recently seen cursors, **sorted by increasing `anchor` positions**.
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
    private cursors: ReadonlyArray<TaggedCursor>;

    /**
     * The pairs that are being tracked for each cursor.
     * 
     * This array is parallel to `cursors`.
     */
    private pairs: Cluster[];

    /**
     * Possible dead key autoclosing pairs for each cursor.
     * 
     * This array is parallel to `cursors`.
     * 
     * # Why this Array Exists
     * 
     * Whenever we encounter the first content change involved in what could be the autoclosing of a 
     * dead key autoclosing pair (which occurs over two content change events), we record it here so 
     * that the second content change (if it occurs) can check this array to verify that the first
     * content change had occurred.
     */
    private possibleDeadKeyPairs: (PossibleDeadKeyPair | undefined)[];

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
     * For consistency with `onDidUpdateHasLineOfSightEmitter`, the updated value is not sent when 
     * firing this event.
     */
    private readonly onDidUpdateHasPairsEmitter = new EventEmitter<undefined>();

    /**
     * Subscribe to be notified when the `hasPairs` property has been updated.
     */
    public get onDidUpdateHasPairs(): Event<undefined> {
        return this.onDidUpdateHasPairsEmitter.event;
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
                       && this.cursors.every(cursor => cursor.anchor.isEqual(cursor.active))
                       && this.pairs.some((cluster, i) => {
                            if (cluster.length > 0) {
                                const anchor       = this.cursors[i].anchor;
                                const nearestPair  = cluster[cluster.length - 1];
                                const rangeBetween = new Range(anchor, nearestPair.close);
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
    private readonly onDidUpdateHasLineOfSightEmitter = new EventEmitter<undefined>();

    /**
     * Subscribe to be notified when the `hasLineOfSight` property has been updated.
     */
    public get onDidUpdateHasLineOfSight(): Event<undefined> {
        return this.onDidUpdateHasLineOfSightEmitter.event;
    }

    /**
     * A timer that fixes decorations at the end of the current event loop cycle.
     * 
     * When this timer executes, it will ensure that every pair is decorated only if `decorateAll` 
     * is enabled. Otherwise, this timer will ensure that the pairs nearest to each cursor is decorated 
     * and that every other pair is not decorated.
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
        if (this._decorateAll) {

            // Make sure all pairs are decorated since `leaper.decorateAll` is enabled.
            for (const cluster of this.pairs) {
                for (const pair of cluster) {
                    if (!pair.decoration) {
                        pair.decoration = decorate(this.owner, pair, this._decorationOptions);
                    }
                }
            }
        } else {

            // Make sure only the pairs nearest to each cursor are decorated since `leaper.decorateAll`
            // is disabled.
            for (const cluster of this.pairs) {
                let i = 0;
                while (i < cluster.length - 1) {
                    cluster[i].decoration?.dispose();
                    cluster[i++].decoration = undefined;
                }
                if (cluster.length > 0) {
                    cluster[i].decoration = decorate(this.owner, cluster[i], this._decorationOptions);
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
        for (const cluster of this.pairs) {
            for (let i = 0; i < cluster.length; ++i) {
                cluster[i].decoration?.dispose();
                cluster[i].decoration = undefined;
            }
        }
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

            /** Which autoclosing pairs to detect and then track. */
            detectedPairs: ReadonlyArray<string>
        }
    ) {
        this._decorateAll         = configuration.decorateAll;
        this._decorationOptions   = configuration.decorationOptions;
        this._detectedPairs       = configuration.detectedPairs;
        this.cursors              = sortCursors(this.owner.selections);
        this.pairs                = Array(this.cursors.length).fill([]);
        this.possibleDeadKeyPairs = Array(this.cursors.length).fill(undefined);
    }

    /** 
     * Notify this tracker of cursor changes in the owning text editor.
     */
    public notifySelectionChanges(newSelections: ReadonlyArray<Selection>): void {

        const prevHasPairs = this.hasPairs;

        // This method does the following:
        // 
        // 1. Untracks pairs if cursors have moved out of them. This makes it such that when a user 
        //    has clicked out of a tracked pair, the pair will cease to be tracked. 
        // 2. Adjusts the internal capacity to match number of active cursors. This step is required 
        //    for the `notifyContentChanges` method to correctly detect pairs that are inserted.

        // There are 4 possible kinds of selection changes. 
        //
        //  1. Movement of cursors.
        //  2. Addition or removal of cursors.
        //  3. Expansion or shrinking of cursor selections.
        //  4. Reordering of cursors.
        //
        // By sorting the cursors here, we obviate the need for dealing with the fourth kind.
        const newCursors = sortCursors(newSelections);

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
        // latest sorted cursors to the previous sorted cursors to determine which cursor was removed 
        // or added. 
        if (newCursors.length !== this.cursors.length) {

            const newPairs = [];
            
            // Compare the latest sorted cursors with the previous sorted cursors.
            let i = 0;
            for (const newCursor of newCursors) {

                // Cursors which are only in the previous sorted cursors array are cursors which
                // have been removed, thus we drop their pairs.
                while (i < this.cursors.length && this.cursors[i].anchor.isBefore(newCursor.anchor)) {
                    this.pairCount -= this.pairs[i].length;
                    this.pairs[i++].forEach(pair => pair.decoration?.dispose());
                }

                if (i < this.cursors.length && this.cursors[i].anchor.isEqual(newCursor.anchor)) {

                    // If a new cursor matches a previous cursor, that means the cursor survived the
                    // cursor change operation, and so we bring forward its cluster.
                    //
                    // Note that we consider two cursors to be equal as long as their anchors match.
                    newPairs.push(this.pairs[i++]);
                } else {

                    // If a new cursor does not match a previous cursor, that means the new cursor
                    // was newly created. In this case, we give it a fresh empty cluster.
                    newPairs.push([]);
                }
            }
    
            // The cursors in `this.cursors[i..]` were removed in the cursor change operation since
            // none of the cursors in that slice have a matching cursor in the latest sorted cursors
            // array. Thus, we drop their pairs.
            while (i < this.cursors.length) {
                this.pairCount -= this.pairs[i].length;
                this.pairs[i++].forEach(pair => pair.decoration?.dispose());
            }

            // The array of possible dead key autoclosing pairs is parallel to `cursors`, and so 
            // should always have the same length as it.
            this.possibleDeadKeyPairs.length = newCursors.length;

            this.pairs = newPairs;
        }

        this.cursors = newCursors;

        // --------------------------------
        // STEP 2 - For each cursor, untrack any pairs that it has moved out of.
        // --------------------------------
        //
        // This step ensures that when the user has moved a cursor out of an enclosing pair, that 
        // pair will no longer be tracked.
        //
        // Note that here we use the anchor of a cursor to decide whether or not it has moved out of 
        // a pair. The choice of using a cursor's anchor makes sense as we do not want to untrack a 
        // cursor's pairs if the user is just making a selection from within a pair to outside of it.
        for (const [i, { anchor } ] of this.cursors.entries()) {

            // The pairs being tracked for this cursor.
            const cluster = this.pairs[i];

            let pairsDropped = false;

            // Drop any pairs that do not enclose the cursor.
            //
            // Iterating in reverse is faster, since the pairs in each cluster are ordered from least 
            // nested to most nested, meaning that we can stop the iteraton once we encounter a pair 
            // that encloses the cursor, since we know that the remaining pairs also enclose the 
            // cursor.
            for (let j = cluster.length - 1; j >= 0; --j) {
                if (anchor.isBeforeOrEqual(cluster[j].open) || anchor.isAfter(cluster[j].close)) {
                    cluster.pop()?.decoration?.dispose();
                    this.pairCount -= 1;
                    pairsDropped    = true;
                } else {
                    break;
                }
            }

            // If pairs were dropped from the cluster but the cluster still contains pairs afterwards, 
            // then we have to fix the decorations as there is now a new nearest pair.
            if (pairsDropped && cluster.length > 0) {
                this.decorationsFixer.set();
            }

            // If this cursor has moved out of a possible dead key autoclosing pair, then that dead
            // key autoclosing pair is no longer possible, since the two stage process involved in 
            // autoclosing a dead key autoclosing pair has been interrupted.
            if (!this.possibleDeadKeyPairs[i]?.close.isEqual(anchor)) {
                this.possibleDeadKeyPairs[i] = undefined;
            }
            
        }

        if (this.hasPairs !== prevHasPairs) {
            this.onDidUpdateHasPairsEmitter.fire(undefined);
        }

        // The `hasLineOfSight` property can only change if there were previously pairs, since 
        // cursor changes never introduce new pairs. If there were previously no pairs, then the
        // `hasLineOfSight` property would have been `false` then and continue to be `false` now, so
        // we don't have to mark the value as stale.
        if (prevHasPairs) {
            this._hasLineOfSight.stale = true;
            this.onDidUpdateHasLineOfSightEmitter.fire(undefined);
        }

    }

    /** 
     * Notify this tracker of text content changes in the owning text editor's document.
     */
    public notifyContentChanges(contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>): void {

        const prevHasPairs = this.hasPairs;

        // This method does the following:
        // 
        // 1. Stop tracking pairs that have been deleted.
        // 2. Start tracking new autoclosing pairs that have been inserted.
        // 3. Maintain tracking of pairs that have shifted in position due to changes in the document.

        // Make the immutable content changes array behave like a mutable stack.
        //
        // A stack is appropriate because:
        //
        //  1. We iterate through clusters from the top to the bottom of the document.
        //  2. We iterate through the pairs in each cluster from the outermost pair's opening side 
        //     to the innermost pair's opening side, and then from the innermost pair's closing side 
        //     to the outermost pair's closing side.
        // 
        // That means that there is no need to backtrack when going through the content changes, 
        // which makes stack a good choice.
        const stack = new ContentChangeStack(contentChanges);

        // Apply the content changes.
        for (const [i, cluster] of this.pairs.entries()) {

            // The cursor that is enclosed by the pairs of this cluster.
            //
            // Note that we consider a cursor to be enclosed by a pair when the `anchor` part of the 
            // cursor is between the opening and closing sides of said pair.
            const cursor = this.cursors[i];

            // To mark pairs that have been deleted from this cluster.
            const deleted = Array(cluster.length).fill(false);

            // --------------------------------
            // STEP 1 - Shift (or delete) the opening side of pairs.
            // --------------------------------
            //
            // This step processes the opening sides of pairs in this cluster. Pairs which have been 
            // deleted will marked in `deleted`.
            for (const [j, pair] of cluster.entries()) {

                // Pop the content change stack until a content change that ends after this pair's 
                // opening side is encountered.
                while (stack.top && !stack.top.range.end.isAfter(pair.open)) {
                    stack.pop();
                }

                if (!stack.top || stack.top.range.start.isAfter(pair.open)) {

                    // We get here when the stack is empty or if the content change currently at 
                    // the top of the stack begins after the opening side of this pair. In either 
                    // case, the opening side of this pair has survived.
                    //
                    // We apply the accumulated carry values to find the position of the opening 
                    // side of this pair after the content changes have been applied.
                    pair.open = shift(stack, pair.open);
                } else {

                    // We get here when the content change at the top of the stack has overwritten
                    // the opening side of this pair. Thus, we drop this pair.
                    pair.decoration?.dispose();
                    deleted[j] = true;
                }
            }

            // There are three kinds of autoclosing pairs:
            //
            //   1. Regular
            //       
            //   This is the most common kind of autoclosing pair. Where when nothing is selected 
            //   and the user presses an opener (such as `{`), vscode automatically inserts the 
            //   closer (in this example, `}`), then moves the cursor to between the autoclosed pair.
            //     
            //   This kind of autoclosing pair always manifests as a single content change that 
            //   inserts a pair (such as `{}`) at a cursor and overwrites no text in the document.
            //   
            //   2. Dead Key
            //     
            //   When autoclosing pairs are inserted with an opening character that is behind a dead 
            //   key, and the user's desktop is configured to insert previews of dead keys into the 
            //   text editor, then when user types in the opening character, vscode autocloses the 
            //   pair in a completely different way compared to regular autoclosing pairs. 
            // 
            //   Depending on whether or not the previewed dead key has the same character as the 
            //   opening character that is being inserted, vscode does one of the following:
            //   
            //     - If the previewed dead key has a different character than the opening character, 
            //       then vscode will fire two separate (but consecutive) content change events, 
            //       where the first event replaces the dead key preview with the opening side of 
            //       the pair, while the second inserts the closing side of the pair. 
            //     - However, if the previewed dead key has the same character as the opening 
            //       character, then vscode will leave the previewed dead key as is, and fires one 
            //       content change event to insert the closing side of the pair. 
            // 
            //   In both cases, when the closing side of the pair is inserted by vscode, the cursor 
            //   will not be moved by the insertion. This insertion behavior is unique as there is 
            //   no way for a user or even an extension author to replicate this behavior.
            //   
            //   For convenience, we call the first kind of dead key autoclosing pair a **Type-1 Dead 
            //   Key Autoclosing Pair**, while we call the second kind a **Type-2 Dead Key Autoclosing 
            //   Pair**.
            // 
            //   It's worth noting that dead key autoclosing pairs are rarely encountered, as by 
            //   default, Windows and Linux IBus do not insert previews of dead keys. It seems that 
            //   only MacOS has such behavior by default. When autoclosing pairs are inserted in a 
            //   desktop environment where dead keys are not previewed, then they will be autoclosed 
            //   in the regular way.
            //   
            //   3. Wrap Around
            //     
            //   This kind of autoclosing pair occurs when there is text selected and the user presses 
            //   an opener (such as `{`), vscode then automatically wraps the selected text on both 
            //   sides (in this example, resulting in `{<selected_text>}`). 
            //     
            //   This kind of autoclosing pair always manifests as two content changes in one event, 
            //   the first of which inserts the opening side of the pair and the second which inserts 
            //   the closing side (for instance, the first one would insert `{` before the selected 
            //   text and the second would insert `}` after the selected text).
            //  
            // Within the next three steps, we will be checking for insertion of the first two kinds 
            // of pairs. However, we will not be checking for wrap around autoclosing pairs due to 
            // the complexity involved in tracking them. 

            // --------------------------------
            // STEP 2 - Check for opening side of a Type-1 dead key autoclosing pair.
            // --------------------------------

            // A possible dead key autoclosing pair detected for this cursor.
            let newPossibleDeadKeyPair: PossibleDeadKeyPair | undefined;

            // We only check for the opening side of a Type-1 dead key autoclosing pair when the
            // cursor's character index is non-zero since a Type-1 dead key autoclosing pair's 
            // opening side replaces a character of text immediately before the cursor.
            if (cursor.anchor.character > 0) {

                // Pop the stack until the content change at the top of the stack is one that ends 
                // at or after the cursor.
                while (stack.top && !stack.top.range.end.isAfterOrEqual(cursor.anchor)) {
                    stack.pop();
                }

                // If the content change currently at the top of the stack ends at the cursor and
                // replaces exactly one character of text before the cursor, then it could possibly 
                // be the first content change involved in the autoclosing of a Type-1 dead key 
                // autoclosing pair. 
                //
                // We only need to check this one content change since content changes do not overlap.  
                if (
                    stack.top
                    && stack.top.range.end.isEqual(cursor.anchor)
                    && stack.top.rangeLength === 1
                    && stack.top.text.length === 1
                    && cursor.anchor.isEqual(cursor.active)
                ) {
                    const match = this._detectedPairs.find(pair => pair[0] === stack.top?.text);
                    if (match) {

                        // Cursor position after all content changes have been applied.
                        const newAnchor = shift(stack, cursor.anchor);

                        // A content change that replaces one character of text right before the 
                        // cursor with the opening character of a pair is possibly the first content 
                        // change involved in the autoclosing of a Type-1 dead key autoclosing pair.
                        newPossibleDeadKeyPair = { pair: match, close: newAnchor };
                    }
                }

            }

            // --------------------------------
            // STEP 3 - Check insertion at cursor.
            // --------------------------------
            //
            // After this step, the content change stack will contain content changes that begin at
            // or after the cursor.

            // A new pair that is detected.
            //
            // Note that the opening and closing positions of this new pair (if detected) is already 
            // finalized.
            let newPair: Pair | undefined;

            // Pop the stack until the content change at the top of the stack is one that begins at 
            // or after the cursor.
            while (stack.top && !stack.top.range.start.isAfterOrEqual(cursor.anchor)) {
                stack.pop();
            }

            // If the content change currently at the top of the stack that begins at the cursor 
            // (i.e. a text insertion at the cursor), then it could be the insertion of:
            //
            //   - A regular autoclosing pair.
            //   - The closing side of either type of dead key autoclosing pair.
            //   - The opening side of a Type-2 dead key autoclosing pair.
            //
            // and so check for each possibility here. We do not perform this check for any other 
            // content changes remaining on the stack since they all occur after the one currently 
            // at the top of the stack (and consequently must occur after the cursor).
            if (
                stack.top
                && stack.top.range.start.isEqual(cursor.anchor) 
                && stack.top.range.isEmpty
                && cursor.anchor.isEqual(cursor.active)
            ) {

                // Cursor position after all content changes have been applied.
                const newAnchor = shift(stack, cursor.anchor);

                if (stack.top.text.length === 2 && this._detectedPairs.includes(stack.top.text)) {
    
                    // Regular autoclosing pair detected.
                    //
                    // Note that the conditions above would not be able to distinguish between a 
                    // pasted pair and an autoclosed one, and therefore we will end up tracking a 
                    // pasted pair as well (when really we only want to track an autoclosed one). 
                    // But because the cursor ends up at different positions afterwards (an autoclosed 
                    // pair will have the cursor end up between the pair, like so `{|}`, while a 
                    // pasted one will have the cursor end up after the pair, like so `{}|`), we can 
                    // rely on a subsequent `Tracker.notifySelectionChanges` call to untrack a pasted 
                    // pair, meaning in practice we should not have issues by not being able to 
                    // distinguish between the two.
                    newPair = { 
                        open:       newAnchor,
                        close:      newAnchor.translate(0, 1),
                        decoration: undefined
                    };
                } else if (stack.top.text.length === 1) {
                    
                    // When the autoclosing pair is a pair that has the same character on both sides
                    // (such as `''` or `""`), it can be ambiguous as to whether an inserted character 
                    // is the opening side for new Type-2 dead key autoclosing pair or the closing 
                    // side for either type of dead key autoclosing pair. Here we eagerly detect both 
                    // kinds, and allow a subsequent `Tracker.notifySelectionChanges` call to sort 
                    // out the ambiguity.

                    // Check for closing side of a dead key autoclosing pair.
                    if (stack.top.text === this.possibleDeadKeyPairs[i]?.pair[1]) {

                        newPair = { 
                            open:       newAnchor.translate(0, -1),
                            close:      newAnchor,
                            decoration: undefined
                        };
                    }

                    // Check for opening side of a possible Type-2 autoclosing pair.
                    const match = this._detectedPairs.find(pair => pair[0] === stack.top?.text);
                    if (match) {
                        newPossibleDeadKeyPair = { pair: match, close: newAnchor.translate(0, 1) };
                    }
                }
            }

            // --------------------------------
            // STEP 4 - Shift (or delete) the closing side of pairs. 
            // --------------------------------
            //
            // This step processes the closing sides of pairs in this cluster. Pairs which have been 
            // deleted will be set to `undefined`.

            // We iterate through the pairs in reverse so that we can go through the closing side 
            // of pairs from innermost to outermost. Doing so means we do not have to backtrack when 
            // going through the content changes.
            for (let j = cluster.length - 1; j >= 0; --j) {
                if (deleted[j]) {
                    continue;
                }

                // Pop the content change stack until a content change that ends after this pair's 
                // closing side is encountered.
                while (stack.top && !stack.top.range.end.isAfter(cluster[j].close)) {
                    stack.pop();
                }

                if (!stack.top || stack.top.range.start.isAfter(cluster[j].close)) {

                    // We get here when the stack is empty or if the content change currently at 
                    // the top of the stack begins after the closing side of this pair. In either 
                    // case, the closing side of this pair has survived.
                    //
                    // We apply the accumulated carry values to find the position of the closing 
                    // side of this pair after the content changes have been applied.
                    cluster[j].close = shift(stack, cluster[j].close);

                    // We only keep pairs that end up with sides on the same line, since we want 
                    // multi-line text insertion between pairs to invalidate them.
                    if (cluster[j].open.line === cluster[j].close.line) {
                        continue;
                    }
                } 

                // We get here when there is either a content change at the top of the stack that
                // has overwritten the closing side of this pair, or when the sides of this pair 
                // have ended up on different lines. In either case, we drop this pair.
                cluster[j].decoration?.dispose();
                deleted[j] = true;
            }

            // --------------------------------
            // STEP 5 - Complete the new cluster.
            // --------------------------------
            
            const prevLength = cluster.length;

            // Filter out all the deleted pairs.
            this.pairs[i] = cluster.filter((_, j) => !deleted[j]);

            // Add the new pair to the finalized cluster.
            if (newPair) {

                // The new pair is appended to the end of the finalized cluster because it (being 
                // nearest to the cursor) is enclosed by all the other pairs in the cluster. 
                this.pairs[i].push(newPair);

                // The newly added pair needs decorating.
                this.decorationsFixer.set();
            } 

            this.pairCount = this.pairCount + this.pairs[i].length - prevLength;

            // If the previous nearest pair was removed, then there is a new nearest pair, so we 
            // have to reapply the decorations.
            if (deleted.length > 0 && deleted[deleted.length - 1]) {
                this.decorationsFixer.set();
            }

            // Save a new possible dead key autoclosing pair for the next call of the enclosing
            // method. 
            //
            // Note that we did not immediately save a new possible dead key autoclosing pair into
            // `this.possibleDeadKeyPairs` had we detected one above, because a new possible dead 
            // key autoclosing pair is always meant for the next call of the enclosing method and 
            // not the current one.
            this.possibleDeadKeyPairs[i] = newPossibleDeadKeyPair;
        };

        if (this.hasPairs !== prevHasPairs) {
            this.onDidUpdateHasPairsEmitter.fire(undefined);
        }

        // If there are now pairs, or if there are now no pairs but previously there were, then the
        // `hasLineOfSight` property could have changed after the content changes have been applied.
        if (this.hasPairs || prevHasPairs) {
            this._hasLineOfSight.stale = true;
            this.onDidUpdateHasLineOfSightEmitter.fire(undefined);
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
        // IMPORTANT: We perform a leap on the cursors that this tracker last saw (`this.cursors`) 
        // instead of the current cursors of the owning text editor (`this.owner.selections`) because 
        // the pairs in this tracker were synchronized to the cursors last seen, which might (at this 
        // point in time) be slightly behind the current cursors of the owning text editor.
        const result: (Selection | undefined)[] = Array(this.cursors.length).fill(undefined);
        for (const [i, { anchor, active, originalIndex }] of this.cursors.entries()) {
            const cluster = this.pairs[i];
            if (cluster.length > 0) {

                // For each cursor that has pairs being tracked for it, move the cursor out of the
                // nearest pair. This is the 'leap'.
                const nearestPair     = cluster[cluster.length - 1];
                const posAfterLeap    = nearestPair.close.translate(0, 1);
                result[originalIndex] = new Selection(posAfterLeap, posAfterLeap);
            } else {

                // Cursors which do not have pairs to leap out of are left alone.
                result[originalIndex] = new Selection(anchor, active);
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
        for (let i = 0; i < this.pairs.length; ++i) {
            this.pairs[i].forEach(pair => pair.decoration?.dispose());
            this.pairs[i] = [];
        }
        this.possibleDeadKeyPairs?.forEach((_, i, self) => self[i] = undefined);
        this.pairCount = 0;
        this._hasLineOfSight.stale = true;
        this.onDidUpdateHasPairsEmitter.fire(undefined);
        this.onDidUpdateHasLineOfSightEmitter.fire(undefined);
        this.decorationsFixer.clear();
    }

    /**
     * Terminate this tracker.
     */
    public dispose(): void {
        this.clear();
        this.onDidUpdateHasPairsEmitter.dispose();
        this.onDidUpdateHasLineOfSightEmitter.dispose();
        this.decorationsFixer.dispose();
    }

    /** 
     * **For tests only**
     * 
     * Get a snapshot of the internal state of this tracker.
     */
    public snapshot(): Snapshot {

        // Clone each cluster and rearrange them back into the original order such that they are 
        // parallel to the `selections` array of the owning text editor.
        const reordered = Array(this.pairs.length).fill(undefined);
        for (const [i, cluster] of this.pairs.entries()) {
            reordered[this.cursors[i].originalIndex] = cluster.map(pair => {
                return { open: pair.open, close: pair.close, isDecorated: !!pair.decoration };
            });
        }

        // So that the decoration options cannot be mutated by whoever requested the snapshot.
        freeze(this._decorationOptions);
        
        return { pairs: reordered, decorationOptions: this._decorationOptions };
    }

}

/** 
 * Return a new array containing the cursors sorted by increasing `anchor` positions. 
 * 
 * Accompanying each cursor in the return array is the index of the cursor before it was sorted.
 * 
 * # Time Complexity
 * 
 * This function delegates the sorting to V8, which uses [Timsort](https://v8.dev/blog/array-sort#timsort).
 * Therefore this sorting step should cost O(n) most of the time since the user's cursors is often
 * already in sorted order.
 */
function sortCursors(unsorted: ReadonlyArray<Selection>): ReadonlyArray<TaggedCursor> {
    return unsorted.map(({ anchor, active }, originalIndex) => ({ anchor, active, originalIndex }))
                   .sort((a, b) => a.anchor.compareTo(b.anchor));
}

/**
 * Decorate the closing side of a pair.
 */
function decorate(
    editor:            TextEditor,
    pair:              Pair,
    decorationOptions: Unchecked<DecorationRenderOptions>
): TextEditorDecorationType {
    const decoration = window.createTextEditorDecorationType(decorationOptions.cast());
    editor.setDecorations(decoration, [ new Range(pair.close, pair.close.translate(0, 1)) ]);
    return decoration;
};

/**
 * Deep freeze an object.
 */
function freeze(obj: any): void {
    if (obj === 'object' && obj !== null) {
        Reflect.ownKeys(obj).forEach(key => freeze(Reflect.get(obj, key)));
        Object.freeze(obj);
    }
}

/**
 * Shift a position with the carry values of a stack.
 */
function shift(stack: ContentChangeStack, position: Position): Position {
    return position.translate(
        stack.vertCarry,
        position.line === stack.horzCarry.affectsLine ? stack.horzCarry.value : 0
    );
}

/** 
 * A pair that is being tracked for a cursor.
 * 
 * # Indices
 * 
 * Both `line` and `character` indices in a `Position` are zero-based. Furthermore, `character` 
 * indices are in units of UTF-16 code units, which notably does not have the same units as the 
 * column number shown in the bottom right of vscode, as the latter corresponds to the physical 
 * width of characters in the editor.
 */
interface Pair {

    /**
     * The position of the opening side of this pair.
     */
    open: Position,

    /**
     * The position of the closing side of this pair.
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
 * The pairs that are being tracked for a cursor.
 * 
 * The pairs in a cluster are always ordered from least nested to most nested, and all of them always
 * enclose the corresponding cursor.
 */
type Cluster = Pair[];

/**
 * A cursor tagged with its original index.
 */
interface TaggedCursor extends Pick<Selection, 'anchor' | 'active'> {

    /**
     * The anchor position of this cursor.
     */
    readonly anchor: Position,

    /**
     * The active position of this cursor.
     */
    readonly active: Position,

    /** 
     * The index of this cursor before it was sorted. 
     * 
     * In other words, this is the index of this cursor in the `selections` array of the owning
     * text editor.
     */
    readonly originalIndex: number

}

/**
 * A possible dead key autoclosing pair.
 */
interface PossibleDeadKeyPair {

    /**
     * The string representation of the pair.
     */
    readonly pair: string,

    /**
     * The expected position of the closing side of the pair.
     */
    readonly close: Position

}

/**
 * A snapshot of the internal state of a tracker.
 */
type Snapshot = {

    pairs: { open: Position, close: Position, isDecorated: boolean }[][],

    readonly decorationOptions: Unchecked<DecorationRenderOptions>

}
