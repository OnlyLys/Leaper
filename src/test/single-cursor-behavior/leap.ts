import { TestCase, TestGroup } from '../utilities/framework';
import { range } from '../utilities/other';
import { ALICE_TEXT_1, ALICE_TEXT_2, } from '../utilities/placeholder-texts';

const SINGLE_LEAP_TEST_CASE = new TestCase({
    name: 'Single Leap',
    prelude: async (executor) => {
        await executor.typeRandomPair();
        executor.assertPairs([ { line: 0, sides: [0, 1] } ]);
        executor.assertCursors([ [0, 1] ]);
    },
    task: async (executor) => {
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [0, 2] ]);
    }
});

const SINGLE_LEAP_ACROSS_WHITESPACE_TEST_CASE = new TestCase({
    name: 'Single Leap Across Whitespace',
    prelude: async (executor) => { 
        await executor.typeRandomPair();
        await executor.typeText('     ');
        await executor.moveCursors('left', { repetitions: 5 });
        executor.assertPairs([ { line: 0, sides: [0, 6] } ]);
        executor.assertCursors([ [0, 1] ]);
    },
    task: async (executor) => { 
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [0, 7] ]);
    }
});

const CONSECUTIVE_LEAPS_TEST_CASE = new TestCase({
    name: 'Consecutive Leaps',
    prelude: async (executor) => { 

        // Insert pairs between some text to simulate a typical usage scenario.
        await executor.editText([
            { kind: 'insert', at: [0, 0], text: ALICE_TEXT_1 + '\n\n' + ALICE_TEXT_2 }
        ]);
        await executor.setCursors([ [6, 71] ]);
        await executor.typeRandomPair({ repetitions: 10 });
        executor.assertPairs([ { line: 6, sides: range(71, 91) } ]);
        executor.assertCursors([ [6, 81] ]);
    },
    task: async (executor) => { 
        const cluster = { line: 6, sides: range(71, 91) };
        while (cluster.sides.length > 0) {
            await executor.leap();
            executor.assertCursors([ [6, cluster.sides[cluster.sides.length / 2] + 1] ]);
            cluster.sides = [
                ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                ...cluster.sides.slice((cluster.sides.length / 2) + 1),
            ];
            executor.assertPairs([ cluster ]);
        }
    }
});

const CONSECUTIVE_LEAPS_ACROSS_WHITESPACE = new TestCase({
    name: 'Consecutive Leaps Across Whitespace',
    prelude: async (executor) => { 

        // Insert pairs after some text to simulate a typical usage scenario.
        await executor.typeText('some text\n\nfunction ');
        for (let i = 0; i < 6; ++i) {
            await executor.typeRandomPair();
            await executor.typeText('     ');
            await executor.moveCursors('left', { repetitions: 5 });
        }
        executor.assertPairs(
            [ 
                { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] } 
            ] 
        );
        executor.assertCursors([ [2, 15] ]);
    },
    task: async (executor) => { 
        const cluster = { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] };
        while (cluster.sides.length > 0) {
            await executor.leap();
            executor.assertCursors([ [2, cluster.sides[cluster.sides.length / 2] + 1] ]);
            cluster.sides = [
                ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                ...cluster.sides.slice((cluster.sides.length / 2) + 1),
            ];
            executor.assertPairs([ cluster ]);
        }
    }
});

const LEAP_CALL_IGNORED_WHEN_NO_PAIRS = new TestCase({
    name: 'Leap Call Ignored When No Pairs',
    editorLanguageId: 'markdown',
    prelude: async (executor) => { 
        await executor.typeText(ALICE_TEXT_2);
        await executor.setCursors([ [2, 11] ]);
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 11] ]); 
    },
    task: async (executor) => { 

        // Leap a bunch of times when there are no pairs and check that the cursor has not moved.
        for (let i = 0; i < 10; ++i) {
            await executor.leap();
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [2, 11] ]);
        }

        // Now insert 5 pairs.
        await executor.typeRandomPair({ repetitions: 5 });
        executor.assertPairs([ { line: 2, sides: range(11, 21) } ]);
        executor.assertCursors([ [2, 16] ]);

        // Leap out of all of the inserted pairs.
        await executor.leap({ repetitions: 5 });
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 21] ]);

        // After leaping, check that future leap calls do not move the cursor at all.
        for (let i = 0; i < 10; ++i) {
            await executor.leap();
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [2, 21] ]);
        }
    }
});

