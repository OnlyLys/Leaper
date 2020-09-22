import { TestGroup } from '../../typedefs';
import { ALICE_TEXT_1, range } from '../../utilities';

/**
 * This test group tests the extension's 'Escape Leaper Mode' command.
 * 
 * Here the 'Escape Leaper Mode' command is directly called. Its keybinding is not being tested.
 */
export const SINGLE_CURSOR_ESCAPE_LEAPER_MODE_TEST_GROUP: TestGroup = {
    name: 'Escape Leaper Mode (Single Cursor)',
    testCases: [
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
    ]
};
