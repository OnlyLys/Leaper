import { SnippetString, ViewColumn } from 'vscode';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * In this prelude that is shared across all the test cases in this module, we insert pairs in a way 
 * that simulates a typical usage scenario.
 *
 * The following initial document is created:
 *
 * ```
 * function () {
 *     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
 * }                                                   ^(cursor position)
 * ```
 */
const sharedPrelude = async (executor: Executor) => {
    await executor.editText([
        {
            kind: 'insert',
            at:   [0, 0],
            text: 'function () {\n    ; // Log object to console.\n}'
        }
    ]);
    await executor.setCursors([ [1, 4] ]);
    await executor.typeText('console.log({  ');
    await executor.moveCursors('left');
    await executor.typeText('obj: {  ');
    await executor.moveCursors('left');
    await executor.typeText('arr: [  ');
    await executor.moveCursors('left');
    await executor.typeText('{  ');
    await executor.moveCursors('left');
    await executor.typeText('prop: someFn(1, 20');
    executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ]); 
    executor.assertCursors([ [1, 52] ]);
};

// ----------------------------------------------------------------------------------
// THE TEST CASES BELOW TEST INVALIDATION DUE TO CURSOR MOVING OUT.

const RIGHTWARDS_EXIT_OF_CURSOR_INCREMENTAL_TEST_CASE = new TestCase({
    name: 'Rightwards Exit of Cursor (Incremental)',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                    ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 53] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                     ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 54] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                      ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 55] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                       ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 56] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                        ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 57] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                         ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 58] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                          ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
        executor.assertCursors([ [1, 59] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                           ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
        executor.assertCursors([ [1, 60] ]);
        
        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                            ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ { line: 1, sides: [15, 61] } ]);
        executor.assertCursors([ [1, 61] ]);

        // Move out of the last pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                             ^(cursor position)
        // ```
        await executor.moveCursors('right');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 62] ]);
    }
});
    
const RIGHTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_CLICKING_OUT_TEST_CASE = new TestCase({
    name: 'Rightwards Exit of Cursor (in One Go by Clicking Out)',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                             ^(cursor position)
        // ```
        await executor.setCursors([ [1, 62] ]);
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 62] ]);
    }
});

const RIGHTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_PRESSING_END_KEY_TEST_CASE = new TestCase({
    name: 'Rightwards Exit of Cursor (in One Go by Pressing `End` Key)',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                                                        ^(cursor position)
        // ```
        await executor.moveCursors('end');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 89] ]);
    }
});

const LEFTWARDS_EXIT_OF_CURSOR_INCREMENTAL_TEST_CASE = new TestCase({
    name: 'Leftwards Exit of Cursor (Incremental)',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Move to the boundary of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                              ^(cursor position)
        // ```
        await executor.moveCursors('left', { repetitions: 5 });
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ]); 
        executor.assertCursors([ [1, 47] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                             ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 46] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                ^(cursor position)
        // ```
        await executor.moveCursors('left', { repetitions: 13 });
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 33] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                               ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 32] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                              ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 31] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                             ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 30] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                       ^(cursor position)
        // ```
        await executor.moveCursors('left', { repetitions: 6 });
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
        executor.assertCursors([ [1, 24] ]);
            
        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                      ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
        executor.assertCursors([ [1, 23] ]);

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                ^(cursor position)
        // ```
        await executor.moveCursors('left', { repetitions: 6 });
        executor.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
        executor.assertCursors([ [1, 17] ]);

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }               ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 1, sides: [15, 61] } ]);
        executor.assertCursors([ [1, 16] ]);

        // Move out of the last pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }              ^(cursor position)
        // ```
        await executor.moveCursors('left');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 15] ]);
    }
});

const LEFTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_CLICKING_OUT_TEST_CASE = new TestCase({
    name: 'Leftwards Exit of Cursor (in One Go by Clicking Out)',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }              ^(cursor position)
        // ```
        await executor.setCursors([ [1, 15] ]);
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 15] ]);
    }
});

const LEFTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_PRESSING_HOME_KEY_TEST_CASE = new TestCase({
    name: 'Leftwards Exit of Cursor (in One Go by Pressing `Home` Key)',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }   ^(cursor position)
        // ```
        await executor.moveCursors('home');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 4] ]);
    }
});

