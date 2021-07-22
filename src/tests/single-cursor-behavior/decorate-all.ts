import { ViewColumn } from 'vscode';
import { Executor, TestCase, TestGroup } from '../utilities/framework';
import { range } from '../utilities/helpers';

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
    executor:          Executor, 
    targetViewColumn:  'first' | 'second' | 'third',
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
    await executor.assertPairsFull([ 'None' ], expectDecorations);
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
    await executor.assertPairsFull([ { line: 7, sides: [10, 11] } ], expectDecorations);
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
    await executor.assertPairsFull([ { line: 7, sides: [10, 17, 18, 19] } ], expectDecorations);
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
    await executor.assertPairsFull([ { line: 7, sides: [10, 19] } ], expectDecorations);
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
    await executor.assertPairsFull([ { line: 7, sides: [10, 23, 24, 25] } ], expectDecorations);
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
    await executor.typeText(' ', 2);
    await executor.assertPairsFull([ { line: 7, sides: [10, 23, 26, 27] } ], expectDecorations);
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
    await executor.assertPairsFull([ { line: 7, sides: [10, 23, 26, 27] } ], expectDecorations);
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 39, 40] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 38, 39, 41, 42] } ], 
        expectDecorations
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
    await executor.typeText(' ', 2);
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 45, 47, 48, 50, 51] } ], 
        expectDecorations
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
    await executor.typeText(' ', 2);
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 46, 47, 49, 51, 52, 54, 55] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 46, 49, 51, 53, 54, 56, 57] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 51, 53, 54, 56, 57] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 69, 71, 72, 74, 75] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 76, 77] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 77, 78] } ], 
        expectDecorations
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
    await executor.assertPairsFull(
        [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ], 
        expectDecorations
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
 * Check that new effective values of `leaper.decorateAll` are automatically hot reloaded.
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
        //     Workspace Folder               | 3          | 4          |
        //     File                           | text.md    | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Markdown   | Typescript |
        //     Autoclosing Pairs              | (AP-2)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Effective                  | (DP-2)     | (DP-1)     |
        //                                    |            |            | 
        //     leaper.decorateAll Value       |            |            |
        //       - Workspace                  | false      | false      |
        //       - Workspace Folder           | undefined  | true       |
        //       - Language Workspace         | undefined  | undefined  | 
        //       - Language Workspace Folder  | undefined  | undefined  | 
        //       - Effective                  | false      | true       | 
        //     ----------------------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(AP-2): [ "()", "[]", "{}", "<>" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //     (DP-2): [ "{}", "<>" ]
        //
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are 
        //     not consistently autoclosed.
        await executor.openFile('./workspace-3/text.md', ViewColumn.One);
        await executor.openFile('./workspace-4/text.ts', ViewColumn.Two);

        // As a precaution, test that the effective values of `leaper.decorateAll` for the two 
        // opened files are as expected.
        await executor.focusEditorGroup('first');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 6) } ], 'nearest');
        await executor.assertCursors([ [ 0, 3 ] ]);
        await executor.focusEditorGroup('second');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 6) } ], 'all');
        await executor.assertCursors([ [ 0, 3 ] ]);
    },
    task: async (executor) => {

        // 1. Clear the configuration in Workspace Folder 2. 
        //
        // This will cause view column 2's text editor to fall back on the root workspace's value.
        // 
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 3          | 4          |
        //     File                           | text.md    | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Markdown   | Typescript |
        //     Autoclosing Pairs              | (AP-2)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Effective                  | (DP-2)     | (DP-1)     |
        //                                    |            |            | 
        //     leaper.decorateAll Value       |            |            |
        //       - Workspace                  | false      | false      |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | undefined  | undefined  | 
        //       - Language Workspace Folder  | undefined  | undefined  | 
        //       - Effective                  | false      | false      | 
        //     ----------------------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(AP-2): [ "()", "[]", "{}", "<>" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //     (DP-2): [ "{}", "<>" ]
        //
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are 
        //     not consistently autoclosed.
        await executor.setConfiguration({
            name:                  'leaper.decorateAll',
            targetWorkspaceFolder: 'workspace-4',
            value:                 undefined
        });

        // The existing pairs in view column 2's text editor should now have all pairs nearest to 
        // the cursor decorated, just like view column 1's text editor.
        await executor.assertPairsFull([ { line: 0, sides: range(0, 6) } ], 'nearest', ViewColumn.One);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 6) } ], 'nearest', ViewColumn.Two);

        // Type more pairs into both text editors to see that the proper decoration behavior is
        // enforced for newly inserted pairs as well.
        await executor.focusEditorGroup('first');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 12) } ], 'nearest');
        await executor.assertCursors([ [0, 6] ]);
        await executor.focusEditorGroup('second');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 12) } ], 'nearest');
        await executor.assertCursors([ [0, 6] ]);

        // 2. Enable the configuration in the root workspace.
        //
        // This will enable the configuration for both text editors.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 3          | 4          |
        //     File                           | text.md    | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Markdown   | Typescript |
        //     Autoclosing Pairs              | (AP-2)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Effective                  | (DP-2)     | (DP-1)     |
        //                                    |            |            | 
        //     leaper.decorateAll Value       |            |            |
        //       - Workspace                  | true       | true       |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | undefined  | undefined  | 
        //       - Language Workspace Folder  | undefined  | undefined  | 
        //       - Effective                  | true       | true       |
        //     ----------------------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(AP-2): [ "()", "[]", "{}", "<>" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //     (DP-2): [ "{}", "<>" ]
        //
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are 
        //     not consistently autoclosed.
        await executor.setConfiguration({
            name:  'leaper.decorateAll',
            value: true
        });

        // The existing pairs in both text editors should now all be decorated. 
        await executor.assertPairsFull([ { line: 0, sides: range(0, 12) } ], 'all', ViewColumn.One);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 12) } ], 'all', ViewColumn.Two);

        // Type more pairs into both text editors to see that the proper decoration behavior is
        // enforced for newly inserted pairs as well.
        await executor.focusEditorGroup('first');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 18) } ], 'all');
        await executor.assertCursors([ [0, 9] ]);
        await executor.focusEditorGroup('second');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 18) } ], 'all');
        await executor.assertCursors([ [0, 9] ]);

        // 3. Disable the configuration for Typescript in the root workspace.
        //
        // This will cause the configuration to be disabled for view column 2's text editor.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 3          | 4          |
        //     File                           | text.md    | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Markdown   | Typescript |
        //     Autoclosing Pairs              | (AP-2)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Effective                  | (DP-2)     | (DP-1)     |
        //                                    |            |            | 
        //     leaper.decorateAll Value       |            |            |
        //       - Workspace                  | true       | true       |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | undefined  | false      | 
        //       - Language Workspace Folder  | undefined  | undefined  | 
        //       - Effective                  | true       | false      |
        //     ----------------------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(AP-2): [ "()", "[]", "{}", "<>" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //     (DP-2): [ "{}", "<>" ]
        //
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are 
        //     not consistently autoclosed.
        await executor.setConfiguration({
            name:           'leaper.decorateAll',
            value:          false,
            targetLanguage: 'typescript'
        });

        // The existing pairs in view column 2's text editor should now have only the pair closest
        // to the cursor decorated, while the decorations in view column 1's text editor should 
        // remain unaffected.
        await executor.assertPairsFull([ { line: 0, sides: range(0, 18) } ], 'all',     ViewColumn.One);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 18) } ], 'nearest', ViewColumn.Two);

        // Type more pairs into both text editors to see that the proper decoration behavior is
        // enforced for newly inserted pairs as well.
        await executor.focusEditorGroup('first');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 24) } ], 'all');
        await executor.assertCursors([ [0, 12] ]);
        await executor.focusEditorGroup('second');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 24) } ], 'nearest');
        await executor.assertCursors([ [0, 12] ]);

        // 4. Disable the configuration for Markdown in Workspace Folder 3.
        //
        // This will cause the configuration to be disabled for view column 1's text editor.
        //
        // The relevant configuration values after this step:
        //
        //     View Column                      1            2
        //     ----------------------------------------------------------
        //     Workspace Folder               | 3          | 4          |
        //     File                           | text.md    | text.ts    |
        //     ----------------------------------------------------------
        //     Language                       | Markdown   | Typescript |
        //     Autoclosing Pairs              | (AP-2)     | (AP-1)     |
        //                                    |            |            |
        //     leaper.detectedPairs Value     |            |            |
        //       - Effective                  | (DP-2)     | (DP-1)     |
        //                                    |            |            | 
        //     leaper.decorateAll Value       |            |            |
        //       - Workspace                  | true       | true       |
        //       - Workspace Folder           | undefined  | undefined  |
        //       - Language Workspace         | undefined  | false      | 
        //       - Language Workspace Folder  | false      | undefined  | 
        //       - Effective                  | false      | false      |
        //     ----------------------------------------------------------
        //
        //     (AP-1): [ "()", "[]", "{}", "``", "''", "\"\"" ]
        //     *(AP-2): [ "()", "[]", "{}", "<>" ]
        // 
        //     (DP-1): [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ]
        //     (DP-2): [ "{}", "<>" ]
        //
        //     *Note that Markdown has an odd behavior where `<>` pairs within square brackets are 
        //     not consistently autoclosed.
        await executor.setConfiguration({
            name:                  'leaper.decorateAll',
            value:                 false,
            targetWorkspaceFolder: 'workspace-3',
            targetLanguage:        'markdown'
        });

        // The existing pairs in view column 1's text editor should now have only the pair closest
        // to the cursor decorated, while the decorations in view column 2's text editor should 
        // remain unaffected.
        await executor.assertPairsFull([ { line: 0, sides: range(0, 24) } ], 'nearest', ViewColumn.One);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 24) } ], 'nearest', ViewColumn.Two);

        // Type more pairs into both text editors to see that the proper decoration behavior is
        // enforced for newly inserted pairs as well.
        await executor.focusEditorGroup('first');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 30) } ], 'nearest');
        await executor.assertCursors([ [0, 15] ]);
        await executor.focusEditorGroup('second');
        await executor.typeText('{', 3);
        await executor.assertPairsFull([ { line: 0, sides: range(0, 30) } ], 'nearest');
        await executor.assertCursors([ [0, 15] ]);
    }
});

