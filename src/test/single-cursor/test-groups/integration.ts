import { SnippetString } from "vscode";
import { TestCase, TestGroup } from "../../typedefs";

// Here we simulate typical usage scenarios by typing code into a document as a user would.
//
// The typed in code will include some pairs that are autocompleted by the editor, which we will 
// check are correctly tracked. 
//
// Furthermore, we might also call the Leap command, insert snippet command and so on, as a real 
// user would.
// 
// Note that because code will be typed into an actual Typescript source file, the usual Typescript 
// auto-bracketing and auto-indentation rules apply. Of note is that `<>` is not auto-bracketed in 
// Typescript.
const TEST_CASES: TestCase[] = [
    {
        // The text to be typed out is:
        //
        // ```
        // function main() {
        //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
        //     arr.flat().forEach((elem) => console.log(`{t: ${elem.t}, n: ${elem.n}}`));
        // } 
        // ```
        name: 'Real User Simulation 1',
        actions: [

            // Document state after:
            // 
            // ```
            // function main()
            //               ^(cursor position)
            // ```
            { kind: 'typeText',      text:    'function main('                          },
            { kind: 'assertPairs',   pairs:   [ [ { open: [0, 14], close: [0, 15] } ] ] },
            { kind: 'assertCursors', cursors: [ [0, 15] ]                               },

            // Document state after:
            // 
            // ```
            // function main()
            //                ^(cursor position)
            // ```
            { kind: 'leap'                                 },
            { kind: 'assertPairs',   pairs:   [ [] ]       },
            { kind: 'assertCursors', cursors: [ [0, 16] ]  },

            // Document state after:
            // 
            // ```
            // function main() {}
            //                  ^(cursor position)
            // ```
            { kind: 'typeText',      text:    ' {'                                      },
            { kind: 'assertPairs',   pairs:   [ [ { open: [0, 16], close: [0, 17] } ] ] },
            { kind: 'assertCursors', cursors: [ [0, 17] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //
            // }   ^(cursor position)
            // ```
            { kind: 'typeText',      text:    '\n'       }, 
            { kind: 'assertPairs',   pairs:   [ [] ]     },
            { kind: 'assertCursors', cursors: [ [1, 4] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
            // }                                                         ^(cursor position)
            // ``` 
            { kind: 'typeText', text: 'const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [
                        { open: [1, 15], close: [1, 61] },
                        { open: [1, 26], close: [1, 60] },
                        { open: [1, 31], close: [1, 59] },
                        { open: [1, 57], close: [1, 58] },
                    ]
                ]                                    
            },
            { kind: 'assertCursors', cursors: [ [1, 58] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]]}}
            // }                                                          ^(cursor position)
            // ``` 
            { kind: 'leap' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [
                        { open: [1, 15], close: [1, 61] },
                        { open: [1, 26], close: [1, 60] },
                        { open: [1, 31], close: [1, 59] },
                    ]
                ]                                    
            },
            { kind: 'assertCursors', cursors: [ [1, 59] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
            // }                                                           ^(cursor position)
            // ``` 
            { kind: 'typeText', text: '>' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [
                        { open: [1, 15], close: [1, 62] },
                        { open: [1, 26], close: [1, 61] },
                        { open: [1, 31], close: [1, 60] },
                    ]
                ]                                    
            },
            { kind: 'assertCursors', cursors: [ [1, 60] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>]}}
            // }                                                            ^(cursor position)
            // ``` 
            { kind: 'leap' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [
                        { open: [1, 15], close: [1, 62] },
                        { open: [1, 26], close: [1, 61] },
                    ]
                ]                                    
            },
            { kind: 'assertCursors', cursors: [ [1, 61] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
            // }                                                             ^(cursor position)
            // ``` 
            { kind: 'typeText', text: ' ' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [
                        { open: [1, 15], close: [1, 63] },
                        { open: [1, 26], close: [1, 62] },
                    ]
                ]                                    
            },
            { kind: 'assertCursors', cursors: [ [1, 62] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }}
            // }                                                              ^(cursor position)
            // ``` 
            { kind: 'leap'                                                              },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 15], close: [1, 63] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 63] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }
            // }                                                                           ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    '>, n: number '                           },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 15], close: [1, 76] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 76] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }
            // }                                                                            ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    '}'         },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [1, 77] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
            // }                                                                             ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    '['                                       },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 77], close: [1, 78] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 78] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[]
            // }                                                                              ^(cursor position)
            // ``` 
            { kind: 'leap'                                },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [1, 79] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
            // }                                                                               ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    '['                                       },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 79], close: [1, 80] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 80] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][]
            // }                                                                                ^(cursor position)
            // ``` 
            { kind: 'leap'                                },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [1, 81] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
            // }                                                                                          ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    ' = getArr('                              },
            { kind: 'assertPairs',   pairs:   [ [ { open: [1, 90], close: [1, 91] } ] ] },
            { kind: 'assertCursors', cursors: [ [1, 91] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr()
            // }                                                                                           ^(cursor position)
            // ``` 
            { kind: 'leap'                                },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [1, 92] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat()
            // }            ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    ';\narr.flat('                            },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 12], close: [2, 13] } ] ] },
            { kind: 'assertCursors', cursors: [ [2, 13] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat()
            // }             ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    ')'         },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [2, 14] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem))
            // }                           ^(cursor position)
            // ``` 
            { kind: 'typeText', text: '.forEach((elem' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [
                        { open: [2, 22], close: [2, 29] },
                        { open: [2, 23], close: [2, 28] }
                    ] 
                ]      
            },
            { kind: 'assertCursors', cursors: [ [2, 28] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem))
            // }                            ^(cursor position)
            // ``` 
            { kind: 'leap'                                                              },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 29] } ] ] }, 
            { kind: 'assertCursors', cursors: [ [2, 29] ]                               },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => con)
            // }                                   ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    ' => con'                                 },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 36] } ] ] }, 
            { kind: 'assertCursors', cursors: [ [2, 36] ]                               },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console)
            // }                                       ^(cursor position)
            // ``` 
            { kind: 'triggerAndAcceptSuggestion'                                        },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 40] } ] ] }, 
            { kind: 'assertCursors', cursors: [ [2, 40] ]                               },
            
            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => )
            // }                                ^(cursor position)
            // ``` 
            { kind: 'backspaceWord'                                                     },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 33] } ] ] }, 
            { kind: 'assertCursors', cursors: [ [2, 33] ]                               },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log())
            // }                                            ^(cursor position)
            // ``` 
            { kind: 'insertSnippet', snippet: new SnippetString('console.log($1)$0')    }, 
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 46] } ] ] }, 
            { kind: 'assertCursors', cursors: [ [2, 45] ]                               },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
            // }                                                          ^(cursor position)
            // ``` 
            { kind: 'typeText', text: '`{ t: ${elem.t' }, 
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [ 
                        { open: [2, 22], close: [2, 63] },
                        { open: [2, 45], close: [2, 61] },
                        { open: [2, 46], close: [2, 60] },
                        { open: [2, 52], close: [2, 59] },
                    ] 
                ] 
            }, 
            { kind: 'assertCursors', cursors: [ [2, 59] ] },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}}`))
            // }                                                           ^(cursor position)
            // ``` 
            { kind: 'leap' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [ 
                        { open: [2, 22], close: [2, 63] },
                        { open: [2, 45], close: [2, 61] },
                        { open: [2, 46], close: [2, 60] },
                    ] 
                ] 
            }, 
            { kind: 'assertCursors', cursors: [ [2, 60] ] },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
            // }                                                                        ^(cursor position)
            // ``` 
            { kind: 'typeText', text: ', n: ${elem.n' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [ 
                        { open: [2, 22], close: [2, 77] },
                        { open: [2, 45], close: [2, 75] },
                        { open: [2, 46], close: [2, 74] },
                        { open: [2, 66], close: [2, 73] },
                    ] 
                ] 
            }, 
            { kind: 'assertCursors', cursors: [ [2, 73] ] },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n}}`))
            // }                                                                         ^(cursor position)
            // ``` 
            { kind: 'typeText', text: '}' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [ 
                        { open: [2, 22], close: [2, 77] },
                        { open: [2, 45], close: [2, 75] },
                        { open: [2, 46], close: [2, 74] },
                    ] 
                ] 
            }, 
            { kind: 'assertCursors', cursors: [ [2, 74] ] },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
            // }                                                                          ^(cursor position)
            // ``` 
            { kind: 'typeText', text: ' ' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [ 
                        { open: [2, 22], close: [2, 78] },
                        { open: [2, 45], close: [2, 76] },
                        { open: [2, 46], close: [2, 75] },
                    ] 
                ] 
            }, 
            { kind: 'assertCursors', cursors: [ [2, 75] ] },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
            // }                                                                           ^(cursor position)
            // ``` 
            { kind: 'leap' },
            { 
                kind: 'assertPairs',   
                pairs: [ 
                    [ 
                        { open: [2, 22], close: [2, 78] },
                        { open: [2, 45], close: [2, 76] },
                    ] 
                ] 
            }, 
            { kind: 'assertCursors', cursors: [ [2, 76] ] },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
            // }                                                                            ^(cursor position)
            // ``` 
            { kind: 'leap'                                                              },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 78] } ] ] },
            { kind: 'assertCursors', cursors: [ [2, 77] ]                               },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
            // }                                                                             ^(cursor position)
            // ``` 
            { kind: 'jumpToNextTabstop'                                                 },
            { kind: 'assertPairs',   pairs:   [ [ { open: [2, 22], close: [2, 78] } ] ] },
            { kind: 'assertCursors', cursors: [ [2, 78] ]                               },

            // Document state after: 
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`))
            // }                                                                              ^(cursor position)
            // ``` 
            { kind: 'leap'                                },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [2, 79] ] },

            // Document state after:
            // 
            // ```
            // function main() {
            //     const arr: { t: TypeT<{ u: [TypeU, TypeV<TypeW, TypeZ[]>] }>, n: number }[][] = getArr();
            //     arr.flat().forEach((elem) => console.log(`{ t: ${elem.t}, n: ${elem.n} }`));
            // }                                                                               ^(cursor position)
            // ``` 
            { kind: 'typeText',      text:    ';'         },
            { kind: 'assertPairs',   pairs:   [ [] ]      },
            { kind: 'assertCursors', cursors: [ [2, 80] ] },

        ]
    }
];

/** 
 * This test groups tests multiple features of the extension at once by simulating a real user 
 * interacting with the editor.
 */
export const SINGLE_CURSOR_INTEGRATION_TEST_GROUP: TestGroup = {
    name: 'Integration (Single Cursor)',
    testCases: TEST_CASES
};