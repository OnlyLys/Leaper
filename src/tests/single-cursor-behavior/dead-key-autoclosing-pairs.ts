import { TestCase, TestGroup } from '../utilities/framework';

const ONLY_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_CASE = new TestCase({
    name: 'Only Dead Key Autoclosing Pairs',
    prelude: async (executor) => await executor.openFile('./workspace-0/text.ts'),
    task: async (executor) => {

        // Type in 6 dead key autoclosing pairs in a row.
        await executor.insertDeadKeyAutoclosingPair({ deadKey: "¨", pair: "\"\"" });
        await executor.assertPairs([ { line: 0, sides: [0, 1] } ]);
        await executor.assertCursors([ [0, 1] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "´", pair: "''"   });
        await executor.assertPairs([ { line: 0, sides: [0, 1, 2, 3] } ]);
        await executor.assertCursors([ [0, 2] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "`", pair: "``"   });
        await executor.assertPairs([ { line: 0, sides: [0, 1, 2, 3, 4, 5] } ]);
        await executor.assertCursors([ [0, 3] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "¨", pair: "\"\"" });
        await executor.assertPairs([ { line: 0, sides: [0, 1, 2, 3, 4, 5, 6, 7] } ]);
        await executor.assertCursors([ [0, 4] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "´", pair: "''"   });
        await executor.assertPairs([ { line: 0, sides: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] } ]);
        await executor.assertCursors([ [0, 5] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "`", pair: "``"   });
        await executor.assertPairs([ { line: 0, sides: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } ]);
        await executor.assertCursors([ [0, 6] ]);

        // Leap out of all of them.
        await executor.leap(6);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 12] ]);

        // Type in 3 more dead key autoclosing pairs, but have some text in between each pair.
        await executor.insertDeadKeyAutoclosingPair({ deadKey: "`", pair: "``"   });
        await executor.assertPairs([ { line: 0, sides: [12, 13] } ]);
        await executor.assertCursors([ [0, 13] ]);

        await executor.typeText(' filler ');
        await executor.assertPairs([ { line: 0, sides: [12, 21] } ]);
        await executor.assertCursors([ [0, 21] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "`", pair: "``"   });
        await executor.assertPairs([ { line: 0, sides: [12, 21, 22, 23] } ]);
        await executor.assertCursors([ [0, 22] ]);

        await executor.typeText(' filler filler ');
        await executor.assertPairs([ { line: 0, sides: [12, 21, 37, 38] } ]);
        await executor.assertCursors([ [0, 37] ]);

        await executor.moveCursors('left');
        await executor.assertPairs([ { line: 0, sides: [12, 21, 37, 38] } ]);
        await executor.assertCursors([ [0, 36] ]);

        await executor.insertDeadKeyAutoclosingPair({ deadKey: "`", pair: "``"   });
        await executor.assertPairs([ { line: 0, sides: [12, 21, 36, 37, 39, 40] } ]);
        await executor.assertCursors([ [0, 37] ]);
    }
});
    }
});

/**
 * Check whether dead key autoclosing pairs correctly detected.
 */
export const SINGLE_CURSOR_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_GROUP = new TestGroup(
    'Dead Key Autoclosing Pairs',
    [
        ONLY_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_CASE,
    ]
);
