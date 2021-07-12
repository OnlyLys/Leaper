import { TestCase, TestGroup } from '../utilities/framework';
import { range } from '../utilities/helpers';
import { ALICE_TEXT_1, ALICE_TEXT_2, } from '../utilities/placeholder-texts';

const SINGLE_LEAP_TEST_CASE = new TestCase({
    name: 'Single Leap',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');
        await executor.typeText('[');
        await executor.assertPairs([ { line: 0, sides: [0, 1] } ]);
        await executor.assertCursors([ [0, 1] ]);
    },
    task: async (executor) => {
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 2] ]);
    }
});

const SINGLE_LEAP_ACROSS_WHITESPACE_TEST_CASE = new TestCase({
    name: 'Single Leap Across Whitespace',
    prelude: async (executor) => { 
        await executor.openFile('./workspace-0/text.ts');
        await executor.typeText('(');
        await executor.typeText(' ', { repetitions: 5 });
        await executor.moveCursors('left', { repetitions: 5 });
        await executor.assertPairs([ { line: 0, sides: [0, 6] } ]);
        await executor.assertCursors([ [0, 1] ]);
    },
    task: async (executor) => { 
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 7] ]);
    }
});

const CONSECUTIVE_LEAPS_TEST_CASE = new TestCase({
    name: 'Consecutive Leaps',
    prelude: async (executor) => { 
        await executor.openFile('./workspace-0/text.ts');
        
        // Insert pairs between some text to simulate a typical usage scenario.
        await executor.editText([
            { kind: 'insert', at: [0, 0], text: ALICE_TEXT_1 + '\n\n' + ALICE_TEXT_2 }
        ]);
        await executor.setCursors([ [6, 71] ]);
        await executor.typeText('[[({(([{((');
        await executor.assertPairs([ { line: 6, sides: range(71, 91) } ]);
        await executor.assertCursors([ [6, 81] ]);
    },
    task: async (executor) => { 
        const cluster = { line: 6, sides: range(71, 91) };
        while (cluster.sides.length > 0) {
            await executor.leap();
            await executor.assertCursors([ [6, cluster.sides[cluster.sides.length / 2] + 1] ]);
            cluster.sides = [
                ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                ...cluster.sides.slice((cluster.sides.length / 2) + 1),
            ];
            await executor.assertPairs([ cluster ]);
        }
    }
});

const CONSECUTIVE_LEAPS_ACROSS_WHITESPACE = new TestCase({
    name: 'Consecutive Leaps Across Whitespace',
    prelude: async (executor) => { 
        await executor.openFile('./workspace-0/text.ts');
        
        // Insert pairs after some text to simulate a typical usage scenario.
        await executor.typeText('some text\n\nfunction ');
        for (let i = 0; i < 6; ++i) {
            await executor.typeText('{');
            await executor.typeText(' ', { repetitions: 5 });
            await executor.moveCursors('left', { repetitions: 5 });
        }
        await executor.assertPairs([ { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] } ]);
        await executor.assertCursors([ [2, 15] ]);
    },
    task: async (executor) => { 
        const cluster = { line: 2, sides: [9, 10, 11, 12, 13, 14, 20, 26, 32, 38, 44, 50] };
        while (cluster.sides.length > 0) {
            await executor.leap();
            await executor.assertCursors([ [2, cluster.sides[cluster.sides.length / 2] + 1] ]);
            cluster.sides = [
                ...cluster.sides.slice(0, (cluster.sides.length / 2) - 1),
                ...cluster.sides.slice((cluster.sides.length / 2) + 1),
            ];
            await executor.assertPairs([ cluster ]);
        }
    }
});

const CALL_IGNORED_WHEN_NO_PAIRS = new TestCase({
    name: 'Call Ignored When No Pairs',
    prelude: async (executor) => { 
        await executor.openFile('./workspace-3/text.md');
        await executor.typeText(ALICE_TEXT_2);
        await executor.setCursors([ [2, 11] ]);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 11] ]); 
    },
    task: async (executor) => { 

        // Leap a bunch of times when there are no pairs and check that the cursor has not moved.
        for (let i = 0; i < 10; ++i) {
            await executor.leap();
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [2, 11] ]);
        }

        // Now insert 5 pairs.
        await executor.typeText('<{{{{');
        await executor.assertPairs([ { line: 2, sides: range(11, 21) } ]);
        await executor.assertCursors([ [2, 16] ]);

        // Leap out of all of the inserted pairs.
        await executor.leap({ repetitions: 5 });
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 21] ]);

        // After leaping, check that future leap calls do not move the cursor at all.
        for (let i = 0; i < 10; ++i) {
            await executor.leap();
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [2, 21] ]);
        }
    }
});

