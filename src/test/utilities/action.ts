import { SnippetString } from 'vscode';
import { CompactCursors, CompactPairs, CompactRange } from './compact';

/**
 * An action that should be taken be a test case.
 */
export type Action = EditAction | AssertAction;

export type EditAction = TypePairAction 
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
                            | UndoAction;

export type AssertAction = AssertPairsAction | AssertCursorsAction;

/**
 * Actions which edit the state of the editor.
 */
interface EditActionBase {

    /** 
     * How many times to execute this action. 
     * 
     * Default is `1`. 
     */
    repetitions?: number,

    /** 
     * Milliseconds of delay to apply after each action execution. 
     * 
     * Default is `20`. 
     * 
     * The delay is applied after each repetition of this action.
     */
    delay?: number
}

interface TypePairAction extends EditActionBase {

    /** 
     * Type an autoclosing pair into the document. 
     * 
     * The kind of autoclosing pair inserted is randomly determined.
     */
    kind: 'typePair';
}

interface TypeTextAction extends EditActionBase {

    /** 
     * Type text into the document. 
     * 
     * The text is typed in codepoint by codepoint. 
     */
    kind: 'typeText';
    text: string;
}

interface ReplaceTextAction extends EditActionBase {

    /** 
     * Replace a region of text in the document. 
     */
    kind: 'replaceText';

    /** 
     * The range to replace with a string. 
     */
    replace: CompactRange;

    /** 
     * String to insert in place of the replaced range. 
     */
    insert: string;
}

interface InsertTextAction extends EditActionBase {

    /** 
     * Insert text at a position in the document. 
     */
    kind: 'insertText';

    /** 
     * Position to insert the text at. 
     */
    position: [number, number];

    /** 
     * String to insert at the position. 
     */
    text: string;
}

interface MoveCursorsAction extends EditActionBase {

    /** 
     * Move all the cursors one unit in a specific `direction`. 
     */
    kind: 'moveCursors';
    direction: 'right' | 'left' | 'up' | 'down';
} 

interface SetCursorsAction extends EditActionBase {

    /** 
     * Set the cursors to specific positions in the document. 
     */
    kind: 'setCursors';
    cursors: CompactCursors;
}

interface LeapAction extends EditActionBase {

    /** 
     * Call the `leaper.leap` command. 
     */
    kind: 'leap';
} 

interface EscapeLeaperMode extends EditActionBase {

    /** 
     * Call the `leaper.escapeLeaperMode` command. 
     */
    kind: 'escapeLeaperMode';
}

interface BackspaceAction extends EditActionBase {

    /** 
     * Press the `backspace` key. 
     */
    kind: 'backspace';
} 

interface BackspaceWordAction extends EditActionBase {
    
    /** 
     * Press 'ctrl + backspace'. 
     */
    kind: 'backspaceWord';
}

interface DeleteRightAction extends EditActionBase {

    /** 
     * Press the `delete` key. 
     */
    kind: 'deleteRight';
}

interface InsertSnippetAction extends EditActionBase {

    /** 
     * Insert a snippet to where the cursors are at. 
     */
    kind: 'insertSnippet';
    snippet: SnippetString;
}

interface JumpToNextTabstopAction extends EditActionBase {

    /** 
     * Jump to the next tabstop in the current snippet. 
     */
    kind: 'jumpToNextTabstop';
} 

interface JumpToPrevTabstopAction extends EditActionBase {

    /** 
     * Jump to the previous tabstop in the current snippet. 
     */
    kind: 'jumpToPrevTabstop';
}

interface TriggerAndAcceptSuggestionAction extends EditActionBase {

    /** 
     * Trigger autocomplete suggestions then accept the first suggestion. 
     */
    kind: 'triggerAndAcceptSuggestion',
}

interface UndoAction extends EditActionBase {

    /** 
     * Calls the `Undo` (`Ctrl+Z`) command. 
     */
    kind: 'undo'
}

interface AssertPairsAction {

    /** 
     * Verify the pairs that the engine is tracking. 
     */
    kind: 'assertPairs',
    pairs: CompactPairs;
}

interface AssertCursorsAction {

    /** 
     * Verify the current cursors in the editor. 
     */
    kind: 'assertCursors',
    cursors: CompactCursors;
}
