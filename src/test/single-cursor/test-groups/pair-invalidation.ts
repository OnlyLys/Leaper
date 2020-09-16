import { Action, TestCase, TestGroup, CompactPair, CompactPosition } from '../../typedefs';

const SHARED_PRELUDE: { description: string, actions: Action[] } = {
    description: 'Insert multiple pairs',
    actions: [
        { 
            kind:    'textEdit',   
            replace: { start: [0, 0], end: [0, 0] }, 
            insert: 'function () {\n    ; // Log object to console.\n}'
        },
        { kind: 'setCursors',  cursors: [ [2, 4] ] }, 
        // Insert pairs in a way that simulates a realistic usage scenario.
        //
        // The following initial test text is created:
        //
        // ```
        // function () {
        //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
        // }
        // ```
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
            kind: 'assertPairs', 
            pairs: [
                [
                    { open: [1, 15], close: [1, 61] },
                    { open: [1, 16], close: [1, 60] },
                    { open: [1, 23], close: [1, 58] },
                    { open: [1, 30], close: [1, 56] },
                    { open: [1, 32], close: [1, 54] },
                    { open: [1, 46], close: [1, 52] },
                ]
            ]
        },
        { kind: 'assertCursors', cursors: [ [1, 52] ] }
    ]
};

/**
 * Generate actions to move out pairs one cursor move at a time.
 * 
 * Assertions are generated to check the state of the pairs and cursors after each cursor move.
 */ 
function genIncrementalCursorMoveActions(
    pairs:     CompactPair[][],
    cursors:   CompactPosition[],
    direction: 'left' | 'right'
): Action[] {
    const singlePairs = pairs[0];
    let singleCursor  = cursors[0];
    const actions: Action[] = [];
    while (pairs[0].length > 0) {
        const nearestPair = singlePairs[singlePairs.length - 1];
        const nearestSide = (direction === 'left' ? nearestPair.open : nearestPair.close);
        if (singleCursor[1] === nearestSide[1]) {
            singlePairs.pop();
        }
        singleCursor = [singleCursor[0], singleCursor[1] + direction === 'left' ? -1 : 1];
        actions.push({ kind: 'moveCursors',   direction                      });
        actions.push({ kind: 'assertPairs',   pairs:    [ [...singlePairs] ] });
        actions.push({ kind: 'assertCursors', cursors:  [ singleCursor ]     });
    }
    return actions;
}

