import { ViewColumn } from 'vscode';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * Test the effective `leaper.decorateAll` configuration in a visible text editor by checking that
 * decorations are appropriately applied.
 * 
 * If the `expectDecorations` parameter is `'all'`, then decorations are expected to be applied to 
 * all pairs. Otherwise, if it is `'nearest'`, then tdecorations are expectedd to only be applied to 
 * the pair nearest to the cursor.
 * 
 * Note that this function only checks whether decorations were applied. It does not check for the 
 * style of the decorations. Also note that this function takes focus of and overwrites the target
 * text editor.
 * 
 * # Requirements 
 * 
 * The target text editor must satisfy the following requirements before this function can be called:
 * 
 *   1. The effective `leaper.detectedPairs` configuration in the target text editor must at least 
 *      be `[ "()", "[]", "{}" ]`.
 *   2. The target text editor's language must be Typescript.
 * 
 * # Document State Afterwards
 * 
 * By the end of this function, the target text editor will have the following state:
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
    executor: Executor, 
    targetViewColumn: 'first' | 'second' | 'third',
    expectDecorations: 'all' | 'nearest'
): Promise<void> {

    // Initialize the target text editor to the following state:
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
    await executor.focusEditorGroup(targetViewColumn);
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
    await executor.assertPairs([ 'None' ], { expectDecorations });
    await executor.assertCursors([ [7, 10] ]);

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
    await executor.assertPairs([ { line: 7, sides: [10, 11] } ], { expectDecorations });
    await executor.assertCursors([ [7, 11] ]);

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
    await executor.assertPairs([ { line: 7, sides: [10, 17, 18, 19] } ], { expectDecorations });
    await executor.assertCursors([ [7, 18] ]);

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
    await executor.assertPairs([ { line: 7, sides: [10, 19] } ], { expectDecorations });
    await executor.assertCursors([ [7, 19] ]);

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
    await executor.assertPairs([ { line: 7, sides: [10, 23, 24, 25] } ], { expectDecorations });
    await executor.assertCursors([ [7, 24] ]);

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
    await executor.assertPairs([ { line: 7, sides: [10, 23, 26, 27] } ], { expectDecorations });
    await executor.assertCursors([ [7, 26] ]);

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
    await executor.assertPairs([ { line: 7, sides: [10, 23, 26, 27] } ], { expectDecorations });
    await executor.assertCursors([ [7, 25] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 39, 40] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 37] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 38, 39, 41, 42] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 38] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 40] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 39] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 45, 47, 48, 50, 51] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 45] ]);
    
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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 47] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 46] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 46, 47, 49, 51, 52, 54, 55] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 47] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 46, 49, 51, 53, 54, 56, 57] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 49] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 51, 53, 54, 56, 57] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 50] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 69, 71, 72, 74, 75] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 68] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 76, 77] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 69] ]);

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
    await executor.assertPairs(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 77, 78] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [7, 69] ]);

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
    await executor.assertPairs(
        [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ], 
        { expectDecorations }
    );
    await executor.assertCursors([ [9, 56] ]);
};

/**
 * Check that only the pair nearest to the cursor is decorated when `leaper.decorateAll` is disabled.
 */
const DECORATE_ONLY_NEAREST_PAIR_TEST_CASE = new TestCase({
    name:    'Decorate Only Nearest Pair (Configuration Disabled)',
    prelude: async (executor) => await executor.openFile('./workspace-0/text.ts'),
    task:    async (executor) => await testDecorations(executor, 'first', 'nearest')
});

/**
 * Check that all pairs being tracked for a cursor are decorated when `leaper.decorateAll` is enabled.
 */
