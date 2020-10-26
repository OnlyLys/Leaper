import { SnippetString } from 'vscode';
import { TestCase, TestGroup } from '../../utilities/framework';

/** 
 * Here we simulate a typical usage scenario by typing code into a document as a user would.
 *
 * The text to be typed out is:
 * 
 * ```
 * function main() {
 *     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
 *     arr.flat().forEach((elem) => console.log(`{t: ${elem.t}, n: ${elem.n}}`));
 * } 
 * ```
 * 
 * The typed in code will include some pairs that are autocompleted by the editor, which we will 
 * check are correctly tracked. 
 *
 * # Simulation
 * 
 * To simulate a real user, we might occasionally:
 * 
 *  - Call the Leap command.
 *  - Insert snippets.
 *  - Move the cursor with the keyboard.
 *  - Move the cursor directly (e.g. 'Go To Line...' commands or `home` / `end` keys).
 *  - Insert mistakes then go back to correct them as a user would. 
 * 
 * # Language Formatting
 * 
 * Note that because code will be typed into an actual Typescript source file, the usual Typescript 
 * auto-bracketing and auto-indentation rules apply. 
 * 
 * Of note is that `<>` is not auto-bracketed in Typescript.
 */
const REAL_USER_SIMULATION_1_TEST_CASE = new TestCase({
    name: 'Real User Simulation 1',
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function main()
        //               ^(cursor position)
        // ```
        await executor.typeText({ text: 'function main(' } );
        executor.assertPairs([ { line: 0, sides: [13, 14] } ]);
        executor.assertCursors([ [0, 14] ]);

        // Document state after:
        // 
        // ```
        // function main()
        //                ^(cursor position)
        // ```
        await executor.leap();
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [0, 15] ]);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            //
            // ```
            // function main() []
            //                  ^(cursor position)
            // ```
            await executor.typeText({ text: ' [' });
            executor.assertPairs([ { line: 0, sides: [16, 17] } ]);
            executor.assertCursors([ [0, 17] ]);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() [
            //
            // ]   ^(cursor position)
            // ```
            await executor.typeText({ text: '\n' });
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [1, 4] ]);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() []
            // ```              ^(cursor position)
            await executor.undo();
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [0, 17] ]);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() 
            //                ^(cursor position)
            // ```
            await executor.backspace({ repetitions: 2 });
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [0, 15] ]);

        // Document state after:
        // 
        // ```
        // function main() {}
        //                  ^(cursor position)
        // ```
        await executor.typeText({ text: ' {' });
        executor.assertPairs([ { line: 0, sides: [16, 17] } ]);
        executor.assertCursors([ [0, 17] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //
        // }   ^(cursor position)
        // ```
        await executor.typeText({ text: '\n' });
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [1, 4] ]);


            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     let arr: 
            // }            ^(cursor position)
            // ```
            await executor.typeText({ text: 'let arr: ' });
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [1, 13] ]);

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     let arr: 
            // }      ^(cursor position)
            // ```
            await executor.setCursors({ cursors: [ [1, 7] ] });
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [1, 7] ]);

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //      arr: 
            // }   ^(cursor position)
            // ```
            await executor.backspaceWord();
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [1, 4] ]);

            // Mistake simulation: `let` instead of `const` specifier.
            // 
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: 
            // }        ^(cursor position)
            // ```
            await executor.typeText({ text: 'const' });
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [1, 9] ]);

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: 
            // }              ^(cursor position)
            // ```
            await executor.moveCursors({ direction: 'right', repetitions: 6 });
            executor.assertPairs([ { line: -1, sides: [] } ]);
            executor.assertCursors([ [1, 15] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: }}
        // }                              ^(cursor position)
        // ```
        await executor.typeText({ text: '{ t: TypeT<{ u: ' });
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32] } ]);
        executor.assertCursors([ [1, 31] ]);
          
            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: ()}}
            // }                               ^(cursor position)
            // ```
            await executor.typeText({ text: '(' });
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32, 33, 34] } ]);
            executor.assertCursors([ [1, 32] ]);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: }}
            // }                              ^(cursor position)
            // ```
            await executor.backspace();
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32] } ]);
            executor.assertCursors([ [1, 31] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
        // }                                                   ^(cursor position)
        // ```
        await executor.typeText({ text: '[TypeU, TypeV<TypeW, ' });
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ]);
        executor.assertCursors([ [1, 52] ]);

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeK[]]}}
            // }                                                         ^(cursor position)
            // ```
            await executor.typeText({ text: 'TypeK[' });
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ]);
            executor.assertCursors([ [1, 58] ]);

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
            // }                                                   ^(cursor position)
            // ```
            await executor.backspace({ repetitions: 6 });
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ]);
            executor.assertCursors([ [1, 52] ]);

        // Document state after:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText({ text: 'TypeZ[' });
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ]);
        executor.assertCursors([ [1, 58] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                          ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 59, 60, 61] } ]);
        executor.assertCursors([ [1, 59] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                           ^(cursor position)
        // ``` 
        await executor.typeText({ text: '>' });
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 60, 61, 62] } ]);
        executor.assertCursors([ [1, 60] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                            ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: 1, sides: [15, 26, 61, 62] } ]);
        executor.assertCursors([ [1, 61] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                             ^(cursor position)
        // ``` 
        await executor.typeText({ text: ' ' });
        executor.assertPairs([ { line: 1, sides: [15, 26, 62, 63] } ]);
        executor.assertCursors([ [1, 62] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                              ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: 1, sides: [15, 63] } ]);
        executor.assertCursors([ [1, 63] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n: string }
            // }                                                                          ^(cursor position)
            // ``` 
            await executor.typeText({ text: ', n: string ' });
            executor.assertPairs([ { line: 1, sides: [15, 75] } ]);
            executor.assertCursors([ [1, 75] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n: string }
            // }                                                                         ^(cursor position)
            // ``` 
            await executor.moveCursors({ direction: 'left' });
            executor.assertPairs([ { line: 1, sides: [15, 75] } ]);
            executor.assertCursors([ [1, 74] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n:  }
            // }                                                                   ^(cursor position)
            // ``` 
            await executor.backspaceWord();
            executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            executor.assertCursors([ [1, 68] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n:  }
            // }                                                              ^(cursor position)
            // ``` 
            await executor.moveCursors({ direction: 'left', repetitions: 5 });
            executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            executor.assertCursors([ [1, 63] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                               ^(cursor position)
            // ``` 
            await executor.typeText({ text: '>' });
            executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            executor.assertCursors([ [1, 64] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                                    ^(cursor position)
            // ``` 
            await executor.moveCursors({ direction: 'right', repetitions: 5 });
            executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            executor.assertCursors([ [1, 69] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: num }
            // }                                                                       ^(cursor position)
            // ``` 
            await executor.typeText({ text: 'num' });
            executor.assertPairs([ { line: 1, sides: [15, 73] } ]);
            executor.assertCursors([ [1, 72] ]);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // This action tests whether tracking can handle autocompleted text being inserted.
            // 
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }
            // }                                                                          ^(cursor position)
            // ``` 
            await executor.triggerAndAcceptSuggestion();
            executor.assertPairs([ { line: 1, sides: [15, 76] } ]);
            executor.assertCursors([ [1, 75] ]);

        // This leap tests whether the cursor can jump across whitespace.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }
        // }                                                                            ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [1, 77] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                             ^(cursor position)
        // ``` 
        await executor.typeText({ text: '['});
        executor.assertPairs([ { line: 1, sides: [77, 78] } ]);
        executor.assertCursors([ [1, 78] ]);

            // Mistake simulation: incorrect array type.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[[]]
            // }                                                                              ^(cursor position)
            // ``` 
            await executor.typeText({ text: '[' });
            executor.assertPairs([ { line: 1, sides: [77, 78, 79, 80] } ]);
            executor.assertCursors([ [1, 79] ]);

            // Mistake simulation: incorrect array type.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
            // }                                                                             ^(cursor position)
            // ``` 
            await executor.backspace();
            executor.assertPairs([ { line: 1, sides: [77, 78] } ]);
            executor.assertCursors([ [1, 78] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                              ^(cursor position)
        // ``` 
        await executor.typeText({ text: ']' });
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [1, 79] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                               ^(cursor position)
        // ``` 
        await executor.typeText({ text: '[' });
        executor.assertPairs([ { line: 1, sides: [79, 80] } ]);
        executor.assertCursors([ [1, 80] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                                ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [1, 81] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                          ^(cursor position)
        // ``` 
        await executor.typeText({ text: ' = getArr(' });
        executor.assertPairs([ { line: 1, sides: [90, 91] } ]);
        executor.assertCursors([ [1, 91] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                           ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [1, 92] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }            ^(cursor position)
        // ``` 
        await executor.typeText({ text: ';\narr.flat(' });
        executor.assertPairs([ { line: 2, sides: [12, 13] } ]);
        executor.assertCursors([ [2, 13] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }             ^(cursor position)
        // ``` 
        await executor.typeText({ text: ')' });
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [2, 14] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                           ^(cursor position)
        // ``` 
        await executor.typeText({ text: '.forEach((elem' });
        executor.assertPairs([ { line: 2, sides: [22, 23, 28, 29] } ]);
        executor.assertCursors([ [2, 28] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                            ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: 2, sides: [22, 29] } ]);
        executor.assertCursors([ [2, 29] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => )
        // }                                ^(cursor position)
        // ``` 
        await executor.typeText({ text: ' => ' });
        executor.assertPairs([ { line: 2, sides: [22, 33] } ]);
        executor.assertCursors([ [2, 33] ]);

            // Mistake simulation: `console.log()` typed in instead of inserted as snippet.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => con)
            // }                                   ^(cursor position)
            // ``` 
            await executor.typeText({ text: 'con' });
            executor.assertPairs([ { line: 2, sides: [22, 36] } ]);
            executor.assertCursors([ [2, 36] ]);

            // Mistake simulation: `console.log()` typed in instead of inserted as snippet.
            //
            // This action tests whether tracking can handle autocompleted text being inserted.
            // 
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console)
            // }                                       ^(cursor position)
            // ``` 
            await executor.triggerAndAcceptSuggestion();
            executor.assertPairs([ { line: 2, sides: [22, 40] } ]);
            executor.assertCursors([ [2, 40] ]);
            
            // Mistake simulation: `console.log()` typed in instead of inserted as snippet.
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => )
            // }                                ^(cursor position)
            // ``` 
            await executor.backspaceWord();
            executor.assertPairs([ { line: 2, sides: [22, 33] } ]);
            executor.assertCursors([ [2, 33] ]);

        // Document state after: 
        // 
        // This action tests whether tracking can handle snippets being inserted.
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log())
        // }                                            ^(cursor position)
        // ``` 
        await executor.insertSnippet({ snippet: new SnippetString('console.log($1)$0') });
        executor.assertPairs([ { line: 2, sides: [22, 46] } ]);
        executor.assertCursors([ [2, 45] ]);

            // Mistake simulation: wrong property name. 
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
            // }                                                               ^(cursor position)
            // ``` 
            // await executor.typeText({ text: '`{ elem_t: ${elem.t' });
            await executor.typeText({ text: '`{ elem_t: ${elem.t' });
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
            executor.assertCursors([ [2, 64] ]);

            // Mistake simulation: wrong property name. 
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
            // }                                                         ^(cursor position)
            // ``` 
            await executor.moveCursors({ direction: 'left', repetitions: 6 });
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
            executor.assertCursors([ [2, 58] ]);

            // Mistake simulation: wrong property name. 
            //
            // This action tests whether a pair is untracked if its cursor has moved out of it.
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
            // }                                                        ^(cursor position)
            // ``` 
            await executor.moveCursors({ direction: 'left' });
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ]);
            executor.assertCursors([ [2, 57] ]);

            // Mistake simulation: wrong property name. 
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
            // }                                                     ^(cursor position)
            // ``` 
            await executor.moveCursors({ direction: 'left', repetitions: 3 });
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ]);
            executor.assertCursors([ [2, 54] ]);

            // Mistake simulation: wrong property name. 
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ : ${elem.t}}`))
            // }                                               ^(cursor position)
            // ``` 
            await executor.backspaceWord();
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 59, 60, 62] } ]);
            executor.assertCursors([ [2, 48] ]);

            // Mistake simulation: wrong property name. 
            //
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
            // }                                                ^(cursor position)
            // ``` 
            await executor.typeText({ text: 't' });
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
            executor.assertCursors([ [2, 49] ]);

            // Mistake simulation: wrong property name. 
            //
            // This action tests whether tracking can handle a direct cursor move.
            // 
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
            // }                                                           ^(cursor position)
            // ``` 
            await executor.setCursors({ cursors: [ [2, 60] ] });
            executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
            executor.assertCursors([ [2, 60] ]);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                        ^(cursor position)
        // ``` 
        await executor.typeText({ text: ', n: ${elem.n' });
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 73, 74, 75, 77] } ]);
        executor.assertCursors([ [2, 73] ]);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                         ^(cursor position)
        // ``` 
        await executor.typeText({ text: '}' });
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 74, 75, 77] } ]);
        executor.assertCursors([ [2, 74] ]);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                          ^(cursor position)
        // ``` 
        await executor.typeText({ text: ' ' });
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 75, 76, 78] } ]);
        executor.assertCursors([ [2, 75] ]);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                           ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: 2, sides: [22, 45, 76, 78] } ]);
        executor.assertCursors([ [2, 76] ]);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                            ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: 2, sides: [22, 78] } ]);
        executor.assertCursors([ [2, 77] ]);

        // Document state after: 
        // 
        // This action tests whether tracking can handle cursor jumping to next tabstop in snippet.
        //  
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                             ^(cursor position)
        // ``` 
        await executor.jumpToNextTabstop();
        executor.assertPairs([ { line: 2, sides: [22, 78] } ]);
        executor.assertCursors([ [2, 78] ]);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                              ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [2, 79] ]);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`));
        // }                                                                               ^(cursor position)
        // ``` 
        await executor.typeText({ text: ';' });
        executor.assertPairs([ { line: -1, sides: [] } ]);
        executor.assertCursors([ [2, 80] ]);
    }
});

/** 
 * This test groups tests multiple features of the extension at once by simulating a real user 
 * interacting with the editor.
 */
export const SINGLE_CURSOR_INTEGRATION_TEST_GROUP: TestGroup = new TestGroup({
    name: 'Integration',
    testCases: [
        REAL_USER_SIMULATION_1_TEST_CASE
    ]
});
