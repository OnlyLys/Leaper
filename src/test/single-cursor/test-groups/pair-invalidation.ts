import { Action, TestCase, TestGroup, CompactPosition, CompactPairsSingle } from '../../typedefs';

// In this prelude that is shared across all the test cases in this module, we insert pairs in a way 
// that simulates a typical usage scenario.
//
// The following initial text is created:
//
// ```
// function () {
//     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
// }
// ```
const SHARED_PRELUDE: { description: string, actions: Action[] } = {
    description: 'Insert multiple pairs',
    actions: [
        { 
            kind:    'insertText',   
            position: [0, 0],
            text:     'function () {\n    ; // Log object to console.\n}'
        },
        { kind: 'setCursors',  cursors:   [ [2, 4] ]           }, 
        { kind: 'typeText',    text:      'console.log({  '    },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      'obj: {  '           },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      'arr: [  '           },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      '{  '                },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      'prop: someFn(1, 20' },
        { 
            kind:  'assertPairs', 
            pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ] 
        },
        { kind: 'assertCursors', cursors: [ [1, 52] ] }
    ]
};

/**
 * Generate actions to move the cursor out of pairs, one pair at a time, in a specific direction.
 * 
 * Assertions are generated along the way to check the state of the pairs and cursors after each 
 * cursor move.
 */ 
function genIncrementalCursorMoveActions(
    pairs:     ReadonlyArray<CompactPairsSingle>,
    cursors:   ReadonlyArray<CompactPosition>,
    direction: 'left' | 'right'
): Action[] {
    let cursor        = cursors[0];
    const openings    = pairs[0].sides.slice(0, pairs[0].sides.length / 2);
    const closingsRev = pairs[0].sides.slice(pairs[0].sides.length / 2).reverse();
    const actions: Action[] = [];
    while (openings.length > 0) {
        actions.push({ kind: 'moveCursors', direction });

        // Assume there are equal amounts of opening sides of pairs as there are closing sides.
        const lastIndex = openings.length - 1;
        if (cursors[0][1] === (direction === 'left' ? openings[lastIndex] : closingsRev[lastIndex])) {
            openings.pop();
            closingsRev.pop();
        }
        actions.push({ 
            kind:  'assertPairs',   
            pairs: [ { line: pairs[0].line, sides: [ ...openings, ...closingsRev.reverse() ] } ] 
        });

        cursor = [cursor[0], cursor[1] + direction === 'left' ? -1 : 1];
        actions.push({ kind: 'assertCursors', cursors: [ cursor ] });
    }
    return actions;
}

