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
export type CompactRange    = { start: CompactPosition, end:   CompactPosition };
export type CompactPair     = { open:  CompactPosition, close: CompactPosition };

export type Action = InsertPairAction 
                    | TypeTextAction
                    | MoveCursorsAction 
                    | SetCursorsAction
                    | LeapAction 
                    | EscapeLeaperMode
                    | BackspaceAction 
                    | DeleteAction
                    | TextEditAction 
                    | InsertSnippetAction
                    | JumpToNextTabstopAction
                    | JumpToPrevTabstopAction
                    | AssertPairsAction
                    | AssertCursorsAction
                    | CompositeAction;

interface InsertPairAction extends Repeat, Delay {

    /** Insert a randomly picked autoclosing pair into the document. */
    kind: 'insertPair';
}

interface TypeTextAction extends Repeat, Delay {

    /** Type text into the document. Text is typed in codepoint by codepoint. */
    kind: 'typeText';
    text: string;
}

interface MoveCursorsAction extends Repeat, Delay {

    /** Move all the cursors one unit in a specific `direction`. */
    kind: 'moveCursors';
    direction: 'right' | 'left' | 'up' | 'down';
} 

interface SetCursorsAction extends Repeat, Delay {

    /** Set the cursors to specific positions in the document. */
    kind: 'setCursors';
    cursors: CompactPosition[]  
}

interface LeapAction extends Repeat, Delay {

    /** Call the `leaper.leap` command. */
    kind: 'leap';
} 

interface EscapeLeaperMode extends Repeat, Delay {

    /** Call the `leaper.escapeLeaperMode` command. */
    kind: 'escapeLeaperMode';
}

interface BackspaceAction extends Repeat, Delay {

    /** Press the 'backspace' key. */
    kind: 'backspace';
} 

interface DeleteAction extends Repeat, Delay {

    /** Press the `delete` key. */
    kind: 'delete';
}

interface TextEditAction extends Repeat, Delay {

    /** Edit a region of text in the document. */
    kind: 'textEdit';
    replace: CompactRange;
    insert:  string;
}

interface InsertSnippetAction extends Repeat, Delay {

    /** Insert a snippet to where the cursors are at. */
    kind: 'insertSnippet';
    snippet: SnippetString;
}

interface JumpToNextTabstopAction extends Repeat, Delay {

    /** Jump to the next tabstop in the current snippet. */
    kind: 'jumpToNextTabstop';
} 

interface JumpToPrevTabstopAction extends Repeat, Delay {

    /** Jump to the previous tabstop in the current snippet. */
    kind: 'jumpToPrevTabstop';
}

interface AssertPairsAction extends Repeat {

    /** Verify the pairs that the engine is tracking. */
    kind: 'assertPairs',
    pairs: CompactPair[][];
}

interface AssertCursorsAction extends Repeat {

    /** Verify the current cursors in the editor. */
    kind: 'assertCursors',
    cursors: CompactPosition[];
}

interface CompositeAction extends Repeat {

    /** Create a new action that is a sequence of other actions. */
    kind: 'composite',
    actions: Action[]
}

interface Repeat {

    /** How many times to repeat this action. Defaults to `1`. */
    repeat?: number
}

interface Delay {

    /** Milliseconds of delay to apply after each action call. Defaults to `20`. */
    delay?: number
}