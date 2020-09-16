import { TestCase, TestGroup, CompactPair, Action } from '../../typedefs';
import { ALICE_TEXT_1, ALICE_TEXT_2 } from '../../utilities';

// TODO: Test Case: Holding `Tab` down OK (Multiple content changes per loop)

const TEST_CASES: TestCase[] = [
    {
        name: 'Single Leap',
        prelude: {
            description: 'Insert single pair',
            actions: [
                { kind: 'insertPair'                                                      },
                { kind: 'assertPairs',   pairs:   [ [ { open: [0, 0], close: [0, 1] } ] ] },
                { kind: 'assertCursors', cursors: [ [0, 1] ]                              }
            ]
        },
        actions: [
            { kind: 'leap'                                }, 
            { kind: 'assertPairs',    pairs:   [ [] ]     }, 
            { kind: 'assertCursors' , cursors: [ [0, 2] ] }
        ]
    },
    {
        name: 'Single Leap Across Whitespace',
        prelude: {
            description: 'Insert single pair with whitespace in between',
            actions: [
                { kind: 'insertPair'                                                      },
                { kind: 'typeText',      text:      '     '                               },
                { kind: 'moveCursors',   direction: 'left', repeat: 5                     },
                { kind: 'assertPairs',   pairs:   [ [ { open: [0, 1], close: [0, 6] } ] ] },
                { kind: 'assertCursors', cursors: [ [0, 1] ]                              }
            ]
        },
        actions: [
            { kind: 'leap'                               },
            { kind: 'assertPairs',   pairs:   [ [] ]     },
            { kind: 'assertCursors', cursors: [ [0, 7] ] }
        ]
    },
    {
        name: 'Consecutive Leaps',
        prelude: {
            description: 'Insert 10 pairs',
            actions: [
                // Insert pairs between some text to simulate a typical usage scenario.
                { 
                    kind:    'textEdit',  
                    replace: { start: [0, 0], end: [0, 0] }, 
                    insert:  ALICE_TEXT_1 + '\n\n' + ALICE_TEXT_2  
                },
                { kind: 'setCursors',  cursors: [ [6, 71] ] },
                { kind: 'insertPair',  repeat:  10          },
                { 
                    kind: 'assertPairs', 
                    pairs: [
                        [
                            { open: [6, 71], close: [6, 90] },
                            { open: [6, 72], close: [6, 89] },
                            { open: [6, 73], close: [6, 88] },
                            { open: [6, 74], close: [6, 87] },
                            { open: [6, 75], close: [6, 86] },
                            { open: [6, 76], close: [6, 85] },
                            { open: [6, 77], close: [6, 84] },
                            { open: [6, 78], close: [6, 83] },
                            { open: [6, 79], close: [6, 82] },
                            { open: [6, 80], close: [6, 81] },
                        ]
                    ] 
                },
                { kind: 'assertCursors', cursors: [ [6, 81] ] }
            ]
        },
        actions: [
            { kind: 'leap' },
            ...([
                { open: [6, 71], close: [6, 90] },
                { open: [6, 72], close: [6, 89] },
                { open: [6, 73], close: [6, 88] },
                { open: [6, 74], close: [6, 87] },
                { open: [6, 75], close: [6, 86] },
                { open: [6, 76], close: [6, 85] },
                { open: [6, 77], close: [6, 84] },
                { open: [6, 78], close: [6, 83] },
                { open: [6, 79], close: [6, 82] },
                { open: [6, 80], close: [6, 81] },
            ] as CompactPair[]).map((pair, i, arr): Action[] => [
                { kind: 'leap'                                                            },
                { kind: 'assertPairs',   pairs:   [ arr.slice(0, i) ]                     },
                { kind: 'assertCursors', cursors: [ [pair.close[0], pair.close[1] + 1 ] ] }
            ]).reverse().flat()
        ]
    },
    {
        name: 'Consecutive Leaps Across Whitespace',
        prelude: {
            description: 'Insert 6 pairs with whitespace in between',
            actions: [
                // Insert pairs after some text to simulate a typical usage scenario.
                { kind: 'typeText', text: 'some text\n\nfunction ' },
                { 
                    kind: 'composite',
                    actions: [
                        { kind: 'insertPair'                                },
                        { kind: 'typeText',    text:      '     '           },
                        { kind: 'moveCursors', direction: 'left', repeat: 5 }
                    ],
                    repeat: 6
                },
                { 
                    kind: 'assertPairs', 
                    pairs: [
                        [
                            { open: [2,  9], close: [2, 50] },
                            { open: [2, 10], close: [2, 44] },
                            { open: [2, 11], close: [2, 38] },
                            { open: [2, 12], close: [2, 32] },
                            { open: [2, 13], close: [2, 26] },
                            { open: [2, 14], close: [2, 20] },
                        ]
                    ]
                },
                { kind: 'assertCursors', cursors: [ [2, 15] ] }
            ], 
        },
        actions: [
            { kind: 'leap' },
            ...([
                { open: [2,  9], close: [2, 50] },
                { open: [2, 10], close: [2, 44] },
                { open: [2, 11], close: [2, 38] },
                { open: [2, 12], close: [2, 32] },
                { open: [2, 13], close: [2, 26] },
                { open: [2, 14], close: [2, 20] },
            ] as CompactPair[]).map((pair, i, arr): Action[] => [
                { kind: 'leap'                                                           },
                { kind: 'assertPairs',   pairs:   [ arr.slice(0, i) ]                    },
                { kind: 'assertCursors', cursors: [ [pair.close[0], pair.close[1] + 1] ] }
            ]).reverse().flat()
        ]
    },
    {
        name: 'Leap Call Ignored When No Pairs',
        prelude: {
            description: 'Insert some text without pairs',
            actions: [
                { kind: 'typeText',      text:    ALICE_TEXT_2 },
                { kind: 'setCursors',    cursors: [ [2, 11] ]  },
                { kind: 'assertPairs',   pairs:   [ [] ]       },
                { kind: 'assertCursors', cursors: [ [2, 11] ]  }
            ]
        },
        actions: [
            // First leap a bunch of times and check that the cursor has not moved at all.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap'                                },
                    { kind: 'assertPairs',   pairs:   [ [] ]      },
                    { kind: 'assertCursors', cursors: [ [2, 11] ] }
                ], 
                repeat: 10
            },
            // Then insert 5 pairs and leap out of all of them.
            { kind: 'insertPair',  repeat: 5 },
            { 
                kind: 'assertPairs', 
                pairs: [
                    [
                        { open: [2, 11], close: [2, 20] },
                        { open: [2, 12], close: [2, 19] },
                        { open: [2, 13], close: [2, 18] },
                        { open: [2, 14], close: [2, 17] },
                        { open: [2, 15], close: [2, 16] }
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [2, 16] ] },
            { kind: 'leap',          repeat:  5           },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [2, 21] ] },
            // Check that future leap calls do not move the cursor at all.
            { kind: 'leap',          repeat:  10          },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [2, 21] ] }
        ]
    },
    {
        name: 'Leap Call Ignored When No Line of Sight',
        prelude: {
            description: 'Insert some pairs with text in between',
            actions: [
                // Insert some random text so simulate a typical usage scenario.
                { kind: 'typeText',    text:      ALICE_TEXT_2  },
                { kind: 'setCursors',  cursors:   [ [ 2, 11 ] ] },
                // Insert `{ {Hello {Typescript} is} Awesome }` into the text.
                { kind: 'insertPair'                                 },
                { kind: 'typeText',    text:      '  Awesome '       },
                { kind: 'moveCursors', direction: 'left', repeat: 9  },
                { kind: 'insertPair'                                 },
                { kind: 'typeText',    text:      'Hello  is'        },
                { kind: 'moveCursors', direction: 'left', repeat: 3  },
                { kind: 'insertPair'                                 },
                { kind: 'typeText',    text:      'Typescript'       },
                { kind: 'moveCursors', direction: 'left', repeat: 10 },
                { 
                    kind: 'assertPairs',
                    pairs: [
                        [
                            { open: [2, 12], close: [2, 46] },
                            { open: [2, 14], close: [2, 36] },
                            { open: [2, 21], close: [2, 32] },
                        ]
                    ]
                },
                { kind: 'assertCursors', cursors: [ [2, 22] ] }
            ]
        },
        actions: [
            // First leap a few times and check that the cursor has not moved at all.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap' },
                    { 
                        kind: 'assertPairs',
                        pairs: [
                            [
                                { open: [2, 12], close: [2, 46] },
                                { open: [2, 14], close: [2, 36] },
                                { open: [2, 21], close: [2, 32] },
                            ]
                        ]
                    },
                    { kind: 'assertCursors', cursors: [ [2, 22] ] }
                ],
                repeat: 5
            },
            // Move past the 'Typescript' obstacle and check that leap is still possible.
            { kind: 'moveCursors', direction: 'right', repeat: 10 },
            { kind: 'leap'                                        },
            { 
                kind: 'assertPairs',
                pairs: [
                    [
                        { open: [2, 12], close: [2, 46] },
                        { open: [2, 14], close: [2, 36] },
                    ]
                ]
            },
            { kind: 'assertCursors', cursors: [ [2, 33] ] },
            // Check that leap is not possible due to the ' is' obstacle.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap' },
                    { 
                        kind: 'assertPairs',
                        pairs: [
                            [
                                { open: [2, 12], close: [2, 46] },
                                { open: [2, 14], close: [2, 36] },
                            ]
                        ]
                    },
                    { kind: 'assertCursors', cursors: [ [2, 33] ] }
                ],
                repeat: 5
            },
            // Move past the ' is' obstacle and check that leap is still possible.
            { kind: 'moveCursors',   direction: 'right', repeat: 3                        },
            { kind: 'leap'                                                                },
            { kind: 'assertPairs',   pairs:     [ [ { open: [2, 12], close: [2, 46] } ] ] },
            { kind: 'assertCursors', cursors:   [ [2, 37] ]                               },
            // Check that leap is not possible due to the ' Awesome ' obstacle.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap'                                                              },
                    { kind: 'assertPairs',   pairs:   [ [ { open: [2, 12], close: [2, 46] } ] ] },
                    { kind: 'assertCursors', cursors: [ [2, 37] ]                               },
                ],
                repeat: 5
            },
            // Move to the end of ' Awesome' and make the final leap.
            { kind: 'moveCursors',   direction: 'right', repeat: 8 },
            { kind: 'leap'                                         },
            { kind: 'assertPairs',   pairs:      [ [] ]            },
            { kind: 'assertCursors', cursors:    [ [2, 47] ]       },
        ]
    },
];

/** 
 * This test group tests the extension's 'Leap' command.
 *
 * Unless mentioned otherwise in the test description, the 'Leap' command is called by firing a 
 * `leaper.leap` command.  Direct command calls like these do not test the keybindings.
 */
export const SINGLE_CURSOR_LEAP_TEST_GROUP: TestGroup = {
    name: 'Leap (Single Cursor)',
    testCases: TEST_CASES
};