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
    prelude: async (executor) => {

        // Since the provided text document is empty, we expect both keybinding contexts to be 
        // initially disabled, since there are clearly no pairs being tracked for it.
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);
    },
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function main
        //              ^(cursor position)
        // ```
        await executor.typeText('function main');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [0, 13] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main()
        //               ^(cursor position)
        // ```
        await executor.typeText('(' );
        executor.assertPairs([ { line: 0, sides: [13, 14] } ]);
        executor.assertCursors([ [0, 14] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main()
        //                ^(cursor position)
        // ```
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [0, 15] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            //
            // ```
            // function main() []
            //                  ^(cursor position)
            // ```
            await executor.typeText(' [');
            executor.assertPairs([ { line: 0, sides: [16, 17] } ]);
            executor.assertCursors([ [0, 17] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() [
            //
            // ]   ^(cursor position)
            // ```
            await executor.typeText('\n');
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [1, 4] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() []
            // ```              ^(cursor position)
            await executor.undo();
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [0, 17] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() 
            //                ^(cursor position)
            // ```
            await executor.backspace({ repetitions: 2 });
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [0, 15] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {}
        //                  ^(cursor position)
        // ```
        await executor.typeText(' {');
        executor.assertPairs([ { line: 0, sides: [16, 17] } ]);
        executor.assertCursors([ [0, 17] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //
        // }   ^(cursor position)
        // ```
        await executor.typeText('\n');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 4] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     let arr: 
            // }            ^(cursor position)
            // ```
            await executor.typeText('let arr: ');
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [1, 13] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     let arr: 
            // }      ^(cursor position)
            // ```
            await executor.setCursors([ [1, 7] ]);
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [1, 7] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

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
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [1, 4] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: `let` instead of `const` specifier.
            // 
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: 
            // }        ^(cursor position)
            // ```
            await executor.typeText('const');
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [1, 9] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: 
            // }              ^(cursor position)
            // ```
            await executor.moveCursors('right', { repetitions: 6 });
            executor.assertPairs([ 'None' ]);
            executor.assertCursors([ [1, 15] ]);
            executor.assertMRBInLeaperModeContext(false);
            executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: {}
        // }               ^(cursor position)
        // ```
        await executor.typeText('{');
        executor.assertPairs([ { line: 1, sides: [15, 16] } ]);
        executor.assertCursors([ [1, 16] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<}
        // }                         ^(cursor position)
        // ```
        await executor.typeText(' t: TypeT<');
        executor.assertPairs([ { line: 1, sides: [15, 26] } ]);
        executor.assertCursors([ [1, 26] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{}}
        // }                          ^(cursor position)
        // ```
        await executor.typeText('{');
        executor.assertPairs([ { line: 1, sides: [15, 26, 27, 28] } ]);
        executor.assertCursors([ [1, 27] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: }}
        // }                              ^(cursor position)
        // ```
        await executor.typeText(' u: ');
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32] } ]);
        executor.assertCursors([ [1, 31] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
          
            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: ()}}
            // }                               ^(cursor position)
            // ```
            await executor.typeText('(');
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32, 33, 34] } ]);
            executor.assertCursors([ [1, 32] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

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
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: []}}
        // }                               ^(cursor position)
        // ```
        await executor.typeText('[');
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32, 33, 34] } ]);
        executor.assertCursors([ [1, 32] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
        // }                                                   ^(cursor position)
        // ```
        await executor.typeText('TypeU, TypeV<TypeW, ');
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ]);
        executor.assertCursors([ [1, 52] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeK]}}
            // }                                                        ^(cursor position)
            // ```
            await executor.typeText('TypeK');
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59] } ]);
            executor.assertCursors([ [1, 57] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeK[]]}}
            // }                                                         ^(cursor position)
            // ```
            await executor.typeText('[');
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ]);
            executor.assertCursors([ [1, 58] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeK}}
            // }                                                        ^(cursor position)
            // ```
            await executor.backspace({ repetitions: 1 });
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59] } ]);
            executor.assertCursors([ [1, 57] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);
            
            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
            // }                                                   ^(cursor position)
            // ```
            await executor.backspace({ repetitions: 5 });
            executor.assertPairs([ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ]);
            executor.assertCursors([ [1, 52] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText('TypeZ');
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59] } ]);
        executor.assertCursors([ [1, 57] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText('[');
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ]);
        executor.assertCursors([ [1, 58] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                           ^(cursor position)
        // ``` 
        await executor.typeText('>');
        executor.assertPairs([ { line: 1, sides: [15, 26, 31, 60, 61, 62] } ]);
        executor.assertCursors([ [1, 60] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                             ^(cursor position)
        // ``` 
        await executor.typeText(' ');
        executor.assertPairs([ { line: 1, sides: [15, 26, 62, 63] } ]);
        executor.assertCursors([ [1, 62] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n: string }
            // }                                                                          ^(cursor position)
            // ``` 
            await executor.typeText(', n: string ');
            executor.assertPairs([ { line: 1, sides: [15, 75] } ]);
            executor.assertCursors([ [1, 75] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n: string }
            // }                                                                         ^(cursor position)
            // ``` 
            await executor.moveCursors('left');
            executor.assertPairs([ { line: 1, sides: [15, 75] } ]);
            executor.assertCursors([ [1, 74] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

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
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n:  }
            // }                                                                 ^(cursor position)
            // ``` 
            await executor.moveCursors('left', { repetitions: 2 });
            executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            executor.assertCursors([ [1, 66] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n:  }
            // }                                                              ^(cursor position)
            // ``` 
            await executor.moveCursors('left', { repetitions: 3 });
            executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            executor.assertCursors([ [1, 63] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                               ^(cursor position)
            // ``` 
            await executor.typeText('>');
            executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            executor.assertCursors([ [1, 64] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // This is a special step to check that Leap is not possible when there is no line of
            // sight.
            // 
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                               ^(cursor position)
            // ``` 
            await executor.leap({ repetitions: 10 });
            executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            executor.assertCursors([ [1, 64] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                                    ^(cursor position)
            // ``` 
            await executor.moveCursors('right', { repetitions: 5 });
            executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            executor.assertCursors([ [1, 69] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: num }
            // }                                                                       ^(cursor position)
            // ``` 
            await executor.typeText('num');
            executor.assertPairs([ { line: 1, sides: [15, 73] } ]);
            executor.assertCursors([ [1, 72] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // This step tests whether tracking can handle autocompleted text being inserted.
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
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 77] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                             ^(cursor position)
        // ``` 
        await executor.typeText('[');
        executor.assertPairs([ { line: 1, sides: [77, 78] } ]);
        executor.assertCursors([ [1, 78] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: incorrect array type.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[[]]
            // }                                                                              ^(cursor position)
            // ``` 
            await executor.typeText('[');
            executor.assertPairs([ { line: 1, sides: [77, 78, 79, 80] } ]);
            executor.assertCursors([ [1, 79] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

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
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                              ^(cursor position)
        // ``` 
        await executor.typeText(']');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 79] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                               ^(cursor position)
        // ``` 
        await executor.typeText('[');
        executor.assertPairs([ { line: 1, sides: [79, 80] } ]);
        executor.assertCursors([ [1, 80] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                                ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 81] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr
        // }                                                                                         ^(cursor position)
        // ``` 
        await executor.typeText(' = getArr');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 90] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                          ^(cursor position)
        // ``` 
        await executor.typeText('(');
        executor.assertPairs([ { line: 1, sides: [90, 91] } ]);
        executor.assertCursors([ [1, 91] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                           ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [1, 92] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat
        // }           ^(cursor position)
        // ``` 
        await executor.typeText(';\narr.flat');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 12] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }            ^(cursor position)
        // ``` 
        await executor.typeText('(');
        executor.assertPairs([ { line: 2, sides: [12, 13] } ]);
        executor.assertCursors([ [2, 13] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }             ^(cursor position)
        // ``` 
        await executor.typeText(')');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 14] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach
        // }                     ^(cursor position)
        // ``` 
        await executor.typeText('.forEach');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 22] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach()
        // }                      ^(cursor position)
        // ``` 
        await executor.typeText('(');
        executor.assertPairs([ { line: 2, sides: [22, 23] } ]);
        executor.assertCursors([ [2, 23] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach(())
        // }                       ^(cursor position)
        // ``` 
        await executor.typeText('(');
        executor.assertPairs([ { line: 2, sides: [22, 23, 24, 25] } ]);
        executor.assertCursors([ [2, 24] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                           ^(cursor position)
        // ``` 
        await executor.typeText('elem');
        executor.assertPairs([ { line: 2, sides: [22, 23, 28, 29] } ]);
        executor.assertCursors([ [2, 28] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => )
        // }                                ^(cursor position)
        // ``` 
        await executor.typeText(' => ');
        executor.assertPairs([ { line: 2, sides: [22, 33] } ]);
        executor.assertCursors([ [2, 33] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: `console.log()` not inserted as snippet.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => con)
            // }                                   ^(cursor position)
            // ``` 
            await executor.typeText('con');
            executor.assertPairs([ { line: 2, sides: [22, 36] } ]);
            executor.assertCursors([ [2, 36] ]);
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

            // Mistake simulation: `console.log()` not inserted as snippet.
            //
            // This step tests whether tracking can handle autocompleted text being inserted.
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
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);
            
            // Mistake simulation: `console.log()` not inserted as snippet.
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
            executor.assertMRBInLeaperModeContext(true);
            executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // This step tests whether tracking can handle snippets being inserted.
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log())
        // }                                            ^(cursor position)
        // ``` 
        await executor.insertSnippet(new SnippetString('console.log($1)$0'));
        executor.assertPairs([ { line: 2, sides: [22, 46] } ]);
        executor.assertCursors([ [2, 45] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // This step tests whether tracking can handle snippets being inserted.
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(``))
        // }                                             ^(cursor position)
        // ``` 
        await executor.typeText('`');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 48] } ]);
        executor.assertCursors([ [2, 46] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // This step tests whether tracking can handle snippets being inserted.
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{}`))
        // }                                              ^(cursor position)
        // ``` 
        await executor.typeText('{');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 47, 48, 50] } ]);
        executor.assertCursors([ [2, 47] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // This step tests whether tracking can handle snippets being inserted.
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: $}`))
        // }                                                        ^(cursor position)
        // ``` 
        await executor.typeText(' elem_t: $');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 58, 60] } ]);
        executor.assertCursors([ [2, 57] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${}}`))
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText('{');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 58, 59, 60, 62] } ]);
        executor.assertCursors([ [2, 58] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                               ^(cursor position)
        // ``` 
        await executor.typeText('elem.t');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
        executor.assertCursors([ [2, 64] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                              ^(cursor position)
        // ``` 
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
        executor.assertCursors([ [2, 63] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                         ^(cursor position)
        // ``` 
        await executor.moveCursors('left', { repetitions: 5 });
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
        executor.assertCursors([ [2, 58] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // This step tests whether a pair is untracked if the cursor has moved out of it.
        //
        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                        ^(cursor position)
        // ``` 
        await executor.moveCursors('left');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ]);
        executor.assertCursors([ [2, 57] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                     ^(cursor position)
        // ``` 
        await executor.moveCursors('left', { repetitions: 3 });
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ]);
        executor.assertCursors([ [2, 54] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
        // }                                                ^(cursor position)
        // ``` 
        await executor.typeText('t');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
        executor.assertCursors([ [2, 49] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // This step checks that Leap calls are ignored when there is no line of sight.
        //
        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
        // }                                                ^(cursor position)
        // ``` 
        await executor.leap({ repetitions: 10 });
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
        executor.assertCursors([ [2, 49] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // This step tests whether tracking can handle a direct cursor move.
        // 
        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
        // }                                                           ^(cursor position)
        // ``` 
        await executor.setCursors([ [2, 60] ]);
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
        executor.assertCursors([ [2, 60] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: $}`))
        // }                                                                 ^(cursor position)
        // ``` 
        await executor.typeText(', n: $');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 67, 69] } ]);
        executor.assertCursors([ [2, 66] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: $}`))
        // }                                                                 ^(cursor position)
        // ``` 
        await executor.typeText('{');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 67, 68, 69, 71] } ]);
        executor.assertCursors([ [2, 67] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                        ^(cursor position)
        // ``` 
        await executor.typeText('elem.n');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 73, 74, 75, 77] } ]);
        executor.assertCursors([ [2, 73] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                         ^(cursor position)
        // ``` 
        await executor.typeText('}');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 74, 75, 77] } ]);
        executor.assertCursors([ [2, 74] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                          ^(cursor position)
        // ``` 
        await executor.typeText(' ');
        executor.assertPairs([ { line: 2, sides: [22, 45, 46, 75, 76, 78] } ]);
        executor.assertCursors([ [2, 75] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

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
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // This step tests whether tracking can handle cursor jumping to next tabstop in snippet.
        //  
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                             ^(cursor position)
        // ``` 
        await executor.jumpToTabstop('next');
        executor.assertPairs([ { line: 2, sides: [22, 78] } ]);
        executor.assertCursors([ [2, 78] ]);
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                              ^(cursor position)
        // ``` 
        await executor.leap();
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 79] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`));
        // }                                                                               ^(cursor position)
        // ``` 
        await executor.typeText(';');
        executor.assertPairs([ 'None' ]);
        executor.assertCursors([ [2, 80] ]);
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);
    }
});

/** 
 * Single cursor integration tests.
 *  
 * This test groups tests multiple features of the extension at once by simulating a real user 
 * interacting with vscode.
 */
export const SINGLE_CURSOR_INTEGRATION_TEST_GROUP: TestGroup = new TestGroup(
    'Integration',
    [
        REAL_USER_SIMULATION_1_TEST_CASE
    ]
);
