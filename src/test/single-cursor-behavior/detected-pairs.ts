import { ViewColumn } from 'vscode';
import { Configuration } from '../../engine/configuration/configuration';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * Test the effective `leaper.detectedPairs` configuration in a visible text editor by asserting 
 * that:
 * 
 *  - The autoclosing pairs in `should` are detected.
 *  - The autoclosing pairs in `shouldNot` are not detected.
 * 
 * Because different languages have different autoclosing pairs, the pairs that you can specify in
 * `should` and `shouldNot` also depends on the language of the target text editor.
 * 
 * Note that this function takes focus of and overwrites the target text editor.
 */
async function testDetection(
    executor: Executor,
    targetViewColumn: 'first' | 'second' | 'third' | 'fourth',
    args: {
            language: 'typescript',
            should:    ("{}" | "[]" | "()" | "''" | "\"\"" | "``")[],
            shouldNot: ("{}" | "[]" | "()" | "''" | "\"\"" | "``")[],
          } | 
          {
            language: 'plaintext',
            should:    ("{}" | "[]" | "()" )[],
            shouldNot: ("{}" | "[]" | "()" )[],
          } |
          {
            language: 'markdown',
            should:    ("{}" | "[]" | "()" | "<>" )[],
            shouldNot: ("{}" | "[]" | "()" | "<>" )[],
          }
): Promise<void> {
    await executor.focusEditorGroup(targetViewColumn);

    // Get rid of all existing text so we know where pairs will be inserted.
    await executor.deleteAll();

    /**
     * Type in the opening side of each pair (which are expected to be autoclosed), then depending
     * on `expectTrack`:
     *  
     *  - If `true`, will assert that each inserted pair is tracked by the engine.
     *  - If `false`, will assert that each inserted pair is not tracked by the engine.
     * 
     * This function will undo all the pairs that it inserted when it is done.
     */
    async function check(
        executor:    Executor,
        pairs:       ("{}" | "[]" | "()" | "''" | "\"\"" | "``" | "<>")[],
        expectTrack: boolean
    ): Promise<void> {
        for (const pair of pairs) {

            // Type in the opening side, which is expected to be autoclosed.
            await executor.typeText(pair[0]);

            // Check that the pair is being tracked (or not tracked, depending on `expectTrack`).
            if (expectTrack) {
                await executor.assertPairs([{ line: 0, sides: [0, 1] }]);
            } else {
                await executor.assertPairs([ 'None' ]);
            }

            // As a precaution, check that the cursor is advanced by 1 unit, as it would when typing 
            // in a pair that is then autoclosed.
            await executor.assertCursors([ [0, 1] ]);

            // Remove the inserted pair.
            await executor.undo();

            // Check that the undo was successful.
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [0, 0] ]);
        }
    }

    await check(executor, args.should,    true);
    await check(executor, args.shouldNot, false);
}

/**
 * Open four text editors in exclusive view columns.
 *
 * The following table shows the relevant configuration values for the text editors in each view 
 * column:
 * 
 *     View Column                       1            2            3            4          
 *     -------------------------------------------------------------------------------------
 *     Workspace Folder                | 0          | 1          | 2          | 3          |
 *     File                            | text.ts    | text.txt   | text.ts    | text.md    |
 *     -------------------------------------------------------------------------------------
 *     Language                        | Typescript | Plaintext  | Typescript | Markdown   |
 *     Autoclosing Pairs               | (A1)       | (A3)       | (A1)       | (A2)       |
 *                                     |            |            |            |            |
 *     leaper.detectedPairs Value      |            |            |            |            |
 *       - Workspace                   | (P1)       | (P1)       | (P1)       | (P1)       |
 *       - Workspace Folder            | undefined  | undefined  | [ "()" ]   | []         |
 *       - Language Workspace          | undefined  | []         | undefined  | undefined  |
 *       - Language Workspace Folder   | undefined  | undefined  | undefined  | (P2)       |
 *       - Effective                   | (P1)       | []         | [ "()" ]   | (P2)       |
 *     -------------------------------------------------------------------------------------
 *     
 *     (A1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
 *     *(A2): [ "()", "[]", "{}", "<>" ]
 *     (A3): [ "()", "[]", "{}" ]
 *     (P1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
 *     (P2): [ "{}", "<>" ]
 *     
 *     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
 *     consistently autoclosed.
 */