/**
 * Just a cursory test to make sure that the deprecated configuration is being read.
 */
const DEPRECATED_CONFIGURATION_TEST_CASE = new TestCase({
    name: 'Deprecated Configuration: `leaper.decorateOnlyNearestPair`',
    prelude: async (executor) => { 
        await executor.openFile('./workspace-0/text.ts');

        // Disable `leaper.decorateAll` in the root workspace so that it does not shadow the 
        // deprecated configuration.
        await executor.setConfiguration({
            name:  'leaper.decorateAll',
            value: undefined
        });
    },
    task: async (executor) => {

        // Set the deprecated configuration in the root workspace and check that all pairs are 
        // decorated as a result.
        await executor.setDeprecatedConfiguration({
            name:  'leaper.decorateOnlyNearestPair',
            value: false
        });
        await executor.typeText('[({[({');
        await executor.assertPairsFull([ { line: 0, sides: range(0, 12) } ], 'all');
        await executor.assertCursors([ [0, 6] ]);

        // Change the deprecated configuration and check that it is hot reloaded.
        await executor.setDeprecatedConfiguration({
            name:  'leaper.decorateOnlyNearestPair',
            value: true
        });
        await executor.assertPairsFull([ { line: 0, sides: range(0, 12) } ], 'nearest');
        await executor.assertCursors([ [0, 6] ]);
    }
});

/**
 * A collection of test cases that test the behavior of the `leaper.decorateAll` configuration when
 * there is a single cursor.
 */
export const SINGLE_CURSOR_DECORATE_ALL_TEST_GROUP = new TestGroup(
    'Configuration: `leaper.decorateAll`',
    [
        DECORATE_ONLY_NEAREST_PAIR_TEST_CASE,
        DECORATE_ALL_PAIRS_TEST_CASE,
        HOT_RELOAD_TEST_CASE,
        DEPRECATED_CONFIGURATION_TEST_CASE
    ]
);
