import { SnippetString } from 'vscode';
import { TestCase, TestGroup } from '../utilities/framework';

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
        await executor.openFile('./workspace-0/text.ts');

        // Since the text editor is empty, there should be no pairs in it, and we expect both 
        // keybinding contexts to be disabled.
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);
    },
    task: async (executor) => {

        // Document state after:
        // 
        // ```
        // function main
        //              ^(cursor position)
        // ```
        await executor.typeText('function main');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 13] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main()
        //               ^(cursor position)
        // ```
        await executor.typeText('(');
        await executor.assertPairs([ { line: 0, sides: [13, 14] } ]);
        await executor.assertCursors([ [0, 14] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main()
        //                ^(cursor position)
        // ```
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 15] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        //
        // ```
        // function main() 
        //                 ^(cursor position)
        // ```
        await executor.typeText(' ');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 16] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            //
            // ```
            // function main() []
            //                  ^(cursor position)
            // ```
            await executor.typeText('[');
            await executor.assertPairs([ { line: 0, sides: [16, 17] } ]);
            await executor.assertCursors([ [0, 17] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [1, 4] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() 
            //                 ^(cursor position)
            // ```
            await executor.undo({ repetitions: 2 });
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [0, 16] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {}
        //                  ^(cursor position)
        // ```
        await executor.typeText('{');
        await executor.assertPairs([ { line: 0, sides: [16, 17] } ]);
        await executor.assertCursors([ [0, 17] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //
        // }   ^(cursor position)
        // ```
        await executor.typeText('\n');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [1, 4] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [1, 13] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [1, 7] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [1, 4] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [1, 9] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ 'None' ]);
            await executor.assertCursors([ [1, 15] ]);
            await executor.assertMRBInLeaperModeContext(false);
            await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: {}
        // }               ^(cursor position)
        // ```
        await executor.typeText('{');
        await executor.assertPairs([ { line: 1, sides: [15, 16] } ]);
        await executor.assertCursors([ [1, 16] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<}
        // }                         ^(cursor position)
        // ```
        await executor.typeText(' t: TypeT<');
        await executor.assertPairs([ { line: 1, sides: [15, 26] } ]);
        await executor.assertCursors([ [1, 26] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{}}
        // }                          ^(cursor position)
        // ```
        await executor.typeText('{');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 27, 28] } ]);
        await executor.assertCursors([ [1, 27] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: }}
        // }                              ^(cursor position)
        // ```
        await executor.typeText(' u: ');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32] } ]);
        await executor.assertCursors([ [1, 31] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);
          
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
            await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32, 33, 34] } ]);
            await executor.assertCursors([ [1, 32] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32] } ]);
            await executor.assertCursors([ [1, 31] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: []}}
        // }                               ^(cursor position)
        // ```
        await executor.typeText('[');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 32, 33, 34] } ]);
        await executor.assertCursors([ [1, 32] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
        // }                                                   ^(cursor position)
        // ```
        await executor.typeText('TypeU, TypeV<TypeW, ');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ]);
        await executor.assertCursors([ [1, 52] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59] } ]);
            await executor.assertCursors([ [1, 57] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ]);
            await executor.assertCursors([ [1, 58] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59] } ]);
            await executor.assertCursors([ [1, 57] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);
            
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
            await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ]);
            await executor.assertCursors([ [1, 52] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText('TypeZ');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59] } ]);
        await executor.assertCursors([ [1, 57] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText('[');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ]);
        await executor.assertCursors([ [1, 58] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                          ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 59, 60, 61] } ]);
        await executor.assertCursors([ [1, 59] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                           ^(cursor position)
        // ``` 
        await executor.typeText('>');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 31, 60, 61, 62] } ]);
        await executor.assertCursors([ [1, 60] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                            ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ { line: 1, sides: [15, 26, 61, 62] } ]);
        await executor.assertCursors([ [1, 61] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                             ^(cursor position)
        // ``` 
        await executor.typeText(' ');
        await executor.assertPairs([ { line: 1, sides: [15, 26, 62, 63] } ]);
        await executor.assertCursors([ [1, 62] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                              ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ { line: 1, sides: [15, 63] } ]);
        await executor.assertCursors([ [1, 63] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 75] } ]);
            await executor.assertCursors([ [1, 75] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 75] } ]);
            await executor.assertCursors([ [1, 74] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            await executor.assertCursors([ [1, 68] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            await executor.assertCursors([ [1, 66] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ { line: 1, sides: [15, 69] } ]);
            await executor.assertCursors([ [1, 63] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            await executor.assertCursors([ [1, 64] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            await executor.assertCursors([ [1, 64] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(false);

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
            await executor.assertPairs([ { line: 1, sides: [15, 70] } ]);
            await executor.assertCursors([ [1, 69] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 73] } ]);
            await executor.assertCursors([ [1, 72] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [15, 76] } ]);
            await executor.assertCursors([ [1, 75] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [1, 77] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                             ^(cursor position)
        // ``` 
        await executor.typeText('[');
        await executor.assertPairs([ { line: 1, sides: [77, 78] } ]);
        await executor.assertCursors([ [1, 78] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [77, 78, 79, 80] } ]);
            await executor.assertCursors([ [1, 79] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 1, sides: [77, 78] } ]);
            await executor.assertCursors([ [1, 78] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                              ^(cursor position)
        // ``` 
        await executor.typeText(']');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [1, 79] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                               ^(cursor position)
        // ``` 
        await executor.typeText('[');
        await executor.assertPairs([ { line: 1, sides: [79, 80] } ]);
        await executor.assertCursors([ [1, 80] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                                ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [1, 81] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr
        // }                                                                                         ^(cursor position)
        // ``` 
        await executor.typeText(' = getArr');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [1, 90] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                          ^(cursor position)
        // ``` 
        await executor.typeText('(');
        await executor.assertPairs([ { line: 1, sides: [90, 91] } ]);
        await executor.assertCursors([ [1, 91] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                           ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [1, 92] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat
        // }           ^(cursor position)
        // ``` 
        await executor.typeText(';\narr.flat');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 12] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }            ^(cursor position)
        // ``` 
        await executor.typeText('(');
        await executor.assertPairs([ { line: 2, sides: [12, 13] } ]);
        await executor.assertCursors([ [2, 13] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }             ^(cursor position)
        // ``` 
        await executor.typeText(')');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 14] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach
        // }                     ^(cursor position)
        // ``` 
        await executor.typeText('.forEach');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 22] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach()
        // }                      ^(cursor position)
        // ``` 
        await executor.typeText('(');
        await executor.assertPairs([ { line: 2, sides: [22, 23] } ]);
        await executor.assertCursors([ [2, 23] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach(())
        // }                       ^(cursor position)
        // ``` 
        await executor.typeText('(');
        await executor.assertPairs([ { line: 2, sides: [22, 23, 24, 25] } ]);
        await executor.assertCursors([ [2, 24] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                           ^(cursor position)
        // ``` 
        await executor.typeText('elem');
        await executor.assertPairs([ { line: 2, sides: [22, 23, 28, 29] } ]);
        await executor.assertCursors([ [2, 28] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                            ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [22, 29] } ]);
        await executor.assertCursors([ [2, 29] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => )
        // }                                ^(cursor position)
        // ``` 
        await executor.typeText(' => ');
        await executor.assertPairs([ { line: 2, sides: [22, 33] } ]);
        await executor.assertCursors([ [2, 33] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 2, sides: [22, 36] } ]);
            await executor.assertCursors([ [2, 36] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
            await executor.assertPairs([ { line: 2, sides: [22, 40] } ]);
            await executor.assertCursors([ [2, 40] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);
            
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
            await executor.assertPairs([ { line: 2, sides: [22, 33] } ]);
            await executor.assertCursors([ [2, 33] ]);
            await executor.assertMRBInLeaperModeContext(true);
            await executor.assertMRBHasLineOfSightContext(true);

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
        await executor.assertPairs([ { line: 2, sides: [22, 46] } ]);
        await executor.assertCursors([ [2, 45] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

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
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 48] } ]);
        await executor.assertCursors([ [2, 46] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

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
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 47, 48, 50] } ]);
        await executor.assertCursors([ [2, 47] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

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
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 58, 60] } ]);
        await executor.assertCursors([ [2, 57] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${}}`))
        // }                                                         ^(cursor position)
        // ``` 
        await executor.typeText('{');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 58, 59, 60, 62] } ]);
        await executor.assertCursors([ [2, 58] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                               ^(cursor position)
        // ``` 
        await executor.typeText('elem.t');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
        await executor.assertCursors([ [2, 64] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                              ^(cursor position)
        // ``` 
        await executor.moveCursors('left');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
        await executor.assertCursors([ [2, 63] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                         ^(cursor position)
        // ``` 
        await executor.moveCursors('left', { repetitions: 5 });
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ]);
        await executor.assertCursors([ [2, 58] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

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
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ]);
        await executor.assertCursors([ [2, 57] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ elem_t: ${elem.t}}`))
        // }                                                     ^(cursor position)
        // ``` 
        await executor.moveCursors('left', { repetitions: 3 });
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ]);
        await executor.assertCursors([ [2, 54] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ : ${elem.t}}`))
        // }                                               ^(cursor position)
        // ``` 
        await executor.backspaceWord();
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 59, 60, 62] } ]);
        await executor.assertCursors([ [2, 48] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
        // }                                                ^(cursor position)
        // ``` 
        await executor.typeText('t');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
        await executor.assertCursors([ [2, 49] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

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
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
        await executor.assertCursors([ [2, 49] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

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
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ]);
        await executor.assertCursors([ [2, 60] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: $}`))
        // }                                                                 ^(cursor position)
        // ``` 
        await executor.typeText(', n: $');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 67, 69] } ]);
        await executor.assertCursors([ [2, 66] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: $}`))
        // }                                                                 ^(cursor position)
        // ``` 
        await executor.typeText('{');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 67, 68, 69, 71] } ]);
        await executor.assertCursors([ [2, 67] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                        ^(cursor position)
        // ``` 
        await executor.typeText('elem.n');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 66, 73, 74, 75, 77] } ]);
        await executor.assertCursors([ [2, 73] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                         ^(cursor position)
        // ``` 
        await executor.typeText('}');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 74, 75, 77] } ]);
        await executor.assertCursors([ [2, 74] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                          ^(cursor position)
        // ``` 
        await executor.typeText(' ');
        await executor.assertPairs([ { line: 2, sides: [22, 45, 46, 75, 76, 78] } ]);
        await executor.assertCursors([ [2, 75] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                           ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [22, 45, 76, 78] } ]);
        await executor.assertCursors([ [2, 76] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                            ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ { line: 2, sides: [22, 78] } ]);
        await executor.assertCursors([ [2, 77] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(false);

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
        await executor.assertPairs([ { line: 2, sides: [22, 78] } ]);
        await executor.assertCursors([ [2, 78] ]);
        await executor.assertMRBInLeaperModeContext(true);
        await executor.assertMRBHasLineOfSightContext(true);

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                              ^(cursor position)
        // ``` 
        await executor.leap();
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 79] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`));
        // }                                                                               ^(cursor position)
        // ``` 
        await executor.typeText(';');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [2, 80] ]);
        await executor.assertMRBInLeaperModeContext(false);
        await executor.assertMRBHasLineOfSightContext(false);
    }
});

/** 
 * A collection of test cases that test the overall behavior of the engine when there is a single 
 * cursor.
 */
export const SINGLE_CURSOR_INTEGRATION_TEST_GROUP: TestGroup = new TestGroup(
    'Integration',
    [
        REAL_USER_SIMULATION_1_TEST_CASE
    ]
);
