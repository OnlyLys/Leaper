import { ViewColumn } from 'vscode';
import { CompactCluster } from '../utilities/compact';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * Prelude where the active text document is overwritten with the following text: 
 * 
 * ```
 * async function helloWorld(): Promise<string> {
 *     return new Promise((resolve) => {
 *         setTimeout(() => resolve('Hello World'), 1000);
 *     });
 * };
 *
 * async function main(): Promise<void> {
 *     await 
 * }         ^(cursor position)
 * ```
 */
async function preludeSetup(executor: Executor): Promise<void> {
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
};

/**
 * Type some pairs into the active text editor then assert that decorations were properly applied. 
 * 
 * # `expectDecorations` Parameter
 * 
 * If `expectDecorations` is `'all'`, then this function will check that decorations were applied to
 * all pairs being tracked for the cursor. 
 * 
 * Otherwise if `expectDecorations` is `'nearest'`, then the check will be that decorations are only 
 * applied to the 'most nested' pair (i.e. the pair nearest to the cursor).
 * 
 * # Note on `leaper.detectedPairs` Requirement
 * 
 * This task expects the active text editor to at least have an effective `leaper.detectedPairs` 
 * value of:
 *      
 *     [ "()", "[]", "{}", "``", "''", "\"\"" ]
 * 
 * # Document State Afterwards
 * 
 * By the end of this function, the active text document will have the following state:
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
async function sharedTask(executor: Executor, expectDecorations: 'all' | 'nearest'): Promise<void> {

    // So that we do not forget to pass `expectDecorations` to `executor.assertPairs`.
    function assertPairsAndDecorations(pairs: CompactCluster[]): void {
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 11] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 17, 18, 19] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 19] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 24, 25] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 26, 27] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 26, 27] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 39, 40] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 38, 39, 41, 42] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 45, 47, 48, 50, 51] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 46, 47, 49, 51, 52, 54, 55] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 46, 49, 51, 53, 54, 56, 57] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 51, 53, 54, 56, 57] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 69, 71, 72, 74, 75] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 76, 77] } ]);
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
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 77, 78] } ]);
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
    assertPairsAndDecorations([ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ]);
    executor.assertCursors([ [9, 56] ]);
};

/**
 * Open a text document which has `leaper.decorateAll` enabled and show it in `viewColumn`.
 * 
 * The `leaper.detectedPairs` configuration of the text document is also set to:
 * 
 *     [ "()", "[]", "{}", "``", "''", "\"\"" ]
 * 
 * The opened text editor will take focus.
 */
async function openDecorateAllEnabledTextEditor(
    executor:   Executor, 
    viewColumn: ViewColumn
): Promise<void> {

    // The text document in Workspace 2 of the test workspace has `leaper.decorateAll` enabled.
    await executor.openFile('./workspace-2/text.ts', { viewColumn });

    // The `sharedTask` function expects these pairs to be detected.
    await executor.setConfiguration({
        partialName:           'detectedPairs',
        value:                 [ "()", "[]", "{}", "``", "''", "\"\"" ],
        targetWorkspaceFolder: 'workspace-2',
    });

    await preludeSetup(executor);
}

/**
 * Test whether pairs are correctly decorated when `leaper.decorateAll` is `false`.
 * 
 * Only the pairs nearest to each cursors are expected to be decorated.
 */
const DECORATE_ONLY_NEAREST_PAIR_TEST_CASE = new TestCase({
    name: 'Decorate Only Nearest Pair',
    prelude: preludeSetup,
    task: async (executor) => sharedTask(executor, 'nearest')
});

/**
 * Test whether pairs are correctly decorated when `leaper.decorateAll` is `true`.
 * 
 * All pairs are expected to be decorated.
 */
const DECORATE_ALL_PAIRS_TEST_CASE = new TestCase({
    name: 'Decorate All Pairs',
    prelude: async (executor) => openDecorateAllEnabledTextEditor(executor, ViewColumn.Active),
    task: async (executor) => sharedTask(executor, 'all')
});

/**
 * Make sure that existing decorations are not messed up when focus is switched between visible text 
 * editors.
 */
const NOT_MESSED_UP_BY_FOCUS_SWITCHING = new TestCase({
    name: 'Not Messed Up by Focus Switching',
    prelude: async (executor) => {

        // Setup the provided text editor (which has `leaper.decorateAll` disabled).
        await preludeSetup(executor);

        // Use the `sharedTask` function to type some pairs into the provided text document.
        await sharedTask(executor, 'nearest');

        // Open another text editor (which has `leaper.decorateAll` enabled) in a separate view 
        // column, then set it up the same way.
        await openDecorateAllEnabledTextEditor(executor, ViewColumn.Two);
        await preludeSetup(executor);

        // Reuse the `sharedTask` function to type the same pairs into the opened text document.
        await sharedTask(executor, 'all');

        // By the end of the prelude, we will have two text documents opened side-by-side with the 
        // same content within them. 
        //
        // However, they are both decorated differently, with the one in view column 1 having 
        // `leaper.decorateAll` disabled while the one in view column 2 has `leaper.decorateAll`
        // enabled.
    },
    task: async (executor) => {

        // First check decorations are valid for both text editors.
        executor.assertPairs(
            [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'all' }
        );
        executor.assertPairs(
            [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'nearest', viewColumn: ViewColumn.One }
        );

        // Switch focus to view column 1 then check again.
        await executor.focusEditorGroup('left');
        executor.assertPairs(
            [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'nearest' }
        );
        executor.assertPairs(
            [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'all', viewColumn: ViewColumn.Two }
        );

        // Switch focus back to view column 2 then check again.
        await executor.focusEditorGroup('right');
        executor.assertPairs(
            [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'all' }
        );
        executor.assertPairs(
            [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'nearest', viewColumn: ViewColumn.One }
        );

        // Close the (active) text editor in view column 2 (which will yield focus to the text 
        // editor in view column 1), then check again.
        await executor.closeActiveEditor();
        executor.assertPairs(
             [ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ],
            { expectDecorations: 'nearest' }
        );
    }

});

/**
 * The following test group tests whether decorations are properly applied for pairs in single 
 * cursor situation.
 */
export const SINGLE_CURSOR_DECORATIONS_TEST_GROUP = new TestGroup(
    'Decorations',
    [
        DECORATE_ALL_PAIRS_TEST_CASE,
        DECORATE_ONLY_NEAREST_PAIR_TEST_CASE,
        NOT_MESSED_UP_BY_FOCUS_SWITCHING
    ]
);