async function prelude(executor: Executor): Promise<void> {
    await executor.openFile('./workspace-0/text.ts');
    await executor.openFile('./workspace-1/text.txt', { viewColumn: ViewColumn.Two });
    await executor.openFile('./workspace-2/text.ts',  { viewColumn: ViewColumn.Three });
    await executor.openFile('./workspace-3/text.md',  { viewColumn: ViewColumn.Four });
}

/**
 * Test whether the configuration value for `leaper.detectedPairs` is being correctly read and that 
 * its value appropriately affects the behavior of the engine.
 */
const WORKS_TEST_CASE = new TestCase({
    name: 'Works',
    prelude,
    task: async (executor) => {

        // 1. Test effective value from workspace scope.
        // 
        // For this, we use the Typescript text editor in view column 1.
        // 
        // Since the text editor in view column 1 has an effective `leaper.detectedPairs` value of:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``", "<>" ]
        // 
        // while Typescript autocloses the following pairs: 
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        //
        // Then we expect all of the pairs that Typescript autocloses to be detected.
        await testDetection(executor, 'first', { 
            language: 'typescript',
            should:    [ "{}", "[]", "()", "''", "\"\"", "``" ], 
            shouldNot: []
        });

        // 2. Test effective value from language-specific workspace scope.
        //
        // For this, we use the Plaintext text editor in view column 2.
        //
        // Since the text editor in view column 2 has an effective `leaper.detectedPairs` value of:
        //
        //      []
        //
        // while Plaintext autocloses the following pairs:
        //
        //      [ "{}", "[]", "()" ]
        //
        // Then we expect none of the pairs that Plaintext autocloses to be detected.
        await testDetection(executor, 'second', {
            language:  'plaintext',
            should:    [], 
            shouldNot: [ "{}", "[]", "()" ]
        });

        // 3. Test effective value from workspace folder scope.
        //
        // For this, we use the Typescript text editor in view column 3.
        // 
        // Since the text editor in view column 3 has an effective `leaper.detectedPairs` value of:
        // 
        //     [ "()" ]
        //
        // while Typescript autocloses the following pairs:
        //
        //     [ "{}", "[]", "()", "''", "\"\"", "``" ]
        // 
        // Then we expect the following autoclosing pairs of Typescript to be detected:
        //
        //     [ "()" ]
        // 
        // and expect the following autoclosing pairs of Typescript to not be detected:
        //
        //     [ "{}", "[]", "''", "\"\"", "``" ]
        //
        await testDetection(executor, 'third', {
            language:  'typescript',
            should:    [ "()" ], 
            shouldNot: [ "{}", "[]", "''", "\"\"", "``" ]
        });

        // 4. Test effective value from language-specific workspace folder scope.
        //
        // For this, we use the Markdown text editor in view column 4.
        //
        // Since the text editor in view column 4 has an effective `leaper.detectedPairs` value of:
        //
        //     [ "{}", "<>" ]
        //
        // while Markdown autocloses the following pairs:
        //
        //     [ "{}", "()", "<>", "[]" ]
        //
        // Then we expect the following autoclosing pairs of Markdown to be detected:
        //
        //     [ "{}", "<>" ]
        //
        // and expect the following autoclosing pairs of Markdown to not be detected:
        //
        //     [ "()", "[]" ]
        //
        await testDetection(executor, 'fourth', {
            language:  'markdown',
            should:    [ "{}", "<>" ], 
            shouldNot: [ "()", "[]" ]
        });

        // 5 (Extra). Repeat the test in step 4 after moving the text editor in view column 4 to 
        //            view column 3.
        //
        // This tests whether we can move a text editor without affecting its effective configuration 
        // value.
        //
        // Note that moving the text editor in view column 4 to view column 3 causes view column 4 
        // to close, meaning that after this step, there will only be three view columns.
        await executor.moveEditorToGroup('left');
        await testDetection(executor, 'third', {
            language:  'markdown',
            should:    [ "{}", "<>" ], 
            shouldNot: [ "()", "[]" ]
        });

        // 6 (Extra). Repeat the test in step 2 after moving the text editor in view column 2 to 
        //            view column 3.
        // 
        // This tests whether we can move a text editor without affecting its effective configuration 
        // value.
        //
        // Note that moving the text editor in view column 2 to view column 3 causes view column 2
        // to close. View column 3 then becomes view column 2. This means that after this step, 
        // there will only be three view columns.
        await executor.focusEditorGroup('second');
        await executor.moveEditorToGroup('right');
        await testDetection(executor, 'second', {
            language:  'plaintext',
            should:    [], 
            shouldNot: [ "{}", "[]", "()" ]
        });   
    }
});

