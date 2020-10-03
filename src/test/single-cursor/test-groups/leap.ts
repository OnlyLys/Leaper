import { TestCase, TestGroup, Action, } from '../../utilities/typedefs';
import { range } from '../../utilities/other';
import { ALICE_TEXT_1, ALICE_TEXT_2, } from '../../utilities/placeholder-texts';

// TODO: Test Case: Holding `Tab` down OK (Multiple content changes per loop)

const TEST_CASES: TestCase[] = [
    {
        name: 'Single Leap',
        prelude: {
            description: 'Insert single pair',
            actions: [
                { kind: 'insertPair'                                             },
                { kind: 'assertPairs',   pairs:   [ { line: 0, sides: [0, 1] } ] },
                { kind: 'assertCursors', cursors: [ [0, 1] ]                     },
            ]
        },
        actions: [
            { kind: 'leap'                                                 }, 
            { kind: 'assertPairs',    pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors' , cursors: [ [0, 2] ]                  },
        ]
    },
    {
        name: 'Single Leap Across Whitespace',
        prelude: {
            description: 'Insert single pair with whitespace in between',
            actions: [
                { kind: 'insertPair'                                               },
                { kind: 'typeText',      text:      '     '                        },
                { kind: 'moveCursors',   direction: 'left', repetitions: 5         },
                { kind: 'assertPairs',   pairs:     [ { line: 0, sides: [0, 6] } ] },
                { kind: 'assertCursors', cursors:   [ [0, 1] ]                     },
            ]
        },
        actions: [
            { kind: 'leap'                                                },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [0, 7] ]                  },
        ]
    },
    {
        name: 'Consecutive Leaps',
        prelude: {
            description: 'Insert 10 pairs',
            actions: [
                { 
                    kind:     'insertText',    
                    position: [0, 0], 
                    text:     ALICE_TEXT_1 + '\n\n' + ALICE_TEXT_2 
                },

                // Insert pairs between some text to simulate a typical usage scenario.
                { kind: 'setCursors',    cursors:     [ [6, 71] ]                           },
                { kind: 'insertPair',    repetitions: 10                                    },
                { kind: 'assertPairs',   pairs:       [ { line: 6, sides: range(71, 91) } ] },
                { kind: 'assertCursors', cursors:     [ [6, 81] ]                           },
            ]
        },
        actions: [
            { kind: 'leap' },
            ...([
                { open: 71, close: 90 },
                { open: 72, close: 89 },
                { open: 73, close: 88 },
                { open: 74, close: 87 },
                { open: 75, close: 86 },
                { open: 76, close: 85 },
                { open: 77, close: 84 },
                { open: 78, close: 83 },
                { open: 79, close: 82 },
                { open: 80, close: 81 },
            ]).map((pair, i, arr): Action[] => [
                { kind: 'leap' },
                { 
                    kind: 'assertPairs',   
                    pairs: [ 
                        {
                            line: 1, 
                            sides: [
                                ...arr.slice(0, i).map(pair => pair.open), 
                                ...arr.slice(i).map(pair => pair.close).reverse()
                            ]
                        }
                    ]
                },
                { kind: 'assertCursors', cursors: [ [1, pair.close + 1] ] }
            ]).reverse().flat()
        ]
    },
    {
        name: 'Consecutive Leaps Across Whitespace',
        prelude: {
            description: 'Insert 6 pairs with whitespace in between',
            actions: [
                { kind: 'typeText', text: 'some text\n\nfunction ' },

                // Insert pairs after some text to simulate a typical usage scenario.
                { 
                    kind: 'composite',
                    actions: [
                        { kind: 'insertPair'                                     },
                        { kind: 'typeText',    text:      '     '                },
                        { kind: 'moveCursors', direction: 'left', repetitions: 5 },
                    ],
                    repetitions: 6
                },
                { 
                    kind:  'assertPairs', 
                    pairs: [ { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] } ]
                },
                { kind: 'assertCursors', cursors: [ [2, 15] ] }
            ], 
        },
        actions: [
            { kind: 'leap' },
            ...([
                { open:  9, close: 50 },
                { open: 10, close: 44 },
                { open: 11, close: 38 },
                { open: 12, close: 32 },
                { open: 13, close: 26 },
                { open: 14, close: 20 },
            ]).map((pair, i, arr): Action[] => [
                { kind: 'leap' },
                { 
                    kind: 'assertPairs',   
                    pairs: [ 
                        {
                            line: 1, 
                            sides: [
                                ...arr.slice(0, i).map(pair => pair.open), 
                                ...arr.slice(i).map(pair => pair.close).reverse()
                            ]
                        }
                    ]
                },
                { kind: 'assertCursors', cursors: [ [1, pair.close + 1] ] }
            ]).reverse().flat()
        ]
    },
    {
        name: 'Leap Call Ignored When No Pairs',
        prelude: {
            description: 'Insert some text without pairs',
            actions: [
                { kind: 'typeText',      text:    ALICE_TEXT_2                },
                { kind: 'setCursors',    cursors: [ [2, 11] ]                 },
                { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
                { kind: 'assertCursors', cursors: [ [2, 11] ]                 },
            ]
        },
        actions: [

            // Leap a bunch of times when there are no pairs and check that the cursor has not moved.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap'                                                },
                    { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
                    { kind: 'assertCursors', cursors: [ [2, 11] ]                 },
                ], 
                repetitions: 10
            },

            // Now insert 5 pairs.
            { kind: 'insertPair',    repetitions: 5                                    },
            { kind: 'assertPairs',   pairs:      [ { line: 2, sides: range(11, 21) } ] },
            { kind: 'assertCursors', cursors:    [ [2, 16] ]                           },

            // Leap out of all of the inserted pairs.
            { kind: 'leap',          repetitions:  5                           },
            { kind: 'assertPairs',   pairs:        [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:      [ [2, 21] ]                 },

            // After leaping, check that future leap calls do not move the cursor at all.
            { kind: 'leap',          repetitions:  10                          },
            { kind: 'assertPairs',   pairs:        [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:      [ [2, 21] ]                 },
        ]
    },
    {
        name: 'Leap Call Ignored When No Line of Sight',
        prelude: {
            description: 'Insert some pairs with text in between',
            actions: [

                // Insert some random text to simulate a typical usage scenario.
                { kind: 'typeText',    text:    ALICE_TEXT_2  },
                { kind: 'setCursors',  cursors: [ [ 2, 11 ] ] },

                // Insert `{ {Hello {Typescript} is} Awesome }` into the text.
                { kind: 'insertPair'                                                                 },
                { kind: 'typeText',      text:      '  Awesome '                                     },
                { kind: 'moveCursors',   direction: 'left', repetitions: 9                           },
                { kind: 'insertPair'                                                                 },
                { kind: 'typeText',      text:      'Hello  is'                                      },
                { kind: 'moveCursors',   direction: 'left', repetitions: 3                           },
                { kind: 'insertPair'                                                                 },
                { kind: 'typeText',      text:      'Typescript'                                     },
                { kind: 'moveCursors',   direction: 'left', repetitions: 10                          },
                { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [12, 14, 21, 32, 36, 46] } ] },
                { kind: 'assertCursors', cursors:   [ [2, 22] ]                                      },
            ]
        },
        actions: [

            // First leap a few times and check that the cursor has not moved at all.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap'                                                                     },
                    { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [12, 14, 21, 32, 36, 46] } ] },
                    { kind: 'assertCursors', cursors: [ [2, 22] ]                                      },
                ],
                repetitions: 5
            },

            // Move past the 'Typescript' obstacle and check that leaping is now possible.
            { kind: 'moveCursors',   direction: 'right', repetitions: 10                 },
            { kind: 'leap'                                                               },
            { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [12, 14, 36, 46] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 33] ]                              },

            // Check that leaping is now not possible due to the ' is' obstacle.
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap'                                                             },
                    { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [12, 14, 36, 46] } ] },
                    { kind: 'assertCursors', cursors: [ [2, 33] ]                              },
                ],
                repetitions: 5
            },

            // Move past the ' is' obstacle and check that leaping is now possible.
            { kind: 'moveCursors',   direction: 'right', repetitions: 3          },
            { kind: 'leap'                                                       },
            { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [12, 46] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 37] ]                      },

            // Check that leaping is now not possible due to the ' Awesome ' obstacle.zz
            {
                kind: 'composite',
                actions: [
                    { kind: 'leap'                                                       },
                    { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [12, 46] } ] },
                    { kind: 'assertCursors', cursors:   [ [2, 37] ]                      },
                ],
                repetitions: 5
            },

            // Move to the end of ' Awesome' and make the final leap.
            { kind: 'moveCursors',   direction: 'right', repetitions: 8     },
            { kind: 'leap'                                                  },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 47] ]                 },
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