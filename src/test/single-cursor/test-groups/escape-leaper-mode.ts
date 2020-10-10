import { TestCase, TestGroup } from '../../framework/framework';
import { range } from '../../framework/utilities';
import { ALICE_TEXT_1 } from '../../framework/placeholder-texts';

export const SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP = new TestGroup({
    name: 'Escape Leaper Mode Command',
    testCases: [

        // Test the 'Escape Leaper Mode' command.
        //
        // Note that the command is directly called instead of being triggered by a keypress. The 
        // keybinding (and its 'when' context) are not being tested here.
        new TestCase({
            name: 'Command Works',
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
        })
    ]
});
