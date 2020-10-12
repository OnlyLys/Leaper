import { SnippetString } from 'vscode';
import { TestCase, TestContext, TestGroup } from '../../framework/framework';

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
const SHARED_PRELUDE = async (context: TestContext) => {
    await context.editText({
        edits: [
            {
                kind:     'insert',
                position: [0, 0],
                text:     'function () {\n    ; // Log object to console.\n}'
            }
        ]
    });
    await context.setCursors({ cursors: [[1, 4]] });
    await context.typeText({ text: 'console.log({  ' });
    await context.moveCursors({ direction: 'left', });
    await context.typeText({ text: 'obj: {  ' });
    await context.moveCursors({ direction: 'left', });
    await context.typeText({ text: 'arr: [  ' });
    await context.moveCursors({ direction: 'left', });
    await context.typeText({ text: '{  ' });
    await context.moveCursors({ direction: 'left', });
    await context.typeText({ text: 'prop: someFn(1, 20' });
    context.assertPairsPrelude(
        [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ],
    ); 
    context.assertCursorsPrelude([ [1, 52] ]);
};

const TEST_CASES: TestCase[] = [

    // ----------------------------------------------------
    // INVALIDATION DUE TO CURSOR MOVING OUT OF PAIR

    new TestCase({
        name: 'Rightwards Exit of Cursor (Incremental)',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                    ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 53] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                     ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 54] ]);

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                      ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 55] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                       ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 56] ]);

            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                        ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
            context.assertCursors([ [1, 57] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                         ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
            context.assertCursors([ [1, 58] ]);

            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                          ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
            context.assertCursors([ [1, 59] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                           ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
            context.assertCursors([ [1, 60] ]);
         
            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                            ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: 1, sides: [15, 61] } ]);
            context.assertCursors([ [1, 61] ]);

            // Move out of the last pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                             ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'right' });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 62] ]);
        }
    }),
    new TestCase({
        name: 'Rightwards Exit of Cursor (in One Go by Clicking Out)',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                             ^(cursor position)
            // ```
            await context.setCursors({ cursors: [ [1, 62] ] });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 62] ]);
        }
    }),
    new TestCase({
        name: 'Rightwards Exit of Cursor (in One Go by Pressing `End` Key)',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                                                        ^(cursor position)
            // ```
            await context.end();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 89] ]);
        }
    }),
    new TestCase({
        name: 'Leftwards Exit of Cursor (Incremental)',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Move to the boundary of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                              ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left', repetitions: 5 });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ]); 
            context.assertCursors([ [1, 47] ]);

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                             ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 46] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left', repetitions: 13 });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 33] ]);

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                               ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 32] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                              ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ]);
            context.assertCursors([ [1, 31] ]);

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                             ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
            context.assertCursors([ [1, 30] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                       ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left', repetitions: 6 });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ]);
            context.assertCursors([ [1, 24] ]);
                
            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                      ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
            context.assertCursors([ [1, 23] ]);

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left', repetitions: 6 });
            context.assertPairs([ { line: 1, sides: [15, 16, 60, 61] } ]);
            context.assertCursors([ [1, 17] ]);
 
            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }               ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: 1, sides: [15, 61] } ]);
            context.assertCursors([ [1, 16] ]);

            // Move out of the last pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }              ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left' });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 15] ]);
        }
    }),
    new TestCase({
        name: 'Leftwards Exit of Cursor (in One Go by Clicking Out)',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }              ^(cursor position)
            // ```
            await context.setCursors({ cursors: [ [1, 15] ] });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 15] ]);
        }
    }),
    new TestCase({
        name: 'Leftwards Exit of Cursor (in One Go by Pressing `Home` Key)',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }   ^(cursor position)
            // ```
            await context.home();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 4] ]);
        }
    }),
    new TestCase({
        name: 'Upwards Exit of Cursor',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Document state after:
            // 
            // ```          
            // function () {
            //              ^(cursor position)
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }
            // ```
            await context.moveCursors({ direction: 'up' });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [0, 13] ]);
        }
    }),
    new TestCase({
        name: 'Downwards Exit of Cursor',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Document state after:
            // 
            // ```          
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }
            //  ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'down' });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [2, 1] ]);
        }
    }),

    // ----------------------------------------------------
    // INVALIDATION DUE TO EITHER SIDE OF PAIR BEING DELETED

    new TestCase({
        name: 'Deletion of Opening Side',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Move to the opening side of the first pair and then backspace it.
            //
            // Document state after: 
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn1, 20) } ] } }); // Log object to console.
            // }                                             ^(cursor position)
            // ```
            await context.moveCursors({ direction: 'left', repetitions: 5 });
            await context.backspace();
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ]);
            context.assertCursors([ [1, 46] ]);

            // Overwrite text including the third and fourth of the remaining pairs.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            // }                                              ^(cursor position)
            // ```
            await context.editText({
                edits: [
                    {
                        kind:    'replace',
                        replace: { start: [1, 23], end: [1, 32] }, 
                        insert:  'cheesecake' 
                    }
                ]
            });
            context.assertPairs([ { line: 1, sides: [15, 16, 33, 54, 60, 61] } ]);
            context.assertCursors([ [1, 47] ]);

            // Overwrite some text including the first of the remaining pairs. 
            //
            // Document state after:
            //
            // ```
            // function () {
            //     { obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            // }                                  ^(cursor position)
            // ```
            await context.editText({
                edits: [
                    { kind: 'delete', range: { start: [1, 4], end: [1, 16] } }
                ]
            });
            context.assertPairs([ { line: 1, sides: [4, 21, 42, 48] } ]);
            context.assertCursors([ [1, 35] ]);

            // Backspace until the second of the remaining pairs is deleted.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     { obj: cheesecake1, 20) } ] } }); // Log object to console.
            // }                    ^(cursor position)
            // ```
            await context.backspace({ repetitions: 14 });
            context.assertPairs([ { line: 1, sides: [4, 34] } ]);
            context.assertCursors([ [1, 21] ]);

            // Overwrite first pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     rabbit obj: cheesecake1, 20) } ] } }); // Log object to console.
            // }                         ^(cursor position)
            // ```
            await context.editText({ 
                edits: [
                    { kind: 'replace', replace: { start: [1, 4], end: [1, 5] }, insert: 'rabbit' }
                ]
            });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 26] ]);
        }
    }),
    new TestCase({
        name: 'Deletion of Closing Side',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Delete right the closing character of the first pair. 
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } ] } }); // Log object to console.
            // }                                                   ^(cursor position)
            // ```
            await context.deleteRight();
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ]);
            context.assertCursors([ [1, 52] ]);

            // Overwrite text including the third and fourth of the remaining pairs.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}); // Log object to console.
            // }                                                   ^(cursor position)
            // ```
            await context.editText({
                edits: [
                    {
                        kind:    'replace',
                        replace: { start: [1, 55], end: [1, 59] }, 
                        insert:  'cheesecake' 
                    }
                ]
            });
            context.assertPairs([ { line: 1, sides: [15, 16, 32, 53, 65, 66] } ]);
            context.assertCursors([ [1, 52] ]);

            // Overwrite some text including the first of the remaining pairs.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}
            // }                                                   ^(cursor position)
            // ```
            await context.editText({
                edits: [
                    { kind: 'delete', range: { start: [1, 66], end: [1, 94] } }
                ]
            });
            context.assertPairs([ { line: 1, sides: [16, 32, 53, 65] } ]);
            context.assertCursors([ [1, 52] ]);
            
            // Delete right until the second of the remaining pairs is deleted.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 cheesecake}
            // }                                                   ^(cursor position)
            // ```
            await context.deleteRight({ repetitions: 2 });
            context.assertPairs([ { line: 1, sides: [16, 63] } ]);
            context.assertCursors([ [1, 52] ]);
            
            // Overwrite text including the final pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //    console.log({rabbit
            // }              ^(cursor position)
            // ```
            await context.editText({
                edits: [
                    { kind: 'replace', replace: { start: [1, 17], end: [1, 64] }, insert: 'rabbit' }
                ]
            });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [1, 23] ]);
        }
    }),

    // ----------------------------------------------------
    // INVALIDATION DUE TO SIDES OF PAIR ENDING UP ON DIFFERENT LINES

    new TestCase({
        name: 'Multi-line Text Inserted Between Pairs',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

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
            await context.editText({
                edits: [
                    {
                        kind:     'insert',
                        position: [1, 16], 
                        text:     '\n        '
                    }
                ]
            });
            context.assertPairs([ { line: 2, sides: [8, 15, 22, 24, 38, 44, 46, 48, 50, 52] } ]);
            context.assertCursors( [ [2, 44] ]);

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
            await context.editText({
                edits: [
                    {
                        kind:    'replace',
                        replace: { start: [2, 17], end: [2, 21] }, 
                        insert:  '\n'
                            + '            Mary\n'
                            + '            had\n'
                            + '            a\n'
                            + '            little\n'
                            + '            lamb'
                    }
                ]
            });
            context.assertPairs([ { line: 7, sides: [17, 19, 33, 39, 41, 43] } ]);
            context.assertCursors([ [7, 39] ]);

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
            await context.typeText({ text: '\n' });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [8, 16] ]);
        }
    }),
    new TestCase({
        name: 'Multi-line Snippet Inserted Between Pairs',
        prelude: SHARED_PRELUDE,
        action: async (context) => {

            // Delete the `20` from the second argument of `someFn`.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, ) } ] } }); // Log object to console.
            // }                                                 ^(cursor position)
            // ```
            await context.backspace({ repetitions: 2 });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 50, 52, 54, 56, 58, 59] } ]);
            context.assertCursors([ [1, 50] ]);

            // Type in an array of numbers.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3]) } ] } }); // Log object to console.
            // }                                                             ^(cursor position)
            // ```
            await context.typeText({ text: '[-1, -2, -3]' });
            context.assertPairs([ { line: 1, sides: [15, 16, 23, 30, 32, 46, 62, 64, 66, 68, 70, 71] } ]);
            context.assertCursors([ [1, 62] ]);

            // Insert a multi-line snippet.
            // 
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //                                                                        |--^(cursor selection)  
            //     }, init)) } ] } }); // Log object to console.
            // }                                                            
            // ```
            await context.insertSnippet({ 
                snippet: new SnippetString('.reduce((${1:acc}, ${2:prev}) => {\n    $3\n}, ${4:init})$0') 
            });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ { anchor: [1, 71], active: [1, 74] } ]);

            // Make sure that the snippet still works by jumping to the second tabstop.
            // 
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //                                                                             |---^(cursor selection)
            //     }, init)) } ] } }); // Log object to console.
            // }                                                            
            // ```
            await context.jumpToNextTabstop();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ { anchor: [1, 76], active: [1, 80] } ]);

            // Make sure that the snippet still works by jumping to the third tabstop.
            // 
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //                                                                              
            //         ^(cursor position)
            //     }, init)) } ] } }); // Log object to console.
            // }                                                            
            // ```
            await context.jumpToNextTabstop();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [2, 8] ]);

            // Make sure that the snippet still works by jumping to the fourth tabstop.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //         
            //     }, init)) } ] } }); // Log object to console.
            // }      |---^(cursor selection)
            // ```
            await context.jumpToNextTabstop();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ { anchor: [3, 7], active: [3, 11] } ]);

            // Make sure that the snippet still works by jumping to the final tabstop.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //         
            //     }, init)) } ] } }); // Log object to console.
            // }           ^(cursor position)
            // ```
            await context.jumpToNextTabstop();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [3, 12] ]);
        }
    })
];

/**
 * This test group tests pair invalidation due to:
 * 
 *  1. Cursor being moved out of them (also known as 'cursor escape' or 'cursor exit').
 *  2. Multi-line text being inserted between them.
 *  3. Their opening or closing sides being deleted.
 */
export const SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP = new TestGroup({
    name: 'Pair Invalidation',
    testCases: TEST_CASES
});
