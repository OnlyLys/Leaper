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

const MIXTURE_OF_REGULAR_AND_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_CASE = new TestCase({
    name: 'Mixture of Regular and Dead Key Autoclosing Pairs',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');

        // Set up the initial document state as:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = 
        // }             ^(cursor)
        // ```
        await executor.typeText('function main() {\nconst w = \'🌍\';\nconst x = ');
    },
    task: async (executor) => {

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ ]
        // }               ^(cursor)
        // ```
        await executor.typeText('[ ');
        await executor.assertPairs([ { line: 2, sides: [14, 16] } ]);
        await executor.assertCursors([ [2, 16] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ ""]
        // }                ^(cursor)
        // ```
        await executor.insertDeadKeyAutoclosingPair({ deadKey: '¨', pair: '""' });
        await executor.assertPairs([ { line: 2, sides: [14, 16, 17, 18] } ]);
        await executor.assertCursors([ [2, 17] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello"]
        // }                     ^(cursor)
        // ```
        await executor.typeText('Hello');
        await executor.assertPairs([ { line: 2, sides: [14, 16, 22, 23] } ]);
        await executor.assertCursors([ [2, 22] ]);
        
        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello"]
        // }                      ^(cursor)
        // ```
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [14, 23] } ]);
        await executor.assertCursors([ [2, 23] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", ]
        // }                        ^(cursor)
        // ```
        await executor.typeText(', ');
        await executor.assertPairs([ { line: 2, sides: [14, 25] } ]);
        await executor.assertCursors([ [2, 25] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", '']
        // }                         ^(cursor)
        // ```
        await executor.insertDeadKeyAutoclosingPair({ deadKey: '´', pair: "''" });
        await executor.assertPairs([ { line: 2, sides: [14, 25, 26, 27] } ]);
        await executor.assertCursors([ [2, 26] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World']
        // }                              ^(cursor)
        // ```
        await executor.typeText('World');
        await executor.assertPairs([ { line: 2, sides: [14, 25, 31, 32] } ]);
        await executor.assertCursors([ [2, 31] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World']
        // }                               ^(cursor)
        // ```
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [14, 32] } ]);
        await executor.assertCursors([ [2, 32] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', ]
        // }                                 ^(cursor)
        // ```
        await executor.typeText(', ');
        await executor.assertPairs([ { line: 2, sides: [14, 34] } ]);
        await executor.assertCursors([ [2, 34] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', ``]
        // }                                  ^(cursor)
        // ```
        await executor.insertDeadKeyAutoclosingPair({ deadKey: "`", pair: "``"   });
        await executor.assertPairs([ { line: 2, sides: [14, 34, 35, 36] } ]);
        await executor.assertCursors([ [2, 35] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', `${w}`]
        // }                                     ^(cursor)
        // ```
        await executor.typeText('${w');
        await executor.assertPairs([ { line: 2, sides: [14, 34, 36, 38, 39, 40] } ]);
        await executor.assertCursors([ [2, 38] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', `${w}`]
        // }                                       ^(cursor)
        // ```
        await executor.leap(2);
        await executor.assertPairs([ { line: 2, sides: [14, 40] } ]);
        await executor.assertCursors([ [2, 40] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', `${w}` ]
        // }                                        ^(cursor)
        // ```
        await executor.typeText(' ');
        await executor.assertPairs([ { line: 2, sides: [14, 41] } ]);
        await executor.assertCursors([ [2, 41] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', `${w}` ]
        // }                                         ^(cursor)
        // ```
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 42] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const w = '🌍';
        //     const x = [ "Hello", 'World', `${w}` ]
        // }                                        ^(cursor)
        // ```
        await executor.typeText(';');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 43] ]);
    }
});

/**
 * Check whether dead key autoclosing pairs are correctly detected for single cursors.
 */
export const SINGLE_CURSOR_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_GROUP = new TestGroup(
    'Dead Key Autoclosing Pairs',
    [
        ONLY_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_CASE,
        MIXTURE_OF_REGULAR_AND_DEAD_KEY_AUTOCLOSING_PAIRS_TEST_CASE
    ]
);
