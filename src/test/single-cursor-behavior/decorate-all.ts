import { ViewColumn } from 'vscode';
import { CompactCluster } from '../utilities/compact';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * Type some pairs into the active text editor then assert that decorations were properly applied.
 * 
 * If the `expectDecorations` parameter is `'all'`, then this function expects decorations to be 
 * applied to all pairs. Otherwise, if it is `'nearest'`, then this function expects decorations to
 * only be applied to the pair nearest to the cursor (i.e. the 'most nested' pair).
 * 
 * Note that this function only checks whether decorations were applied. It does not check for the 
 * style of the decorations. Also note that the active text editor will be overwritten when this 
 * function is called.
 * 
 * # Requirements Before This Function Can Be Called
 * 
 * The active text editor must satisfy the following requirements before this function can be called:
 * 
 *   1. The effective `leaper.detectedPairs` configuration in the active text editor at least have
 *      `[ "()", "[]", "{}" ]`.
 *   2. The active text editor's language must be Typescript.
 * 
 * # Document State Afterwards
 * 
 * By the end of this function, the active text editor will have the following state:
 * 
 * ```
 * async function helloWorld(): Promise<string> {
 *     return new Promise((resolve) => {
 *         setTimeout(() => resolve('Hello World'), 1000);
 *     });
 * };
 * 
 * async function main(): Promise<void> {
 *     await (
 *          async () => { 
 *              console.log({ hey: [ '😎', await helloWorld() ] }); 
 *          }                                               ^(cursor position)
 *     )();
 * }
 * ```
 * 
 * with a pair cluster at `{ line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] }`.
 */