const UPWARDS_EXIT_OF_CURSOR_TEST_CASE = new TestCase({
    name: 'Upwards Exit of Cursor',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Document state after:
        // 
        // ```          
        // function () {
        //              ^(cursor position)
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }
        // ```
        await executor.moveCursors('up');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [0, 13] ]);
    }
});

const DOWNWARDS_EXIT_OF_CURSOR_TEST_CASE = new TestCase({
    name: 'Downwards Exit of Cursor',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Document state after:
        // 
        // ```          
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }
        //  ^(cursor position)
        // ```
        await executor.moveCursors('down');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 1] ]);
    }
});

// ----------------------------------------------------------------------------------
// THE TEST CASES BELOW TEST INVALIDATION DUE TO EITHER SIDE OF PAIRS BEING DELETED.

const DELETION_OF_OPENING_SIDE_TEST_CASE = new TestCase({
    name: 'Deletion of Opening Side',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Move to the opening side of the first pair and then backspace it.
        //
        // Document state after: 
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn1, 20) } ] } }); // Log object to console.
        // }                                             ^(cursor position)
        // ```
        await executor.moveCursors('left', { repetitions: 5 });
        await executor.backspace();
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ]);
        executor.assertCursors([ [1, 46] ]);

        // Overwrite text including the third and fourth of the remaining pairs.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
        // }                                              ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'replace', range: { start: [1, 23], end: [1, 32] }, with: 'cheesecake' }
        ]);
        executor.assertPairs([ { line: 1, sides: [15, 16, 33, 54, 60, 61] } ]);
        executor.assertCursors([ [1, 47] ]);

        // Overwrite some text including the first of the remaining pairs. 
        //
        // Document state after:
        //
        // ```
        // function () {
        //     { obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
        // }                                  ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'delete', range: { start: [1, 4], end: [1, 16] } }
        ]);
        executor.assertPairs([ { line: 1, sides: [4, 21, 42, 48] } ]);
        executor.assertCursors([ [1, 35] ]);

        // Backspace until the second of the remaining pairs is deleted.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     { obj: cheesecake1, 20) } ] } }); // Log object to console.
        // }                    ^(cursor position)
        // ```
        await executor.backspace({ repetitions: 14 });
        executor.assertPairs([ { line: 1, sides: [4, 34] } ]);
        executor.assertCursors([ [1, 21] ]);

        // Overwrite first pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     rabbit obj: cheesecake1, 20) } ] } }); // Log object to console.
        // }                         ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'replace', range: { start: [1, 4], end: [1, 5] }, with: 'rabbit' }
        ]);
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 26] ]);
    }
});

const DELETION_OF_CLOSING_SIDE_TEST_CASE = new TestCase({
    name: 'Deletion of Closing Side',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Delete right the closing character of the first pair. 
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } ] } }); // Log object to console.
        // }                                                   ^(cursor position)
        // ```
        await executor.deleteRight();
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ]);
        executor.assertCursors([ [1, 52] ]);

        // Overwrite text including the third and fourth of the remaining pairs.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}); // Log object to console.
        // }                                                   ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'replace', range: { start: [1, 55], end: [1, 59] }, with: 'cheesecake' }
        ]);
        executor.assertPairs([ { line: 1, sides: [15, 16, 32, 53, 65, 66] } ]);
        executor.assertCursors([ [1, 52] ]);

        // Overwrite some text including the first of the remaining pairs.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}
        // }                                                   ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'delete', range: { start: [1, 66], end: [1, 94] } }
        ]);
        executor.assertPairs([ { line: 1, sides: [16, 32, 53, 65] } ]);
        executor.assertCursors([ [1, 52] ]);
        
        // Delete right until the second of the remaining pairs is deleted.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20 cheesecake}
        // }                                                   ^(cursor position)
        // ```
        await executor.deleteRight({ repetitions: 2 });
        executor.assertPairs([ { line: 1, sides: [16, 63] } ]);
        executor.assertCursors([ [1, 52] ]);
        
        // Overwrite text including the final pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //    console.log({rabbit
        // }              ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'replace', range: { start: [1, 17], end: [1, 64] }, with: 'rabbit' }
        ]);
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 23] ]);
    }
});