const TEST_CASES: TestCase[] = [
    {
        name: 'Rightwards Exit of Cursor (Incremental)',
        prelude: SHARED_PRELUDE,
        actions: genIncrementalCursorMoveActions(
            [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ],
            [ [1, 52] ],
            'right'
        )
    },
    {
        name: 'Rightwards Exit of Cursor (in One Go)',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'setCursors',    cursors: [ [1, 62] ]                 },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 62] ]                 },
        ]
    },
    {
        name: 'Leftwards Exit of Cursor (Incremental)',
        prelude: SHARED_PRELUDE,
        actions: genIncrementalCursorMoveActions(
            [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ],
            [ [1, 52] ],
            'left'
        )
    },
    {
        name: 'Leftwards Exit of Cursor (in One Go)',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'setCursors',    cursors: [ [1, 16] ]                 },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 16] ]                 },
        ]
    },
    {
        name: 'Upwards Exit of Cursor',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'moveCursors',   direction: 'up'                        },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [0, 13] ]                 },
        ]
    },
    {
        name: 'Downwards Exit of Cursor',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'moveCursors',   direction: 'down'                      },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 1] ]                  },
        ]
    },
    {
        name: 'Deletion of Opening Side',
        prelude: SHARED_PRELUDE,
        actions: [

            // Move to the opening side of the first pair and then backspace it.
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                                     ^(cursor position)
            //
            // Line after: 
            //
            //     console.log({ obj: { arr: [ { prop: someFn1, 20) } ] } }); // Log object to console.
            //                                               ^(cursor position)
            { kind: 'moveCursors',   direction: 'left', repetitions: 5                                       },
            { kind: 'backspace'                                                                              },
            { kind: 'assertPairs',   pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ] },
            { kind: 'assertCursors', cursors: [ [1, 46] ]                                                    },

            // Overwrite text including the third and fourth of the remaining pairs.
            //
            // Line before: 
            //
            //     console.log({ obj: { arr: [ { prop: someFn1, 20) } ] } }); // Log object to console.
            //                                               ^(cursor position)
            //
            // Line after: 
            //
            //     console.log({ obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            //                                                ^(cursor position)
            { kind: 'replaceText',   replace: { start: [1, 23], end: [1, 32] }, insert: 'cheesecake' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 16, 33, 54, 60, 61] } ]       },
            { kind: 'assertCursors', cursors: [ [1, 47] ]                                            },

            // Overwrite some text including the first of the remaining pairs. 
            //
            // Line before: 
            //
            //     console.log({ obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            //                                                ^(cursor position)
            //
            // Line after: 
            // 
            //     { obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            //                                    ^(cursor position)
            { kind: 'replaceText',   replace: { start: [1, 4], end: [1, 16] }, insert: '' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [4, 21, 42, 48] } ]     },
            { kind: 'assertCursors', cursors: [ [1, 35] ]                                 },

            // Backspace until the second of the remaining pairs is deleted.
            //
            // Line before:
            //
            //     { obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            //                                    ^(cursor position)
            //
            // Line after:
            //     
            //     { obj: cheesecake1, 20) } ] } }); // Log object to console.
            //                      ^(cursor position)
            { kind: 'backspace',     repetitions: 14                              },
            { kind: 'assertPairs',   pairs:       [ { line: 1, sides: [4, 34] } ] },
            { kind: 'assertCursors', cursors:     [ [1, 21] ]                     },

            // Overwrite first pair.
            //
            // Line before:
            //
            //     { obj: cheesecake1, 20) } ] } }); // Log object to console.
            //                      ^(cursor position)
            //
            // Line after:
            //
            //     rabbit obj: cheesecake1, 20) } ] } }); // Log object to console.
            //                           ^(cursor position)
            { kind: 'replaceText',   replace: { start: [1, 4], end: [1, 5] }, insert: 'rabbit' },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]                      },
            { kind: 'assertCursors', cursors: [ [1, 26] ]                                      },
        ]
    },
    {
        name: 'Deletion of Closing Side',
        prelude: SHARED_PRELUDE,
        actions: [

            // Delete right the closing character of the first pair. 
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                                     ^(cursor position)
            //
            // Line after: 
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } ] } }); // Log object to console.
            //                                                     ^(cursor position)
            { kind: 'deleteRight'                                                                            },
            { kind: 'assertPairs',   pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ] },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                                    },

            // Overwrite text including the third and fourth of the remaining pairs.
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } ] } }); // Log object to console.
            //                                                     ^(cursor position)
            //
            // Line after:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}); // Log object to console.
            //                                                     ^(cursor position)
            { kind: 'replaceText',   replace: { start: [1, 55], end: [1, 59] }, insert: 'cheesecake' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 16, 32, 53, 65, 66] } ]       },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                            },

            // Overwrite some text including the first of the remaining pairs.
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}); // Log object to console.
            //                                                     ^(cursor position)
            //
            // Line after:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}
            //                                                     ^(cursor position)
            { kind: 'replaceText',   replace: { start: [1, 66], end: [1, 94] }, insert: '' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [16, 32, 53, 65] } ]     },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                  },
            
            // Delete right until the second of the remaining pairs is deleted.
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}
            //                                                     ^(cursor position)
            // 
            // Line after:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 cheesecake}
            //                                                     ^(cursor position)
            { kind: 'deleteRight',   repetitions: 2                                },
            { kind: 'assertPairs',   pairs:       [ { line: 1, sides: [16, 63] } ] },
            { kind: 'assertCursors', cursors:     [ [1, 52] ]                      },
            
            // Overwrite text including the final pair.
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 cheesecake}
            //                                                     ^(cursor position)
            //
            // Line after:
            //
            //    console.log({rabbit
            //                ^(cursor position)
            { kind: 'replaceText',   replace: { start: [1, 17], end: [1, 64] }, insert: 'rabbit' },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]                        },
            { kind: 'assertCursors', cursors: [ [1, 23] ]                                        },
        ]
    },
    {
        name: 'Multiline Text Inserted Between Pair',
        prelude: SHARED_PRELUDE,
        actions: [

            // Indent the text after the first pair.
            //
            // Line before:
            //
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                                     ^(cursor position) 
            //
            // Lines after:
            // 
            //    console.log(
            //        { obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                            ^(cursor position)
            { kind: 'insertText',    position: [1, 16], text: '\n\t\t'                                         },
            { kind: 'assertPairs',   pairs:    [ { line: 2, sides: [8, 15, 22, 24, 38, 44, 46, 48, 50, 52] } ] },
            { kind: 'assertCursors', cursors:  [ [2, 44] ]                                                     },

            // Replace the text between the second and third remaining pairs with multiline text.
            //
            // Lines before:
            //
            //    console.log(
            //        { obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                            ^(cursor position)
            //
            // Lines after:
            //
            //     console.log(
            //         { obj: { 
            //             Mary
            //             had
            //             a
            //             little
            //             lamb [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                        ^(cursor position)
            { 
                kind:    'replaceText', 
                replace: { start: [2, 17], end: [2, 21] }, 
                insert:  '\n\t\t\tMary\n\t\t\thad\n\t\t\ta\n\t\t\tlittle\n\t\t\tlamb'
            },
            { kind: 'assertPairs',   pairs:   [ { line: 7, sides: [17, 19, 33, 39, 41, 43] } ] },
            { kind: 'assertCursors', cursors: [ [7, 39] ]                                      },

            // Type in a newline at the cursor position.
            //
            // Lines before:
            //
            //     console.log(
            //         { obj: { 
            //             Mary
            //             had
            //             a
            //             little
            //             lamb [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            //                                        ^(cursor position)//
            //
            // Lines after (with Typescript auto-indentation applied):
            //
            //     console.log(
            //         { obj: { 
            //             Mary
            //             had
            //             a
            //             little
            //             lamb [ { prop: someFn(1, 20
            //                 ) } ] } }); // Log object to console.
            //                 ^(cursor position)
            { kind: 'typeText',      text:    '\n'                        },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [8, 16] ]                 },
        ]
    }
];

/**
 * This test group tests pair invalidation due to:
 * 
 *  1. Cursor being moved out of them (also known as 'cursor escape' or 'cursor exit').
 *  2. Multiline text being inserted between them.
 *  3. Their opening or closing sides being deleted.
 */
export const SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP: TestGroup = {
    name: 'Pair Invalidation (Single Cursor)',
    testCases: TEST_CASES
};
