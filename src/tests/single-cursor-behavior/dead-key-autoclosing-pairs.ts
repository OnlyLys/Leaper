import { Executor, TestCase, TestGroup } from '../utilities/framework';

const DEAD_KEY_AUTOCLOSING_PAIRS_ONLY_TEST_CASE = new TestCase({
    name: 'Dead Key Autoclosing Pairs Only',
    prelude: async (executor) => await executor.openFile('./workspace-0/text.ts'),
    task: async (executor) => {

        async function assertLineZero(executor: Executor, sides: number[], cursorChar: number) {
            await executor.assertPairs([ { line: 0, sides } ]);
            await executor.assertCursors([ [0, cursorChar] ]);
        }

        // Type in 6 dead key autoclosing pairs in a row.
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "¨", pair: "\"\"" });
        await assertLineZero(executor, [0, 1], 1);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "´", pair: "''"   });
        await assertLineZero(executor, [0, 1, 2, 3], 2);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "`", pair: "``"   });
        await assertLineZero(executor, [0, 1, 2, 3, 4, 5], 3);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "¨", pair: "\"\"" });
        await assertLineZero(executor, [0, 1, 2, 3, 4, 5, 6, 7], 4);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "´", pair: "''"   });
        await assertLineZero(executor, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "`", pair: "``"   });
        await assertLineZero(executor, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 6);

        // Leap out of all of them.
        await executor.leap(6);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 12] ]);

        // Type in 3 more dead key autoclosing pairs, but have some text in between each pair.
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "`", pair: "``"   });
        await assertLineZero(executor, [12, 13], 13);
        await executor.typeText(' filler ');
        await assertLineZero(executor, [12, 21], 21);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "`", pair: "``"   });
        await assertLineZero(executor, [12, 21, 22, 23], 22);
        await executor.typeText(' filler filler ');
        await assertLineZero(executor, [12, 21, 37, 38], 37);
        await executor.moveCursors('left');
        await assertLineZero(executor, [12, 21, 37, 38], 36);
        await executor.simulateDeadKeyAutoclosingPairInsertion({ deadKey: "`", pair: "``"   });
        await assertLineZero(executor, [12, 21, 36, 37, 39, 40], 37);
    }
});

/**
 * Check whether dead key autoclosing pairs correctly detected.
 */
export const SINGLE_CURSOR_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_GROUP = new TestGroup(
    'Dead Key Autoclosing Pairs',
    [
        DEAD_KEY_AUTOCLOSING_PAIRS_ONLY_TEST_CASE,
    ]
);
