import { CompactClusters } from '../../utilities/compact';
import { Executor, TestCase, TestGroup } from '../../utilities/framework';

async function sharedPrelude(executor: Executor, decorateAll: boolean): Promise<void> {

    // First create the following initial document:
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
    await executor.editText({
        edits: [
            { 
                kind: 'insert', 
                at:   [0, 0],
                text: 'async function helloWorld(): Promise<string> {\n' 
                +         '    return new Promise((resolve) => {\n'
                +         `        setTimeout(() => resolve('Hello World'), 1000);\n`
                +         '    });\n'
                +         '};\n'
                +         '\n'
                +         'async function main(): Promise<void> {\n'
                +         '    await \n'
                +         '}'
            },
        ]
    }); 
    await executor.setCursors({ to: [ [7, 10] ] });
    executor.assertPairs({   expect: [ 'None' ] });
    executor.assertCursors({ expect: [ [7, 10] ] });

    // Then set the `leaper.decorateAll` configuration in the test workspace to `decorateAll`.
    await executor.setConfiguration({
        partialName: 'decorateAll',
        value:       decorateAll
    });
};

async function sharedTask(executor: Executor, expectDecorations: 'all' | 'nearest'): Promise<void> {

    // So that we do not forget to pass `expectDecorations` to  `executor.assertPairs`.
    function assertPairsAndDecorations(pairs: CompactClusters): void {
        executor.assertPairs({ expect: pairs, decorations: expectDecorations });
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
    await executor.typeText({ text: '(' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 11] } ]);
    executor.assertCursors({ expect: [ [7, 11] ] });

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
    await executor.typeText({ text: 'async (' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 17, 18, 19] } ]);
    executor.assertCursors({ expect: [ [7, 18] ] });

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
    executor.assertCursors({ expect: [ [7, 19] ] });

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
    await executor.typeText({ text: ' => {' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 24, 25] } ]);
    executor.assertCursors({ expect: [ [7, 24] ] });

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
    await executor.typeText({ text: ' ', repetitions: 2 });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 26, 27] } ]);
    executor.assertCursors({ expect: [ [7, 26] ] });

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
    await executor.moveCursors({ direction: 'left' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 26, 27] } ]);
    executor.assertCursors({ expect: [ [7, 25] ] });

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
    await executor.typeText({ text: 'console.log(' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 39, 40] } ]);
    executor.assertCursors({ expect: [ [7, 37] ] });

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
    await executor.typeText({ text: '{' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 38, 39, 41, 42] } ]);
    executor.assertCursors({ expect: [ [7, 38] ] });

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
    await executor.typeText({ text: ' ', repetitions: 2 });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ]);
    executor.assertCursors({ expect: [ [7, 40] ] });

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
    await executor.moveCursors({ direction: 'left' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 40, 41, 43, 44] } ]);
    executor.assertCursors({ expect: [ [7, 39] ] });

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
    await executor.typeText({ text: 'hey: [' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 45, 47, 48, 50, 51] } ]);
    executor.assertCursors({ expect: [ [7, 45] ] });
    
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
    await executor.typeText({ text: ' ', repetitions: 2 });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ]);
    executor.assertCursors({ expect: [ [7, 47] ] });

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
    await executor.moveCursors({ direction: 'left' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 47, 49, 50, 52, 53] } ]);
    executor.assertCursors({ expect: [ [7, 46] ] });

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
    await executor.typeText({ text: '\'' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 46, 47, 49, 51, 52, 54, 55] } ]);
    executor.assertCursors({ expect: [ [7, 47] ] });

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
    await executor.typeText({ text: '😎' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 46, 49, 51, 53, 54, 56, 57] } ]);
    executor.assertCursors({ expect: [ [7, 49] ] });

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
    executor.assertCursors({ expect: [ [7, 50] ] });

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
    await executor.editText({
        edits: [
            { kind: 'insert', at: [7, 50], text: ', await helloWorld' }
        ]
    });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 69, 71, 72, 74, 75] } ]);
    executor.assertCursors({ expect: [ [7, 68] ] });

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
    await executor.typeText({ text: '(' });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 76, 77] } ]);
    executor.assertCursors({ expect: [ [7, 69] ] });

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
    await executor.editText({
        edits: [
            { kind: 'insert', at: [7, 78], text: '();' },
            { kind: 'insert', at: [7, 75], text: ';'   }
        ]
    });
    assertPairsAndDecorations([ { line: 7, sides: [10, 23, 36, 37, 44, 68, 69, 71, 73, 74, 77, 78] } ]);
    executor.assertCursors({ expect: [ [7, 69] ] });

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
    await executor.editText({
        edits: [
            { kind: 'insert', at: [7, 78], text: '\n    '           },
            { kind: 'insert', at: [7, 77], text: '\n        '       },
            { kind: 'insert', at: [7, 25], text: '\n            '   },
            { kind: 'insert', at: [7, 11], text: '\n        '       },
        ]
    });
    assertPairsAndDecorations([ { line: 9, sides: [23, 24, 31, 55, 56, 58, 60, 61] } ]);
    executor.assertCursors({ expect: [ [9, 56] ] });
};


/**
 * Test whether pairs are correctly decorated when `leaper.decorateAll` is `true`.
 * 
 * All pairs are expected to be decorated.
 */
const DECORATE_ALL_PAIRS_TEST_CASE = new TestCase({
    name:    'Decorate All Pairs',
    prelude: async (executor) => sharedPrelude(executor, true),
    task:    async (executor) => sharedTask(executor, 'all')
});

/**
 * Test whether pairs are correctly decorated when `leaper.decorateAll` is `false`.
 * 
 * Only the pairs nearest to each cursors are expected to be decorated.
 */
const DECORATE_ONLY_NEAREST_PAIR_TEST_CASE = new TestCase({
    name:    'Decorate Only Nearest Pair',
    prelude: async (executor) => sharedPrelude(executor, false),
    task:    async (executor) => sharedTask(executor, 'nearest')
});

/**
 * The following test group tests whether decorations are properly applied for pairs around a single 
 * cursor.
 */
export const SINGLE_CURSOR_DECORATIONS_TEST_GROUP = new TestGroup({
    name: 'Decorations',
    testCases: [
        DECORATE_ALL_PAIRS_TEST_CASE,
        DECORATE_ONLY_NEAREST_PAIR_TEST_CASE
    ]
});