/**
 * Check that when the effective value of `leaper.detectedPairs` has changed that the new effective
 * value is automatically reloaded.
 */
const AUTOMATIC_RELOAD_OF_LATEST_EFFECTIVE_VALUE_TEST_CASE = new TestCase({
    name: 'Automatic Reload of Latest Effective Value',
    prelude,
    task: async (executor) => {

        // Within this test case, we will modify the configuration's values at various scopes within 
        // the test workspace. We check after each change that the effective values are as expected.
        //
        // For the sake of brevity, we will not be writing specific comments explaining why we expect 
        // certain pairs to be detected and certain pairs to not be detected. The general approach 
        // for a given text editor is that the pairs that should be detected is the intersection 
        // between the set of pairs autoclosed by the language of that text editor with the effective 
        // value of `leaper.detectedPairs`, while the pairs that should not be detected is the set 
        // of pairs autoclosed by the language of that text editor less the effective value of 
        // `leaper.detectedPairs`. Please consult the 'Works' test case for detailed examples.
        
        // 1. Change the workspace configuration value.
        //
        // This changes the effective value of the text editor in view column 1. The other text 
        // editors maintain their effective values.
        // 
        // The relevant configuration values after this change:
        // 
        //     View Column                       1            2            3            4          
        //     -------------------------------------------------------------------------------------
        //     Workspace Folder                | 0          | 1          | 2          | 3          |
        //     File                            | text.ts    | text.txt   | text.ts    | text.md    |
        //     -------------------------------------------------------------------------------------
        //     Language                        | Typescript | Plaintext  | Typescript | Markdown   |
        //     Autoclosing Pairs               | (A1)       | (A3)       | (A1)       | (A2)       |
        //                                     |            |            |            |            |
        //     leaper.detectedPairs Value      |            |            |            |            |
        //       - Workspace                   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder            | undefined  | undefined  | [ "()" ]   | []         |
        //       - Language Workspace          | undefined  | []         | undefined  | undefined  |
        //       - Language Workspace Folder   | undefined  | undefined  | undefined  | (P2)       |
        //       - Effective                   | [ "{}" ]   | []         | [ "()" ]   | (P2)       |
        //     -------------------------------------------------------------------------------------
        //     
        //     (A1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(A2): [ "()", "[]", "{}", "<>" ]
        //     (A3): [ "()", "[]", "{}" ]
        //     (P2): [ "{}", "<>" ]
        //     
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
        //     consistently autoclosed.
        //
        await executor.setConfiguration({
            partialName: 'detectedPairs', 
            value:       [ "{}" ],
        });
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}" ], 
            shouldNot: [ "[]", "()", "''", "\"\"", "``" ]
        });
        await testDetection(executor, 'second', {
            language:  'plaintext',
            should:    [], 
            shouldNot: [ "{}", "[]", "()" ]
        });
        await testDetection(executor, 'third', { 
            language:  'typescript',
            should:    [ "()" ], 
            shouldNot: [ "{}", "[]", "''", "\"\"", "``" ]
        });
        await testDetection(executor, 'fourth', { 
            language:  'markdown',
            should:    [ "{}", "<>" ], 
            shouldNot: [ "()", "[]" ]
        });

        // 2. Change a language-specific workspace configuration value.
        //
        // For this, we change the Plaintext specific configuration value in the root workspace.
        // This changes the effective value of the text editor in view column 2. The other text
        // editors maintain their effective values.
        // 
        // The relevant configuration values after this change:
        // 
        //     View Column                       1            2            3            4          
        //     -------------------------------------------------------------------------------------
        //     Workspace Folder                | 0          | 1          | 2          | 3          |
        //     File                            | text.ts    | text.txt   | text.ts    | text.md    |
        //     -------------------------------------------------------------------------------------
        //     Language                        | Typescript | Plaintext  | Typescript | Markdown   |
        //     Autoclosing Pairs               | (A1)       | (A3)       | (A1)       | (A2)       |
        //                                     |            |            |            |            |
        //     leaper.detectedPairs Value      |            |            |            |            |
        //       - Workspace                   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder            | undefined  | undefined  | [ "()" ]   | []         |
        //       - Language Workspace          | undefined  | (P3)       | undefined  | undefined  |
        //       - Language Workspace Folder   | undefined  | undefined  | undefined  | (P2)       |
        //       - Effective                   | [ "{}" ]   | (P3)       | [ "()" ]   | (P2)       |
        //     -------------------------------------------------------------------------------------
        //     
        //     (A1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(A2): [ "()", "[]", "{}", "<>" ]
        //     (A3): [ "()", "[]", "{}" ]
        //     (P2): [ "{}", "<>" ]
        //     (P3): [ "[]", "()" ]
        //     
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
        //     consistently autoclosed.
        //
        await executor.setConfiguration({
            partialName:    'detectedPairs',
            value:          [ "[]", "()" ],
            targetLanguage: 'plaintext',
        });
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}" ], 
            shouldNot: [ "[]", "()", "''", "\"\"", "``" ]
        });
        await testDetection(executor, 'second', {
            language:  'plaintext',
            should:    [ "[]", "()" ], 
            shouldNot: [ "{}" ]
        });
        await testDetection(executor, 'third', { 
            language:  'typescript',
            should:    [ "()" ], 
            shouldNot: [ "{}", "[]", "''", "\"\"", "``" ]
        });
        await testDetection(executor, 'fourth', { 
            language:  'markdown',
            should:    [ "{}", "<>" ], 
            shouldNot: [ "()", "[]" ]
        });

        // 3. Change a workspace folder configuration value.
        //
        // For this, we change the configuration value in Workspace Folder 2. This changes the 
        // effective value of the text editor in view column 3. The other text editors maintain 
        // their effective values.
        // 
        // The relevant configuration values after this change:
        // 
        //     View Column                       1            2            3            4          
        //     -------------------------------------------------------------------------------------
        //     Workspace Folder                | 0          | 1          | 2          | 3          |
        //     File                            | text.ts    | text.txt   | text.ts    | text.md    |
        //     -------------------------------------------------------------------------------------
        //     Language                        | Typescript | Plaintext  | Typescript | Markdown   |
        //     Autoclosing Pairs               | (A1)       | (A3)       | (A1)       | (A2)       |
        //                                     |            |            |            |            |
        //     leaper.detectedPairs Value      |            |            |            |            |
        //       - Workspace                   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder            | undefined  | undefined  | (P4)       | []         |
        //       - Language Workspace          | undefined  | (P3)       | undefined  | undefined  |
        //       - Language Workspace Folder   | undefined  | undefined  | undefined  | (P2)       |
        //       - Effective                   | [ "{}" ]   | (P3)       | (P4)       | (P2)       |
        //     -------------------------------------------------------------------------------------
        //     
        //     (A1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(A2): [ "()", "[]", "{}", "<>" ]
        //     (A3): [ "()", "[]", "{}" ]
        //     (P2): [ "{}", "<>" ]
        //     (P3): [ "[]", "()" ]
        //     (P4): [ "''", "\"\"", "``" ]
        //     
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
        //     consistently autoclosed.
        //
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 [ "''", "\"\"", "``" ],
            targetWorkspaceFolder: 'workspace-2'
        });
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}" ], 
            shouldNot: [ "[]", "()", "''", "\"\"", "``" ]
        });
        await testDetection(executor, 'second', {
            language:  'plaintext',
            should:    [ "[]", "()" ], 
            shouldNot: [ "{}" ]
        });
        await testDetection(executor, 'third', { 
            language:  'typescript',
            should:    [ "''", "\"\"", "``" ], 
            shouldNot: [ "{}", "[]", "()" ]
        });
        await testDetection(executor, 'fourth', { 
            language:  'markdown',
            should:    [ "{}", "<>" ], 
            shouldNot: [ "()", "[]" ]
        });

        // 4. Change a language-specific workspace folder configuration value.
        //
        // For this, we change the Markdown specific configuration value in Workspace Folder 3. This 
        // changes the effective value of the text editor in view column 4. The other text editors 
        // maintain their effective values.
        // 
        // The relevant configuration values after this change:
        // 
        //     View Column                       1            2            3            4          
        //     -------------------------------------------------------------------------------------
        //     Workspace Folder                | 0          | 1          | 2          | 3          |
        //     File                            | text.ts    | text.txt   | text.ts    | text.md    |
        //     -------------------------------------------------------------------------------------
        //     Language                        | Typescript | Plaintext  | Typescript | Markdown   |
        //     Autoclosing Pairs               | (A1)       | (A3)       | (A1)       | (A2)       |
        //                                     |            |            |            |            |
        //     leaper.detectedPairs Value      |            |            |            |            |
        //       - Workspace                   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder            | undefined  | undefined  | (P4)       | []         |
        //       - Language Workspace          | undefined  | (P3)       | undefined  | undefined  |
        //       - Language Workspace Folder   | undefined  | undefined  | undefined  | (P5)       |
        //       - Effective                   | [ "{}" ]   | (P3)       | (P4)       | (P5)       |
        //     -------------------------------------------------------------------------------------
        //     
        //     (A1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(A2): [ "()", "[]", "{}", "<>" ]
        //     (A3): [ "()", "[]", "{}" ]
        //     (P2): [ "{}", "<>" ]
        //     (P3): [ "[]", "()" ]
        //     (P4): [ "''", "\"\"", "``" ]
        //     (P5): [ "{}", "()", "<>", "[]" ]
        //     
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
        //     consistently autoclosed.
        //
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 [ "{}", "()", "<>", "[]" ],
            targetWorkspaceFolder: 'workspace-3',
            targetLanguage:        'markdown',
        });
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}" ], 
            shouldNot: [ "[]", "()", "''", "\"\"", "``" ]
        });
        await testDetection(executor, 'second', {
            language:  'plaintext',
            should:    [ "[]", "()" ], 
            shouldNot: [ "{}" ]
        });
        await testDetection(executor, 'third', { 
            language:  'typescript',
            should:    [ "''", "\"\"", "``" ], 
            shouldNot: [ "{}", "[]", "()" ]
        });
        await testDetection(executor, 'fourth', { 
            language:  'markdown',
            should:    [ "{}", "()", "<>", "[]" ], 
            shouldNot: []
        });
    }
});