async function testDecorations(
    executor:          Executor, 
    expectDecorations: 'all' | 'nearest'
): Promise<void> {

    // Initialize the active text editor to the following:
    // 
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    // 
    // async function main(): Promise<void> {
    //     await 
    // }         ^(cursor position)
    // ```
    await executor.deleteAll();
    await executor.editText([
        { 
            kind: 'insert', 
            at:   [0, 0],
            text: 'async function helloWorld(): Promise<string> {\n' 
            +     '    return new Promise((resolve) => {\n'
            +     `        setTimeout(() => resolve('Hello World'), 1000);\n`
            +     '    });\n'
            +     '};\n'
            +     '\n'
            +     'async function main(): Promise<void> {\n'
            +     '    await \n'
            +     '}'
        },
    ]); 
    await executor.setCursors([ [7, 10] ]);
    executor.assertPairs([ 'None' ]);
    executor.assertCursors([ [7, 10] ]);

    // So that we do not forget to pass `expectDecorations` to `executor.assertPairs`.
    function assertPairsAndDecorations(executor: Executor, pairs: CompactCluster[]): void {
        executor.assertPairs(pairs, { expectDecorations });
    }

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await ()
    // }          ^(cursor position)
    // ```   
    await executor.typeText('(');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 11] } ]);
    executor.assertCursors([ [7, 11] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async ())
    // }                 ^(cursor position)
    // ```   
    await executor.typeText('async (');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 17, 18, 19] } ]);
    executor.assertCursors([ [7, 18] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async ())
    // }                  ^(cursor position)
    // ```   
    await executor.leap();
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 19] } ]);
    executor.assertCursors([ [7, 19] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => {})
    // }                       ^(cursor position)
    // ```   
    await executor.typeText(' => {');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 24, 25] } ]);
    executor.assertCursors([ [7, 24] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => {  })
    // }                         ^(cursor position)
    // ```   
    await executor.typeText(' ', { repetitions: 2 });
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 26, 27] } ]);
    executor.assertCursors([ [7, 26] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => {  })
    // }                        ^(cursor position)
    // ```   
    await executor.moveCursors('left');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 26, 27] } ]);
    executor.assertCursors([ [7, 25] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log() })
    // }                                    ^(cursor position)
    // ```   
    await executor.typeText('console.log(');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 39, 40] } ]);
    executor.assertCursors([ [7, 37] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({}) })
    // }                                     ^(cursor position)
    // ```   
    await executor.typeText('{');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 38, 39, 41, 42] } ]);
    executor.assertCursors([ [7, 38] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({  }) })
    // }                                       ^(cursor position)
    // ```   
    await executor.typeText(' ', { repetitions: 2 });
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ]);
    executor.assertCursors([ [7, 40] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({  }) })
    // }                                      ^(cursor position)
    // ```   
    await executor.moveCursors('left');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ]);
    executor.assertCursors([ [7, 39] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [] }) })
    // }                                            ^(cursor position)
    // ```
    await executor.typeText('hey: [');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 45, 47, 48, 50, 51] } ]);
    executor.assertCursors([ [7, 45] ]);
    
    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [  ] }) })
    // }                                              ^(cursor position)
    // ```
    await executor.typeText(' ', { repetitions: 2 });
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ]);
    executor.assertCursors([ [7, 47] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [  ] }) })
    // }                                             ^(cursor position)
    // ```
    await executor.moveCursors('left');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ]);
    executor.assertCursors([ [7, 46] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [ '' ] }) })
    // }                                              ^(cursor position)
    // ```
    await executor.typeText("'");
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 46, 47, 49, 51, 52, 54, 55] } ]);
    executor.assertCursors([ [7, 47] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [ '😎' ] }) })
    // }                                                ^(cursor position)
    // ```
    await executor.typeText('😎');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 46, 49, 51, 53, 54, 56, 57] } ]);
    executor.assertCursors([ [7, 49] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [ '😎' ] }) })
    // }                                                 ^(cursor position)
    // ```
    await executor.leap();
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 51, 53, 54, 56, 57] } ]);
    executor.assertCursors([ [7, 50] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [ '😎', await helloWorld ] }) })
    // }                                                                   ^(cursor position)
    // ```
    await executor.editText([
        { kind: 'insert', at: [7, 50], text: ', await helloWorld' }
    ]);
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 69, 71, 72, 74, 75] } ]);
    executor.assertCursors([ [7, 68] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [ '😎', await helloWorld() ] }) })
    // }                                                                    ^(cursor position)
    // ```
    await executor.typeText('(');
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 76, 77] } ]);
    executor.assertCursors([ [7, 69] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (async () => { console.log({ hey: [ '😎', await helloWorld() ] }); })();
    // }                                                                    ^(cursor position)
    // ```
    await executor.editText([
        { kind: 'insert', at: [7, 78], text: '();' },
        { kind: 'insert', at: [7, 75], text: ';'   }
    ]);
    assertPairsAndDecorations(executor, [ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 77, 78] } ]);
    executor.assertCursors([ [7, 69] ]);

    // Document state after:
    //
    // ```
    // async function helloWorld(): Promise<string> {
    //     return new Promise((resolve) => {
    //         setTimeout(() => resolve('Hello World'), 1000);
    //     });
    // };
    //
    // async function main(): Promise<void> {
    //     await (
    //          async () => { 
    //              console.log({ hey: [ '😎', await helloWorld() ] }); 
    //          }                                               ^(cursor position)
    //     )();
    // }                                                                    
    // ```
    await executor.editText([
        { kind: 'insert', at: [7, 78], text: '\n    '           },
        { kind: 'insert', at: [7, 77], text: '\n        '       },
        { kind: 'insert', at: [7, 25], text: '\n            '   },
        { kind: 'insert', at: [7, 11], text: '\n        '       },
    ]);
    assertPairsAndDecorations(executor, [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ]);
    executor.assertCursors([ [9, 56] ]);
};

/**
 * Check that only the pair nearest to the cursor is decorated when `leaper.decorateAll` is disabled.
 */