const TEST_CASES: TestCase[] = [
    {
        name: 'Cursor Moves Out Rightwards (Incremental)',
        prelude: SHARED_PRELUDE,
        actions: genIncrementalCursorMoveActions(
            [
                [
                    { open: [1, 15], close: [1, 61] },
                    { open: [1, 16], close: [1, 60] },
                    { open: [1, 23], close: [1, 58] },
                    { open: [1, 30], close: [1, 56] },
                    { open: [1, 32], close: [1, 54] },
                    { open: [1, 46], close: [1, 52] },
                ]
            ],
            [ [1, 52] ],
            'right'
        )
    },
    {
        name: 'Cursor Moves Out Rightwards (in One Go)',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'setCursors',    cursors: [ [1, 62] ] },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [1, 62] ] }
        ]
    },
    {
        name: 'Cursor Moves Out Leftwards (Incremental)',
        prelude: SHARED_PRELUDE,
        actions: genIncrementalCursorMoveActions(
            [
                [
                    { open: [1, 15], close: [1, 61] },
                    { open: [1, 16], close: [1, 60] },
                    { open: [1, 23], close: [1, 58] },
                    { open: [1, 30], close: [1, 56] },
                    { open: [1, 32], close: [1, 54] },
                    { open: [1, 46], close: [1, 52] },
                ]
            ],
            [ [1, 52] ],
            'left'
        )
    },
    {
        name: 'Cursor Moves Out Leftwards (in One Go)',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'setCursors',    cursors: [ [1, 16] ] },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [1, 16] ] }
        ]
    },
    {
        name: 'Cursor Moves Out Upwards',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'moveCursors',   direction: 'up'        },
            { kind: 'assertPairs',   pairs:     [ [] ]      },
            { kind: 'assertCursors', cursors:   [ [0, 13] ] }
        ]
    },
    {
        name: 'Cursor Moves Out Downwards',
        prelude: SHARED_PRELUDE,
        actions: [
            { kind: 'moveCursors',   direction: 'down'     },
            { kind: 'assertPairs',   pairs:     [ [] ]     },
            { kind: 'assertCursors', cursors:   [ [2, 1] ] }
        ]
    },
    {
        name: 'Deletion of Opening Side',
        prelude: SHARED_PRELUDE,
        actions: [
            // Move to the closing side of the first pair and then backspace it.
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
            { kind: 'moveCursors', direction: 'left', repeat: 5 },
            { kind: 'backspace'                                 },
            { 
                kind: 'assertPairs', 
                pairs: [
                    [
                        { open: [1, 15], close: [1, 60] },
                        { open: [1, 16], close: [1, 59] },
                        { open: [1, 23], close: [1, 57] },
                        { open: [1, 30], close: [1, 55] },
                        { open: [1, 32], close: [1, 53] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [1, 46] ] },
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
            { kind: 'textEdit', replace: { start: [1, 23], end: [1, 32] }, insert: 'cheesecake' },
            {
                kind: 'assertPairs', 
                pairs: [
                    [
                        { open: [1, 15], close: [1, 61] },
                        { open: [1, 16], close: [1, 60] },
                        { open: [1, 33], close: [1, 54] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [1, 47] ] },
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
            { kind: 'textEdit', replace: { start: [1, 4], end: [1, 16] }, insert:  '' },
            {
                kind: 'assertPairs',
                pairs: [
                    [
                        { open: [1,  4], close: [1, 48] },
                        { open: [1, 21], close: [1, 42] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [1, 35] ] },
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
            { kind: 'backspace',     repeat:  14                                        },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 4],  close: [1, 34] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 21] ]                               },
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
            { kind: 'textEdit',      replace: { start: [1, 4], end: [1, 5] }, insert: 'rabbit' },
            { kind: 'assertPairs',   pairs:   [ [] ]                                           },
            { kind: 'assertCursors', cursors: [ [1, 26] ]                                      }
        ]
    },
    {
        name: 'Deletion of Closing Side',
        prelude: SHARED_PRELUDE,
        actions: [
            // Delete the first pair. 
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
            { kind: 'delete' },
            { 
                kind: 'assertPairs', 
                pairs: [
                    [
                        { open: [1, 15], close: [1, 60] },
                        { open: [1, 16], close: [1, 59] },
                        { open: [1, 23], close: [1, 57] },
                        { open: [1, 30], close: [1, 55] },
                        { open: [1, 32], close: [1, 53] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [1, 52] ] },
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
            { kind: 'textEdit', replace: { start: [1, 55], end: [1, 59] }, insert: 'cheesecake' },
            { 
                kind: 'assertPairs', 
                pairs: [
                    [
                        { open: [1, 15], close: [1, 66] },
                        { open: [1, 16], close: [1, 65] },
                        { open: [1, 32], close: [1, 53] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [1, 52] ] },
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
            { kind: 'textEdit', replace: { start: [1, 66], end: [1, 94] }, insert: '' },
            { 
                kind: 'assertPairs', 
                pairs: [
                    [
                        { open: [1, 16], close: [1, 65] },
                        { open: [1, 32], close: [1, 53] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [1, 52] ] },
            // Delete until the second of the remaining pairs is deleted.
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
            { kind: 'delete',        repeat:  2                                         },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 16], close: [1, 63] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                               },
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
            { kind: 'textEdit',      replace: { start: [1, 17], end: [1, 64] }, insert: 'rabbit' },
            { kind: 'assertPairs',   pairs:   [ [] ]                                             },
            { kind: 'assertCursors', cursors: [ [1, 23] ]                                        }
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
            { kind: 'textEdit', replace: { start: [1, 16], end: [1, 16] }, insert: '\n\t\t' },
            { 
                kind: 'assertPairs',
                pairs: [
                    [
                        { open: [2,  8], close: [2, 52] },
                        { open: [2, 15], close: [2, 50] },
                        { open: [2, 22], close: [2, 48] },
                        { open: [2, 24], close: [2, 46] },
                        { open: [2, 38], close: [2, 44] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [2, 44] ] },
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

                kind: 'textEdit', 
                replace: { start: [2, 17], end: [2, 21] }, 
                insert: '\n\t\t\tMary\n\t\t\thad\n\t\t\ta\n\t\t\tlittle\n\t\t\tlamb'
            },
            { 
                kind: 'assertPairs',
                pairs: [
                    [
                        { open: [7, 17], close: [7, 43] },
                        { open: [7, 19], close: [7, 41] },
                        { open: [7, 33], close: [7, 39] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [7, 39] ] },
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
            // Lines after (with markdown auto-indentation applied):
            //
            //     console.log(
            //         { obj: { 
            //             Mary
            //             had
            //             a
            //             little
            //             lamb [ { prop: someFn(1, 20
            //             ) } ] } }); // Log object to console.
            //             ^(cursor position)
            { kind: 'typeText',      text:    '\n'        },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [8, 12] ] }
        ]
    },
];

/**
 * This test group tests pair invalidation due to:
 * 
 *  1. Deletion of either the opening or closing side.
 *  2. Cursor being moved out of them.
 *  3. Multi-line text being inserted between them.
 */
export const SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP: TestGroup = {
    name: 'Pair Invalidation (Single Cursor)',
    testCases: TEST_CASES
};
