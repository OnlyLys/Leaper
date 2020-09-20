import { TestGroup } from '../../typedefs';
import { ALICE_TEXT_1 } from '../../utilities';

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
                    { kind: 'typeText',    text: ALICE_TEXT_1                 },
                    { kind: 'moveCursors', direction: 'up'                    },
                    { kind: 'moveCursors', direction: 'left', repetitions: 10 },
                    { kind: 'insertPair',  repetitions: 10                    },
                    { 
                        kind: 'assertPairs', 
                        pairs: [[
                            { open: [5, 79], close: [5, 98] },
                            { open: [5, 80], close: [5, 97] },
                            { open: [5, 81], close: [5, 96] },
                            { open: [5, 82], close: [5, 95] },
                            { open: [5, 83], close: [5, 94] },
                            { open: [5, 84], close: [5, 93] },
                            { open: [5, 85], close: [5, 92] },
                            { open: [5, 86], close: [5, 91] },
                            { open: [5, 87], close: [5, 90] },
                            { open: [5, 88], close: [5, 89] },
                        ]]
                    },
                    { kind: 'assertCursors', cursors: [ [5, 89] ] }
                ]
            },
            actions: [
                // Jump out of one pair first, just to simulate a more 'random' scenario.
                { kind: 'leap'                                 },
                { kind: 'escapeLeaperMode'                     },
                { kind: 'assertPairs',    pairs:   [ [] ]      },
                { kind: 'assertCursors',  cursors: [ [5, 90] ] }
            ]
        },
    ]
};
