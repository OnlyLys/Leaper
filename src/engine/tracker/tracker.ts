import { Range, Selection, TextEditor, DecorationRenderOptions, TextDocumentContentChangeEvent, EventEmitter, Event, TextEditorDecorationType, window } from 'vscode';
import { CompactPair } from '../../tests/utilities/compact';
import { Unchecked } from '../configurations/unchecked';
import { ContentChangeStack } from './content-change-stack';
import { TimeoutReusable } from './timeout-reusable';

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
     * The most recently seen cursors, **sorted by increasing anchor positions**.
     * 
     * # Why Sort the Cursors?
     * 
     * We prefer working with sorted cursors because vscode is inconsistent with how cursors are 
     * ordered within the `selections` array of a `TextEditor`. For example, an operation like 
     * pasting with multi-cursors may reorder the cursors in the `selections` array.
     * 
     * Only handling sorted cursors means that we can make our `pairs` array parallel to this array 
     * of sorted cursors without worrying about cursor reordering operations messing things up. 
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
    private cursors: TaggedCursor[];

    /**
     * The pairs that are being tracked for each cursor.
     * 
     * This array is parallel to `cursors`.
     * 
     * # Clusters
     * 
     * Each subarray of `number`s is called a cluster, and it contains the pairs being tracked for 
     * the corresponding cursor. Each pair is represented by four consecutive indices. The first and
     * second indices are the line and character indices of the opening side of the pair, while the 
     * third and fourth are the line and character indices of the closing side of the pair.
     * 
     * The pairs in a cluster are always ordered from least to most nested and always enclose the 
     * corresponding cursor.
     * 
     * # Indices are Zero-Based
     * 
     * Both line and character indices are zero-based. Furthermore, character indices are in units 
     * of UTF-16 code units, which notably does not have the same units as the column number shown 
     * in the bottom right of vscode, as the latter corresponds to the physical width of characters 
     * in the editor.
     * 
     * # Optimization: Storing Indices Instead of Objects
     * 
     * You might ask why we store indices instead of `Position` objects to represent the positions 
     * of the sides of a pair. A previous implementation of this class stored (for each pair) two 
     * `Position` objects within a `Pair` object, and that `Pair` object was then stored within a 
     * `Pair[]` array containing the pairs for a cursor. However, it was found that doing it that way 
     * had some runtime performance penalty (around 2 times slower*), probably due to the amount of 
     * pointer indirection involved. Since we want to minimise latency, we store indices directly 
     * instead.
     * 
     * *With manual measurements by inserting 20 consecutive pairs at 20 cursors, the runtime of 
     * each `notifyContentChanges` call averaged at around 1.5ms to 2ms with the current 'flat'
     * implementation, while it averaged at around 4ms with the previous 'nested' implementation.
     */
    private pairs: number[][];

    /**
     * The decoration for each pair. 
     * 
     * This array is parallel to `pairs`. Each subarray in this array is parallel to the corresponding 
     * cluster in `pairs`. Pairs which do not have decorations have the value of `undefined` here.
     */
    private decorations: (TextEditorDecorationType | undefined)[][];

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
            this._hasLineOfSight.value = false;
            if (this.hasPairs && this.cursors.every(cursor => cursor.isEmpty)) {
                for (const [i, cluster] of this.pairs.entries()) {
                    if (cluster.length > 0) {

                        // The range between this cluster's cursor and the nearest pair's closing side.
                        const rangeBetween = new Range(
                            this.cursors[i].anchorLine, 
                            this.cursors[i].anchorChar,
                            cluster[cluster.length - 2],
                            cluster[cluster.length - 1]
                        );

                        if (this.owner.document.getText(rangeBetween).trim().length === 0) {
                            this._hasLineOfSight.value = true;

                            // The `hasLineOfSight` property is `true` as long as one cursor has 
                            // line-of-sight.
                            break;
                        }
                    }
                }
            }
            this._hasLineOfSight.stale = false;
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

    private _decorateAll: boolean;

    /**
     * Whether to decorate all pairs or just the ones nearest to each cursor.
     */
    public set decorateAll(v: boolean) {
        this._decorateAll = v;

        // Remove then reapply all the decorations.
        for (let i = 0; i < this.decorations.length; ++i) {
            for (let j = 0; j < this.decorations[i].length; ++j) {
                this.decorations[i][j]?.dispose();
                this.decorations[i][j] = undefined;
            }
        }
        this.decorator.set();
    }

    private _decorationOptions: Unchecked<DecorationRenderOptions>;

    /**
     * The style of the decorations applied.
     */
    public set decorationOptions(newOptions: Unchecked<DecorationRenderOptions>) {
        this._decorationOptions = newOptions;

        // Use the setter for `decorateAll` to reapply the decorations.
        this.decorateAll = this._decorateAll;
    }
    
    private _detectedPairs: ReadonlyArray<string>;

    /**
     * Which pairs to detect and then track.
     */
    public set detectedPairs(v: ReadonlyArray<string>) {
        this._detectedPairs = v;
    }

    private _waitBeforeDecorating: number = 30;

    /** 
     * How many milliseconds of inactivity before applying decorations. 
     */
    public set waitBeforeDecorating(ms: number) {
        this._waitBeforeDecorating = ms;
    }

    /**
     * A timer that applies decorations after a period of inactivity.
     * 
     * If `decorateAll` is disabled, then this timer only decorates the most nested pair (i.e. the
     * 'nearest pair') in a cluster if it hasn't already been decorated. On the other hand, if 
     * `decorateAll` is enabled, then this timer will decorate pairs starting from the most nested 
     * pair to the least nested pair, only stopping when an already decorated pair is encountered, 
     * since it can be assumed that the remaining pairs have all been decorated as well.
     * 
     * This timer should be set whenever pairs are added or when pairs are dropped from a cluster 
     * such that the cluster has a new 'nearest pair'. This timer does not need to be set when the 
     * nearest pair for a cluster has not changed or when the entire cluster is dropped because in 
     * both cases there are no pairs within it that need decorating.
     * 
     * # Why Do We Only Apply Decorations After a Period of Inactivity?
     * 
     * We do not immediately decorate pairs when they are detected because vscode does not immediately
     * apply decorations when requested. Instead, vscode applies decorations asynchronously, which 
     * causes problems as a request to decorate a pair could be referencing a stale position once 
     * vscode gets around to processing it. This is particularly an issue when there are content
     * changes following immediately after a content change that inserted a pair.
     * 
     * Consider for example two consecutive content change events, the first of which inserts a pair 
     * at line X, character Y and the second of which inserts a space " " in between the pair. Had 
     * we applied decorations when processing the first content change event, we would have asked 
     * vscode to decorate the closing side of the pair at line X, character Y + 1. However, by the 
     * time vscode gets around to processing the decoration request, it is possible that the space 
     * " " has already been inserted, meaning that the space will be decorated instead of the closing
     * side of the pair which has been pushed 1 character to the right due to the insertion of the 
     * space.
     * 
     * Therefore, by only applying decorations after a period of inactivity (i.e. no content changes), 
     * we can reduce the likelihood of a pending content change making our requests to decorate pairs 
     * stale.
     */
    private readonly decorator = new TimeoutReusable(() => {
        if (this._decorateAll) {

            // For each cursor, decorate the pairs from inside out, stopping when we encounter an
            // already decorated pair.
            for (let i = 0; i < this.decorations.length; ++i) {
                const cluster     = this.pairs[i];
                const decorations = this.decorations[i];
                for (let j = decorations.length - 1; j >= 0; --j) {
                    if (!decorations[j]) {
                        const closeLine = cluster[(j * 4) + 2];
                        const closeChar = cluster[(j * 4) + 3];
                        decorations[j] = decorate(this.owner, closeLine, closeChar, this._decorationOptions);
                    } else {
                        break;
                    }
                }
            }
        } else {

            // For each cursor, ensure that the pair nearest to it is decorated.
            for (const [i, decorations] of this.decorations.entries()) {
                const cluster = this.pairs[i];
                if (decorations.length > 0 && !decorations[decorations.length - 1]) {
                    const nearestCloseLine = cluster[cluster.length - 2];
                    const nearestCloseChar = cluster[cluster.length - 1];
                    decorations[decorations.length - 1] = decorate(
                        this.owner,
                        nearestCloseLine,
                        nearestCloseChar, 
                        this._decorationOptions
                    );
                }
            }
        }
    }, this._waitBeforeDecorating);

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
        this._detectedPairs       = configuration.detectedPairs;
        this._decorationOptions   = configuration.decorationOptions;
        this.cursors              = sortCursors(this.owner.selections);
        this.pairs                = Array(this.cursors.length).fill([]);
        this.decorations          = Array(this.cursors.length).fill([]);
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

            const newPairs       = [];
            const newDecorations = [];
            
            // Compare the latest sorted cursors with the previous sorted cursors.
            let i = 0;
            for (const newCursor of newCursors) {

                // Cursors which are only in the previous sorted cursors array are cursors which
                // have been removed, thus we drop their pairs.
                while (i < this.cursors.length && compareAnchors(this.cursors[i], newCursor) < 0) {
                    this.pairCount -= this.pairs[i].length / 4;
                    this.decorations[i++].forEach(decoration => decoration?.dispose());
                }

                if (i < this.cursors.length && compareAnchors(this.cursors[i], newCursor) === 0) {

                    // If a new cursor matches a previous cursor, that means the cursor survived the
                    // cursor change operation, and so we bring forward its cluster.
                    //
                    // Note that we consider two cursors to be equal as long as their anchors match.
                    newPairs.push(this.pairs[i]);
                    newDecorations.push(this.decorations[i++]);
                } else {

                    // If a new cursor does not match a previous cursor, that means the new cursor
                    // was newly created. In this case, we give it a fresh empty cluster.
                    newPairs.push([]);
                    newDecorations.push([]);
                }
            }
    
            // The cursors in `this.cursors[i..]` were removed in the cursor change operation since
            // none of the cursors in that slice have a matching cursor in the latest sorted cursors
            // array. Thus, we drop their pairs.
            while (i < this.cursors.length) {
                this.pairCount -= (this.pairs[i].length / 4);
                this.decorations[i++].forEach(decoration => decoration?.dispose());
            }

            this.pairs       = newPairs;
            this.decorations = newDecorations;

            // The array of possible dead key autoclosing pairs is parallel to `cursors`, and so 
            // should always have the same length as it.
            this.possibleDeadKeyPairs.length = newCursors.length;
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
        for (const [i, cursor] of this.cursors.entries()) {

            let pairsDropped = false;

            // Drop any pairs that do not enclose the cursor.
            //
            // Iterating in reverse is faster, since the pairs in each cluster are ordered from least 
            // nested to most nested, meaning that we can stop the iteraton once we encounter a pair 
            // that encloses the cursor, since we know that the remaining pairs also enclose the 
            // cursor.
            for (let j = this.pairs[i].length - 4; j >= 0; j -= 4) {
                if (anchorEnclosedBy(cursor, this.pairs[i], j)) {
                    break; 
                } else {
                    this.pairs[i].length -= 4;
                    this.decorations[i].pop()?.dispose();
                    this.pairCount -= 1;
                    pairsDropped = true;
                }
            }

            // If pairs were dropped but the cluster still contains pairs after, that means that there
            // is a new nearest pair and we should ensure that it is decorated.
            if (pairsDropped && this.pairs[i].length > 0) {
                this.decorator.set();
            }

            // If this cursor has moved out of a possible dead key autoclosing pair, then that dead
            // key autoclosing pair is no longer possible, since the two stage process involved in 
            // autoclosing a dead key autoclosing pair has been interrupted.
            const possible = this.possibleDeadKeyPairs[i];
            if (possible && compareAnchorWith(cursor, possible.closeLine, possible.closeChar) !== 0) {
                this.possibleDeadKeyPairs[i] = undefined;
            }
            
        }

        if (this.hasPairs !== prevHasPairs) {
            this.onDidUpdateHasPairsEmitter.fire(undefined);
        }

        // The `hasLineOfSight` property can only change if there were previously pairs, since 
        // cursor changes never introduce new pairs. If there were previously no pairs, then the
        // `hasLineOfSight` property would have been `false` then and continue to be `false` now.
        if (prevHasPairs) {
            this._hasLineOfSight.stale = true;
            this.onDidUpdateHasLineOfSightEmitter.fire(undefined);
        }
    }

    /** 
     * Notify this tracker of text content changes in the owning text editor's document.
     */
    public notifyContentChanges(contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>): void {

        // Decorations should only be applied after a period of inactivity.
        this.decorator.resetCountdown();

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
            // Note that we consider a cursor to be enclosed by a pair when the anchor position of 
            // the cursor is between the opening and closing sides of said pair.
            const cursor = this.cursors[i];

            // The decorations for this cluster.
            const decorations = this.decorations[i];

            // --------------------------------
            // STEP 1 - Shift (or delete) the opening side of pairs.
            // --------------------------------
            //
            // This step processes the opening sides of pairs in this cluster. Pairs which have been 
            // deleted will have their indices set to `-1`.
            for (let j = 0; j < cluster.length; j += 4) {

                // Pop the content change stack until a content change that ends after this pair's 
                // opening side is encountered.
                while (stack.top && compareEndWith(stack.top.range, cluster[j], cluster[j + 1]) <= 0) {
                    stack.pop();
                }

                if (!stack.top || compareStartWith(stack.top.range, cluster[j], cluster[j + 1]) > 0) {

                    // We get here when the stack is empty or if the content change currently at 
                    // the top of the stack begins after the opening side of this pair. In either 
                    // case, the opening side of this pair has survived.
                    //
                    // We apply the accumulated carry values to find the position of the opening 
                    // side of this pair after the content changes have been applied.
                    [cluster[j], cluster[j + 1]] = shift(stack, cluster[j], cluster[j + 1]);
                } else {

                    // We get here when the content change at the top of the stack has overwritten
                    // the opening side of this pair. Thus, we drop this pair.
                    cluster.fill(-1, j, j + 4);
                    decorations[j / 4]?.dispose();
                    decorations[j / 4] = undefined;
                    this.pairCount -= 1;
                }
            }

            // --------------------------------
            // STEP 2 - Check for autoclosing pair.
            // --------------------------------
            //
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
            // Within this step, we will be checking for the first two kinds of autoclosing pairs. 
            // We will not be checking for wrap around autoclosing pairs due to the complexity 
            // involved in tracking them. 

            // Pop the stack until the content change at the top of the stack is one that ends at or 
            // after the cursor.
            while (stack.top && compareEndWith(stack.top.range, cursor.anchorLine, cursor.anchorChar) < 0) {
                stack.pop();
            }

            // A possible dead key autoclosing pair detected for this cursor.
            let newPossibleDeadKeyPair: PossibleDeadKeyPair | undefined;

            // Check for opening side of a Type-1 dead key autoclosing pair.
            //
            // If the content change currently at the top of the stack ends at the cursor and replaces 
            // exactly one character of text before the cursor, then it could possibly be the first 
            // event involved in the two event autoclosing of a Type-1 dead key autoclosing pair. 
            //
            // Note that since content changes do not overlap (meaning each subsequent content change 
            // must begin at or after the end of the previous content change), if the stack is not 
            // empty, then the content change at the top of the stack is the only one that could 
            // possibly introduce the opener of a Type-1 dead key autoclosing pair. All content changes 
            // before this one ended before the cursor and all content changes after this one begins 
            // after the cursor, so none of them could possibly replace a character before the cursor.
            if (
                stack.top?.rangeLength === 1
                && compareEndWith(stack.top.range, cursor.anchorLine, cursor.anchorChar) === 0
                && stack.top.text.length === 1
                && cursor.anchorChar > 0
                && cursor.isEmpty
            ) {
                const match = this._detectedPairs.find(pair => pair[0] === stack.top?.text);
                if (match) {

                    // The cursor's anchor position after all prior content changes have been applied.
                    const [newAnchorLine, newAnchorChar] = shift(stack, cursor.anchorLine, cursor.anchorChar);

                    // A content change that replaces one character of text right before the 
                    // cursor with the opening character of a pair is possibly the first content 
                    // change involved in the autoclosing of a Type-1 dead key autoclosing pair.
                    newPossibleDeadKeyPair = new PossibleDeadKeyPair(match, newAnchorLine, newAnchorChar);
                }
            }

            // A new confirmed autoclosing pair.
            //
            // Note that the opening and closing positions of this new pair (if detected) is already 
            // finalized.
            let newPair: [number, number, number, number] | undefined;

            // If the content change at the top of the stack ends at the cursor then it could be 
            // either an insertion at the cursor or a replacement that ends at the cursor. If it is 
            // a replacement that ends at the cursor, then we skip it.
            //
            // Since content changes do not overlap, the next content change after this must begin
            // at or after the cursor, and could possibly be an insertion at the cursor.
            if (
                stack.top 
                && compareEndWith(stack.top.range, cursor.anchorLine, cursor.anchorChar) === 0
                && stack.top.rangeLength > 0
            ) {
                stack.pop();
            }

            // Check for regular autoclosing pair or closing side of either type of dead key autoclosing 
            // pair.
            //
            // If the content change currently at the top of the stack that begins and ends at the 
            // cursor (i.e. a text insertion at the cursor), then it is the first content change that
            // begins at the cursor and could be the insertion of:
            //
            //   - A regular autoclosing pair.
            //   - The closing side of either type of dead key autoclosing pair.
            //   - The opening side of a Type-2 dead key autoclosing pair.
            //
            // and so check for each possibility here.
            //
            // We do not perform this check for any other content changes remaining on the stack since 
            // the content change currently at the top of the stack (if it exists) is the only one 
            // that could possibly have been an insertion at the cursor. Consider each possibility: 
            //
            //   - If the content change at the top of the stack does not begin at the cursor, then
            //     it must begin after the cursor so it and all other remaining content changes are
            //     not insertions at the cursor.
            //   - If the content change at the top of the stack begins at the cursor but ends after
            //     cursor, then since content changes do not overlap, all content changes after this
            //     one must begin after the cursor and so cannot be insertions at the cursor.
            //   - If the content change at the top of the stack begins and ends at the cursor (i.e. 
            //     an insertion), then it is possible for there to also be other insertions at the
            //     cursor. However, when there are multiple insertions within one content change event 
            //     at the same position, vscode actually applies them in order (an order which our 
            //     stack follows), meaning that only the first insertion is actually an insertion at 
            //     the cursor. After the first insertion, the cursor would have been shifted, causing 
            //     subsequent insertions to not end up inserting text at the cursor.
            //
            if (
                stack.top
                && compareEndWith(stack.top.range, cursor.anchorLine, cursor.anchorChar) === 0
                && stack.top.range.isEmpty
                && cursor.isEmpty
            ) {

                // The cursor's anchor position after all prior content changes have been applied.
                const [newAnchorLine, newAnchorChar] = shift(stack, cursor.anchorLine, cursor.anchorChar);

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
                    newPair = [newAnchorLine, newAnchorChar, newAnchorLine, newAnchorChar + 1];

                } else if (stack.top.text.length === 1) {
                    
                    // When the autoclosing pair is a pair that has the same character on both sides
                    // (such as `''` or `""`), it can be ambiguous as to whether an inserted character 
                    // is the opening side for new Type-2 dead key autoclosing pair or the closing 
                    // side for either type of dead key autoclosing pair. Here we eagerly detect both 
                    // kinds, and allow a subsequent `Tracker.notifySelectionChanges` call to sort 
                    // out the ambiguity.

                    // Check for closing side of a dead key autoclosing pair.
                    if (stack.top.text === this.possibleDeadKeyPairs[i]?.pair[1]) {
                        newPair = [newAnchorLine, newAnchorChar - 1, newAnchorLine, newAnchorChar];
                    }

                    // Check for opening side of a possible Type-2 autoclosing pair.
                    const match = this._detectedPairs.find(pair => pair[0] === stack.top?.text);
                    if (match) {
                        newPossibleDeadKeyPair = new PossibleDeadKeyPair(match, newAnchorLine, newAnchorChar + 1);
                    }
                }
            }

            // Save a new possible dead key autoclosing pair for the next content change event.
            this.possibleDeadKeyPairs[i] = newPossibleDeadKeyPair;

            // --------------------------------
            // STEP 3 - Shift (or delete) the closing side of pairs (excluding the new pair). 
            // --------------------------------
            //
            // This step processes the closing sides of pairs in this cluster (not including the new
            // pair). Pairs which have been deleted will have their indices set to `-1`.

            // We iterate through the pairs in reverse so that we can go through the closing side 
            // of pairs from innermost to outermost. Doing so means we do not have to backtrack when 
            // going through the content changes.
            for (let j = cluster.length - 4; j >= 0; j -= 4) {

                if (cluster[j] === -1) {
                    continue;
                }

                // Pop the content change stack until a content change that ends after this pair's 
                // closing side is encountered.
                while (stack.top && compareEndWith(stack.top.range, cluster[j + 2], cluster[j + 3]) <= 0) {
                    stack.pop();
                }

                if (!stack.top || compareStartWith(stack.top.range, cluster[j + 2], cluster[j + 3]) > 0) {

                    // We get here when the stack is empty or if the content change currently at 
                    // the top of the stack begins after the closing side of this pair. In either 
                    // case, the closing side of this pair has survived.
                    //
                    // We apply the accumulated carry values to find the position of the closing 
                    // side of this pair after the content changes have been applied.
                    [cluster[j + 2], cluster[j + 3]] = shift(stack, cluster[j + 2], cluster[j + 3]);

                    // We only keep pairs that end up with sides on the same line, since we want 
                    // multi-line text insertion between pairs to invalidate them.
                    if (cluster[j] === cluster[j + 2]) {
                        continue;
                    }
                } 

                // We get here when there is either a content change at the top of the stack that
                // has overwritten the closing side of this pair, or when the sides of this pair 
                // have ended up on different lines. In either case, we drop this pair.
                cluster.fill(-1, j, j + 4);
                decorations[j / 4]?.dispose();
                decorations[j / 4] = undefined;
                this.pairCount -= 1;
            }

            // --------------------------------
            // STEP 4 - Complete the new cluster.
            // --------------------------------

            // Whether the previous nearest pair was dropped.
            const prevNearestDropped = cluster.length > 0 ? cluster[cluster.length - 4] === -1 : false;

            // Filter out all the deleted pairs.
            //
            // OPTIMIZATION NOTE: I tried filtering the cluster and decorations array in place but 
            // did not see performance improvements, so I have left it as is, where a new array is 
            // allocated to store the result of the filtering.
            const newCluster     = cluster.filter(index => index >= 0);
            const newDecorations = decorations.filter((_, i) => cluster[i * 4] >= 0);

            // If the previous nearest pair was dropped but there are still pairs remaining, then 
            // we have to ensure that the new nearest pair is decorated.
            if (newCluster.length > 0 && prevNearestDropped) {
                this.decorator.set();    
            }

            // Add the new pair to the finalized cluster.
            if (newPair) {

                // If `decorateAll` is disabled, then only the newly added pair should be decorated,
                // so we undecorate the previous nearest pair (if it survived).
                if (!this._decorateAll && newDecorations.length > 0) {
                    newDecorations[newDecorations.length - 1]?.dispose();
                    newDecorations[newDecorations.length - 1] = undefined;
                }

                // The new pair is appended to the end of the finalized cluster because it (being 
                // nearest to the cursor) is enclosed by all the other pairs in the cluster. 
                newCluster.push(...newPair);
                newDecorations.push(undefined);
                this.pairCount += 1;

                // The newly added pair is the new nearest pair, thus it needs to be decorated.
                this.decorator.set();
            }

            this.pairs[i]       = newCluster;
            this.decorations[i] = newDecorations;
        };

        if (this.hasPairs !== prevHasPairs) {
            this.onDidUpdateHasPairsEmitter.fire(undefined);
        }

        // If there are now pairs, or if there are now no pairs but previously there were, then the
        // `hasLineOfSight` property could have changed.
        if (this.hasPairs || prevHasPairs) {
            this._hasLineOfSight.stale = true;
            this.onDidUpdateHasLineOfSightEmitter.fire(undefined);
        }
    }
    
    /** 
     * Move all cursors out of their respective nearest pairs.
     * 
     * Cursors which do not have a nearest pair to leap out of are left alone.
     * 
     * This method call only succeeds if the `hasLineOfSight` property is `true` at the moment this
     * method is called. Nothing is done otherwise.
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
        for (let i = 0; i < this.cursors.length; ++i) {
            if (this.pairs[i].length > 0) {

                // For each cursor that has pairs being tracked for it, move the cursor out of the
                // closing side of the nearest pair. This is the 'leap'.
                const nearestPairCloseLine = this.pairs[i][this.pairs[i].length - 2];
                const nearestPairCloseChar = this.pairs[i][this.pairs[i].length - 1];
                result[this.cursors[i].originalIndex] = new Selection(
                    nearestPairCloseLine,
                    nearestPairCloseChar + 1,
                    nearestPairCloseLine,
                    nearestPairCloseChar + 1,
                );
            } else {

                // Cursors which do not have pairs to leap out of are left alone.
                result[this.cursors[i].originalIndex] = new Selection(
                    this.cursors[i].anchorLine, 
                    this.cursors[i].anchorChar,
                    this.cursors[i].activeLine, 
                    this.cursors[i].activeChar
                );
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
        this.pairs.forEach((_, i, self) => self[i] = []);
        for (let i = 0; i < this.decorations.length; ++i) {
            this.decorations[i].forEach(decoration => decoration?.dispose());
            this.decorations[i] = [];
        }
        this.possibleDeadKeyPairs?.forEach((_, i, self) => self[i] = undefined);
        this.pairCount = 0;
        this._hasLineOfSight.stale = true;
        this.onDidUpdateHasPairsEmitter.fire(undefined);
        this.onDidUpdateHasLineOfSightEmitter.fire(undefined);
        this.decorator.clear();
    }

    /**
     * Terminate this tracker.
     */
    public dispose(): void {
        this.clear();
        this.onDidUpdateHasPairsEmitter.dispose();
        this.onDidUpdateHasLineOfSightEmitter.dispose();
        this.decorator.dispose();
    }

    /** 
     * **For tests only**
     * 
     * Get a snapshot of the internal state of this tracker.
     */
    public snapshot(): Snapshot {

        // Clone each cluster and rearrange them back into the original order such that they are 
        // parallel to the `selections` array of the owning text editor.
        const reordered: CompactPair[][] = this.pairs.map(() => []);
        for (const [i, cluster] of this.pairs.entries()) {
            const originalIndex = this.cursors[i].originalIndex;
            const decorations   = this.decorations[i];
            for (let j = 0; j < cluster.length; j += 4) {
                reordered[originalIndex].push({
                    open:  [cluster[j],     cluster[j + 1]], 
                    close: [cluster[j + 2], cluster[j + 3]],
                    isDecorated: !!decorations[j / 4]
                });
            }
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
function sortCursors(unsorted: ReadonlyArray<Selection>): TaggedCursor[] {
    return unsorted.map((selection, originalIndex) => {
        return {
            anchorLine: selection.anchor.line,
            anchorChar: selection.anchor.character,
            activeLine: selection.active.line,
            activeChar: selection.active.character,
            isEmpty:    selection.isEmpty,
            originalIndex
        };
    }).sort(compareAnchors);
}

/**
 * Shift a position with the carry values of a stack.
 */
function shift(stack: ContentChangeStack, line: number, char: number): [number, number] {
    return [
        line + stack.vertCarry, 
        char + (line === stack.horzCarry.affectsLine ? stack.horzCarry.value : 0)
    ];
}

/**
 * Decorate a position in an editor.
 */
function decorate(
    editor:            TextEditor,
    line:              number,
    char:              number,
    decorationOptions: Unchecked<DecorationRenderOptions>
): TextEditorDecorationType {
    const decoration = window.createTextEditorDecorationType(decorationOptions.cast());
    editor.setDecorations(decoration, [ new Range(line, char, line, char + 1) ]);
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
 * Compare two positions and returns `0` if they are equal, `-1` if `a` is before `b` and `1` if `a`
 * is after `b`.
 */
function comparePositions(aLine: number, aChar: number, bLine: number, bChar: number): number {
    return aLine === bLine ? aChar - bChar : aLine - bLine;
}

/**
 * Compare the anchor position of a cursor with another position.
 */
function compareAnchorWith(a: TaggedCursor, line: number, char: number): number {
    return comparePositions(a.anchorLine, a.anchorChar, line, char);
}

/**
 * Compare the anchor positions of two cursors.
 */
function compareAnchors(a: TaggedCursor, b: TaggedCursor): number {
    return comparePositions(a.anchorLine, a.anchorChar, b.anchorLine, b.anchorChar);
}

/**
 * Compare the `end` position of a vscode `Range` with a position.
 */
function compareEndWith(range: Range, line: number, char: number): number {
    return comparePositions(range.end.line, range.end.character, line, char);
}

/**
 * Whether the `start` position of a vscode `Range` with a position.
 */
function compareStartWith(range: Range, line: number, char: number): number {
    return comparePositions(range.start.line, range.start.character, line, char);
}

/**
 * Whether a cursor's anchor is enclosed by a pair located at `cluster[index...index + 4]`.
 */
function anchorEnclosedBy(cursor: TaggedCursor, cluster: ReadonlyArray<number>, index: number): boolean {
    const openLine  = cluster[index];
    const openChar  = cluster[index + 1];
    const closeLine = cluster[index + 2];
    const closeChar = cluster[index + 3];
    return comparePositions(cursor.anchorLine, cursor.anchorChar, openLine, openChar) > 0
        && comparePositions(cursor.anchorLine, cursor.anchorChar, closeLine, closeChar) <= 0;
}

/**
 * A cursor tagged with its original index.
 * 
 * # Anchor Position
 * 
 * When considering whether a cursor is enclosed by a pair, we always use its anchor position as we
 * we not want to untrack pairs when the user is just making a selection from inside a pair to outside
 * of it.
 * 
 * # Optimization
 * 
 * Instead of storing a vscode `Selection` or use vscode `Position`s to represent the cursor, we 
 * store its indices directly in this object for performance reasons.
 */
interface TaggedCursor {

    /**
     * Line index of the anchor position of this cursor.
     */
    readonly anchorLine: number;

    /**
     * Character index of the anchor position of this cursor.
     */
    readonly anchorChar: number;

    /**
     * Line index of the active position of this cursor.
     */
    readonly activeLine: number;

    /**
     * Character index of the active position of this cursor.
     */
    readonly activeChar: number;

    /**
     * Whether this cursor's selection is empty.
     */
    readonly isEmpty: boolean;

    /** 
     * The index of this cursor before it was sorted. 
     * 
     * In other words, this is the index of this cursor in the `selections` array of the owning
     * text editor.
     */
    readonly originalIndex: number;

}

/**
 * A possible dead key autoclosing pair.
 */
class PossibleDeadKeyPair {

    /**
     * The string representation of the pair.
     */
    readonly pair: string;

    /**
     * The expected line index of the closing side of this pair.
     */
    readonly closeLine: number;

    /** 
     * The expected character index of the closing side of this pair.
    */
    readonly closeChar: number;

    public constructor(pair: string, closeLine: number, closeChar: number) {
        this.pair      = pair;
        this.closeLine = closeLine;
        this.closeChar = closeChar;
    }

}

/**
 * A snapshot of the internal state of a tracker.
 */
type Snapshot = {

    pairs: CompactPair[][],

    decorationOptions: Readonly<Unchecked<DecorationRenderOptions>>

}
