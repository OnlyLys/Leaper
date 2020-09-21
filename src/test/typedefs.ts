//! This module contains definitions of types used to help organize the test cases.

import { SnippetString } from 'vscode';

export interface TestGroup {

    name: string,

    /** Each test case is given a fresh empty document. */
    testCases: TestCase[] 
}

export interface TestCase {

    name: string,

    /** Actions to setup the document for the test. */
    prelude?: {
        description: string,
        actions:     Action[],
    },

    /** Actions to execute as part of the test case. */
    actions: Action[]

}

/**
 * For the sake of compactness, we use a tuple to represent positions in the tests. 
 * 
 * The first number of the tuple is the line-index while the second is the column-index.
 */
export type CompactPosition = [number, number];

/** Compact way to represent a range in the document. */
export type CompactRange = { start: CompactPosition, end: CompactPosition };

/**
 * Compact way to represent the pairs for a cursor.
 * 
 * Since all the pairs for a cursor must be on the same line, we can represent them in a 'flatter' 
 * form, allowing for a more compact representation.
 * 
 * For example, say we have:
 *  
 *  1. Pair at line 1, opening side at column 10 and closing side column 20.
 *  2. Pair at line 1, opening side at column 14 and closing side column 17.
 *  3. Pair at line 1, opening side at column 15 and closing side column 16.
 * 
 * Then we can represent the above in a more compact way:
 * 
 *     { line: 1, sides: [ 10, 14, 15, 16, 17, 20 ] }
 */
export type CompactPairs = { line: number, sides: number[] };

export type Action = InsertPairAction 
                    | TypeTextAction
                    | ReplaceTextAction
                    | InsertTextAction
                    | MoveCursorsAction 
                    | SetCursorsAction
                    | LeapAction 
                    | EscapeLeaperMode
                    | BackspaceAction
                    | BackspaceWordAction
                    | DeleteRightAction
                    | InsertSnippetAction
                    | JumpToNextTabstopAction
                    | JumpToPrevTabstopAction
                    | TriggerAndAcceptSuggestionAction
                    | UndoAction
                    | AssertPairsAction
                    | AssertCursorsAction
                    | CompositeAction;

interface InsertPairAction extends Repetitions, Delay {

    /** 
     * Insert an autoclosing pair into the document. 
     * 
     * The kind of autoclosing pair inserted is randomly determined.
     */
    kind: 'insertPair';
}

interface TypeTextAction extends Repetitions, Delay {

    /** Type text into the document. Text is typed in codepoint by codepoint. */
    kind: 'typeText';
    text: string;
}

interface ReplaceTextAction extends Repetitions, Delay {

    /** Replace a region of text in the document. */
    kind: 'replaceText';

    /** The range to replace with a string. */
    replace: CompactRange;

    /** String to insert in place of the replaced range. */
    insert: string;
}

interface InsertTextAction extends Repetitions, Delay {

    /** Insert text at a position in the document. */
    kind: 'insertText';

    /** Position to insert the text at. */
    position: [number, number];

    /** String to insert at the position. */
    text: string;
}

interface MoveCursorsAction extends Repetitions, Delay {

    /** Move all the cursors one unit in a specific `direction`. */
    kind: 'moveCursors';
    direction: 'right' | 'left' | 'up' | 'down';
} 

interface SetCursorsAction extends Repetitions, Delay {

    /** Set the cursors to specific positions in the document. */
    kind: 'setCursors';
    cursors: CompactPosition[]  
}

interface LeapAction extends Repetitions, Delay {

    /** Call the `leaper.leap` command. */
    kind: 'leap';
} 

interface EscapeLeaperMode extends Repetitions, Delay {

    /** Call the `leaper.escapeLeaperMode` command. */
    kind: 'escapeLeaperMode';
}

interface BackspaceAction extends Repetitions, Delay {

    /** Press the `backspace` key. */
    kind: 'backspace';
} 

interface BackspaceWordAction extends Repetitions, Delay {
    
    /** Press 'ctrl + backspace'. */
    kind: 'backspaceWord';
}

interface DeleteRightAction extends Repetitions, Delay {

    /** Press the `delete` key. */
    kind: 'deleteRight';
}

interface InsertSnippetAction extends Repetitions, Delay {

    /** Insert a snippet to where the cursors are at. */
    kind: 'insertSnippet';
    snippet: SnippetString;
}

interface JumpToNextTabstopAction extends Repetitions, Delay {

    /** Jump to the next tabstop in the current snippet. */
    kind: 'jumpToNextTabstop';
} 

interface JumpToPrevTabstopAction extends Repetitions, Delay {

    /** Jump to the previous tabstop in the current snippet. */
    kind: 'jumpToPrevTabstop';
}

interface TriggerAndAcceptSuggestionAction extends Repetitions, Delay {

    /** Trigger autocomplete suggestions then accept the first suggestion. */
    kind: 'triggerAndAcceptSuggestion',
}

interface UndoAction extends Repetitions, Delay {

    /** Calls the `Undo` (`Ctrl+Z`) command. */
    kind: 'undo'
}

interface AssertPairsAction extends Repetitions {

    /** Verify the pairs that the engine is tracking. */
    kind: 'assertPairs',

    /** The pairs for a cursor can be `undefined` if there are no pairs being tracked for it. */
    pairs: (CompactPairs | undefined)[];
}

interface AssertCursorsAction extends Repetitions {

    /** Verify the current cursors in the editor. */
    kind: 'assertCursors',
    cursors: CompactPosition[];
}

interface CompositeAction extends Repetitions {

    /** Create a new action that is a sequence of other actions. */
    kind: 'composite',
    actions: Action[]
}

interface Repetitions {

    /** How many times to execute this action. Default is `1`. */
    repetitions?: number
}

interface Delay {

    /** Milliseconds of delay to apply after each action call. Default is `20`. */
    delay?: number
}