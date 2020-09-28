//! Note that within the test cases in this module, we often insert non-ASCII text in order to guard 
//! against regressions since at one point this extension was not able track pairs once non-ASCII
//! text was involved.

import { Action, CompactPairs, TestCase, TestGroup } from '../../typedefs';
import { clonePairs, range, sliceAdd, sliceSub } from '../../utilities';
import { SnippetString } from 'vscode';

/**
 * Test case to check whether this extension can handle single-line text modifications between pairs.
 * 
 * Note that because multi-line text insertions between pairs cause pairs to be untracked, such text 
 * insertions are tested in the `pair-invalidation.ts` module.
 */
const SINGLE_LINE_TEXT_MODIFICATIONS_BETWEEN_PAIRS_TEST_CASE: TestCase = (() => {
    const name    = 'Single-Line Text Modifications Between Pairs';
    const prelude = {
        description: 'Insert multiple pairs',
        actions: [
            { kind: 'typeText',      text:        '\nblah-blah\n'                      },
            { kind: 'moveCursors',   direction:   'up'                                 },
            { kind: 'insertPair',    repetitions: 10                                   },
            { kind: 'assertPairs',   pairs:       [ { line: 1, sides: range(9, 29) } ] },
            { kind: 'assertCursors', cursors:     [ [1, 19] ]                          },
        ] as Action[]
    };
    const actions: Action[]   = [];
    const pairs: CompactPairs = [ { line: 1, sides: range(9, 29) } ];

    // 1. Insert 17 code units between the opening sides of the first and second pairs.
    //
    // After this, the sides of the pairs are at character indices:
    // 
    //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45
    actions.push({ kind: 'insertText', position: [1, 10], text: '❤🧡💛💚💙💜🤎🖤🤍' });
    sliceAdd(pairs[0].sides, 1, 20, 17);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 36] ]       });

    // 2. Insert 11 code units in between the closing sides of the fourth and fifth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    // 
    //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 53, 54, 55, 56
    actions.push({ kind: 'insertText', position: [1, 42], text: 'H᭭a᭰p⃠p᭬ỳ֑' });
    sliceAdd(pairs[0].sides, 16, 20, 11);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 36] ]       });

    // 3. Type 10 code units at the cursor.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 46, 47, 48, 49, 50, 51, 63, 64, 65, 66
    actions.push({ kind: 'typeText', text: 'Pretzel 🥨' });
    sliceAdd(pairs[0].sides, 10, 20, 10);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 46] ]       });

    // 4. Type 20 code units at the cursor.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 66, 67, 68, 69, 70, 71, 83, 84, 85, 86
    actions.push({ kind: 'typeText', text: '蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。', });
    sliceAdd(pairs[0].sides, 10, 20, 20);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 66] ]       });

    // 5. Insert 8 code units at the cursor (simulating a paste action).
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 74, 75, 76, 77, 78, 79, 91, 92, 93, 94
    actions.push({ kind: 'insertText', position: [1,66], text: '😮😣😖🤯' });
    sliceAdd(pairs[0].sides, 10, 20, 8);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 74] ]       });

    // 6. Backspace two emojis at the cursor, consisting of 4 code units.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 70, 71, 72, 73, 74, 75, 87, 88, 89, 90
    actions.push({ kind: 'backspace', repetitions: 2 });
    sliceSub(pairs[0].sides, 10, 20, 4);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 70] ]       });

    // 7. Insert 12 code units between the opening sides of the seventh and eighth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 45, 46, 47, 82, 83, 84, 85, 86, 87, 99, 100, 101, 102
    actions.push({ kind: 'insertText', position: [1, 33], text: 'Ice Cream 🍦' });
    sliceAdd(pairs[0].sides, 7, 20, 12);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 82] ]       });

    // 8. Insert 10 code units between the closing sides of the eighth and ninth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 45, 46, 47, 82, 83, 94, 95, 96, 97, 109, 110, 111, 112
    actions.push({ kind: 'insertText', position: [1, 84], text: '🙏🙏🙏🙏🙏' });
    sliceAdd(pairs[0].sides, 12, 20, 10);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 82] ]       });

    // 9. Delete 9 code units between the opening sides of the seventh and eighth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 38, 73, 74, 85, 86, 87, 88, 100, 101, 102, 103
    actions.push({ kind: 'replaceText', replace: { start: [1, 36], end: [1, 45] }, insert: '' });
    sliceSub(pairs[0].sides, 7, 20, 9);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 73] ]       });

    // 10. Insert 8 code units between the closing sides of the ninth and tenth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 38, 73, 82, 93, 94, 95, 96, 108, 109, 110, 111
    actions.push({ kind: 'insertText', position: [1, 74], text: '🥰😍🤫🤓' });
    sliceAdd(pairs[0].sides, 11, 20, 8);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 73] ]       });

    // 11. Insert 13 code units between the opening sides of the ninth and tenth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //  
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 51, 86, 95, 106, 107, 108, 109, 121, 122, 123, 124
    actions.push({ kind: 'insertText', position: [1, 38], text: 'Bubble Tea 🧋' });
    sliceAdd(pairs[0].sides, 9, 20, 13);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 86] ]       });
    
    // 12. Delete 11 code units between the closing side of the fourth and fifth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //  
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 51, 86, 95, 106, 107, 108, 109, 110, 111, 112, 113
    actions.push({ kind: 'replaceText', replace: { start: [1, 110], end: [1, 121] }, insert: '' });
    sliceSub(pairs[0].sides, 16, 20, 11);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 86] ]       });

    // 13. Delete 7 code units between the opening sides of the ninth and tenth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 79, 88, 99, 100, 101, 102, 103, 104, 105, 106
    actions.push({ kind: 'replaceText', replace: { start: [1, 38], end: [1, 45] }, insert: '' });
    sliceSub(pairs[0].sides, 9, 20, 7);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 79] ]       });

    // 14. Backspace 6 times, deleting 12 code units at the cursor.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 67, 76, 87, 88, 89, 90, 91, 92, 93, 94
    actions.push({ kind: 'backspace', repetitions: 6 });
    sliceSub(pairs[0].sides, 10, 20, 12);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 67] ]       });

    // 15. Move the cursor back 6 code units (while still remaining in the most nested pair), then 
    // type in 7 code units.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 74, 83, 94, 95, 96, 97, 98, 99, 100, 101
    actions.push({ kind: 'moveCursors', direction: 'left', repetitions: 3 });
    actions.push({ kind: 'typeText',    text:      'Fire 🔥'              });
    sliceAdd(pairs[0].sides, 10, 20, 7);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 68] ]       });

    // 16. Insert 10 code units between the closing sides of the third and fourth pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 74, 83, 94, 95, 96, 97, 98, 109, 110, 111
    actions.push({ kind: 'insertText', position: [1, 99], text: 'Pretzel 🥨' });
    sliceAdd(pairs[0].sides, 17, 20, 10);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 68] ]       });

    // 17. Insert 10 code units between the opening sides of the second and third pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //  9, 27, 38, 39, 40, 41, 42, 46, 47, 54, 84, 93, 104, 105, 106, 107, 108, 119, 120, 121
    actions.push({ kind: 'insertText', position: [1, 28], text: 'Popcorn 🍿' });
    sliceAdd(pairs[0].sides, 2, 20, 10);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 78] ]       });

    // 18. Replace 8 code units between the opening sides of the first and second pairs with 2 code units.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //  9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 78, 87, 98, 99, 100, 101, 102, 113, 114, 115
    actions.push({ kind: 'replaceText', replace: { start: [1, 15], end: [1, 23] }, insert: '🫀' });
    sliceSub(pairs[0].sides, 1, 20, 6);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 72] ]       });

    // 19. Insert 8 code units between the closing sides of the first and second pairs.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //  9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 78, 87, 98, 99, 100, 101, 102, 113, 114, 123
    actions.push({ kind: 'insertText', position: [1, 115], text: '🐡🐟🐠🦈' });
    sliceAdd(pairs[0].sides, 19, 20, 8);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 72] ]       });

    // 20. Move the cursor back 7 code units (while still remaining in the most nested pair), then 
    // delete right 4 code units.
    //
    // After this, the sides of the pairs are at character indices:
    //
    //  9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 74, 83, 94, 95, 96, 97, 98, 109, 110, 119
    actions.push({ kind: 'moveCursors', direction:  'left', repetitions: 6 });
    actions.push({ kind: 'deleteRight', repetitions: 4                     });
    sliceSub(pairs[0].sides, 10, 20, 4);
    actions.push({ kind: 'assertPairs',   pairs:   clonePairs(pairs) });
    actions.push({ kind: 'assertCursors', cursors: [ [1, 65] ]       });

    return {
        name,
        prelude,
        actions
    };
})();

