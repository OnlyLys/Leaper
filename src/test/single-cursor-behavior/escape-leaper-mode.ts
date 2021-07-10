import { ViewColumn } from 'vscode';
import { CompactCluster, CompactCursor } from '../utilities/compact';
import { TestCase, TestGroup } from '../utilities/framework';
import { range } from '../utilities/other';

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
 * Note that the command is directly called instead of being triggered by a keypress. The keybinding 
 * context is being tested here.
 */
const IT_WORKS_TEST_CASE = new TestCase({
    name: 'It Works',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');
        await executor.typeText(SHARED_TEXT);
        await executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 28, 29, 30, 31] } ]);
        await executor.assertCursors([ [2, 28] ]);
    },
    task: async (executor) => {

        // Jump out of one pair first, just to simulate a more 'realistic' scenario.
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [15, 17, 22, 29, 30, 31] } ]);
        await executor.assertCursors([ [2, 29] ]);

        // This should remove all pairs from being tracked.
        await executor.escapeLeaperMode();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 29] ]);
    }
});

/**
 * Check if the engine can handle many 'Escape Leaper Mode' calls in a short span of time.
 * 
 * Such a scenario could occur when the user presses and holds down the keybinding for the command.
 */
const ENGINE_CAN_HANDLE_RAPID_CALLS = new TestCase({
    name: 'Engine Can Handle Rapid Calls',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');
        await executor.typeText(SHARED_TEXT);
        await executor.assertPairs([ { line: 2, sides: [15, 17, 22, 27, 28, 29, 30, 31] } ]);
        await executor.assertCursors([ [2, 28] ]);
    },
    task: async (executor) => {

        // This should remove all pairs from being tracked and do nothing else.
        await executor.escapeLeaperMode({ repetitions: 50 }); 
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 28] ]);
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
            await executor.typeText('(', { repetitions: 10 });
            await executor.assertPairs([ { line: 1, sides: range(4, 24) } ]);
            await executor.assertCursors([ [1, 14] ]);
        }
        
        // Open three Typescript text editors in exclusive view columns.
        await executor.openFile('./workspace-0/text.ts');
        await executor.openFile('./workspace-2/text.ts', { viewColumn: ViewColumn.Two });
        await executor.openFile('./workspace-4/text.ts', { viewColumn: ViewColumn.Three });

        // Set all three text editors to the same state.
        //
        // View column 1 will be in focus after this step.
        await action();
        await executor.focusEditorGroup('left');
        await action();
        await executor.focusEditorGroup('left');
        await action();
    },
    task: async (executor) => {

        // Execute the command in the active text editor (view column 1).
        await executor.escapeLeaperMode();

        // Expected pairs for text editors that have not been cleared.
        const pairs: CompactCluster[] = [ { line: 1, sides: range(4, 24) } ];
        
        // Expected cursors for each text editor.
        const cursors: CompactCursor[] = [ [1, 14] ];

        // Verify that only the pairs in the active text editor were cleared.
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors(cursors);
        await executor.assertPairs(pairs,     { viewColumn: ViewColumn.Two });
        await executor.assertCursors(cursors, { viewColumn: ViewColumn.Two });
        await executor.assertPairs(pairs,     { viewColumn: ViewColumn.Three });
        await executor.assertCursors(cursors, { viewColumn: ViewColumn.Three });
    }

});

/**
 * A collection of test cases that test the `leaper.escapeLeaperMode` command when there is a single
 * cursor.
 */
export const SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP = new TestGroup(
    "'Escape Leaper Mode' Command",
    [
        IT_WORKS_TEST_CASE,
        ENGINE_CAN_HANDLE_RAPID_CALLS,
        ONLY_CLEARS_ACTIVE_TEXT_EDITOR
    ]
);
