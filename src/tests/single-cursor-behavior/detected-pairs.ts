import { ViewColumn } from 'vscode';
import * as configurations  from '../../engine/configurations/configurations';
import { CompactCluster, CompactCursor } from '../utilities/compact';
import { Executor, TestCase, TestGroup } from '../utilities/framework';
import * as assert from 'assert';

/**
 * Test the effective `leaper.detectedPairs` configuration for a visible text editor by asserting 
 * that:
 * 
 *  - The autoclosing pairs in `should` are detected.
 *  - The autoclosing pairs in `shouldNot` are not detected.
 * 
 * Because different languages have different autoclosing pairs, the pairs that you should specify 
 * in `should` and `shouldNot` depends on the language of the target text editor.
 * 
 * Note that this function takes focus of and overwrites the target text editor. When this function
 * is done, the target text editor will be empty.
 */
async function testDetection(
    executor:          Executor,
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
 * Check that the value configured for `leaper.detectedPairs` appropriately affects the behavior of 
 * the engine.
 */
const IT_WORKS_TEST_CASE = new TestCase({
    name: 'It Works',
    prelude: async (executor) => {

        // Open four files in exclusive view columns.
        // 
        // The following table shows the relevant configuration values for each file:
        // 
        //     View Column                       1            2            3            4          
        //     -------------------------------------------------------------------------------------
        //     Workspace Folder                | 0          | 1          | 2          | 3          |
        //     File                            | text.ts    | text.txt   | text.ts    | text.md    |
        //     -------------------------------------------------------------------------------------
        //     Language                        | Typescript | Plaintext  | Typescript | Markdown   |
        //     Autoclosing Pairs               | (AP-1)     | (AP-3)     | (AP-1)     | (AP-2)     |
        //                                     |            |            |            |            |
        //     leaper.detectedPairs Value      |            |            |            |            |
        //       - Workspace                   | (DP-1)     | (DP-1)     | (DP-1)     | (DP-1)     |
        //       - Workspace Folder            | undefined  | undefined  | [ "()" ]   | []         |
        //       - Language Workspace          | undefined  | []         | undefined  | undefined  |
        //       - Language Workspace Folder   | undefined  | undefined  | undefined  | (DP-2)     |
        //       - Effective                   | (DP-1)     | []         | [ "()" ]   | (DP-2)     |
        //     -------------------------------------------------------------------------------------
        //     
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(AP-2): [ "()", "[]", "{}", "<>" ]
        //     (AP-3): [ "()", "[]", "{}" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //     (DP-2): [ "{}", "<>" ]
        //     
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are not 
        //     consistently autoclosed.
        // 
        await executor.openFile('./workspace-0/text.ts',  ViewColumn.One);
        await executor.openFile('./workspace-1/text.txt', ViewColumn.Two);
        await executor.openFile('./workspace-2/text.ts',  ViewColumn.Three);
        await executor.openFile('./workspace-3/text.md',  ViewColumn.Four);
    },
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
 * Check that configuration values which do not have unique items are rejected.
 */
const REJECT_VALUE_IF_ITEMS_ARE_NOT_UNIQUE_TEST_CASE: TestCase = new TestCase({
    name: 'Reject Value if Items Are Not Unique',
    prelude: async (executor) => {
        
        // For this test case, we will only be using the Typescript file in Workspace Folder 0.
        //
        // The relevant configuration values for that file is:
        //
        //     ---------------------------------------------
        //     Workspace Folder               | 0          |
        //     File                           | text.ts    |
        //     ---------------------------------------------
        //     Language                       | Typescript |
        //     Autoclosing Pairs              | (AP-1)     |
        //                                    |            |
        //     leaper.detectedPairs Value     |            |
        //       - Workspace                  | (DP-1)     |
        //       - Workspace Folder           | undefined  |
        //       - Language Workspace         | undefined  |
        //       - Language Workspace Folder  | undefined  |
        //       - Effective                  | (DP-1)     |
        //     ---------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //
        await executor.openFile('./workspace-0/text.ts');
    },
    task: async (executor) => {

        // Set the configuration value in Workspace Folder 0 to one that does not have unique items.
        await executor.setConfiguration({
            name:                  'leaper.detectedPairs',
            value:                 [ "{}", "[]", "[]" ],
            targetWorkspaceFolder: 'workspace-0'
        });

        // Since the workspace folder value does not have unique items, it will be ignored, and the 
        // effective value will still come from the root workspace scope.
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
    prelude: async (executor) => {

        // For this test case, we will only be using the Typescript file in Workspace Folder 0.
        //
        // The relevant configuration values for that file is:
        //
        //     ---------------------------------------------
        //     Workspace Folder               | 0          |
        //     File                           | text.ts    |
        //     ---------------------------------------------
        //     Language                       | Typescript |
        //     Autoclosing Pairs              | (AP-1)     |
        //                                    |            |
        //     leaper.detectedPairs Value     |            |
        //       - Workspace                  | (DP-1)     |
        //       - Workspace Folder           | undefined  |
        //       - Language Workspace         | undefined  |
        //       - Language Workspace Folder  | undefined  |
        //       - Effective                  | (DP-1)     |
        //     ---------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //
        await executor.openFile('./workspace-0/text.ts');
    },
    task: async (executor) => {

        // Set the configuration value in Workspace Folder 0 to one that exceeds the limit. 
        const tooManyItemsValue = [];
        for (let i = 0; i < configurations.DETECTED_PAIRS_MAX_ITEMS + 1; ++i) {
            tooManyItemsValue.push("()");
        }
        await executor.setConfiguration({
            name:                  'leaper.detectedPairs',
            value:                 tooManyItemsValue,
            targetWorkspaceFolder: 'workspace-0'
        });

        // Since the workspace folder value exceeds the limit, it will be ignored, and the effective 
        // value will still come from the root workspace scope.
        await testDetection(executor, 'first', {
            language:  'typescript',
            should:    [ "{}", "[]", "()", "''", "\"\"", "``" ], 
            shouldNot: []
        });
    }
});

/**
 * Check that new effective values of `leaper.detectedPairs` are automatically hot reloaded.
 */
const HOT_RELOAD_TEST_CASE = new TestCase({
    name: 'Hot Reload',
    prelude: async (executor) => {

        // Open two text editors in exclusive view columns.
        //
        // The following table shows the relevant configuration values for the text editor in each 
        // view column:
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 1          | 4          |
        //     File                           | text.txt   | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Plaintext  | Typescript |
        //     Autoclosing Pairs              | (AP-3)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Workspace                  | (DP-1)     | (DP-1)     |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | []         | undefined  |
        //       - Language Workspace Folder  | undefined  | undefined  |
        //       - Effective                  | []         | (DP-1)     |
        //     ----------------------------------------------------------
        //     
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     (AP-3): [ "()", "[]", "{}" ]
        //     
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //
        await executor.openFile('./workspace-1/text.txt', ViewColumn.One);
        await executor.openFile('./workspace-4/text.ts',  ViewColumn.Two);

        // As a precaution we check that the two text editors have been correctly preconfigured.
        await testDetection(executor, 'first', { 
            language:  'plaintext',
            should:    [],
            shouldNot: ["()", "[]", "{}"] 
        });
        await testDetection(executor, 'second', { 
            language:  'typescript',
            should:    [ "()", "[]", "{}", "``", "''", "\"\"" ],
            shouldNot: [] 
        });

        // For variety's sake, type some filler text into both text editors.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT 
        // FILLER TEXT ^(cursor position) 
        // ```
        //
        await executor.focusEditorGroup('first');
        await executor.typeText('FILLER TEXT \nFILLER TEXT \nFILLER TEXT ');
        await executor.setCursors([ [1, 12] ]);
        await executor.focusEditorGroup('second');
        await executor.typeText('FILLER TEXT \nFILLER TEXT \nFILLER TEXT ');
        await executor.setCursors([ [1, 12] ]);
    },
    task: async (executor) => {

        async function typeThenCheck(
            executor:        Executor,
            whichTextEditor: 'first' | 'second',
            textToTypeIn:    string,
            expectPairs:     CompactCluster[],
            expectCursors:   CompactCursor[]
        ): Promise<void> {
            await executor.focusEditorGroup(whichTextEditor);
            await executor.typeText(textToTypeIn);
            await executor.assertPairs(expectPairs);
            await executor.assertCursors(expectCursors);
        }

        // 1. Change the root workspace's configuration value.
        //
        // This changes the effective value for view column 2's text editor.
        // 
        // The relevant configuration values after this change:
        // 
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 1          | 4          |
        //     File                           | text.txt   | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Plaintext  | Typescript |
        //     Autoclosing Pairs              | (AP-3)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Workspace                  | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | []         | undefined  |
        //       - Language Workspace Folder  | undefined  | undefined  |
        //       - Effective                  | []         | [ "{}" ]   |
        //     ----------------------------------------------------------
        //     
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     (AP-3): [ "()", "[]", "{}" ]
        //
        await executor.setConfiguration({
            name:  'leaper.detectedPairs', 
            value: [ "{}" ],
        });

        // Type some pairs into both text editors and check that view column 2's text editor now 
        // only detects newly inserted `{}` pairs, while view column 1's text editor does not detect 
        // any newly inserted pair. 
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{}])
        // FILLER TEXT    ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first',  '([{', [ 'None' ], [ [1, 15] ]);
        await typeThenCheck(executor, 'second', '([{', [ { line: 1, sides: [14, 15] } ], [ [1, 15] ]);

        // Type more filler text into both text editors and check that the tracking behaves as 
        // expected for the one previously detected pair.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO }])
        // FILLER TEXT           ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first',  ' HELLO ', [ 'None' ], [ [1, 22] ]);
        await typeThenCheck(executor, 'second', ' HELLO ', [ { line: 1, sides: [14, 22] } ], [ [1, 22] ]);

        // 2. Change the Plaintext specific workspace configuration value.
        //
        // This changes the effective value for view column 1's text editor.
        // 
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 1          | 4          |
        //     File                           | text.txt   | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Plaintext  | Typescript |
        //     Autoclosing Pairs              | (AP-3)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Workspace                  | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | (DP-3)     | undefined  |
        //       - Language Workspace Folder  | undefined  | undefined  |
        //       - Effective                  | (DP-3)     | [ "{}" ]   |
        //     ----------------------------------------------------------
        //     
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     (AP-3): [ "()", "[]", "{}" ]
        //   
        //     (DP-3): [ "[]", "()" ]
        //
        await executor.setConfiguration({
            name:           'leaper.detectedPairs',
            value:          [ "[]", "()" ],
            targetLanguage: 'plaintext',
        });

        // Type more pairs into both text editors and check that view column 1's text editor now 
        // detects newly inserted `[]` and `()` pairs, while nothing changes for view column 2's
        // text editor continues to only detect newly inserted `{}` pairs.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO ([{}])}])
        // FILLER TEXT              ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first', '([{', 
            [ { line: 1, sides: [22, 23, 26, 27] } ], 
            [ [1, 25] ]
        );
        await typeThenCheck(executor, 'second', '([{', 
            [ { line: 1, sides: [14, 24, 25, 28] } ], 
            [ [1, 25] ]
        );

        // Type more filler text into both text editors and check that the tracking behaves as 
        // expected for all detected pairs so far.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO ([{ WORLD }])}])
        // FILLER TEXT                     ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first', ' WORLD ', 
            [ { line: 1, sides: [22, 23, 33, 34] } ], 
            [ [1, 32] ]
        );
        await typeThenCheck(executor, 'second', ' WORLD ', 
            [ { line: 1, sides: [14, 24, 32, 35] } ], 
            [ [1, 32] ]
        );

        // 3. Change Workspace Folder 4's configuration value.
        //
        // This changes the effective value for view column 2's text editor.
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 1          | 4          |
        //     File                           | text.txt   | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Plaintext  | Typescript |
        //     Autoclosing Pairs              | (AP-3)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Workspace                  | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder           | undefined  | (DP-3)     |
        //       - Language Workspace         | (DP-3)     | undefined  |
        //       - Language Workspace Folder  | undefined  | undefined  |
        //       - Effective                  | (DP-3)     | (DP-3)     |
        //     ----------------------------------------------------------
        //     
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     (AP-3): [ "()", "[]", "{}" ]
        //   
        //     (DP-3): [ "[]", "()" ]
        //
        await executor.setConfiguration({
            name:                  'leaper.detectedPairs',
            value:                 [ "[]", "()" ],
            targetWorkspaceFolder: 'workspace-4'
        });

        // Type more pairs into both text editors and check both text editors only detect newly 
        // inserted `[]` and `()` pairs.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO ([{ WORLD ( [ { }])}])}])
        // FILLER TEXT                           ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first', '( [ { ', 
            [ { line: 1, sides: [22, 23, 32, 34, 39, 40, 42, 43] } ], 
            [ [1, 38] ]
        );
        await typeThenCheck(executor, 'second', '( [ { ', 
            [ { line: 1, sides: [14, 24, 32, 34, 39, 40, 41, 44] } ], 
            [ [1, 38] ]
        );

        // Leap and move out of some pairs while typing some filler indentations in, then check that 
        // tracking behaves as expected.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO ([{ WORLD ( [ { } ] ) }])}])
        // FILLER TEXT                           ^(cursor position) 
        // ```
        //
        async function typeFillerIndentation(): Promise<void> {
            await executor.moveCursors('right');
            await executor.typeText(' ');
            await executor.leap();
            await executor.typeText(' ');
            await executor.leap();
            await executor.typeText(' ');
            await executor.moveCursors('left', 6);
        }
        await executor.focusEditorGroup('first');
        await typeFillerIndentation();
        await executor.assertPairs([ { line: 1, sides: [22, 23, 45, 46] } ]);
        await executor.assertCursors([ [1, 38] ]);
        await executor.focusEditorGroup('second');
        await typeFillerIndentation();
        await executor.assertPairs([ { line: 1, sides: [14, 24, 44, 47] } ]);
        await executor.assertCursors([ [1, 38] ]);

        // 4. Change Workspace Folder 4's Typescript specific configuration value.
        //
        // This changes the effective value for view column 2's text editor.
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 1          | 4          |
        //     File                           | text.txt   | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Plaintext  | Typescript |
        //     Autoclosing Pairs              | (AP-3)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Workspace                  | [ "{}" ]   | [ "{}" ]   |
        //       - Workspace Folder           | undefined  | (DP-3)     |
        //       - Language Workspace         | (DP-3)     | undefined  |
        //       - Language Workspace Folder  | undefined  | [ "()" ]   |
        //       - Effective                  | (DP-3)     | [ "()" ]   |
        //     ----------------------------------------------------------
        //     
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     (AP-3): [ "()", "[]", "{}" ]
        //   
        //     (DP-3): [ "[]", "()" ]
        //
        await executor.setConfiguration({
            name:                  'leaper.detectedPairs',
            value:                 [ "()" ],
            targetWorkspaceFolder: 'workspace-4',
            targetLanguage:        'typescript',
        });

        // Type more pairs into both text editors and check that both text editors detect newly 
        // inserted `()` pairs, but only the text editor in view column 1 detects newly inserted
        // `[]` pairs.
        // 
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO ([{ WORLD ( [ { {{[[(())]]}}} ] ) }])}])
        // FILLER TEXT                                 ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first', '{{[[((',
            [ { line: 1, sides: [22, 23, 40, 41, 42, 43, 44, 45, 46, 47, 57, 58] } ],
            [ [1, 44] ]
        );
        await typeThenCheck(executor, 'second', '{{[[((', 
            [ { line: 1, sides: [14, 24, 42, 43, 44, 45, 56, 59] } ],
            [ [1, 44] ]
        );
        
        // Type more filler text into both text editors and check that the tracking behaves as 
        // expected for all the pairs that have been detected.
        //
        // Both text editors will have the following state after this step:
        //
        // ```
        // FILLER TEXT 
        // FILLER TEXT ([{ HELLO ([{ WORLD ( [ { {{[[(( GOODBYE ))]]}}} ] ) }])}])
        // FILLER TEXT                                          ^(cursor position) 
        // ```
        //
        await typeThenCheck(executor, 'first', ' GOODBYE ',
            [ { line: 1, sides: [22, 23, 40, 41, 42, 43, 53, 54, 55, 56, 66, 67] } ],
            [ [1, 53] ]
        );
        await typeThenCheck(executor, 'second', ' GOODBYE ', 
            [ { line: 1, sides: [14, 24, 42, 43, 53, 54, 65, 68] } ],
            [ [1, 53] ]
        );
    }
});

