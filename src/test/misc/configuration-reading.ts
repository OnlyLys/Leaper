import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * Tests the effective `detectedPairs` configuration by asserting that:
 * 
 *  - The autoclosing pairs in `should` are appropriately detected.
 *  - The autoclosing pairs in` shouldNot` are not detected by this extension.
 * 
 * Please make sure that the pairs provided are actual autoclosing pairs in the language of the
 * active text editor. For instance, `<>`, even though it is a commonly used pair in languages with
 * generics like Rust or Typescript, is not autoclosed in either language. 
 */
async function testDetectedPairs(
    executor:  Executor,
    should:    ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[],
    shouldNot: ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[]
): Promise<void> {

    // Move cursor to the end of document.
    await executor.cursorBottom();

    // Get the cursor position.
    const cursor = executor.getCursors()[0] as [number, number];

    // Perform the checks.
    await check(should,    true);
    await check(shouldNot, false);

    /**
     * Type in the opening side of each pair in `pairs`, let vscode autoclose the pair, then 
     * depending on `expect`:
     *  
     *  - If `true`, will assert that each inserted pair is tracked by the extension.
     *  - If `false`, will assert that each inserted pair is not tracked by the extension. 
     */
    async function check(
        pairs: ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[],
        expect: boolean
    ): Promise<void> {
        for (const pair of pairs) {

            // Type in the opening side of the pair, and let vscode autoclose it.
            await executor.typeText({ text: pair[0] });

            // Check that the pair is being tracked (or not tracked, depending on `expect`).
            executor.assertPairs([ 
                expect ? { line: cursor[0], sides: [ cursor[1], cursor[1] + 1 ] } 
                       : { line: -1, sides: [] }
            ]);
            executor.assertCursors([ [cursor[0], cursor[1] + 1] ]);

            // Remove the inserted pair.
            await executor.undo();

            // Check that the inserted pair was removed.
            executor.assertPairs([ { line: -1, sides: [] }]);
            executor.assertCursors([ cursor ]);
        }
    }
}

/**
 * Test whether this extension is correctly reading configuration values.
 * 
 * This extension should be reading configuration values scoped to the text document of the 
 */
const CAN_READ_VALUES_TEST_CASE = new TestCase({
    name: 'Can Read Values',
    task: async (executor) => {

        // 1. Test whether workspace configuration values can be read.
        // 
        // For this, we use the initial text editor that is provided to each test case.
        //
        // Because we did not specify a language for the provided text editor, it will be Typescript.
        // And because the opened text editor does not belong to any of the workspace folders within 
        // the workspace, it is expected to only inherit up to workspace configuration values.
        // 
        // The testing workspace has `leaper.detectedPairs` configured to: 
        // 
        //     [ "{}", "[]", "()", "''", "\"\"", "``", "<>" ]
        // 
        // while Typescript autocloses the following pairs: 
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        //
        // Therefore we would expect all of the autoclosing pairs of Typescript to be tracked.
        await testDetectedPairs(executor, [ "{}", "[]", "()", "''", "\"\"", "``" ], []);

        // 2a. Test whether language-specific workspace configuration values can be read.
        //
        // For this, we use the Plaintext file within the first workspace folder.
        //
        // The workspace has `leaper.detectedPairs`, scoped to Plaintext, configured to:
        //
        //      []
        //
        // while Plaintext autocloses the following pairs:
        //
        //      [ "{}", "[]", "()" ]
        //
        // Therefore we would expect none of the autoclosing pairs of Plaintext to be tracked.
        await executor.openFile('./workspace-1/text.txt');
        await testDetectedPairs(executor, [], [ "{}", "[]", "()" ]);

        // 2b. Repeat the test after moving the opened text editor to another tab.
        //
        // This tests whether we can move the text editor without affecting its loaded configuration 
        // values.
        await executor.moveEditorToRight();
        await testDetectedPairs(executor, [], [ "{}", "[]", "()" ]);

        // 3a. Test whether workspace folder configuration values can be read.
        //
        // For this, we use the Typescript file within the second workspace folder.
        // 
        // The second workspace folder has `leaper.detectedPairs` configured to:
        // 
        //     [ "()" ]
        //
        // while Typescript autocloses the following pairs:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        // 
        // Therefore we would expect the following autoclosing pairs of Typescript to be tracked:
        //
        //     [ "()" ]
        // 
        // and would expect the following autoclosing pairs of Typescript to not be tracked: 
        //
        //     [ "{}", "[]", "''", "\"\"", "``" ]
        await executor.openFile('./workspace-2/text.ts');
        await testDetectedPairs(executor, [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);

        // 3b. Repeat the test after moving the active text editor to another tab.
        //
        // This tests whether we can move the text editor without affecting its loaded configuration 
        // values.
        await executor.moveEditorToRight();
        await testDetectedPairs(executor, [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);

        // 4a. Test whether language-specific workspace folder configuration values can be read.
        //
        // For this, we use the Markdown file within the third workspace folder.
        //
        // The second workspace folder has `leaper.detectedPairs`, scoped to Markdown, configured to:
        //
        //     [ "{}", "<>" ]
        //
        // while Markdown autocloses the following pairs:
        //
        //     [ "{}", "()", "<>", "[]" ]
        //
        // Therefore we would expect the following autoclosing pairs of Markdown to be tracked:
        //
        //     [ "{}", "<>" ]
        //
        // and would expect the following autoclosing pairs of Markdown to not be tracked:
        //
        //     [ "()", "[]" ]
        await executor.openFile('./workspace-3/text.md');
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);

        // 4b. Repeat the test after moving the active text editor to another tab.
        //
        // This tests whether we can move the text editor without affecting its loaded configuration 
        // values.
        await executor.moveEditorToRight();
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);

    }
});

/**
 * This test group tests whether this extension can correctly read configuration values.
 *
 * Within this group, the `leaper.detectedPairs` configuration will be modified in the workspace and 
 * workspace folder scopes in order to check if this extension can properly reload configuration 
 * values when they change.
 */
export const CONFIGURATION_READING_TEST_GROUP = new TestGroup({
    name: 'Configuration Reading',
    testCases: [
        CAN_READ_VALUES_TEST_CASE
    ]
});
