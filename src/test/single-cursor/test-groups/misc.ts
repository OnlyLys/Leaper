import { TestCase, TestGroup } from '../../utilities/executor';
import { range } from '../../utilities/other';
import { ALICE_TEXT_1 } from '../../utilities/placeholder-texts';

const TEST_CASES: TestCase[] = [

    // Test the 'Escape Leaper Mode' command.
    //
    // Note that the command is directly called instead of being triggered by a keypress. 
    {
        name: 'Escape Leaper Mode',
        prelude: {
            description: 'Insert 10 pairs',
            actions: [
                // Insert pairs between some text to simulate a typical usage scenario.
                { kind: 'typeText',      text:        ALICE_TEXT_1                          },
                { kind: 'moveCursors',   direction:   'up'                                  },
                { kind: 'moveCursors',   direction:   'left', repetitions: 10               },
                { kind: 'insertPair',    repetitions: 10                                    },
                { kind: 'assertPairs',   pairs:       [ { line: 5, sides: range(79, 90) } ] },
                { kind: 'assertCursors', cursors:     [ [5, 89] ]                           },
            ]
        },
        actions: [

            // Jump out of one pair first, just to simulate a more 'random' scenario.
            { kind: 'leap' },

            // This should remove all pairs from being tracked.
            { kind: 'escapeLeaperMode'                                     },
            { kind: 'assertPairs',    pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors',  cursors: [ [5, 90] ]                 }
        ]
    },
    
];

/**
 * This test group contains an assortment of test cases that are not big enough to require their own 
 * module. 
 */
export const SINGLE_CURSOR_MISC_TEST_GROUP: TestGroup = {
    name: 'Miscellaneous Tests (Single Cursor)',
    testCases: TEST_CASES
};