// ----------------------------------------------------------------------------------
// THE TEST CASES BELOW TEST INVALIDATION DUE TO SIDES OF PAIRS ENDING UP ON DIFFERENT LINES.

const MULTI_LINE_TEXT_INSERTED_BETWEEN_PAIRS_TEST_CASE = new TestCase({
    name: 'Multi-line Text Inserted Between Pairs',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Indent the text after the first pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //    console.log(
        //        { obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                          ^(cursor position)
        // ```
        await executor.editText([
            { kind: 'insert', at: [1, 16], text: '\n        ' }
        ]);
        executor.assertPairs([ { line: 2, sides: [8, 15, 22, 24, 38, 44, 46, 48, 50, 52] } ]);
        executor.assertCursors([ [2, 44] ]);

        // Replace the text between the second and third remaining pairs with multiline text.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log(
        //         { obj: { 
        //             Mary
        //             had
        //             a
        //             little
        //             lamb [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                      ^(cursor position)
        // ```
        await executor.editText([
            {
                kind:  'replace',
                range: { start: [2, 17], end: [2, 21] }, 
                with:  '\n'
                    + '            Mary\n'
                    + '            had\n'
                    + '            a\n'
                    + '            little\n'
                    + '            lamb'
            }
        ]);
        executor.assertPairs([ { line: 7, sides: [17, 19, 33, 39, 41, 43] } ]);
        executor.assertCursors([ [7, 39] ]);

        // Type in a newline at the cursor position.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log(
        //         { obj: { 
        //             Mary
        //             had
        //             a
        //             little
        //             lamb [ { prop: someFn(1, 20
        //                 ) } ] } }); // Log object to console.
        // }                ^(cursor position)
        // ```
        //
        // (Note that auto-indentation of Typescript applies).
        await executor.typeText('\n');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [8, 16] ]);
    }
});

const MULTI_LINE_SNIPPET_INSERTED_BETWEEN_PAIRS_TEST_CASE = new TestCase({
    name: 'Multi-line Snippet Inserted Between Pairs',
    prelude: sharedPrelude,
    task: async (executor) => {

        // Delete the `20` from the second argument of `someFn`.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, ) } ] } }); // Log object to console.
        // }                                                 ^(cursor position)
        // ```
        await executor.backspace({ repetitions: 2 });
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 50, 52, 54, 56, 58, 59] } ]);
        executor.assertCursors([ [1, 50] ]);

        // Type in an array of numbers.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3]) } ] } }); // Log object to console.
        // }                                                             ^(cursor position)
        // ```
        await executor.typeText('[-1, -2, -3]');
        executor.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 62, 64, 66, 68, 70, 71] } ]);
        executor.assertCursors([ [1, 62] ]);

        // Insert a multi-line snippet.
        // 
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, curr) => {
        //                                                                        |--^(cursor selection)  
        //     }, init)) } ] } }); // Log object to console.
        // }                                                            
        // ```
        await executor.insertSnippet(
            new SnippetString(
                 '.reduce((${1:acc}, ${2:curr}) => {\n'
               + '    $3\n'
               + '}, ${4:init})$0'
            ) 
        );
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ { anchor: [1, 71], active: [1, 74] } ]);

        // Make sure that the snippet still works by jumping to the second tabstop.
        // 
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, curr) => {
        //                                                                             |---^(cursor selection)
        //     }, init)) } ] } }); // Log object to console.
        // }                                                            
        // ```
        await executor.jumpToTabstop('next');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ { anchor: [1, 76], active: [1, 80] } ]);

        // Make sure that the snippet still works by jumping to the third tabstop.
        // 
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, curr) => {
        //                                                                              
        //         ^(cursor position)
        //     }, init)) } ] } }); // Log object to console.
        // }                                                            
        // ```
        await executor.jumpToTabstop('next');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 8] ]);

        // Make sure that the snippet still works by jumping to the fourth tabstop.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, curr) => {
        //         
        //     }, init)) } ] } }); // Log object to console.
        // }      |---^(cursor selection)
        // ```
        await executor.jumpToTabstop('next');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ { anchor: [3, 7], active: [3, 11] } ]);

        // Make sure that the snippet still works by jumping to the final tabstop.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, curr) => {
        //         
        //     }, init)) } ] } }); // Log object to console.
        // }           ^(cursor position)
        // ```
        await executor.jumpToTabstop('next');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [3, 12] ]);
    }
});

