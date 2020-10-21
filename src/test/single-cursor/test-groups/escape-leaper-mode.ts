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
            prelude: async (executor) => {
                
                // Insert pairs between some text to simulate a typical usage scenario.
                await executor.typeText({ text: ALICE_TEXT_1 });
                await executor.moveCursors({ direction: 'up' });
                await executor.moveCursors({ direction: 'left', repetitions: 10 });
                await executor.typePair({ repetitions: 10 });
                executor.assertPairs([ { line: 5, sides: range(79, 99) } ]);
                executor.assertCursors([ [5, 89] ]);
            },
            action: async (executor) => {

                // Jump out of one pair first, just to simulate a more 'realistic' scenario.
                await executor.leap();

                // This should remove all pairs from being tracked.
                await executor.escapeLeaperMode();
                executor.assertPairs([ { line: -1, sides: [] } ]);
                executor.assertCursors([ [5, 90] ]);
            }
        }),

        // Check if the 'Escape Leaper Mode' command can handle being called multiple times in one
        // event loop cycle.
        //
        // Such a scenario could occur when the user presses and holds down the keybinding for the
        // command.
        new TestCase({
            name: 'Can Handle Being Rapidly Called',
            prelude: async (executor) => {

                // Type the following text into the editor:
                //
                // ```
                // function main() {
                //     function inner() {
                //         return [ { a: { b: []}}]
                //     }                       ^(cursor position)
                // }
                // ```
                await executor.typeText({ 
                    text: 'function main() {\n'
                        +     'function inner() {\n'
                        +         'return [ { a: { b: ['
                });
                executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 28, 29, 30, 31] } ]);
                executor.assertCursors([ [2, 28] ]);
            },
            action: async (executor) => {

                // This should remove all pairs from being tracked and do nothing else.
                await executor.escapeLeaperMode({ delay: 0, repetitions: 50 }); 
                executor.assertPairs([ { line: -1, sides: [] } ]);
                executor.assertCursors([ [2, 28] ]);
            }
        })
    ]
});