const CALL_IGNORED_WHEN_NO_LINE_OF_SIGHT = new TestCase({
    name: 'Call Ignored When No Line of Sight',
    prelude: async (executor) => { 
        await executor.openFile('./workspace-3/text.md');
        
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
        await executor.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
        await executor.assertCursors([ [2, 23] ]);
    },
    task: async (executor) => { 

        // First leap a few times and check that the cursor has not moved at all.
        //
        // Leaping is not possible due to the ' Markdown ' obstalce.
        for (let i = 0; i < 5; ++i) {
            await executor.leap();
            await executor.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
            await executor.assertCursors([ [2, 23] ]);
        }

        // Move past the ' Markdown ' obstacle.
        await executor.moveCursors('right', { repetitions: 10 });
        await executor.assertPairs([ { line: 2, sides: [12, 14, 22, 33, 38, 48] } ]);
        await executor.assertCursors([ [2, 33] ]);

        // Check that leaping is now possible.
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
        await executor.assertCursors([ [2, 34] ]);

        // After leaping, check that leaping is not possible due to the ' is ' obstacle.
        for (let i = 0; i < 5; ++i) {
            await executor.leap();
            await executor.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
            await executor.assertCursors([ [2, 34] ]);
        }

        // Move past the ' is ' obstacle.
        await executor.moveCursors('right', { repetitions: 4 });
        await executor.assertPairs([ { line: 2, sides: [12, 14, 38, 48] } ]);
        await executor.assertCursors([ [2, 38] ]);

        // Check that leaping is now possible.
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [12, 48] } ]);
        await executor.assertCursors([ [2, 39] ]);

        // After leaping, check that leaping is not possible due to the ' Awesome ' obstacle.
        for (let i = 0; i < 5; ++i) {
            await executor.leap();
            await executor.assertPairs([ { line: 2, sides: [12, 48] } ]);
            await executor.assertCursors([ [2, 39] ]);
        }

        // Move past the ' Awesome ' obstacle.
        await executor.moveCursors('right', { repetitions: 9 });
        await executor.assertPairs([ { line: 2, sides: [12, 48] } ]);
        await executor.assertCursors([ [2, 48] ]);

        // Perform the final leap.
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 49] ]);
    }
});

/**
 * Test whether the engine can handle the 'Leap' command being called many times in a short span of 
 * time.
 */
const ENGINE_CAN_HANDLE_RAPID_CALLS = new TestCase({
    name: 'Engine Can Handle Rapid Calls',
    prelude: async (executor) => {

        // Initialize a Typescript text editor to the following state:
        //
        // ```
        // function main() {
        //     function inner() {
        //         return [ { a: { b: [ 100 ]}}]
        //     }                        ^(cursor position)
        // }
        // ```
        await executor.openFile('./workspace-0/text.ts');
        await executor.typeText(
            'function main() {\n'
           +    'function inner() {\n'
           +        'return [ { a: { b: [ 100 '
        );
        await executor.moveCursors('left', { repetitions: 4 });
        await executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
        await executor.assertCursors([ [2, 29] ]);
    },
    task: async (executor) => {

        // 1. Test whether the engine is resilient to rapid 'Leap' calls even though there is no 
        //    line-of-sight.
        //
        // The cursor is currently at a position where it has no line-of-sight to the closing side 
        // of the nearest pair. The `leaper.hasLineOfSight` keybinding context should be disabled at 
        // this point, which disables the default keybinding to the 'Leap' command. However, the 
        // user may still have a custom keybinding for the 'Leap' command that ignores the 
        // `leaper.hasLineOfSight` keybinding context. Thus, we have to check that calling the
        // command, even though there is no line-of-sight, does not create any problems. 
        //
        // To do this test, we call the 'Leap' command many times when there is no line-of-sight, 
        // then check that neither the pairs being tracked nor the cursor position has changed, 
        // since we expect the engine to do nothing.
        await executor.leap({ repetitions: 50 });
        await executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 33, 34, 35, 36] } ]);
        await executor.assertCursors([ [2, 29] ]);

        // 2. Test whether the engine is resilient to more 'Leap' calls than is necessary.
        //
        // To do this test, we move the cursor to a position that has line-of-sight, then call more 
        // 'Leap' commands than is necessary. We check that all that happens is the cursors are 
        // leapt out of all available pairs, and that nothing more is done after that.
        await executor.moveCursors('right', { repetitions: 3 });
        await executor.leap({ repetitions: 50 });
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 37] ]);

        // 3. Test whether the engine is resilient to many valid 'Leap' calls.
        //
        // To do this test, we type in 50 pairs then consecutively leap out of all of them. In a way,
        // this tests the ability of the engine to handle the 'Leap' key being held down.
        await executor.typeText('{', { repetitions: 50 });
        await executor.assertPairs([ { line: 2, sides: range(37, 137) } ]);
        await executor.assertCursors([ [2, 87] ]);
        await executor.leap({ repetitions: 50 });
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 137] ]);
    }
});

/** 
 * A collection of tests cases that test the `leaper.leap` command when there is a single cursor.
 */
export const SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP: TestGroup = new TestGroup(
    "'Leap' Command",
    [
        SINGLE_LEAP_TEST_CASE,
        SINGLE_LEAP_ACROSS_WHITESPACE_TEST_CASE,
        CONSECUTIVE_LEAPS_TEST_CASE,
        CONSECUTIVE_LEAPS_ACROSS_WHITESPACE,
        CALL_IGNORED_WHEN_NO_PAIRS,
        CALL_IGNORED_WHEN_NO_LINE_OF_SIGHT,
        ENGINE_CAN_HANDLE_RAPID_CALLS
    ]
);