/**
 * Test whether pair invalidation works for an out-of-focus text editor.
 * 
 * We will perform tests similar to what we have done so far but for an out-of-focus text editor. 
 * But since changes occurring in out-of-focus text editors are quite rare, this test case will not 
 * be as comprehensive as the ones we have done so far for in-focus text editors.
 */
const PAIR_INVALIDATION_IN_OUT_OF_FOCUS_TEXT_EDITOR_TEST_CASE = new TestCase({
    name: 'Pair Invalidation in Out-of-Focus Text Editor',
    prelude: async (executor) => {

        // Open another fresh text editor in view column 2. 
        // 
        // During the tests, we will be switching focus to this text editor in order to defocus the 
        // text editor in view column 1. Then we will make changes in the text editor in view column 
        // 1 and check that pairs are appropriately invalidated.
        await executor.openNewTextEditor(undefined, { viewColumn: ViewColumn.Two });
    },
    task: async (executor) => {

        // Setup the text editor in view column 1, then switch focus to view column 2.
        //
        // By the end of this function call, the text editor in view column 1 will have the following
        // state:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                   ^(cursor position)
        // ```
        async function reset(executor: Executor): Promise<void> {
            await executor.focusEditorGroup('first');
            await executor.deleteAll();
            await sharedPrelude(executor);
            await executor.focusEditorGroup('second');
        }

        // Test setting cursor out rightwards.
        //
        // Expected state of the text editor in view column 1 as a result:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                            ^(cursor position)
        // ```
        await reset(executor);
        await executor.setCursors([ [1, 61] ],                 { viewColumn: ViewColumn.One });
        executor.assertPairs([ { line: 1, sides: [15, 61] } ], { viewColumn: ViewColumn.One });
        executor.assertCursors([ [1, 61] ],                    { viewColumn: ViewColumn.One });

        // Test setting cursor out leftwards.
        //
        // Expected state of the text editor in view column 1 as a result:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }           |-----^(cursor selection)
        // ```
        await reset(executor);
        await executor.setCursors(
            [ { anchor: [1, 12], active: [1, 18] } ], 
            { viewColumn: ViewColumn.One }
        );
        executor.assertPairs([ 'None' ], { viewColumn: ViewColumn.One });
        executor.assertCursors(
            [ { anchor: [1, 12], active: [1, 18] } ],
            { viewColumn: ViewColumn.One }
        );

        // Test setting cursor out upwards.
        //
        // Expected state of the text editor in view column 1 as a result:
        //
        // ```       ⌄(cursor position)
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }
        // ```
        await reset(executor);
        await executor.setCursors([ [0, 10] ], { viewColumn: ViewColumn.One });
        executor.assertPairs([ 'None' ],       { viewColumn: ViewColumn.One });
        executor.assertCursors([ [0, 10] ],    { viewColumn: ViewColumn.One });

        // Test setting cursor out downwards.
        //
        // Expected state of the text editor in view column 1 as a result:
        //
        // ```       
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }
        //  ^(cursor position)
        // ```
        await reset(executor);
        await executor.setCursors([ [2, 1] ], { viewColumn: ViewColumn.One });
        executor.assertPairs([ 'None' ],      { viewColumn: ViewColumn.One });
        executor.assertCursors([ [2, 1] ],    { viewColumn: ViewColumn.One });

        // Test deletion of opening side.
        //
        // Expected state of the text editor in view column 1 as a result:
        //
        // ```       
        // function () {
        //     console.log     { obj:  arr: [  prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                     ^(cursor position)
        // ```
        await reset(executor);
        await executor.editText(
            [
                { kind: 'delete',  range: { start: [1, 32], end: [1, 33] } },
                { kind: 'delete',  range: { start: [1, 23], end: [1, 24] } },
                { kind: 'replace', range: { start: [1, 15], end: [1, 16] }, with: '     ' },
            ],
            { viewColumn: ViewColumn.One }
        );
        executor.assertPairs(
            [ { line: 1, sides: [20, 33, 48, 54, 58, 62] } ], 
            { viewColumn: ViewColumn.One }
        );
        executor.assertCursors([ [1, 54] ], { viewColumn: ViewColumn.One });

        // Test deletion of closing side.
        //
        // Expected state of the text editor in view column 1 as a result:
        //
        // ```       
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn( }  Woah!); // Log object to console.
        // }                                              ^(cursor position)
        // ```
        await reset(executor);
        await executor.editText(
            [
                { kind: 'replace', range: { start: [1, 60], end: [1, 61] }, with: 'Woah!' },
                { kind: 'delete',  range: { start: [1, 56], end: [1, 59] } },
                { kind: 'delete',  range: { start: [1, 47], end: [1, 53] } },
            ],
            { viewColumn: ViewColumn.One }
        );
        executor.assertPairs([ { line: 1, sides: [15, 32, 48, 56] } ], { viewColumn: ViewColumn.One });
        executor.assertCursors([ [1, 47] ],                            { viewColumn: ViewColumn.One });

        // Test that multi-line text insertion between pairs untracks them.
        //
        // Expected state of text editor in view column 1 as a result:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(
        //             1, 
        // (sel. start)^   20,
        //                     300,
        //                         4000,
        //                             50000
        //     ) } ] } }); // Log object to console.
        // }   ^(selection end)
        // ```
        await reset(executor);
        await executor.editText(
            [
                { 
                    kind:  'replace', 
                    range: { start: [1, 47], end: [1, 52] },
                    with:  '\n'
                         + '            1,\n'
                         + '                20,\n'
                         + '                    300,\n'
                         + '                        4000,\n'
                         + '                            50000\n'
                         + '    '
                },
            ],
            { viewColumn: ViewColumn.One }
        );
        executor.assertPairs([ 'None' ],                               { viewColumn: ViewColumn.One });
        executor.assertCursors([ { anchor: [2, 4], active: [7, 4] } ], { viewColumn: ViewColumn.One });

        // Test that multi-line snippet insertion between pairs untracks them.
        // 
        // Expected state of text editor in view column 1 as a result:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(
        //         [1, 20, 300, 4000, 50000].reduce((acc, curr) => )
        //     ) } ] } }); // Log object to console.               ^(cursor position)
        // }
        // ```
        await reset(executor);
        await executor.insertSnippet(
            new SnippetString(
                '\n'
              + '    [1, 20, 300, 4000, 50000].reduce((acc, curr) => $1)$0\n'
            ),
            {
                at: { start: [1, 47], end: [1, 52] },
                viewColumn: ViewColumn.One
            }
        );
        executor.assertPairs([ 'None' ],    { viewColumn: ViewColumn.One });
        executor.assertCursors([ [2, 56] ], { viewColumn: ViewColumn.One });
    }
});