const DECORATE_ALL_PAIRS_TEST_CASE = new TestCase({
    name:    'Decorate All Pairs (Configuration Enabled)',
    prelude: async (executor) => await executor.openFile('./workspace-4/text.ts'),
    task:    async (executor) => await testDecorations(executor, 'first', 'all')
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
    prelude: async (executor) => {

        // Open three text editors in exclusive view columns.
        //
        // The following table shows the relevant configuration values for the text editors in each 
        // view column:
        // 
        //     View Column                      1            2            3
        //     -----------------------------------------------------------------------
        //     Workspace Folder               | 0          | 2          | 4          |
        //     File                           | text.ts    | text.ts    | text.ts    |
        //     -----------------------------------------------------------------------
        //     Language                       | Typescript | Typescript | Typescript |
        //                                    |            |            |            |
        //     leaper.decorateAll Value       |            |            |            |
        //       - Workspace                  | false      | false      | false      |
        //       - Workspace Folder           | undefined  | undefined  | true       |
        //       - Language Workspace         | undefined  | undefined  | undefined  | 
        //       - Language Workspace Folder  | undefined  | undefined  | undefined  | 
        //       - Effective                  | false      | false      | true       | 
        //     -----------------------------------------------------------------------
        //
        await executor.openFile('./workspace-0/text.ts');
        await executor.openFile('./workspace-2/text.ts', { viewColumn: ViewColumn.Two   });
        await executor.openFile('./workspace-4/text.ts', { viewColumn: ViewColumn.Three });

        // The `testDecorations` function requires that the effective value of `leaper.detectedPairs`
        // be at least `[ "()", "[]", "{}" ]` for all of the text editors.
        //
        // The first and third text editors already have at least this effective value as they 
        // inherit the value from the root workspace. But Workspace Folder 2 overrides that value, 
        // so we have to clear the value of `leaper.detectedPairs` in Workspace Folder 2 so that the 
        // second text editor also inherits the value from the root workspace.
        await executor.setConfiguration({
            partialName:           'detectedPairs',
            targetWorkspaceFolder: 'workspace-2',
            value:                 undefined
        });

        // As a precaution, test that the preconfigured values of `leaper.decorateAll` are as 
        // expected.
        await testDecorations(executor, 'first',  'nearest');
        await testDecorations(executor, 'second', 'nearest');
        await testDecorations(executor, 'third',  'all');
    },
    task: async (executor) => {

        // 1. Enable the configuration in a workspace folder. 
        //
        // For this, we enable the configuration in Workspace Folder 2.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2            3
        //     -----------------------------------------------------------------------
        //     Workspace Folder               | 0          | 2          | 4          |
        //     File                           | text.ts    | text.ts    | text.ts    |
        //     -----------------------------------------------------------------------
        //     Language                       | Typescript | Typescript | Typescript |
        //                                    |            |            |            |
        //     leaper.decorateAll Value       |            |            |            |
        //       - Workspace                  | false      | false      | false      |
        //       - Workspace Folder           | undefined  | true       | true       |
        //       - Language Workspace         | undefined  | undefined  | undefined  | 
        //       - Language Workspace Folder  | undefined  | undefined  | undefined  | 
        //       - Effective                  | false      | true       | true       | 
        //     -----------------------------------------------------------------------
        //
        await executor.setConfiguration({
            partialName:           'decorateAll',
            targetWorkspaceFolder: 'workspace-2',
            value:                 true
        });

        // `leaper.decorateAll` should now be enabled for the second text editor, while remaining 
        // disabled for the first and enabled for the third.
        await testDecorations(executor, 'first',  'nearest');
        await testDecorations(executor, 'second', 'all');
        await testDecorations(executor, 'third',  'all');

        // 2. Enable the configuration in the root workspace.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2            3
        //     -----------------------------------------------------------------------
        //     Workspace Folder               | 0          | 2          | 4          |
        //     File                           | text.ts    | text.ts    | text.ts    |
        //     -----------------------------------------------------------------------
        //     Language                       | Typescript | Typescript | Typescript |
        //                                    |            |            |            |
        //     leaper.decorateAll Value       |            |            |            |
        //       - Workspace                  | true       | true       | true       |
        //       - Workspace Folder           | undefined  | true       | true       |
        //       - Language Workspace         | undefined  | undefined  | undefined  | 
        //       - Language Workspace Folder  | undefined  | undefined  | undefined  | 
        //       - Effective                  | true       | true       | true       | 
        //     -----------------------------------------------------------------------
        //
        await executor.setConfiguration({
            partialName: 'decorateAll',
            value:       true
        });

        // The configuration should now be enabled for all three text editors.
        await testDecorations(executor, 'first',  'all');
        await testDecorations(executor, 'second', 'all');
        await testDecorations(executor, 'third',  'all');

        // 3. Disable the configuration for specific language in the root workspace.
        //
        // For this, we disable the configuration for Typescript in the root workspace.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2            3
        //     -----------------------------------------------------------------------
        //     Workspace Folder               | 0          | 2          | 4          |
        //     File                           | text.ts    | text.ts    | text.ts    |
        //     -----------------------------------------------------------------------
        //     Language                       | Typescript | Typescript | Typescript |
        //                                    |            |            |            |
        //     leaper.decorateAll Value       |            |            |            |
        //       - Workspace                  | true       | true       | true       |
        //       - Workspace Folder           | undefined  | true       | true       |
        //       - Language Workspace         | false      | false      | false      |
        //       - Language Workspace Folder  | undefined  | undefined  | undefined  | 
        //       - Effective                  | false      | false      | false      |
        //     -----------------------------------------------------------------------
        //
        await executor.setConfiguration({
            partialName:    'decorateAll',
            value:          false,
            targetLanguage: 'typescript'
        });

        // Since all three text editors are Typescript, the configuration should now be disabled for 
        // all of them.
        await testDecorations(executor, 'first',  'nearest');
        await testDecorations(executor, 'second', 'nearest');
        await testDecorations(executor, 'third',  'nearest');

        // 4. Enable the configuration for a specific language in a workspace folder.
        //
        // For this, we enable the configuration for Typescript in Workspace Folder 2.
        // 
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2            3
        //     -----------------------------------------------------------------------
        //     Workspace Folder               | 0          | 2          | 4          |
        //     File                           | text.ts    | text.ts    | text.ts    |
        //     -----------------------------------------------------------------------
        //     Language                       | Typescript | Typescript | Typescript |
        //                                    |            |            |            |
        //     leaper.decorateAll Value       |            |            |            |
        //       - Workspace                  | true       | true       | true       |
        //       - Workspace Folder           | undefined  | true       | true       |
        //       - Language Workspace         | false      | false      | false      |
        //       - Language Workspace Folder  | undefined  | true       | undefined  | 
        //       - Effective                  | false      | true       | false      |
        //     -----------------------------------------------------------------------

        await executor.setConfiguration({
            partialName:           'decorateAll',
            value:                 true,
            targetWorkspaceFolder: 'workspace-2',
            targetLanguage:        'typescript'
        });

        // The configuration should now be enabled for the second text editor, while remaining 
        // disabled for the other two text editors.
        await testDecorations(executor, 'first',  'nearest');
        await testDecorations(executor, 'second', 'all');
        await testDecorations(executor, 'third',  'nearest');
    }
});

/**
 * A collection of test cases that test the behavior of the `leaper.decorateAll` configuration when
 * there is a single cursor.
 */
export const SINGLE_CURSOR_DECORATE_ALL_TEST_GROUP = new TestGroup(
    '`leaper.decorateAll` Configuration',
    [
        DECORATE_ONLY_NEAREST_PAIR_TEST_CASE,
        DECORATE_ALL_PAIRS_TEST_CASE,
        AUTOMATIC_RELOAD_OF_LATEST_EFFECTIVE_VALUE_TEST_CASE
    ]
);