const DECORATE_ONLY_NEAREST_PAIR_TEST_CASE = new TestCase({
    name: 'Decorate Only Nearest Pair (Configuration Disabled)',
    languageId: 'typescript',
    
    // The provided Typescript text editor's effective value of `leaper.detectedPairs` is from the 
    // root workspace, which has the value:
    //
    //     [ "()", "[]", "{}", "``", "''", "\"\"" ]
    //
    // Thus, we can call `testDecorations` as the requirements noted by its doc comment are satisfied.
    task: async (executor) => testDecorations(executor, 'nearest')
});

/**
 * Check that all pairs being tracked for a cursor are decorated when `leaper.decorateAll` is enabled.
 */
const DECORATE_ALL_PAIRS_TEST_CASE = new TestCase({
    name: 'Decorate All Pairs (Configuration Enabled)',
    languageId: 'typescript',

    // We open the Typescript file from Workspace Folder 4 because Workspace Folder 4 has been 
    // configured to have `leaper.decorateAll` enabled.
    prelude: async (executor) => executor.openFile('./workspace-4/text.ts'),

    // The opened text editor is Typescript and its effective value is from the root workspace, which 
    // has the value:
    //
    //     [ "()", "[]", "{}", "``", "''", "\"\"" ]
    //
    // Thus, we can call `testDecorations` as the requirements noted by its doc comment are satisfied.
    task: async (executor) => testDecorations(executor, 'all')
});

/**
 * Test whether the configuration value of `leaper.decorateAll` is automatically reloaded when a 
 * change in the effective value is detected.
 * 
 * Within this test case, we shall modify the configuration's values at various scopes within the 
 * test workspace. We check after each change that the new values are in effect.
 */
