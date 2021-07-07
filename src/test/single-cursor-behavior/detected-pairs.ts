import { ViewColumn } from 'vscode';
import { Configuration } from '../../engine/tracker/configuration/configuration';
import { CompactPosition } from '../utilities/compact';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * Test the effective `leaper.detectedPairs` configuration in the active text editor by asserting 
 * that:
 * 
 *  - The autoclosing pairs in `should` are detected.
 *  - The autoclosing pairs in `shouldNot` are not detected.
 * 
 * **Please make sure that the pairs provided are actual autoclosing pairs in the language of the
 * active text editor**. For instance, `<>`, even though it is a commonly used pair in languages 
 * with generics like Rust or Typescript, is not autoclosed in either language. 
 */
async function testDetectedPairs(
    executor:  Executor,
    should:    ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[],
    shouldNot: ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[]
): Promise<void> {

    /**
     * Type in the opening side of each pair (which are expected to be autoclosed), then depending
     * on `expectTrack`:
     *  
     *  - If `true`, will assert that each inserted pair is tracked by the engine.
     *  - If `false`, will assert that each inserted pair is not tracked by the engine.
     * 
     * This function will undo all the pairs that it inserted and restore the cursor to its original
     * position when it is done.
     */
    async function check(
        initialCursorPosition: CompactPosition,
        pairs: ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[],
        expectTrack: boolean
    ): Promise<void> {
        const [line, column] = initialCursorPosition;
        for (const pair of pairs) {

            // Type in the opening side, which is expected to be autoclosed.
            await executor.typeText(pair[0]);

            // As a safety precaution, check that the cursor is advanced by 1 unit, as it would when 
            // typing in a pair that is then autoclosed.
            await executor.assertCursors([ [line, column + 1] ]);

            // Check that the pair is being tracked (or not tracked, depending on `expectTrack`).
            if (expectTrack) {
                await executor.assertPairs([{ line, sides: [column, column + 1] }]);
            } else {
                await executor.assertPairs([ 'None' ]);
            }

            // Remove the inserted pair.
            await executor.undo();

            // Check that the undo was successful.
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ initialCursorPosition ]);
        }
    }

    // Some of the documents that we open might already have preexisting text it. Thus, we do this 
    // so that when the opening side of pairs are entered, we know that they will be autoclosed.
    await executor.moveCursors('endOfDocument');

    const initialCursorPosition = (await executor.getCursors())[0] as [number, number];
    await check(initialCursorPosition, should,    true);
    await check(initialCursorPosition, shouldNot, false);
}

/**
 * Test whether the configuration value for `leaper.detectedPairs`'s is being correctly read and 
 * that its value appropriately affects the behavior of the engine.
 */