/**
 * Just a cursory test to make sure that the deprecated configuration is being read.
 */
 const DEPRECATED_CONFIGURATION_TEST_CASE = new TestCase({
    name: 'Deprecated Configuration: `leaper.additionalTriggerPairs`',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');

        // Disable `leaper.detectedPairs` in the root workspace so that it does not shadow the 
        // deprecated configuration.
        await executor.setConfiguration({
            name:  'leaper.detectedPairs',
            value: undefined
        });
    },
    task: async (executor) => {

        // Set the deprecated configuration in the root workspace.
        await executor.setDeprecatedConfiguration({
            name:  'leaper.additionalTriggerPairs',
            value: [
                { open: "|", close: "|" },
                { open: "*", close: "*" } 
            ]
        });

        // Since I do not know of a language that has `||` or `**` as autoclosing pairs, I can only
        // query the engine's configuration reader directly instead of inserting those pairs into
        // the document and then calling `executor.assertPairs`.
        assert.deepStrictEqual(
            configurations.detectedPairs.read(),
            [ "()", "[]", "{}", "<>", "``", "''", "\"\"", "||", "**" ], 
        );

    }
});

/** 
 * A collection of test cases that test the behavior of the `leaper.detectedPairs` configuration 
 * when there is a single cursor.
 */
export const SINGLE_CURSOR_DETECTED_PAIRS_TEST_GROUP: TestGroup = new TestGroup(
    'Configuration: `leaper.detectedPairs`',
    [
        IT_WORKS_TEST_CASE,
        REJECT_VALUE_IF_ITEMS_ARE_NOT_UNIQUE_TEST_CASE,
        REJECT_VALUE_IF_MAX_ITEMS_EXCEEDED_TEST_CASE,
        HOT_RELOAD_TEST_CASE,
        DEPRECATED_CONFIGURATION_TEST_CASE
    ]
);