/**
 * Test case to check whether this extension can handle autocompleted text insertions between pairs.
 */
const AUTOCOMPLETIONS_OK_TEST_CASE: TestCase = (() => {
    const name    = 'Autocompletions OK';
    const prelude = {
        description: 'Insert multiple pairs and a variable name that we can use to autocomplete',
        actions: [
            { 
                kind:     'insertText', 
                position: [0, 0], 
                text:     'function main(){\n    const reallyLongVariableName = 10;\n    \n}'
            },
            { kind: 'setCursors',    cursors:     [ [2, 4] ]                           },
            { kind: 'insertPair',    repetitions: 10                                   },
            { kind: 'assertPairs',   pairs:       [ { line: 2, sides: range(4, 24) } ] },
            { kind: 'assertCursors', cursors:     [ [2, 14] ]                          },
        ] as Action[]
    };
    const actions: Action[]   = [];
    const pairs: CompactPairs = [ { line: 2, sides: range(4, 24) } ];

    // 1. Autocomplete the variable name and check that all pairs are correctly tracked.
    actions.push({ kind: 'typeText', text: 'really' });
    actions.push({ kind: 'triggerAndAcceptSuggestion' });
    sliceAdd(pairs[0].sides, 10, 20, 22);
    actions.push({ kind: 'assertPairs',   pairs: clonePairs(pairs)  }); 
    actions.push({ kind: 'assertCursors', cursors: [ [2, 14 + 22] ] });

    // 2. As an additional check, perform another autocompletion.
    actions.push({ kind: 'setCursors',  cursors:   [ [2, 14] ] });
    actions.push({ kind: 'typeText',    text:      ' '         });
    actions.push({ kind: 'moveCursors', direction: 'left'      });
    actions.push({ kind: 'typeText',    text:      'really'    });
    actions.push({ kind: 'triggerAndAcceptSuggestion'          });
    sliceAdd(pairs[0].sides, 10, 20, 23);
    actions.push({ kind: 'assertPairs',   pairs: clonePairs(pairs)  }); 
    actions.push({ kind: 'assertCursors', cursors: [ [2, 14 + 23] ] });

    return {
        name,
        prelude,
        actions
    };
})();