const WORKS_TEST_CASE = new TestCase({
    name: 'Works',
    languageId: 'typescript',
    task: async (executor) => {

        // Within this test case we shall be switching between different text editors within the 
        // test workspace. Each of the text documents in the test workspace has been preconfigured 
        // to have effective values inherited from different scopes. 

        // 1. Effective value from workspace scope.
        // 
        // For this, we use the text editor that is provided to this test case.
        // 
        // The root workspace has `leaper.detectedPairs` configured to: 
        // 
        //     [ "{}", "[]", "()", "''", "\"\"", "``", "<>" ]
        // 
        // while Typescript autocloses the following pairs: 
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        //
        // Because the text editor provided is Typescript and does not belong to any of the workspace
        // folders within the test workspace, its effective value will be from the root workspace
        // scope. Therefore we expect all of the autoclosing pairs of Typescript to be tracked.
        await testDetectedPairs(executor, [ "{}", "[]", "()", "''", "\"\"", "``" ], []);

        // 2. Effective value from language-specific workspace scope.
        //
        // For this, we use the Plaintext file within Workspace Folder 1.
        //
        // The root workspace has `leaper.detectedPairs`, scoped to Plaintext, configured to:
        //
        //      []
        //
        // while Plaintext autocloses the following pairs:
        //
        //      [ "{}", "[]", "()" ]
        //
        // Workspace Folder 1 does not override the root workspace value. Therefore we expect none 
        // of the autoclosing pairs of Plaintext to be tracked.
        await executor.openFile('./workspace-1/text.txt');
        await testDetectedPairs(executor, [], [ "{}", "[]", "()" ]);

        // 2-Extra. Repeat the test after moving the opened text editor to another tab.
        //
        // This tests whether we can move the text editor without affecting its effective 
        // configuration value.
        await executor.moveEditorToGroup('right');
        await testDetectedPairs(executor, [], [ "{}", "[]", "()" ]);

        // 3. Effective value from workspace folder scope.
        //
        // For this, we use the Typescript file within Workspace Folder 2.
        // 
        // Workspace Folder 2 has `leaper.detectedPairs` configured to:
        // 
        //     [ "()" ]
        //
        // while Typescript autocloses the following pairs:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        // 
        // Therefore we expect the following autoclosing pairs of Typescript to be tracked:
        //
        //     [ "()" ]
        // 
        // and expect the following autoclosing pairs of Typescript to not be tracked: 
        //
        //     [ "{}", "[]", "''", "\"\"", "``" ]
        //
        await executor.openFile('./workspace-2/text.ts');
        await testDetectedPairs(executor, [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);

        // 3-Extra. Repeat the test after moving the active text editor to another tab.
        //
        // This tests whether we can move the text editor without affecting its effective configuration 
        // value.
        await executor.moveEditorToGroup('right');
        await testDetectedPairs(executor, [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);

        // 4. Effective value from language-specific workspace folder scope.
        //
        // For this, we use the Markdown file within Workspace Folder 3.
        //
        // Workspace Folder 3 has `leaper.detectedPairs`, scoped to Markdown, configured to:
        //
        //     [ "{}", "<>" ]
        //
        // while Markdown autocloses the following pairs:
        //
        //     [ "{}", "()", "<>", "[]" ]
        //
        // Therefore we expect the following autoclosing pairs of Markdown to be tracked:
        //
        //     [ "{}", "<>" ]
        //
        // and expect the following autoclosing pairs of Markdown to not be tracked:
        //
        //     [ "()", "[]" ]
        //
        await executor.openFile('./workspace-3/text.md');
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);

        // 4-Extra. Repeat the test after moving the active text editor to another tab.
        //
        // This tests whether we can move the text editor without affecting its loaded configuration 
        // values.
        await executor.moveEditorToGroup('right');
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);
    }
});

/**
 * Check that when the effective value of `leaper.detectedPairs` has changed that the new effective
 * value is automatically reloaded.
 */
