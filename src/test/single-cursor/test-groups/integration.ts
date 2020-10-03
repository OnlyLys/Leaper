import { SnippetString } from 'vscode';
import { TestCase, TestGroup } from '../../utilities/executor';

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
const REAL_USER_SIMULATION_1: TestCase = {
    name: 'Real User Simulation 1',
    actions: [

        // Document state after:
        // 
        // ```
        // function main()
        //               ^(cursor position)
        // ```
        { kind: 'typeText',      text:    'function main('                 },
        { kind: 'assertPairs',   pairs:   [ { line: 0, sides: [14, 15] } ] },
        { kind: 'assertCursors', cursors: [ [0, 15] ]                      },

        // Document state after:
        // 
        // ```
        // function main()
        //                ^(cursor position)
        // ```
        { kind: 'leap'                                                },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [0, 16] ]                 },

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            //
            // ```
            // function main() []
            //                  ^(cursor position)
            // ```
            { kind: 'typeText',      text:    ' ['                             },
            { kind: 'assertPairs',   pairs:   [ { line: 0, sides: [16, 17] } ] },
            { kind: 'assertCursors', cursors: [ [0, 17] ]                      },

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() [
            //
            // ]   ^(cursor position)
            // ```
            { kind: 'typeText',      text:    '\n'                        }, 
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 4] ]                  },

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main()
            //                ^(cursor position)
            // ```
            { kind: 'undo',          repetitions: 3                           },
            { kind: 'assertPairs',   pairs:       [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:     [ [0, 16] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {}
        //                  ^(cursor position)
        // ```
        { kind: 'typeText',      text:    ' {'                             },
        { kind: 'assertPairs',   pairs:   [ { line: 0, sides: [16, 17] } ] },
        { kind: 'assertCursors', cursors: [ [0, 17] ]                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //
        // }   ^(cursor position)
        // ```
        { kind: 'typeText',      text:    '\n'                        },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 4] ]                  },

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     let arr: 
            // }            ^(cursor position)
            // ```
            { kind: 'typeText',      text:    'let arr: '                 },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 13] ]                 },

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     let arr: 
            // }      ^(cursor position)
            // ```
            { kind: 'setCursors',    cursors: [ [1, 7] ]                  },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 7] ]                  },

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //      arr: 
            // }   ^(cursor position)
            // ```
            { kind: 'backspaceWord',                                      },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 4] ]                  },

            // Mistake simulation: `let` instead of `const` specifier.
            // 
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: 
            // }        ^(cursor position)
            // ```
            { kind: 'typeText',      text:    'const'                     },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 9] ]                  },

            // Mistake simulation: `let` instead of `const` specifier.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: 
            // }              ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right', repetitions: 6     },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 15] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: }}
        // }                              ^(cursor position)
        // ```
        { kind: 'typeText',      text:    '{ t: TypeT<{ u: '                       },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 32] } ] },
        { kind: 'assertCursors', cursors: [ [1, 31] ]                              },
          
            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: ()}}
            // }                               ^(cursor position)
            // ```
            { kind: 'typeText',      text:    '('                                              },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 32, 33, 34] } ] },
            { kind: 'assertCursors', cursors: [ [1, 32] ]                                      },

            // Mistake simulation: wrong bracket inserted.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: }}
            // }                              ^(cursor position)
            // ```
            { kind: 'backspace'                                                        },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 32] } ] },
            { kind: 'assertCursors', cursors: [ [1, 31] ]                              },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
        // }                                                   ^(cursor position)
        // ```
        { kind: 'typeText',      text:    '[TypeU, TypeV<TypeW, '                          },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ] },
        { kind: 'assertCursors', cursors: [ [1, 52] ]                                      },

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeK[]]}}
            // }                                                         ^(cursor position)
            // ```
            { kind: 'typeText',      text:    'TypeK['                                                 },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ] },
            { kind: 'assertCursors', cursors: [ [1, 58] ]                                              },

            // Mistake simulation: wrong type argument.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, ]}}
            // }                                                   ^(cursor position)
            // ```
            { kind: 'backspaceWord', repetitions: 2                                            },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 52, 53, 54] } ] },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                      },

        // Document state after:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                         ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    'TypeZ['                                                 },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 57, 58, 59, 60, 61] } ] },
        { kind: 'assertCursors', cursors: [ [1, 58] ]                                              },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
        // }                                                          ^(cursor position)
        // ``` 
        { kind: 'leap'                                                                     },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 59, 60, 61] } ] },
        { kind: 'assertCursors', cursors: [ [1, 59] ]                                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                           ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    '>'                                              },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 31, 60, 61, 62] } ] },
        { kind: 'assertCursors', cursors: [ [1, 60] ]                                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
        // }                                                            ^(cursor position)
        // ``` 
        { kind: 'leap'                                                             },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 61, 62] } ] },
        { kind: 'assertCursors', cursors: [ [1, 61] ]                              },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                             ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ' '                                      },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 26, 62, 63] } ] },
        { kind: 'assertCursors', cursors: [ [1, 62] ]                              },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
        // }                                                              ^(cursor position)
        // ``` 
        { kind: 'leap'                                                     },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 63] } ] },
        { kind: 'assertCursors', cursors: [ [1, 63] ]                      },

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n: strin }
            // }                                                                          ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    ', n: string '                   },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 75] } ] },
            { kind: 'assertCursors', cursors: [ [1, 75] ]                      },

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n:  }
            // }                                                                   ^(cursor position)
            // ``` 
            { kind: 'backspaceWord'                                            },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 69] } ] },
            { kind: 'assertCursors', cursors: [ [1, 68] ]                      },

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }, n:  }
            // }                                                              ^(cursor position)
            // ``` 
            { kind: 'moveCursors',   direction: 'left', repetitions: 5           },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 69] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 63] ]                      },

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                               ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    '>'                              },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 70] } ] },
            { kind: 'assertCursors', cursors: [ [1, 64] ]                      },

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n:  }
            // }                                                                    ^(cursor position)
            // ``` 
            { kind: 'moveCursors',   direction: 'right', repetitions: 5          },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 70] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 69] ]                      },

            // Mistake simulation: missing `>` sign and wrong type annotation for `n`.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: num }
            // }                                                                       ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    'num'                            },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 73] } ] },
            { kind: 'assertCursors', cursors: [ [1, 72] ]                      },

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
            { kind: 'triggerAndAcceptSuggestion'                               },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 76] } ] },
            { kind: 'assertCursors', cursors: [ [1, 75] ]                      },

        // This leap tests whether the cursor can jump across whitespace.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }
        // }                                                                            ^(cursor position)
        // ``` 
        { kind: 'leap'                                                },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 77] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                             ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    '['                              },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [77, 78] } ] },
        { kind: 'assertCursors', cursors: [ [1, 78] ]                      },

            // Mistake simulation: incorrect array type.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[[]]
            // }                                                                              ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    '['                                      },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [77, 78, 79, 80] } ] },
            { kind: 'assertCursors', cursors: [ [1, 79] ]                              },

            // Mistake simulation: incorrect array type.
            //
            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
            // }                                                                             ^(cursor position)
            // ``` 
            { kind: 'backspace'                                                },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [77, 78] } ] },
            { kind: 'assertCursors', cursors: [ [1, 78] ]                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
        // }                                                                              ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ']'                         },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 79] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                               ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    '['                              },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [79, 80] } ] },
        { kind: 'assertCursors', cursors: [ [1, 80] ]                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
        // }                                                                                ^(cursor position)
        // ``` 
        { kind: 'leap'                                                },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 81] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                          ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ' = getArr('                     },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [90, 91] } ] },
        { kind: 'assertCursors', cursors: [ [1, 91] ]                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
        // }                                                                                           ^(cursor position)
        // ``` 
        { kind: 'leap'                                                },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 92] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }            ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ';\narr.flat('                   },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [12, 13] } ] },
        { kind: 'assertCursors', cursors: [ [2, 13] ]                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat()
        // }             ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ')'                         },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [2, 14] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                           ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    '.forEach((elem'                         },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 23, 28, 29] } ] },
        { kind: 'assertCursors', cursors: [ [2, 28] ]                              },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem))
        // }                            ^(cursor position)
        // ``` 
        { kind: 'leap'                                                     },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 29] } ] },
        { kind: 'assertCursors', cursors: [ [2, 29] ]                      },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => )
        // }                                ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ' => '                           },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 33] } ] },
        { kind: 'assertCursors', cursors: [ [2, 33] ]                      },

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
            { kind: 'typeText',      text:    'con'                            },
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 36] } ] },
            { kind: 'assertCursors', cursors: [ [2, 36] ]                      },

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
            { kind: 'triggerAndAcceptSuggestion'                               },
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 40] } ] },
            { kind: 'assertCursors', cursors: [ [2, 40] ]                      },
            
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
            { kind: 'backspaceWord'                                            },
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 33] } ] },
            { kind: 'assertCursors', cursors: [ [2, 33] ]                      },

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
        { kind: 'insertSnippet', snippet: new SnippetString('console.log($1)$0') }, 
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 46] } ]       },
        { kind: 'assertCursors', cursors: [ [2, 45] ]                            },

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
            { kind: 'typeText',      text:    '`{ elem_t: ${elem.t'                                    }, 
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ] },
            { kind: 'assertCursors', cursors: [ [2, 64] ]                                              },

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
            { kind: 'moveCursors',   direction: 'left', repetitions: 6                                   }, 
            { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [22, 45, 46, 57, 64, 65, 66, 68] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 58] ]                                              },

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
            { kind: 'moveCursors',   direction: 'left'                                           }, 
            { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 57] ]                                      },

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
            { kind: 'moveCursors',   direction: 'left', repetitions: 3                           }, 
            { kind: 'assertPairs',   pairs:     [ { line: 2, sides: [22, 45, 46, 65, 66, 68] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 54] ]                                      },

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
            { kind: 'backspaceWord'                                                            },
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 59, 60, 62] } ] },
            { kind: 'assertCursors', cursors: [ [2, 48] ]                                      },

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
            { kind: 'typeText',      text:    't'                                              },
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ] },
            { kind: 'assertCursors', cursors: [ [2, 49] ]                                      },

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
            { kind: 'setCursors',    cursors: [ [2, 60] ]                                      },
            { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 60, 61, 63] } ] },
            { kind: 'assertCursors', cursors: [ [2, 60] ]                                      },

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                        ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ', n: ${elem.n'                                          },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 66, 73, 74, 75, 77] } ] },
        { kind: 'assertCursors', cursors: [ [2, 73] ]                                              },

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
        // }                                                                         ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    '}'                                              },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 74, 75, 77] } ] },
        { kind: 'assertCursors', cursors: [ [2, 74] ]                                      },

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                          ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ' '                                              },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 46, 75, 76, 78] } ] },
        { kind: 'assertCursors', cursors: [ [2, 75] ]                                      },

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                           ^(cursor position)
        // ``` 
        { kind: 'leap'                                                             },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 45, 76, 78] } ] },
        { kind: 'assertCursors', cursors: [ [2, 76] ]                              },

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                            ^(cursor position)
        // ``` 
        { kind: 'leap'                                                     },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 78] } ] },
        { kind: 'assertCursors', cursors: [ [2, 77] ]                      },

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
        { kind: 'jumpToNextTabstop'                                        },
        { kind: 'assertPairs',   pairs:   [ { line: 2, sides: [22, 78] } ] },
        { kind: 'assertCursors', cursors: [ [2, 78] ]                      },

        // Document state after: 
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
        // }                                                                              ^(cursor position)
        // ``` 
        { kind: 'leap'                                                },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [2, 79] ]                 },

        // Document state after:
        // 
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`));
        // }                                                                               ^(cursor position)
        // ``` 
        { kind: 'typeText',      text:    ';'                         },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [2, 80] ]                 },
    ]
};

/** 
 * This test groups tests multiple features of the extension at once by simulating a real user 
 * interacting with the editor.
 */
export const SINGLE_CURSOR_INTEGRATION_TEST_GROUP: TestGroup = {
    name: 'Integration (Single Cursor)',
    testCases: [
        REAL_USER_SIMULATION_1
    ]
};