import { TestCase, TestGroup } from '../../utilities/framework';
import { range } from '../../utilities/other';
import { ALICE_TEXT_1, ALICE_TEXT_2, } from '../../utilities/placeholder-texts';

const TEST_CASES: TestCase[] = [
    new TestCase({
        name: 'Single Leap',
        prelude: async (executor) => {
            await executor.typePair();
            executor.assertPairs({   expect: [ { line: 0, sides: [0, 1] } ] });
            executor.assertCursors({ expect: [ [0, 1] ]                     });
        },
        task: async (executor) => {
            await executor.leap();
            executor.assertPairs({   expect: [ 'None' ] });
            executor.assertCursors({ expect: [ [0, 2] ] });
        }
    }),
    new TestCase({
        name: 'Single Leap Across Whitespace',
        prelude: async (executor) => { 
            await executor.typePair();
            await executor.typeText({ text: '     ' });
            await executor.moveCursors({ direction: 'left', repetitions: 5 });
            executor.assertPairs({   expect: [ { line: 0, sides: [0, 6] } ] });
            executor.assertCursors({ expect: [ [0, 1] ]                     });
        },
        task: async (executor) => { 
            await executor.leap();
            executor.assertPairs({   expect: [ 'None' ] });
            executor.assertCursors({ expect: [ [0, 7] ] });
        }
    }),
    new TestCase({
        name: 'Consecutive Leaps',
        prelude: async (executor) => { 

            // Insert pairs between some text to simulate a typical usage scenario.
            await executor.editText({
                edits: [
                    { kind: 'insert', at: [0, 0], text: ALICE_TEXT_1 + '\n\n' + ALICE_TEXT_2 }
                ]
            });
            await executor.setCursors({ to: [ [6, 71] ] });
            await executor.typePair({ repetitions: 10 });
            executor.assertPairs({   expect: [ { line: 6, sides: range(71, 91) } ] });
            executor.assertCursors({ expect: [ [6, 81] ]                           });
        },
        task: async (executor) => { 
            const cluster = { line: 6, sides: range(71, 91) };
            while (cluster.sides.length > 0) {
                await executor.leap();
                executor.assertCursors({ expect: [ [6, cluster.sides[cluster.sides.length / 2] + 1] ] });
                cluster.sides = [
                    ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                    ...cluster.sides.slice((cluster.sides.length / 2) + 1),
                ];
                executor.assertPairs({ expect: [ cluster ] });
            }
        }
    }),
    new TestCase({
        name: 'Consecutive Leaps Across Whitespace',
        prelude: async (executor) => { 

            // Insert pairs after some text to simulate a typical usage scenario.
            await executor.typeText({ text: 'some text\n\nfunction ' });
            for (let i = 0; i < 6; ++i) {
                await executor.typePair();
                await executor.typeText({ text: '     ' });
                await executor.moveCursors({ direction: 'left', repetitions: 5 });
            }
            executor.assertPairs({ 
                expect: [ 
                    { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] } 
                ] 
            });
            executor.assertCursors({ expect: [ [2, 15] ] });
        },
        task: async (executor) => { 
            const cluster = { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] };
            while (cluster.sides.length > 0) {
                await executor.leap();
                executor.assertCursors({ expect: [ [2, cluster.sides[cluster.sides.length / 2] + 1] ] });
                cluster.sides = [
                    ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                    ...cluster.sides.slice((cluster.sides.length / 2) + 1),
                ];
                executor.assertPairs({ expect: [ cluster ] });
            }
        }
    }),
    new TestCase({
        name: 'Leap Call Ignored When No Pairs',
        editorLanguageId: 'markdown',
        prelude: async (executor) => { 
            await executor.typeText({ text: ALICE_TEXT_2  });
            await executor.setCursors({ to: [ [2, 11] ] });
            executor.assertPairs({   expect: [ 'None' ]  });
            executor.assertCursors({ expect: [ [2, 11] ] });  
        },
        task: async (executor) => { 

            // Leap a bunch of times when there are no pairs and check that the cursor has not moved.
            for (let i = 0; i < 10; ++i) {
                await executor.leap();
                executor.assertPairs({   expect: [ 'None' ]  });
                executor.assertCursors({ expect: [ [2, 11] ] });
            }

            // Now insert 5 pairs.
            await executor.typePair({ repetitions: 5 });
            executor.assertPairs({   expect: [ { line: 2, sides: range(11, 21) } ] });
            executor.assertCursors({ expect: [ [2, 16] ]                           });

            // Leap out of all of the inserted pairs.
            await executor.leap({ repetitions: 5 });
            executor.assertPairs({   expect: [ 'None' ]  });
            executor.assertCursors({ expect: [ [2, 21] ] });

            // After leaping, check that future leap calls do not move the cursor at all.
            for (let i = 0; i < 10; ++i) {
                await executor.leap();
                executor.assertPairs({   expect: [ 'None' ]  });
                executor.assertCursors({ expect: [ [2, 21] ] });
            }
        }
    }),
    new TestCase({
        name: 'Leap Call Ignored When No Line of Sight',
        editorLanguageId: 'markdown',
        prelude: async (executor) => { 

            // Insert some random text to simulate a typical usage scenario.
            await executor.typeText({ text: ALICE_TEXT_2 });
            await executor.setCursors({ to: [ [2, 11] ] });

            // Insert `{ { Hello { Markdown } is } Awesome }` into the text.
            await executor.typeText({ text: ' {  Awesome ' });
            await executor.moveCursors({ direction: 'left', repetitions: 9 });
            await executor.typeText({ text: '{ Hello  is ' });
            await executor.moveCursors({ direction: 'left', repetitions: 4 });
            await executor.typeText({ text: '{ Markdown ' });
            await executor.moveCursors({ direction: 'left', repetitions: 10 });
            executor.assertPairs({   expect: [ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ] });
            executor.assertCursors({ expect: [ [2, 23] ]                                      });
        },
        task: async (executor) => { 

            // First leap a few times and check that the cursor has not moved at all.
            //
            // Leaping is not possible due to the ' Markdown ' obstalce.
            for (let i = 0; i < 5; ++i) {
                await executor.leap();
                executor.assertPairs({   expect: [ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ] });
                executor.assertCursors({ expect: [ [2, 23] ]                                      });
            }

            // Move past the ' Markdown ' obstacle.
            await executor.moveCursors({ direction: 'right', repetitions: 10 });
            executor.assertPairs({   expect: [ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ] });
            executor.assertCursors({ expect: [ [2, 33] ]                                      });

            // Check that leaping is now possible.
            await executor.leap();
            executor.assertPairs({   expect: [ { line: 2, sides: [12, 14, 38, 48] } ] });
            executor.assertCursors({ expect: [ [2, 34] ]                              });

            // After leaping, check that leaping is not possible due to the ' is ' obstacle.
            for (let i = 0; i < 5; ++i) {
                await executor.leap();
                executor.assertPairs({   expect: [ { line: 2, sides: [12, 14, 38, 48] } ] });
                executor.assertCursors({ expect: [ [2, 34] ]                              });
            }

            // Move past the ' is ' obstacle.
            await executor.moveCursors({ direction: 'right', repetitions: 4 });
            executor.assertPairs({   expect: [ { line: 2, sides: [12, 14, 38, 48] } ] });
            executor.assertCursors({ expect: [ [2, 38] ]                              });

            // Check that leaping is now possible.
            await executor.leap();
            executor.assertPairs({   expect: [ { line: 2, sides: [12, 48] } ] });
            executor.assertCursors({ expect: [ [2, 39] ]                      });

            // After leaping, check that leaping is not possible due to the ' Awesome ' obstacle.
            for (let i = 0; i < 5; ++i) {
                await executor.leap();
                executor.assertPairs({   expect: [ { line: 2, sides: [12, 48] } ] });
                executor.assertCursors({ expect: [ [2, 39] ]                      });
            }

            // Move past the ' Awesome ' obstacle.
            await executor.moveCursors({ direction: 'right', repetitions: 9 });
            executor.assertPairs({   expect: [ { line: 2, sides: [12, 48] } ] });
            executor.assertCursors({ expect: [ [2, 48] ]                      });

            // Perform the final leap.
            await executor.leap();
            executor.assertPairs({   expect: [ 'None' ]  });
            executor.assertCursors({ expect: [ [2, 49] ] });
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
        prelude: async (executor) => {

            // Initialize the editor to the following state:
            //
            // ```
            // function main() {
            //     function inner() {
            //         return [ { a: { b: [ 100 ]}}]
            //     }                        ^(cursor position)
            // }
            // ```
            await executor.typeText({ 
                text: 'function main() {\n'
                    +     'function inner() {\n'
                    +         'return [ { a: { b: [ 100 '
            });
            await executor.moveCursors({ direction: 'left', repetitions: 4 });
            executor.assertPairs({   expect: [ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ] });
            executor.assertCursors({ expect: [ [2, 29] ]                                              });
        },
        task: async (executor) => {

            // Since there is an obstacle at where the cursor is at, a leap should not occur.
            await executor.leap({ delay: 0, repetitions: 50 });
            executor.assertPairs({   expect: [ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ] });
            executor.assertCursors({ expect: [ [2, 29] ]                                              });

            // Move past the '100' obstacle.
            await executor.moveCursors({ direction: 'right', repetitions: 3 });
            executor.assertPairs({   expect: [ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ] });
            executor.assertCursors({ expect: [ [2, 32] ]                                              });

            // Rapidly calling the 'Leap' command here should cause the cursor to leap out of all
            // the pairs, and do nothing else after that.
            await executor.leap({ delay: 0, repetitions: 50 });
            executor.assertPairs({   expect: [ 'None' ]  });
            executor.assertCursors({ expect: [ [2, 37] ] });
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