const AUTOMATIC_RELOAD_OF_LATEST_EFFECTIVE_VALUE_TEST_CASE = new TestCase({
    name: 'Automatic Reload of Latest Effective Value',
    languageId: 'typescript',
    prelude: async (executor) => {

        // Open the text files from the first three workspace folders. 
        //
        // This results in a total of 4 text editors (including the one provided to this test case)
        // being opened, arranged as so:
        //
        //      Provided | Workspace Folder 1 | Workspace Folder 2 | Workspace Folder 3 
        //
        // # Focus
        // 
        // The text editor of Workspace Folder 3 (view column 4) will be in focus after this step.
        await executor.openFile('./workspace-1/text.txt', { viewColumn: ViewColumn.Two   });
        await executor.openFile('./workspace-2/text.ts',  { viewColumn: ViewColumn.Three });
        await executor.openFile('./workspace-3/text.md',  { viewColumn: ViewColumn.Four  });
    },
    task: async (executor) => {

        // Within this test case, we shall modify the configuration's values at various scopes within 
        // the test workspace. We check after each change that the new values are in effect.

        // 1. Change the workspace configuration value.
        //
        // The test workspace's configuration value is changed:
        //
        //     From: [ "{}", "[]", "()", "<>", "''", "\"\"", "``" ]
        // 
        //     To:   [ "{}" ]
        //
        // # Effect on the Provided Text Editor
        // 
        // The provided text editor inherits the workspace configuration value since there are no
        // values in more nested scopes that would override the workspace configuration value.
        //  
        // Since the provided text editor is Typescript, and Typescript autocloses the following 
        // pairs:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        // 
        // we expect the following autoclosing pairs of Typescript to be tracked:
        //
        //     [ "{}" ]
        // 
        // Furthermore, we expect the following autoclosing pairs of Typescript to not be tracked: 
        //
        //     [ "{}", "[]", "''", "\"\"", "``" ]
        //
        // # Effect on the Other Text Editors
        //
        // The other text editors have been configured to override the workspace configuration value, 
        // so no change is expected for them.
        //
        // # Focus 
        // 
        // The provided text editor (view column 1) will be in focus after this step.
        await executor.setConfiguration({
            partialName: 'detectedPairs', 
            value:       [ "{}" ],
        });
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);                // Workspace Folder 3 (Markdown).
        await executor.focusEditorGroup('left');
        await testDetectedPairs(executor, [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);  // Workspace Folder 2 (Typescript).
        await executor.focusEditorGroup('left');
        await testDetectedPairs(executor, [], [ "{}", "[]", "()" ]);                      // Workspace Folder 1 (Plaintext).
        await executor.focusEditorGroup('left');
        await testDetectedPairs(executor, [ "{}" ], [ "[]", "()", "''", "\"\"", "``" ]);  // Provided (Typescript).

        // 2. Change a language-specific workspace configuration value.
        //
        // The test workspace's, scoped to Plaintext, configuration value is changed:
        //
        //     From: []
        //     
        //     To:   [ "[]",  "()" ]
        //
        // # Effect on Workspace Folder 1's Text Editor
        //
        // Workspace Folder 1's text editor inherits the language-specific workspace configuration 
        // value from the root workspace.
        //
        // Since Workspace Folder 1's text editor is Plaintext, and Plaintext autocloses the following 
        // pairs:
        //
        //     [ "{}", "[]", "()" ]
        // 
        // we expect the following autoclosing pairs of Plaintext to be tracked:
        //
        //     [ "[]",  "()" ]
        //
        // Furthermore, we expect the following autoclosing pairs of Plaintext to not be tracked:
        //
        //     [ "{}" ]
        //
        // # Effect on the Other Text Editors
        //
        // The other text editors are not of Plaintext language and are therefore not affected by
        // this change.
        //
        // # Focus 
        //
        // The text editor of Workspace Folder 3 (view column 4) will be in focus after this step.
        await executor.setConfiguration({
            partialName:    'detectedPairs',
            value:          [ "[]", "()" ],
            targetLanguage: 'plaintext',
        });
        await testDetectedPairs(executor, [ "{}" ], [ "[]", "()", "''", "\"\"", "``" ]);  // Provided (Typescript).
        await executor.focusEditorGroup('right');
        await testDetectedPairs(executor, [ "[]", "()" ], [ "{}" ] );                     // Workspace Folder 1 (Plaintext).
        await executor.focusEditorGroup('right');
        await testDetectedPairs(executor, [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);  // Workspace Folder 2 (Typescript).
        await executor.focusEditorGroup('right');
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);                // Workspace Folder 3 (Markdown).

        // 3. Change a workspace folder configuration value.
        //
        // Workspace Folder 2's configuration value is changed:
        //
        //     From: [ "()" ]
        //
        //     To:   [ "''", "\"\"", "``" ]
        //
        // # Effect on Workspace Folder 2's Text Editor
        //
        // Workspace Folder 2's text editor is affected by this change as there is no override of 
        // the configuration value for Typescript in Workspace Folder 2.
        //
        // Since Workspace Folder 2's text editor is Typescript, and Typescript autocloses the 
        // following pairs:
        //
        //      [ "{}", "[]", "()", "''", "\"\"", "``" ]
        //
        // we expect the following autoclosing pairs of Typescript to be tracked:
        //
        //      [ "''", "\"\"", "``" ]
        //
        // Furthermore, we expect the following autoclosing pairs of Typescript to not be tracked: 
        //
        //      [ "{}", "[]", "()" ]
        //
        // # Effect on the Other Text Editors
        //
        // The provided text editor is not within any of the workspace folders so it is not affected. 
        //
        // Meanwhile, the text editors of Workspace Folder 1 and Workspace Folder 3 are not affected 
        // at all as this change only applies to Workspace Folder 2.
        //
        // # Focus 
        // 
        // The provided text editor (view column 1) will be in focus after this step.
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 [ "''", "\"\"", "``" ],
            targetWorkspaceFolder: 'workspace-2'
        });
        await testDetectedPairs(executor, [ "{}", "<>" ], [ "()", "[]" ]);                // Workspace Folder 3 (Markdown).
        await executor.focusEditorGroup('left');
        await testDetectedPairs(executor, [ "''", "\"\"", "``" ], [ "{}", "[]", "()" ]);  // Workspace Folder 2 (Typescript).
        await executor.focusEditorGroup('left');
        await testDetectedPairs(executor, [ "[]", "()" ], [ "{}" ] );                     // Workspace Folder 1 (Plaintext).
        await executor.focusEditorGroup('left');
        await testDetectedPairs(executor, [ "{}" ], [ "[]", "()", "''", "\"\"", "``" ]);  // Provided (Typescript).

        // 4. Change a language-specific workspace folder configuration value.
        //
        // Workspace Folder 3's, scoped to Markdown, configuration value is changed:
        //
        //     From: [ "{}", "<>" ]
        //
        //     To:   [ "{}", "()", "<>", "[]" ]
        //
        // # Effect on Workspace Folder 3's Text Editor
        // 
        // Workspace Folder 3's text editor is affected by this change as its language is Markdown.
        //
        // Since Workspace Folder 3's text editor is Markdown, and Markdown autocloses the following
        // pairs:
        //
        //     [ "{}", "()", "<>", "[]" ]
        //
        // we expect all of the autoclosing pairs of Markdown to be tracked.
        //
        // Furthermore, we expect none of the autoclosing pairs of Markdown to not be tracked.
        //
        // # Effect on Other Text Editors
        //
        // The provided text editor is not within any of the workspace folders so it is not affected.
        //
        // Meanwhile, the text editors of Workspace Folder 1 and Workspace Folder 2 are not affected 
        // at all as this change only applies to Markdown text editor from Workspace Folder 3.
        //
        // # Focus 
        //
        // The text editor of Workspace Folder 3 (view column 4) will be in focus after this step.
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 [ "{}", "()", "<>", "[]" ],
            targetWorkspaceFolder: 'workspace-3',
            targetLanguage:        'markdown',
        });
        await testDetectedPairs(executor, [ "{}" ], [ "[]", "()", "''", "\"\"", "``" ]);  // Provided (Typescript).
        await executor.focusEditorGroup('right');
        await testDetectedPairs(executor, [ "[]", "()" ], [ "{}" ] );                     // Workspace Folder 1 (Plaintext).
        await executor.focusEditorGroup('right');
        await testDetectedPairs(executor, [ "''", "\"\"", "``" ], [ "{}", "[]", "()" ]);  // Workspace Folder 2 (Typescript).
        await executor.focusEditorGroup('right');
        await testDetectedPairs(executor, [ "{}", "()", "<>", "[]" ], []);                // Workspace Folder 3 (Markdown).
    }
});

