import { SnippetString } from 'vscode';
import { Action, TestCase, TestGroup } from '../../typedefs';

// In this prelude that is shared across all the test cases in this module, we insert pairs in a way 
// that simulates a typical usage scenario.
//
// The following initial document is created:
//
// ```
// function () {
//     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
// }                                                   ^(cursor position)
// ```
const SHARED_PRELUDE: { description: string, actions: Action[] } = {
    description: 'Insert mock code with multiple pairs',
    actions: [
        { 
            kind:    'insertText',   
            position: [0, 0],
            text:     'function () {\n    ; // Log object to console.\n}'
        },
        { kind: 'setCursors',  cursors:   [ [1, 4] ]           }, 
        { kind: 'typeText',    text:      'console.log({  '    },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      'obj: {  '           },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      'arr: [  '           },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      '{  '                },
        { kind: 'moveCursors', direction: 'left',              },
        { kind: 'typeText',    text:      'prop: someFn(1, 20' },
        { 
            kind:  'assertPairs', 
            pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ] 
        },
        { kind: 'assertCursors', cursors: [ [1, 52] ] }
    ]
};

const TEST_CASES: TestCase[] = [

    // ----------------------------------------------------
    // INVALIDATION DUE TO CURSOR MOVING OUT OF PAIR

    {
        name: 'Rightwards Exit of Cursor (Incremental)',
        prelude: SHARED_PRELUDE,
        actions: [

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                    ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'right' }, 
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 53] ] },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                     ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'right' }, 
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 54] ] },

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                      ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'right' }, 
            { 
                kind:  'assertPairs',   
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 55] ] },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                       ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'right' }, 
            { 
                kind:  'assertPairs',   
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 56] ] },

            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                        ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right'                                          }, 
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 57] ]                                      },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                         ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right'                                          }, 
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 58] ]                                      },

            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                          ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right'                                  }, 
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 59] ]                              },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                           ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right'                                  }, 
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 60] ]                              },
         
            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                            ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right'                          }, 
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 61] ]                      },

            // Move out of the last pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                             ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'right'                     }, 
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 62] ]                 },
        ]
    },
    {
        name: 'Leftwards Exit of Cursor (Incremental)',
        prelude: SHARED_PRELUDE,
        actions: [

            // Move to the boundary of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                              ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'left', repetitions: 5 }, 
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 52, 54, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 47] ] },

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                             ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'left' },
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 46] ] },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'left', repetitions: 13 },
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 54, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 33] ] },

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                               ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'left' },
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 32] ] },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                              ^(cursor position)
            // ```
            { kind: 'moveCursors', direction: 'left' },
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 56, 58, 60, 61] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 31] ] },

            // Move out of the nearest pair.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                             ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left'                                           },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 30] ]                                      },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                       ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left', repetitions: 6                           },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 23, 58, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 24] ]                                      },
                
            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                      ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left'                                   },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 23] ]                              },

            // Move to the boundary of the next nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left', repetitions: 6                   },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 16, 60, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 17] ]                              },
 
            // Move out of the nearest pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }               ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left'                           },
            { kind: 'assertPairs',   pairs:     [ { line: 1, sides: [15, 61] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 16] ]                      },

            // Move out of the last pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }              ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left'                      },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [1, 15] ]                 },
        ]
    },
    {
        name: 'Rightwards Exit of Cursor (in One Go)',
        prelude: SHARED_PRELUDE,
        actions: [

            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                                             ^(cursor position)
            // ```
            { kind: 'setCursors',    cursors: [ [1, 62] ]                 },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 62] ]                 },
        ]
    },
    {
        name: 'Leftwards Exit of Cursor (in One Go)',
        prelude: SHARED_PRELUDE,
        actions: [

            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }              ^(cursor position)
            // ```
            { kind: 'setCursors',    cursors: [ [1, 16] ]                 },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [1, 16] ]                 },
        ]
    },
    {
        name: 'Upwards Exit of Cursor',
        prelude: SHARED_PRELUDE,
        actions: [

            // Document state after:
            // 
            // ```          
            // function () {
            //              ^(cursor position)
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }
            // ```
            { kind: 'moveCursors',   direction: 'up'                        },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [0, 13] ]                 },
        ]
    },
    {
        name: 'Downwards Exit of Cursor',
        prelude: SHARED_PRELUDE,
        actions: [

            // Document state after:
            // 
            // ```          
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }
            //  ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'down'                      },
            { kind: 'assertPairs',   pairs:     [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors:   [ [2, 1] ]                  },
        ]
    },

    // ----------------------------------------------------
    // INVALIDATION DUE TO EITHER SIDE OF PAIR BEING DELETED

    {
        name: 'Deletion of Opening Side',
        prelude: SHARED_PRELUDE,
        actions: [

            // Move to the opening side of the first pair and then backspace it.
            //
            // Document state after: 
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn1, 20) } ] } }); // Log object to console.
            // }                                             ^(cursor position)
            // ```
            { kind: 'moveCursors',   direction: 'left', repetitions: 5                                       },
            { kind: 'backspace'                                                                              },
            { kind: 'assertPairs',   pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ] },
            { kind: 'assertCursors', cursors: [ [1, 46] ]                                                    },

            // Overwrite text including the third and fourth of the remaining pairs.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            // }                                              ^(cursor position)
            // ```
            { kind: 'replaceText',   replace: { start: [1, 23], end: [1, 32] }, insert: 'cheesecake' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 16, 33, 54, 60, 61] } ]       },
            { kind: 'assertCursors', cursors: [ [1, 47] ]                                            },

            // Overwrite some text including the first of the remaining pairs. 
            //
            // Document state after:
            //
            // ```
            // function () {
            //     { obj: cheesecake{ prop: someFn1, 20) } ] } }); // Log object to console.
            // }                                  ^(cursor position)
            // ```
            { kind: 'replaceText',   replace: { start: [1, 4], end: [1, 16] }, insert: '' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [4, 21, 42, 48] } ]     },
            { kind: 'assertCursors', cursors: [ [1, 35] ]                                 },

            // Backspace until the second of the remaining pairs is deleted.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     { obj: cheesecake1, 20) } ] } }); // Log object to console.
            // }                    ^(cursor position)
            // ```
            { kind: 'backspace',     repetitions: 14                              },
            { kind: 'assertPairs',   pairs:       [ { line: 1, sides: [4, 34] } ] },
            { kind: 'assertCursors', cursors:     [ [1, 21] ]                     },

            // Overwrite first pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     rabbit obj: cheesecake1, 20) } ] } }); // Log object to console.
            // }                         ^(cursor position)
            // ```
            { kind: 'replaceText',   replace: { start: [1, 4], end: [1, 5] }, insert: 'rabbit' },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]                      },
            { kind: 'assertCursors', cursors: [ [1, 26] ]                                      },
        ]
    },
    {
        name: 'Deletion of Closing Side',
        prelude: SHARED_PRELUDE,
        actions: [

            // Delete right the closing character of the first pair. 
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } ] } }); // Log object to console.
            // }                                                   ^(cursor position)
            // ```
            { kind: 'deleteRight'                                                                            },
            { kind: 'assertPairs',   pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 53, 55, 57, 59, 60] } ] },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                                    },

            // Overwrite text including the third and fourth of the remaining pairs.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}); // Log object to console.
            // }                                                   ^(cursor position)
            // ```
            { kind: 'replaceText',   replace: { start: [1, 55], end: [1, 59] }, insert: 'cheesecake' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [15, 16, 32, 53, 65, 66] } ]       },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                            },

            // Overwrite some text including the first of the remaining pairs.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 } cheesecake}
            // }                                                   ^(cursor position)
            // ```
            { kind: 'replaceText',   replace: { start: [1, 66], end: [1, 94] }, insert: '' },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [16, 32, 53, 65] } ]     },
            { kind: 'assertCursors', cursors: [ [1, 52] ]                                  },
            
            // Delete right until the second of the remaining pairs is deleted.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, 20 cheesecake}
            // }                                                   ^(cursor position)
            // ```
            { kind: 'deleteRight',   repetitions: 2                                },
            { kind: 'assertPairs',   pairs:       [ { line: 1, sides: [16, 63] } ] },
            { kind: 'assertCursors', cursors:     [ [1, 52] ]                      },
            
            // Overwrite text including the final pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //    console.log({rabbit
            // }              ^(cursor position)
            // ```
            { kind: 'replaceText',   replace: { start: [1, 17], end: [1, 64] }, insert: 'rabbit' },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]                        },
            { kind: 'assertCursors', cursors: [ [1, 23] ]                                        },
        ]
    },

    // ----------------------------------------------------
    // INVALIDATION DUE TO SIDES OF PAIR ENDING UP ON DIFFERENT LINES

    {
        name: 'Multi-line Text Inserted Between Pairs',
        prelude: SHARED_PRELUDE,
        actions: [

            // Indent the text after the first pair.
            //
            // Document state after:
            //
            // ```
            // function () {
            //    console.log(
            //        { obj: { arr: [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                          ^(cursor position)
            // ```
            { kind: 'insertText',    position: [1, 16], text: '\n\t\t'                                         },
            { kind: 'assertPairs',   pairs:    [ { line: 2, sides: [8, 15, 22, 24, 38, 44, 46, 48, 50, 52] } ] },
            { kind: 'assertCursors', cursors:  [ [2, 44] ]                                                     },

            // Replace the text between the second and third remaining pairs with multiline text.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log(
            //         { obj: { 
            //             Mary
            //             had
            //             a
            //             little
            //             lamb [ { prop: someFn(1, 20) } ] } }); // Log object to console.
            // }                                      ^(cursor position)
            // ```
            { 
                kind:    'replaceText', 
                replace: { start: [2, 17], end: [2, 21] }, 
                insert:  '\n\t\t\tMary\n\t\t\thad\n\t\t\ta\n\t\t\tlittle\n\t\t\tlamb'
            },
            { kind: 'assertPairs',   pairs:   [ { line: 7, sides: [17, 19, 33, 39, 41, 43] } ] },
            { kind: 'assertCursors', cursors: [ [7, 39] ]                                      },

            // Type in a newline at the cursor position.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log(
            //         { obj: { 
            //             Mary
            //             had
            //             a
            //             little
            //             lamb [ { prop: someFn(1, 20
            //                 ) } ] } }); // Log object to console.
            // }                ^(cursor position)
            // ```
            //
            // (Note that auto-indentation of Typescript applies).
            { kind: 'typeText',      text:    '\n'                        },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [8, 16] ]                 },
        ]
    },
    {
        name: 'Multi-line Snippet Inserted Between Pairs',
        prelude: SHARED_PRELUDE,
        actions: [

            // Delete the `20` from the second argument of `someFn`.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, ) } ] } }); // Log object to console.
            // }                                                 ^(cursor position)
            // ```
            { kind: 'backspace', repetitions: 2 },
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 50, 52, 54, 56, 58, 59] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 50] ] },

            // Type in an array of numbers.
            //
            // Document state after:
            //
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3]) } ] } }); // Log object to console.
            // }                                                             ^(cursor position)
            // ```
            { kind: 'typeText', text: '[-1, -2, -3]' },
            { 
                kind:  'assertPairs', 
                pairs: [ { line: 1, sides: [15, 16, 23, 30, 32, 46, 62, 64, 66, 68, 70, 71] } ] 
            },
            { kind: 'assertCursors', cursors: [ [1, 61] ] },

            // Insert a multi-line snippet.
            // 
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //                                                                        |--^(cursor selection)  
            //     }, init)) } ] } }); // Log object to console.
            // }                                                            
            // ```
            { 
                kind:    'insertSnippet', 
                snippet: new SnippetString('.reduce((${1:acc}, ${2:prev}) => {\n    $3\n}, ${4:init})$0') 
            },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]              },
            { kind: 'assertCursors', cursors: [ { anchor: [1, 71], active: [1, 74] } ] },

            // Make sure that the snippet still works by jumping to the second tabstop.
            // 
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //                                                                             |---^(cursor selection)
            //     }, init)) } ] } }); // Log object to console.
            // }                                                            
            // ```
            { kind: 'jumpToNextTabstop'                                                },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]              },
            { kind: 'assertCursors', cursors: [ { anchor: [1, 76], active: [1, 80] } ] },

            // Make sure that the snippet still works by jumping to the third tabstop.
            // 
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //                                                                              
            //         ^(cursor position)
            //     }, init)) } ] } }); // Log object to console.
            // }                                                            
            // ```
            { kind: 'jumpToNextTabstop'                                   },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [2, 8] ]                  },

            // Make sure that the snippet still works by jumping to the fourth tabstop.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //         
            //     }, init)) } ] } }); // Log object to console.
            // }      |---^(cursor selection)
            // ```
            { kind: 'jumpToNextTabstop'                                               },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ]             },
            { kind: 'assertCursors', cursors: [ { anchor: [3, 7], active: [3, 11] } ] },

            // Make sure that the snippet still works by jumping to the final tabstop.
            //
            // Document state after:
            // 
            // ```
            // function () {
            //     console.log({ obj: { arr: [ { prop: someFn(1, [-1, -2, -3].reduce((acc, prev) => {
            //         
            //     }, init)) } ] } }); // Log object to console.
            // }           ^(cursor position)
            // ```
            { kind: 'jumpToNextTabstop'                                   },
            { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
            { kind: 'assertCursors', cursors: [ [3, 12] ]                 },
        ]
    }
];

/**
 * This test group tests pair invalidation due to:
 * 
 *  1. Cursor being moved out of them (also known as 'cursor escape' or 'cursor exit').
 *  2. Multi-line text being inserted between them.
 *  3. Their opening or closing sides being deleted.
 */
export const SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP: TestGroup = {
    name: 'Pair Invalidation (Single Cursor)',
    testCases: TEST_CASES
};
