import { TestCase, TestGroup } from '../../framework/framework';
import { range } from '../../framework/utilities';
import { ALICE_TEXT_1 } from '../../framework/placeholder-texts';

const TEST_CASES: TestCase[] = [

    // Test the 'Escape Leaper Mode' command.
    //
    // Note that the command is directly called instead of being triggered by a keypress. In other
    // words, the keybinding (and its 'when' context) are not being tested here.
    new TestCase({
        name: 'Escape Leaper Mode',
        editorLanguageId: 'markdown',
        prelude: async (context) => {
            
            // Insert pairs between some text to simulate a typical usage scenario.
            await context.typeText({ text: ALICE_TEXT_1 });
            await context.moveCursors({ direction: 'up' });
            await context.moveCursors({ direction: 'left', repetitions: 10 });
            await context.typePair({ repetitions: 10 });
            context.assertPairsPrelude([ { line: 5, sides: range(79, 99) } ]);
            context.assertCursorsPrelude([ [5, 89] ]);
        },
        action: async (context) => {

            // Jump out of one pair first, just to simulate a more 'realistic' scenario.
            await context.leap();

            // This should remove all pairs from being tracked.
            await context.escapeLeaperMode();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [5, 90] ]);
        }
    }),
    
];

/**
 * This test group contains an assortment of test cases that are not big enough to require their own 
 * module. 
 */
export const SINGLE_CURSOR_MISC_TEST_GROUP = new TestGroup({
    name: 'Miscellaneous',
    testCases: TEST_CASES
});
