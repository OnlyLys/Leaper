import { ViewColumn } from 'vscode';
import { TestCase, TestGroup } from '../../utilities/framework';
import { range } from '../../utilities/other';

/**
 * Text that is typed in by each of the test case preludes.
 * 
 * Typing this text causes the text editor state to become:
 * 
 * ```
 * function main() {
 *     function inner() {
 *         return [ { a: { b: []}}]
 *     }                       ^(cursor position)
 * }
 * ```
 */
const SHARED_TEXT = 'function main() {\n'
                  +     'function inner() {\n'
                  +         'return [ { a: { b: [';

/**
 * Make sure the command works.
 * 
 * Note that the command is directly called instead of being triggered by a keypress. The 
 * keybinding (and its 'when' context) are not being tested here.
 */
const IT_WORKS_TEST_CASE = new TestCase({
    name: 'It Works',
    prelude: async (executor) => {
        await executor.typeText(SHARED_TEXT);
        executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 28, 29, 30, 31] } ]);
        executor.assertCursors([ [2, 28] ]);
    },
    task: async (executor) => {

        // Jump out of one pair first, just to simulate a more 'realistic' scenario.
        await executor.leap();
        executor.assertPairs([ { line: 2, sides: [15, 17, 22, 29, 30, 31] } ]);
        executor.assertCursors([ [2, 29] ]);

        // This should remove all pairs from being tracked.
        await executor.escapeLeaperMode();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 29] ]);
    }
});

/**
 * Check if the 'Escape Leaper Mode' command can handle being called multiple times in one event 
 * loop cycle.
 * 
 * Such a scenario could occur when the user presses and holds down the keybinding for the
 * command.
 */
const CAN_HANDLE_RAPID_CALLS = new TestCase({
    name: 'Can Handle Rapid Calls',
    prelude: async (executor) => {
        await executor.typeText(SHARED_TEXT);
        executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 28, 29, 30, 31] } ]);
        executor.assertCursors([ [2, 28] ]);
    },
    task: async (executor) => {

        // This should remove all pairs from being tracked and do nothing else.
        await executor.escapeLeaperMode({ delay: 0, repetitions: 50 }); 
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 28] ]);
    }
});

/**
 * Make sure the command only clears pairs in the active text editor.
 */
const ONLY_CLEARS_ACTIVE_TEXT_EDITOR = new TestCase({
    name: 'Only Clears Active Text Editor',
    prelude: async (executor) => {

        // Insert some text and then type in some pairs into the active text editor.
        async function action(): Promise<void> {
            await executor.editText([
                { kind: 'insert', at: [0, 0], text: 'function main(): void {\n    \n}' }
            ]);
            await executor.setCursors([ [1, 4] ]);
            await executor.typeRandomPair({ repetitions: 10 });
            executor.assertPairs([ { line: 1, sides: range(4, 24) } ]);
            executor.assertCursors([ [1, 14] ]);
        }

        // Open three additional text editors in exclusive view columns.
        //
        // After this step, there will be four empty Typescript text editors, one in each of four 
        // visible view columns.
        //
        // View column 4 will be in focus after this step.
        await executor.openNewTextEditor(undefined, { viewColumn: ViewColumn.Two   });
        await executor.openNewTextEditor(undefined, { viewColumn: ViewColumn.Three });
        await executor.openNewTextEditor(undefined, { viewColumn: ViewColumn.Four  });

        // Set up all four text editors to the same state.
        //
        // View column 1 will be in focus after this step.
        await action();
        await executor.focusEditorGroup('left');
        await action();
        await executor.focusEditorGroup('left');
        await action();
        await executor.focusEditorGroup('left');
        await action();
    },
    task: async (executor) => {

        // Execute the command in the active text editor (view column 1).
        await executor.escapeLeaperMode();

        // Verify that only the pairs in the active text editor were cleared.
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 14] ]);
        executor.assertPairs([ { line: 1, sides: range(4, 24) } ], { viewColumn: ViewColumn.Two   });
        executor.assertCursors([ [1, 14] ],                        { viewColumn: ViewColumn.Two   });
        executor.assertPairs([ { line: 1, sides: range(4, 24) } ], { viewColumn: ViewColumn.Three });
        executor.assertCursors([ [1, 14] ],                        { viewColumn: ViewColumn.Three });
        executor.assertPairs([ { line: 1, sides: range(4, 24) } ], { viewColumn: ViewColumn.Four  });
        executor.assertCursors([ [1, 14] ],                        { viewColumn: ViewColumn.Four  });
    }

});

export const SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP = new TestGroup(
    'Escape Leaper Mode Command',
    [
        IT_WORKS_TEST_CASE,
        CAN_HANDLE_RAPID_CALLS,
        ONLY_CLEARS_ACTIVE_TEXT_EDITOR
    ]
);