const LEAP_CALL_IGNORED_WHEN_NO_LINE_OF_SIGHT = new TestCase({
    name: 'Leap Call Ignored When No Line of Sight',
    editorLanguageId: 'markdown',
    prelude: async (executor) => { 

        // Insert some random text to simulate a typical usage scenario.
        await executor.typeText(ALICE_TEXT_2);
        await executor.setCursors([ [2, 11] ]);

        // Insert `{ { Hello { Markdown } is } Awesome }` into the text.
        await executor.typeText(' {  Awesome ');
        await executor.moveCursors('left', { repetitions: 9 });
        await executor.typeText('{ Hello  is ');
        await executor.moveCursors('left', { repetitions: 4 });
        await executor.typeText('{ Markdown ');
        await executor.moveCursors('left', { repetitions: 10 });
        executor.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
        executor.assertCursors([ [2, 23] ]);
    },
    task: async (executor) => { 

        // First leap a few times and check that the cursor has not moved at all.
        //
        // Leaping is not possible due to the ' Markdown ' obstalce.
        for (let i = 0; i < 5; ++i) {
            await executor.leap();
            executor.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
            executor.assertCursors([ [2, 23] ]);
        }

        // Move past the ' Markdown ' obstacle.
        await executor.moveCursors('right', { repetitions: 10 });
        executor.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
        executor.assertCursors([ [2, 33] ]);

        // Check that leaping is now possible.
        await executor.leap();
        executor.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
        executor.assertCursors([ [2, 34] ]);

        // After leaping, check that leaping is not possible due to the ' is ' obstacle.
        for (let i = 0; i < 5; ++i) {
            await executor.leap();
            executor.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
            executor.assertCursors([ [2, 34] ]);
        }

        // Move past the ' is ' obstacle.
        await executor.moveCursors('right', { repetitions: 4 });
        executor.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
        executor.assertCursors([ [2, 38] ]);

        // Check that leaping is now possible.
        await executor.leap();
        executor.assertPairs([ { line: 2, sides: [12, 48] } ]);
        executor.assertCursors([ [2, 39] ]);

        // After leaping, check that leaping is not possible due to the ' Awesome ' obstacle.
        for (let i = 0; i < 5; ++i) {
            await executor.leap();
            executor.assertPairs([ { line: 2, sides: [12, 48] } ]);
            executor.assertCursors([ [2, 39] ]);
        }

        // Move past the ' Awesome ' obstacle.
        await executor.moveCursors('right', { repetitions: 9 });
        executor.assertPairs([ { line: 2, sides: [12, 48] } ]);
        executor.assertCursors([ [2, 48] ]);

        // Perform the final leap.
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 49] ]);
    }
});

/**
 * Let's say the user created a new keybinding for the 'Leap' command that does not take into 
 * consideration the `leaper.hasLineOfSight` or `leaper.inLeaperMode` keybinding contexts, and 
 * managed to hold down said keybinding for a while. That will cause many calls of the 'Leap' 
 * command to occur in a short span of time.
 *
 * This test case tests whether the extension can handle such a situation.
 */
const CAN_HANDLE_BEING_RAPIDLY_CALLED = new TestCase({
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
        await executor.typeText(
            'function main() {\n'
           +    'function inner() {\n'
           +        'return [ { a: { b: [ 100 '
        );
        await executor.moveCursors('left', { repetitions: 4 });
        executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
        executor.assertCursors([ [2, 29] ]);
    },
    task: async (executor) => {

        // Since there is an obstacle at where the cursor is at, a leap should not occur.
        await executor.leap({ delay: 0, repetitions: 50 });
        executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
        executor.assertCursors([ [2, 29] ]);

        // Move past the '100' obstacle.
        await executor.moveCursors('right', { repetitions: 3 });
        executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
        executor.assertCursors([ [2, 32] ]);

        // Rapidly calling the 'Leap' command here should cause the cursor to leap out of all
        // the pairs, and do nothing else after that.
        await executor.leap({ delay: 0, repetitions: 50 });
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 37] ]);
    }
});

/** 
 * Test group containing tests for the `leaper.leap` command in single cursor situations.
 */
export const SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP: TestGroup = new TestGroup(
    'Leap Command',
    [
        SINGLE_LEAP_TEST_CASE,
        SINGLE_LEAP_ACROSS_WHITESPACE_TEST_CASE,
        CONSECUTIVE_LEAPS_TEST_CASE,
        CONSECUTIVE_LEAPS_ACROSS_WHITESPACE,
        LEAP_CALL_IGNORED_WHEN_NO_PAIRS,
        LEAP_CALL_IGNORED_WHEN_NO_LINE_OF_SIGHT,
        CAN_HANDLE_BEING_RAPIDLY_CALLED
    ]
);
