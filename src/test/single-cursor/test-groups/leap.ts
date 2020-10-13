import { TestCase, TestGroup } from '../../framework/framework';
import { range } from '../../framework/utilities';
import { ALICE_TEXT_1, ALICE_TEXT_2, } from '../../framework/placeholder-texts';

// TODO: Test Case: Holding `Tab` down OK (Multiple content changes per loop)

const TEST_CASES: TestCase[] = [
    new TestCase({
        name: 'Single Leap',
        prelude: async (context) => {
            await context.typePair();
            context.assertPairsPrelude([ { line: 0, sides: [0, 1] } ]);
            context.assertCursorsPrelude([ [0, 1] ]);
        },
        action: async (context) => {
            await context.leap();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [0, 2] ]);
        }
    }),
    new TestCase({
        name: 'Single Leap Across Whitespace',
        prelude: async (context) => { 
            await context.typePair();
            await context.typeText({ text: '     ' });
            await context.moveCursors({ direction: 'left', repetitions: 5 });
            context.assertPairsPrelude([ { line: 0, sides: [0, 6] } ]);
            context.assertCursorsPrelude([ [0, 1] ]);
        },
        action: async (context) => { 
            await context.leap();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [0, 7] ]);
        }
    }),
    new TestCase({
        name: 'Consecutive Leaps',
        prelude: async (context) => { 

            // Insert pairs between some text to simulate a typical usage scenario.
            await context.editText({
                edits: [
                    { kind: 'insert', position: [0, 0], text: ALICE_TEXT_1 + '\n\n' + ALICE_TEXT_2 }
                ]
            });
            await context.setCursors({ cursors: [ [6, 71] ] });
            await context.typePair({ repetitions: 10 });
            context.assertPairsPrelude([ { line: 6, sides: range(71, 91) } ]);
            context.assertCursorsPrelude([ [6, 81] ]);
        },
        action: async (context) => { 
            const cluster = { line: 6, sides: range(71, 91) };
            while (cluster.sides.length > 0) {
                await context.leap();
                context.assertCursors([ [6, cluster.sides[cluster.sides.length / 2] + 1] ]);
                cluster.sides = [
                    ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                    ...cluster.sides.slice((cluster.sides.length / 2) + 1),
                ];
                context.assertPairs([ cluster ]);
            }
        }
    }),
    new TestCase({
        name: 'Consecutive Leaps Across Whitespace',
        prelude: async (context) => { 

            // Insert pairs after some text to simulate a typical usage scenario.
            await context.typeText({ text: 'some text\n\nfunction ' });
            for (let i = 0; i < 6; ++i) {
                await context.typePair();
                await context.typeText({ text: '     ' });
                await context.moveCursors({ direction: 'left', repetitions: 5 });
            }
            context.assertPairsPrelude(
                [ { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] } ],
            );
            context.assertCursorsPrelude([ [2, 15] ]);
        },
        action: async (context) => { 
            const cluster = { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] };
            while (cluster.sides.length > 0) {
                await context.leap();
                context.assertCursors([ [2, cluster.sides[cluster.sides.length / 2] + 1] ]);
                cluster.sides = [
                    ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                    ...cluster.sides.slice((cluster.sides.length / 2) + 1),
                ];
                context.assertPairs([ cluster ]);
            }
        }
    }),
    new TestCase({
        name: 'Leap Call Ignored When No Pairs',
        editorLanguageId: 'markdown',
        prelude: async (context) => { 
            await context.typeText({ text: ALICE_TEXT_2  });
            await context.setCursors({ cursors: [ [2, 11] ] });
            context.assertPairsPrelude([ { line: -1, sides: [] } ]);
            context.assertCursorsPrelude([ [2, 11] ]);  
        },
        action: async (context) => { 

            // Leap a bunch of times when there are no pairs and check that the cursor has not moved.
            for (let i = 0; i < 10; ++i) {
                await context.leap();
                context.assertPairs([ { line: -1, sides: [] } ]);
                context.assertCursors([ [2, 11] ]);
            }

            // Now insert 5 pairs.
            await context.typePair({ repetitions: 5 });
            context.assertPairs([ { line: 2, sides: range(11, 21) } ]);
            context.assertCursors([ [2, 16] ]);

            // Leap out of all of the inserted pairs.
            await context.leap({ repetitions: 5 });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [2, 21] ]);

            // After leaping, check that future leap calls do not move the cursor at all.
            for (let i = 0; i < 10; ++i) {
                await context.leap();
                context.assertPairs([ { line: -1, sides: [] } ]);
                context.assertCursors([ [2, 21] ]);
            }
        }
    }),
    new TestCase({
        name: 'Leap Call Ignored When No Line of Sight',
        editorLanguageId: 'markdown',
        prelude: async (context) => { 

            // Insert some random text to simulate a typical usage scenario.
            await context.typeText({ text: ALICE_TEXT_2 });
            await context.setCursors({ cursors: [ [2, 11] ] });

            // Insert `{ { Hello { Markdown } is } Awesome }` into the text.
            await context.typeText({ text: ' {  Awesome ' });
            await context.moveCursors({ direction: 'left', repetitions: 9 });
            await context.typeText({ text: '{ Hello  is ' });
            await context.moveCursors({ direction: 'left', repetitions: 4 });
            await context.typeText({ text: '{ Markdown ' });
            await context.moveCursors({ direction: 'left', repetitions: 10 });
            context.assertPairsPrelude([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
            context.assertCursorsPrelude([ [2, 23] ]);
        },
        action: async (context) => { 

            // First leap a few times and check that the cursor has not moved at all.
            //
            // Leaping is not possible due to the ' Markdown ' obstalce.
            for (let i = 0; i < 5; ++i) {
                await context.leap();
                context.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
                context.assertCursors([ [2, 23] ]);
            }

            // Move past the ' Markdown ' obstacle.
            await context.moveCursors({ direction: 'right', repetitions: 10 });
            context.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
            context.assertCursors([ [2, 33] ]);

            // Check that leaping is now possible.
            await context.leap();
            context.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
            context.assertCursors([ [2, 34] ]);

            // After leaping, check that leaping is not possible due to the ' is ' obstacle.
            for (let i = 0; i < 5; ++i) {
                await context.leap();
                context.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
                context.assertCursors([ [2, 34] ]);
            }

            // Move past the ' is ' obstacle.
            await context.moveCursors({ direction: 'right', repetitions: 4 });
            context.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
            context.assertCursors([ [2, 38] ]);

            // Check that leaping is now possible.
            await context.leap();
            context.assertPairs([ { line: 2, sides: [12, 48] } ]);
            context.assertCursors([ [2, 39] ]);

            // After leaping, check that leaping is not possible due to the ' Awesome ' obstacle.
            for (let i = 0; i < 5; ++i) {
                await context.leap();
                context.assertPairs([ { line: 2, sides: [12, 48] } ]);
                context.assertCursors([ [2, 39] ]);
            }

            // Move past the ' Awesome ' obstacle.
            await context.moveCursors({ direction: 'right', repetitions: 9 });
            context.assertPairs([ { line: 2, sides: [12, 48] } ]);
            context.assertCursors([ [2, 48] ]);

            // Perform the final leap.
            await context.leap();
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [2, 49] ]);
        }
    }),

    // Let's say the user created a new keybinding for the 'Leap' command that does not take into 
    // consideration the `leaper.hasLineOfSight` or `leaper.inLeaperMode` keybinding contexts, and 
    // managed to hold down said keybinding for a while. That will cause many calls of the 'Leap' 
    // command to occur in a short span of time.
    //
    // This test case tests whether the extension can handle such a situation.
    new TestCase({
        name: 'Can Handle Being Rapidly Called',
        prelude: async (context) => {

            // Initialize the editor to the following state:
            //
            // ```
            // function main() {
            //     function inner() {
            //         return [ { a: { b: [ 100 ]}}]
            //     }                        ^(cursor position)
            // }
            // ```
            await context.typeText({ 
                text: 'function main() {\n'
                    +     'function inner() {\n'
                    +         'return [ { a: { b: [ 100 '
            });
            await context.moveCursors({ direction: 'left', repetitions: 4 });
            context.assertPairsPrelude([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
            context.assertCursorsPrelude([ [2, 29] ]);
        },
        action: async (context) => {

            // Since there is an obstacle at where the cursor is at, a leap should not occur.
            await context.leap({ delay: 0, repetitions: 50 });
            context.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
            context.assertCursors([ [2, 29] ]);

            // Move past the '100' obstacle.
            await context.moveCursors({ direction: 'right', repetitions: 3 });
            context.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
            context.assertCursors([ [2, 32] ]);

            // Rapidly calling the 'Leap' command here should cause the cursor to leap out of all
            // the pairs, and do nothing else after that.
            await context.leap({ delay: 0, repetitions: 50 });
            context.assertPairs([ { line: -1, sides: [] } ]);
            context.assertCursors([ [2, 37] ]);
        }
    })
];

/** 
 * This test group tests the extension's 'Leap' command.
 *
 * Unless mentioned otherwise in the test description, the 'Leap' command is called by firing a 
 * `leaper.leap` command.  Direct command calls like these do not test the keybindings.
 */
export const SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP: TestGroup = new TestGroup({
    name: 'Leap Command',
    testCases: TEST_CASES
});
