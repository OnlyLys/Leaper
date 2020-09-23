//! Note that within the test cases in this module, we often insert non-ASCII text in order to guard 
//! against regressions since at one point this extension was not able track pairs once non-ASCII
//! text was involved.

import { Action, CompactCursors, CompactPairs, TestCase, TestGroup } from '../../typedefs';
import { clonePairs, range, sliceAdd, sliceSub } from '../../utilities';

/**
 * Test case to check whether this extension can handle single line text modifications between pairs.
 * 
 * Note that because multi line text insertions between pairs cause the pairs to be untracked, such
 * text insertions are tested in the `pair-invalidation.ts` module.
 */
const SINGLE_LINE_TEXT_MODIFICATIONS_BETWEEN_PAIRS_TEST_CASE: TestCase = (() => {
    const name    = 'Single Line Text Modifications Between Pairs';
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
}

export const SINGLE_CURSOR_TRACKING_TEST_GROUP: TestGroup = {
    name: 'Tracking (Single Cursor)',
    testCases: [
        SINGLE_LINE_TEXT_MODIFICATIONS_BETWEEN_PAIRS_TEST_CASE,

    ]
};