const AUTOMATIC_RELOAD_OF_LATEST_EFFECTIVE_VALUE_TEST_CASE = new TestCase({
    name: 'Automatic Reload of Latest Effective Value',
    languageId: 'typescript',
    prelude: async (executor) => {

        // Open the Typescript files from Workspace Folder 2 and Workspace Folder 4.
        //
        // This results in a total of 3 Typescript text editors (including the one provided to this 
        // test case) being opened, one for each view column. 
        //
        // The following table shows the relevant `leaper.decorateAll` values after this step:
        //
        //     View Column                | 1         | 2         | 3         |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder           |     -     | 2         | 4         |
        //     Workspace Value            | false     | false     | false     |
        //     Workspace Folder Value     |     -     | false     | true      |
        //     Typescript Specific:       
        //         Workspace Value        | undefined | undefined | undefined |
        //         Workspace Folder Value |     -     | undefined | undefined |
        //     Effective Value            | false     | false     | true      |
        //
        await executor.openFile('./workspace-2/text.ts', { viewColumn: ViewColumn.Two   });
        await executor.openFile('./workspace-4/text.ts', { viewColumn: ViewColumn.Three });

        // The `testDecorations` function requires that the effective value of `leaper.detectedPairs`
        // be at least `[ "()", "[]", "{}" ]` for all of the text editors.
        //
        // The first and third text editors already have at least this effective value as they 
        // inherit the value from the root workspace. But Workspace Folder 2 overrides that value, 
        // so we clear the value of `leaper.detectedPairs` in Workspace Folder 2 so that the second 
        // text editor also inherits the value from the root workspace.
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            targetWorkspaceFolder: 'workspace-2',
            value:                 undefined
        });

        // As a precaution, test that the configuration values have been correctly preconfigured.
        await executor.focusEditorGroup('first');
        await testDecorations(executor, 'nearest');
        await executor.focusEditorGroup('second');
        await testDecorations(executor, 'nearest');
        await executor.focusEditorGroup('third');
        await testDecorations(executor, 'all');
    },
    task: async (executor) => {

        async function focusThenTestDecorations(
            focusOnEditorGroup: 'first' | 'second' | 'third',
            expectDecorations:  'all'   | 'nearest' 
        ): Promise<void> {
            await executor.focusEditorGroup(focusOnEditorGroup);
            return testDecorations(executor, expectDecorations);
        }

        // 1. Enable the configuration in Workspace Folder 2.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                | 1         | 2         | 3         |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder           |     -     | 2         | 4         |
        //     Workspace Value            | false     | false     | false     |
        //     Workspace Folder Value     |     -     | true      | true      |
        //     Typescript Specific:       
        //         Workspace Value        | undefined | undefined | undefined |
        //         Workspace Folder Value |     -     | undefined | undefined |
        //     Effective Value            | false     | true      | true      |
        //
        // `leaper.decorateAll` should now be enabled for both the second and third text editors, 
        // while remaining disabled for the first.
        await executor.setConfiguration({
            partialName:           'decorateAll',
            targetWorkspaceFolder: 'workspace-2',
            value:                 true
        });
        await focusThenTestDecorations('first',  'nearest');
        await focusThenTestDecorations('second', 'all');
        await focusThenTestDecorations('third',  'all');

        // 2. Enable the configuration in the root workspace.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                | 1         | 2         | 3         |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder           |     -     | 2         | 4         |
        //     Workspace Value            | true      | true      | true      |
        //     Workspace Folder Value     |     -     | true      | true      |
        //     Typescript Specific:       
        //         Workspace Value        | undefined | undefined | undefined |
        //         Workspace Folder Value |     -     | undefined | undefined |
        //     Effective Value            | true      | true      | true      |
        //
        // The configuration should now be enabled for all three text editors.
        await executor.setConfiguration({
            partialName: 'decorateAll',
            value:       true
        });
        await focusThenTestDecorations('first',  'all');
        await focusThenTestDecorations('second', 'all');
        await focusThenTestDecorations('third',  'all');

        // 3. Disable the configuration for Typescript in the root workspace.
        //
        // The relevant configuration values after the change:
        //
        //     View Column                | 1         | 2         | 3         |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder           |     -     | 2         | 4         |
        //     Workspace Value            | true      | true      | true      |
        //     Workspace Folder Value     |     -     | true      | true      |
        //     Typescript Specific:       
        //         Workspace Value        | false     | false     | false     |
        //         Workspace Folder Value |     -     | undefined | undefined |
        //     Effective Value            | false     | false     | false     |
        //
        // Since all three text editors are Typescript, the configuration should now be disabled 
        // for all of them.
        await executor.setConfiguration({
            partialName:    'decorateAll',
            value:          false,
            targetLanguage: 'typescript'
        });
        await focusThenTestDecorations('first',  'nearest');
        await focusThenTestDecorations('second', 'nearest');
        await focusThenTestDecorations('third',  'nearest');

        // 4. Enable the configuration for Typescript in Workspace Folder 2.
        //
        // The relevant configuration values after the change:
        //
        //     View Column                | 1         | 2         | 3         |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder           |     -     | 2         | 4         |
        //     Workspace Value            | true      | true      | true      |
        //     Workspace Folder Value     |     -     | true      | true      |
        //     Typescript Specific:       
        //         Workspace Value        | false     | false     | false     |
        //         Workspace Folder Value |     -     | true      | undefined |
        //     Effective Value            | false     | true      | false     |
        //
        // The configuration should now be enabled for the second text editor, while remaining 
        // disabled for the other two text editors.
        await executor.setConfiguration({
            partialName:           'decorateAll',
            value:                 true,
            targetWorkspaceFolder: 'workspace-2',
            targetLanguage:        'typescript'
        });
        await focusThenTestDecorations('first',  'nearest');
        await focusThenTestDecorations('second', 'all');
        await focusThenTestDecorations('third',  'nearest');
    }
});

/**
 * A collection of test cases that test the behavior of the `leaper.decorateAll` configuration when
 * there is a single cursor.
 */
export const SINGLE_CURSOR_DECORATE_ALL_TEST_GROUP = new TestGroup(
    '`leaper.decorateAll` Configuration',
    [
        DECORATE_ALL_PAIRS_TEST_CASE,
        DECORATE_ONLY_NEAREST_PAIR_TEST_CASE,
        AUTOMATIC_RELOAD_OF_LATEST_EFFECTIVE_VALUE_TEST_CASE
    ]
);