/**
 * Test case to check whether this extension can handle snippet text insertions between pairs.
 * 
 * Note that because multi-line text insertions between pairs cause pairs to be untracked, 
 * multi-line snippets also cause pairs to be untracked, and are therefore tested in the 
 * `pair-invalidation.ts` module.
 */
const SNIPPETS_OK_TEST_CASE: TestCase = {
    name: 'Snippets OK',
    prelude: {
        description: 'Insert three pairs',
        actions: [
            { kind: 'typeText',      text:    'function main() {\n    const x = \n}'           },
            { kind: 'setCursors',    cursors: [ [1, 14] ]                                      },
            { kind: 'typeText',      text:    'someFn({ outer: { inner: '                      },
            { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 39, 40, 41] } ] },
            { kind: 'assertCursors', cursors: [ [1, 39] ]                                      },
        ]
    },
    actions: [

        // Insert the snippet.
        //
        // This will cause the cursor to be moved to the $1 position.
        { 
            kind: 'insertSnippet', 
            snippet: new SnippetString('fn1({ arg1: `$3`, arg2: fn2(${1:float}, ${2:binary}), arg3: $4 })$0')
        },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 90, 91, 92] } ] },
        { kind: 'assertCursors', cursors: [ { anchor: [1, 65], active: [1, 70] } ]         },

        // Insert a floating point number at the first tabstop.
        { kind: 'typeText',      text:    '3.14159265359'                                   },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 98, 99, 100] } ] },
        { kind: 'assertCursors', cursors: [ [1, 78] ]                                       },

        // (User Pressed Tab)
        //
        // Jump to the second tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        { kind: 'jumpToNextTabstop'                                                         },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 98, 99, 100] } ] },
        { kind: 'assertCursors', cursors: [ { anchor: [1, 80], active: [1, 86]} ]           },

        // Insert a binary number at the second tabstop.
        { kind: 'typeText',      text:    '0b101010'                                          },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 100, 101, 102] } ] },
        { kind: 'assertCursors', cursors: [ [1, 88] ]                                         },

        // (User Presses Tab) 
        //
        // Jump to the third tabstop without inserting anything there yet.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        { kind: 'jumpToNextTabstop'                                                           },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 100, 101, 102] } ] },
        { kind: 'assertCursors', cursors: [ [1, 52] ]                                         },

        // (User Presses Tab) 
        //
        // Jump to to the fourth tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        { kind: 'jumpToNextTabstop'                                                           },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 100, 101, 102] } ] },
        { kind: 'assertCursors', cursors: [ [1, 97] ]                                         },

        // Insert a single-element array at the fourth tabstop.
        { kind: 'typeText',      text:    "['hello"                                                             },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 97, 98, 104, 105, 109, 110, 111] } ] },
        { kind: 'assertCursors', cursors: [ [1, 104] ]                                                          },

        // (User Presses Tab) 
        //
        // Leap out of the array element's autoclosed quotes.
        //
        // Note that Leap executes when Tab is pressed here because:
        //
        //  1. There is line of sight to the nearst pair.
        //  2. By default the `leaper.leap` command has higher keybinding priority than the 
        //     `jumpToNextTabstop` command.
        { kind: 'leap'                                                                                 },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 97, 105, 109, 110, 111] } ] },
        { kind: 'assertCursors', cursors: [ [1, 105] ]                                                 },

        // Insert another array element.
        { kind: 'typeText',      text:    ", 'world"                                                             },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 97, 107, 113, 114, 118, 119, 120] } ] },
        { kind: 'assertCursors', cursors: [ [1, 113] ]                                                           },

        // (User Presses Shift-Tab) 
        //
        // Jump back to the third tabstop.
        { kind: 'jumpToPrevTabstop'                                                           },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 118, 119, 120] } ] },
        { kind: 'assertCursors', cursors: [ [1, 52] ]                                         },        

        // Fill in the template string at the third tabstop.
        { kind: 'typeText',      text:    '${168 / 4'                                                 },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 53, 61, 118, 119, 120] } ] },
        { kind: 'assertCursors', cursors: [ [1, 61] ]                                                 },        

        // (User Presses Tab) 
        //
        // Leap out of the curly braces within the template string.
        //
        // Note that Leap executes when Tab is pressed here because:
        //
        //  1. There is line of sight to the nearst pair.
        //  2. By default the `leaper.leap` command has higher keybinding priority than the 
        //     `jumpToNextTabstop` command.
        { kind: 'leap'                                                                        },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 128, 129, 130] } ] },
        { kind: 'assertCursors', cursors: [ [1, 62] ]                                         },        

        // (User Presses Tab) 
        //
        // Jump to the fourth tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        { kind: 'jumpToNextTabstop'                                                           },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 128, 129, 130] } ] },
        { kind: 'assertCursors', cursors: [ { anchor: [1, 107], active: [1, 125] } ]          },

        // (User Presses Tab) 
        //
        // Jump out of the snippet.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        { kind: 'jumpToNextTabstop'                                                           },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 128, 129, 130] } ] },
        { kind: 'assertCursors', cursors: [ [1, 128] ]                                        },

        // Add spacing.
        { kind: 'typeText',      text:    ' '                                                 },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 30, 129, 130, 131] } ] },
        { kind: 'assertCursors', cursors: [ [1, 129] ]                                        },

        // (User Presses Tab)
        // 
        // Jump out of the third remaining pair.
        { kind: 'leap'                                                               },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 130, 131] } ] },
        { kind: 'assertCursors', cursors: [ [1, 130] ]                               },

        // Add more spacing
        { kind: 'typeText',      text:    ' '                                        },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 21, 131, 132] } ] },
        { kind: 'assertCursors', cursors: [ [1, 131] ]                               },

        // (User Presses Tab)
        // 
        // Jump out of the second remaining pair.
        { kind: 'leap'                                                      },
        { kind: 'assertPairs',   pairs:   [ { line: 1, sides: [20, 132] } ] },
        { kind: 'assertCursors', cursors: [ [1, 132] ]                      },

        // (User Presses Tab)
        // 
        // Jump out of the final pair.
        { kind: 'leap'                                                },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 133] ]                },

        // Complete the line with a semicolon at the end.
        { kind: 'typeText',      text:    ';'                         },
        { kind: 'assertPairs',   pairs:   [ { line: -1, sides: [] } ] },
        { kind: 'assertCursors', cursors: [ [1, 134] ]                },
    ]
};
export const SINGLE_CURSOR_TRACKING_TEST_GROUP: TestGroup = {
    name: 'Tracking (Single Cursor)',
    testCases: [
        SINGLE_LINE_TEXT_MODIFICATIONS_BETWEEN_PAIRS_TEST_CASE,
        AUTOCOMPLETIONS_OK_TEST_CASE,
        SNIPPETS_OK_TEST_CASE,
    ]
};