/**
 * Check that configuration values which do not have unique items are rejected.
 */
const REJECT_VALUE_IF_ITEMS_ARE_NOT_UNIQUE_TEST_CASE: TestCase = new TestCase({
    name: 'Reject Value if Items Are Not Unique',
    prelude,
    task: async (executor) => {

        // For this test case, we will only be using the Typescript document in Workspace Folder 0.
        // The effective value is preconfigured to come from the root workspace scope.

        // Set the configuration value in Workspace Folder 0 to one that does not have unique items.
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 [ "{}", "[]", "[]" ],
            targetWorkspaceFolder: 'workspace-0'
        });

        // Since the workspace folder value does not have unique items, it will be ignored, and the 
        // effective value will continue to come from the root workspace scope.
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}", "[]", "()", "''", "\"\"", "``" ], 
            shouldNot: []
        });
    }
});

/**
 * Check that configuration values which exceed the maximum items limit are rejected.
 */
const REJECT_VALUE_IF_MAX_ITEMS_EXCEEDED_TEST_CASE: TestCase = new TestCase({
    name: 'Reject Value if Max Items Exceeded',
    prelude,
    task: async (executor) => {

        // For this test case, we will only be using the Typescript document in Workspace Folder 0.
        // The effective value is preconfigured to come from the root workspace scope.

        // Set the configuration value in Workspace Folder 0 to one that exceeds the limit. 
        const tooManyItemsValue = [];
        for (let i = 0; i < Configuration.DETECTED_PAIRS_MAX_ITEMS + 1; ++i) {
            tooManyItemsValue.push("()");
        }
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            value:                 tooManyItemsValue,
            targetWorkspaceFolder: 'workspace-0'
        });

        // Since the workspace folder value exceeds the limit, it will be ignored, and the effective 
        // value will continue to come from the root workspace scope.
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}", "[]", "()", "''", "\"\"", "``" ], 
            shouldNot: []
        });
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
        REJECT_VALUE_IF_ITEMS_ARE_NOT_UNIQUE_TEST_CASE,
        REJECT_VALUE_IF_MAX_ITEMS_EXCEEDED_TEST_CASE,
    ]
);
