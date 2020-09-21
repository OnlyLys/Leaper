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

export type Action = InsertPairAction 
                    | TypeTextAction
                    | MoveCursorsAction 
                    | SetCursorsAction
                    | LeapAction 
                    | EscapeLeaperMode
                    | BackspaceAction
                    | BackspaceWordAction
                    | DeleteRightAction
                    | TextEditAction 
                    | InsertSnippetAction
                    | JumpToNextTabstopAction
                    | JumpToPrevTabstopAction
                    | TriggerAndAcceptSuggestionAction
                    | UndoAction
                    | AssertPairsAction
                    | AssertCursorsAction
                    | CompositeAction;

interface InsertPairAction extends Repetitions, Delay {

    /** Insert a randomly picked autoclosing pair into the document. */
    kind: 'insertPair';
}

interface TypeTextAction extends Repetitions, Delay {

    /** Type text into the document. Text is typed in codepoint by codepoint. */
    kind: 'typeText';
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

interface TextEditAction extends Repetitions, Delay {

    /** Edit a region of text in the document. */
    kind: 'textEdit';
    replace: CompactRange;
    insert:  string;
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
    pairs: CompactPair[][];
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