/**
 * Check that configuration values which exceed the maximum items limit are rejected.
 */
const REJECT_VALUE_IF_MAX_ITEMS_EXCEEDED_TEST_CASE: TestCase = new TestCase({
    name: 'Reject Value if Max Items Exceeded',
    languageId: 'typescript',
    prelude: async (executor) => {

        // Open the text file from Workspace Folder 2, which has an effective `leaper.detectedPairs`
        // value that comes from the workspace folder of:
        //
        //     [ "()" ]
        //
        await executor.openFile('./workspace-2/text.ts');

        // Since the opened file is Typescript and we know that Typescript autocloses:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        //
        // Then we expect the following autoclosing pairs of Typescript to be tracked:
        //
        //     [ "()" ]
        // 
        // and expect the following autoclosing pairs of Typescript to not be tracked: 
        //
        //     [ "{}", "[]", "''", "\"\"", "``" ]
        //
        await testDetectedPairs(executor,  [ "()" ], [ "{}", "[]", "''", "\"\"", "``" ]);
    },
    task: async (executor) => {

        // Set the configuration value in the workspace folder to one that exceeds the limit.
        const tooManyItemsValue = [];
        for (let i = 0; i < Configuration.DETECTED_PAIRS_MAX_ITEMS + 1; ++i) {

            // It doesn't matter what pairs we use to fill the array since we are just testing 
            // whether the length limiter kicks in.
            tooManyItemsValue.push("()");
        }
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 tooManyItemsValue,
            targetWorkspaceFolder: 'workspace-2'
        });

        // Since the workspace folder value now exceeds the limit, it will be rejected, and the 
        // effective value should now come from the root workspace scope, which has the value:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``", "<>" ]
        //
        // Since the opened file is Typescript and we know that Typescript autocloses:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        //
        // Then we expect all of the autoclosing pairs of Typescript to be tracked.
        await testDetectedPairs(executor, [ "{}", "[]", "()", "''", "\"\"", "``" ], []);
    }
});


/** 
 * A collection of test cases that test the behavior of the `leaper.detectedPairs` configuration 
 * when there is a single cursor.
 */
export const SINGLE_CURSOR_DETECTED_PAIRS_TEST_GROUP: TestGroup = new TestGroup(
    '`leaper.detectedPairs` Configuration',
    [
        WORKS_TEST_CASE,
        AUTOMATIC_RELOAD_OF_LATEST_EFFECTIVE_VALUE_TEST_CASE,
        REJECT_VALUE_IF_MAX_ITEMS_EXCEEDED_TEST_CASE,
    ]
);