/**
 * A collection of test cases that test that pairs for a single cursor are invalidated due to:
 * 
 *  1. Cursor being moved out of them (also known as 'cursor escape' or 'cursor exit').
 *  2. Multi-line text being inserted between them.
 *  3. Their opening or closing sides being deleted.
 */
export const SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP = new TestGroup(
    'Pair Invalidation',
    [
        RIGHTWARDS_EXIT_OF_CURSOR_INCREMENTAL_TEST_CASE,
        RIGHTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_CLICKING_OUT_TEST_CASE,
        RIGHTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_PRESSING_END_KEY_TEST_CASE,
        LEFTWARDS_EXIT_OF_CURSOR_INCREMENTAL_TEST_CASE,
        LEFTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_CLICKING_OUT_TEST_CASE,
        LEFTWARDS_EXIT_OF_CURSOR_IN_ONE_GO_BY_PRESSING_HOME_KEY_TEST_CASE,
        UPWARDS_EXIT_OF_CURSOR_TEST_CASE,
        DOWNWARDS_EXIT_OF_CURSOR_TEST_CASE,
        DELETION_OF_OPENING_SIDE_TEST_CASE,
        DELETION_OF_CLOSING_SIDE_TEST_CASE,
        MULTI_LINE_TEXT_INSERTED_BETWEEN_PAIRS_TEST_CASE,
        MULTI_LINE_SNIPPET_INSERTED_BETWEEN_PAIRS_TEST_CASE,
        PAIR_INVALIDATION_IN_OUT_OF_FOCUS_TEXT_EDITOR_TEST_CASE
    ]
);
