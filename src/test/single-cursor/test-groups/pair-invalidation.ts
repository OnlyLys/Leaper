import { SnippetString } from 'vscode';
import { Executor, TestCase, TestGroup } from '../../utilities/framework';

// In this prelude that is shared across all the test cases in this module, we insert pairs in a way 
// that simulates a typical usage scenario.
//
// The following initial document is created:
//
// ```
// function () {
//     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
// }                                                   ^(cursor position)
// ```
const sharedPrelude = async (executor: Executor) => {
    await executor.editText({
        edits: [
            {
                kind: 'insert',
                at:   [0, 0],
                text: 'function () {\n    ; // Log object to console.\n}'
            }
        ]
    });
    await executor.setCursors({ to: [[1, 4]] });
    await executor.typeText({ text: 'console.log({  ' });
    await executor.moveCursors({ direction: 'left', });
    await executor.typeText({ text: 'obj: {  ' });
    await executor.moveCursors({ direction: 'left', });
    await executor.typeText({ text: 'arr: [  ' });
    await executor.moveCursors({ direction: 'left', });
    await executor.typeText({ text: '{  ' });
    await executor.moveCursors({ direction: 'left', });
    await executor.typeText({ text: 'prop: someFn(1, 20' });
    executor.assertPairs({
        expect: [ 
            { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } 
        ] 
    }); 
    executor.assertCursors({ expect: [ [1, 52] ] });
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
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 53] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                     ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 54] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                      ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 55] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                       ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 56] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                        ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 57] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                         ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 58] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                          ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 59] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                           ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 60] ] });
        
        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                            ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 61] } ] });
        executor.assertCursors({ expect: [ [1, 61] ] });

        // Move out of the last pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                                             ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'right' });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 62] ] });
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
        await executor.setCursors({ to: [ [1, 62] ] });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 62] ] });
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
        await executor.end();
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 89] ] });
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
        await executor.moveCursors({ direction: 'left', repetitions: 5 });
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } 
            ] 
        }); 
        executor.assertCursors({ expect: [ [1, 47] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                             ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({   
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 46] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                                ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left', repetitions: 13 });
        executor.assertPairs({
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 33] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                               ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 32] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                              ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 31] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                             ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 30] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                       ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left', repetitions: 6 });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 24] ] });
            
        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                      ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 23] ] });

        // Move to the boundary of the next nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }                ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left', repetitions: 6 });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 17] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }               ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 61] } ] });
        executor.assertCursors({ expect: [ [1, 16] ] });

        // Move out of the last pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }              ^(cursor position)
        // ```
        await executor.moveCursors({ direction: 'left' });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 15] ] });
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
        await executor.setCursors({ to: [ [1, 15] ] });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 15] ] });
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
        await executor.home();
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 4] ] });
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
        await executor.moveCursors({ direction: 'up' });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [0, 13] ] });
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
        await executor.moveCursors({ direction: 'down' });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [2, 1] ] });
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
        await executor.moveCursors({ direction: 'left', repetitions: 5 });
        await executor.backspace();
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 46] ] });

        // Overwrite text including the third and fourth of the remaining pairs.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
        // }                                              ^(cursor position)
        // ```
        await executor.editText({
            edits: [
                { kind: 'replace', range: { start: [1, 23], end: [1, 32] }, with: 'cheesecake' }
            ]
        });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 33, 54, 60, 61] } ] });
        executor.assertCursors({ expect: [ [1, 47] ] });

        // Overwrite some text including the first of the remaining pairs. 
        //
        // Document state after:
        //
        // ```
        // function () {
        //     { obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
        // }                                  ^(cursor position)
        // ```
        await executor.editText({
            edits: [
                { kind: 'delete', range: { start: [1, 4], end: [1, 16] } }
            ]
        });
        executor.assertPairs({   expect: [ { line: 1, sides: [4, 21, 42, 48] } ] });
        executor.assertCursors({ expect: [ [1, 35] ] });

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
        executor.assertPairs({   expect: [ { line: 1, sides: [4, 34] } ] });
        executor.assertCursors({ expect: [ [1, 21] ] });

        // Overwrite first pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     rabbit obj: cheesecake1, 20) } ] } }); // Log object to console.
        // }                         ^(cursor position)
        // ```
        await executor.editText({ 
            edits: [
                { kind: 'replace', range: { start: [1, 4], end: [1, 5] }, with: 'rabbit' }
            ]
        });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 26] ] });
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
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } 
            ]
        });
        executor.assertCursors({ expect: [ [1, 52] ] });

        // Overwrite text including the third and fourth of the remaining pairs.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}); // Log object to console.
        // }                                                   ^(cursor position)
        // ```
        await executor.editText({
            edits: [
                { kind: 'replace', range: { start: [1, 55], end: [1, 59] }, with: 'cheesecake' }
            ]
        });
        executor.assertPairs({   expect: [ { line: 1, sides: [15, 16, 32, 53, 65, 66] } ] });
        executor.assertCursors({ expect: [ [1, 52] ] });

        // Overwrite some text including the first of the remaining pairs.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}
        // }                                                   ^(cursor position)
        // ```
        await executor.editText({
            edits: [
                { kind: 'delete', range: { start: [1, 66], end: [1, 94] } }
            ]
        });
        executor.assertPairs({   expect: [ { line: 1, sides: [16, 32, 53, 65] } ] });
        executor.assertCursors({ expect: [ [1, 52] ] });
        
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
        executor.assertPairs({   expect: [ { line: 1, sides: [16, 63] } ] });
        executor.assertCursors({ expect: [ [1, 52] ] });
        
        // Overwrite text including the final pair.
        //
        // Document state after:
        //
        // ```
        // function () {
        //    console.log({rabbit
        // }              ^(cursor position)
        // ```
        await executor.editText({
            edits: [
                { kind: 'replace', range: { start: [1, 17], end: [1, 64] }, with: 'rabbit' }
            ]
        });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [1, 23] ] });
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
        await executor.editText({
            edits: [
                { kind: 'insert', at: [1, 16], text: '\n        ' }
            ]
        });
        executor.assertPairs({ 
            expect: [ 
                { line: 2, sides: [8, 15, 22, 24, 38, 44, 46, 48, 50, 52] } 
            ] 
        });
        executor.assertCursors({ expect: [ [2, 44] ] });

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
        await executor.editText({
            edits: [
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
            ]
        });
        executor.assertPairs({   expect: [ { line: 7, sides: [17, 19, 33, 39, 41, 43] } ] });
        executor.assertCursors({ expect: [ [7, 39] ] });

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
        await executor.typeText({ text: '\n' });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [8, 16] ] });
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
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 46, 50, 52, 54, 56, 58, 59] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 50] ] });

        // Type in an array of numbers.
        //
        // Document state after:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3]) } ] } }); // Log object to console.
        // }                                                             ^(cursor position)
        // ```
        await executor.typeText({ text: '[-1, -2, -3]' });
        executor.assertPairs({ 
            expect: [ 
                { line: 1, sides: [15, 16, 23, 30, 32, 46, 62, 64, 66, 68, 70, 71] } 
            ] 
        });
        executor.assertCursors({ expect: [ [1, 62] ] });

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
        await executor.insertSnippet({ 
            snippet: new SnippetString(
                 '.reduce((${1:acc}, ${2:curr}) => {\n'
               + '    $3\n'
               + '}, ${4:init})$0'
            ) 
        });
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ { anchor: [1, 71], active: [1, 74] } ] });

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
        await executor.jumpToNextTabstop();
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ { anchor: [1, 76], active: [1, 80] } ] });

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
        await executor.jumpToNextTabstop();
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [2, 8] ] });

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
        await executor.jumpToNextTabstop();
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ { anchor: [3, 7], active: [3, 11] } ] });

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
        await executor.jumpToNextTabstop();
        executor.assertPairs({   expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [3, 12] ] });
    }
});

/**
 * Test pair invalidation due to:
 * 
 *  1. Cursor being moved out of them (also known as 'cursor escape' or 'cursor exit').
 *  2. Multi-line text being inserted between them.
 *  3. Their opening or closing sides being deleted.
 */
export const SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP = new TestGroup({
    name: 'Pair Invalidation',
    testCases: [
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
        MULTI_LINE_SNIPPET_INSERTED_BETWEEN_PAIRS_TEST_CASE
    ]
});
