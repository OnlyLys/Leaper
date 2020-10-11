//! Note that within the test cases in this module, we often insert non-ASCII text in order to guard 
//! against regressions since at one point this extension was not able track pairs once non-ASCII
//! text was involved.

import { CompactClusters } from '../../framework/compact';
import { range, sliceAdd, sliceSub } from '../../framework/utilities';
import { TestCase, TestGroup } from '../../framework/framework';
import { SnippetString } from 'vscode';
import { ALICE_TEXT_1, ALICE_TEXT_2, LOREM_IPSUM_1 } from '../../framework/placeholder-texts';

/**
 * Test case to check whether this extension can handle text modifications before pairs.
 * 
 * Within this test case we will be trying all possible variants of text modifications before pairs.
 * 
 * Text modifications before pairs are expected to shift the position of the cursor and the pairs.
 */
const TEXT_MODIFICATIONS_BEFORE_PAIRS_TEST_CASE = new TestCase({
    name: 'Text Modifications Before Pairs',

    // This sets up the initial document as:
    //
    // ```
    // function main() {
    //     [[[[[[[[[[]]]]]]]]]]
    // }
    // ```
    //
    // Note that in reality when we insert autoclosing pairs with the 'typePair' action, the pairs 
    // are randomly selected. However for notational convenience, we use `[]` to represent pairs.
    prelude: async (context) => {
        await context.typeText({ text: 'function main() {\n' });
        await context.typePair({ repetitions: 10 });
        context.assertPairsPrelude([ { line: 1, sides: range(4, 24) } ]);
        context.assertCursorsPrelude([ [1, 14] ]);
    },

    action: async (context) => {

        // 1. Insert single-line text on the same line before the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.insertText({ position: [1, 4], text:  'const x = ' });
        context.assertPairs([ { line: 1, sides: range(14, 34) } ]);
        context.assertCursors([ [1, 24] ]);

        // 2. Insert multi-line text on the same line before the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = 'Hello 😃';
        //     let y = 10.1;
        //     const variable = [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.insertText({ 
            position: [1, 14], 
            text:     `'Hello 😃';\n    let y = 10.1;\n    const variable = ` 
        });
        context.assertPairs([ { line: 3, sides: range(21, 41) } ]);
        context.assertCursors([ [3, 31] ]);

        // 3. Delete single-line text on the same line before the pairs.
        //
        // Document state after:
        //
        // ``` 
        // function main() {
        //     const x = 'Hello 😃';
        //     let y = 10.1;
        //     const var = [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ replace: { start: [3, 13], end: [3, 18] }, insert: '' });
        context.assertPairs([ { line: 3, sides: range(16, 36) } ]);
        context.assertCursors([ [3, 26] ]);

        // 4. Delete multi-line text starting from a line above and ending on the same line before 
        //    the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = 'Hello 😃';
        //     let y = [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ replace: { start: [2, 10], end: [3, 14] }, insert: '' });
        context.assertPairs([ { line: 2, sides: range(12, 32) } ]);
        context.assertCursors([ [2, 22] ]);

        // 5. Replace single-line text on the same line before the pairs with single-line text.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = 'Hello 😃';
        //     let reallyLongVariableName = [[[[[[[[[[]]]]]]]]]]
        // } 
        // ```
        await context.replaceText({
            replace: { start: [2, 8], end: [2, 9] }, 
            insert:  'reallyLongVariableName' 
        });
        context.assertPairs([ { line: 2, sides: range(33, 53) } ]);
        context.assertCursors([ [2, 43] ]);

        // 6. Replace single-line text on the same line before the pairs with multi-line text.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = 'Hello 😃';
        //     const s = `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to 
        // do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
        // conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'
        // 
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.`;
        //     const a = [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({
            replace: { start: [2, 4], end: [2, 33] }, 
            insert:  'const s = `' + ALICE_TEXT_1 + '`;\n    const a = '
        });
        context.assertPairs([ { line: 9, sides: range(14, 34) } ]);
        context.assertCursors([ [9, 24] ]);

        // 7. Replace multi-line text starting from a line above and ending on the same line before 
        //    the pairs with single-line text.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = 'Hello 😃';
        //     const s = { first: 'Typescript 😎', second: [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({
            replace: { start: [2, 14], end: [9, 13] }, 
            insert:  `{ first: 'Typescript 😎', second:`
        });
        context.assertPairs([ { line: 2, sides: range(48, 68) } ]);
        context.assertCursors([ [2, 58] ]);

        // 8. Replace multi-line text starting from a line above and ending on the same line before 
        //    the pairs with multi-line text.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = [
        //         'woah',
        //         'dude'
        //     ]; 
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({
            replace: { start: [1, 14], end: [2, 48] }, 
            insert:  `[\n        'woah',\n        'dude'\n    ];\n    const fn = () => ['🐸', `
        });
        context.assertPairs([ { line: 5, sides: range(28, 48) } ]);
        context.assertCursors([ [5, 38] ]);

        // 9. Insert single-line text on a line above the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = [
        //         'woah',
        //         'dude 🤯🤯🤯🤯🤯🤯🤯🤯🤯🤯'
        //     ];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.insertText({ position: [3, 13], text: ' 🤯🤯🤯🤯🤯🤯🤯🤯🤯🤯' });
        context.assertPairs([ { line: 5, sides: range(28, 48) } ]);
        context.assertCursors([ [5, 38] ]);

        // 10. Insert multi-line text on a line above the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = [
        //         'woah',
        //         'dude 🤯🤯🤯🤯🤯🤯🤯🤯🤯🤯',
        //         'In those days',
        //         'in those far remote days',
        //         'in those nights',
        //         'in those faraway nights',
        //         'in those years',
        //         'in those far remote years',
        //         'at that time the wise one who knew how to speak in elaborate words lived in the Land'
        //     ];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.insertText({ 
            position: [3, 35], 
            text: ',\n'
            + `        'In those days',\n`
            + `        'in those far remote days',\n`
            + `        'in those nights',\n`
            + `        'in those faraway nights',\n`
            + `        'in those years',\n`
            + `        'in those far remote years',\n`
            + `        'at that time the wise one who knew how to speak in elaborate words lived in the Land'`
        });
        context.assertPairs([ { line: 12, sides: range(28, 48) } ]);
        context.assertCursors([ [12, 38] ]);

        // 11. Delete single-line text on a line above the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = [
        //         'woah',
        //         'dude 🤯🤯🤯🤯🤯🤯🤯🤯🤯🤯',
        //         'In those days',
        //         'in those far remote days',
        //         'in those nights',
        //         'in those faraway nights',
        //         'in those years',
        //         'in those far remote years',
        //     
        //     ];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ replace: { start: [10, 8], end: [10, 94] }, insert: '' });
        context.assertPairs([ { line: 12, sides: range(28, 48) } ]);
        context.assertCursors([ [12, 38] ]);

        // 12. Delete multi-line text on lines above the pairs.
        //
        // Document state after:
        //
        // ```
        // function main() {
        //     const x = [
        //         'In those days',
        //         'in those far remote days',
        //         'in those nights',
        //         'in those faraway nights',
        //         'in those years',
        //         'in those far remote years',
        //  
        //     ];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ replace: { start: [1, 15], end: [3, 36] }, insert: ''  });
        context.assertPairs([ { line: 10, sides: range(28, 48) } ]);
        context.assertCursors([ [10, 38] ]);

        // 13. Replace single-line text on a line above the pairs with single-line text.
        //
        // Document state after:
        //
        // ```
        // function primary() {
        //     const x = [
        //         'In those days',
        //         'in those far remote days',
        //         'in those nights',
        //         'in those faraway nights',
        //         'in those years',
        //         'in those far remote years',
        //  
        //     ];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ replace: { start: [0, 9], end: [0, 13] }, insert: 'primary' });
        context.assertPairs([ { line: 10, sides: range(28, 48) } ]);
        context.assertCursors([ [10, 38] ]);

        // 14. Replace single-line text on a line above the pairs with multi-line text.
        //
        // Document state after:
        //
        // ```
        // function primary() {
        //     const num = 1.4561;
        //     
        //     const instructionsOfShuruppak = [
        //         'In those days',
        //         'in those far remote days',
        //         'in those nights',
        //         'in those faraway nights',
        //         'in those years',
        //         'in those far remote years',
        //  
        //     ];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({
            replace: { start: [1, 10], end: [1, 11] }, 
            insert:  'num = 1.4561;\n    \n    const instructionsOfShuruppak'
        });
        context.assertPairs([ { line: 12, sides: range(28, 48) } ]);
        context.assertCursors([ [12, 38] ]);

        // 15. Replace multi-line text on lines above the pairs with single-line text.
        //  
        // Document state after:
        //
        // ```
        // function primary() {
        //     const num = 1.4561;
        //      
        //     const instructionsOfShuruppak = ['Fate is a wet bank; it can make one slip'];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ 
            replace: { start: [3, 37], end: [11, 4] }, 
            insert:  `'Fate is a wet bank; it can make one slip'`
        });
        context.assertPairs([ { line: 4, sides: range(28, 48) } ]);
        context.assertCursors([ [4, 38] ]);

        // 16. Replace multi-line text on lines above the pairs with multi-line text.
        //
        // Document state after: 
        //
        // ```
        // () => {
        //     function hey() {
        //         console.log('🙂 + 🕶 = 😎');
        //     }
        //     hey();
        //     const instructionsOfShuruppak = ['Fate is a wet bank; it can make one slip'];
        //     const fn = () => ['🐸', [[[[[[[[[[]]]]]]]]]]
        // }
        // ```
        await context.replaceText({ 
            replace: { start: [0, 0], end: [2, 4] },
            insert:  '() => {\n'
                + '    function hey() {\n'
                + `        console.log('🙂 + 🕶 = 😎');\n`
                + '    }\n'
                + '    hey();'
        });
        context.assertPairs([ { line: 6, sides: range(28, 48) } ]);
        context.assertCursors([ [6, 38] ]);
    }
});

/**
 * Test case to check whether this extension can handle single-line text modifications between pairs.
 * 
 * Note that because multi-line text insertions between pairs cause pairs to be untracked, those 
 * kind of text insertions are tested in the `pair-invalidation.ts` module.
 */
const SINGLE_LINE_TEXT_MODIFICATIONS_BETWEEN_PAIRS_TEST_CASE = new TestCase({
    name: 'Single-line Text Modifications Between Pairs',
    editorLanguageId: 'markdown',

    // This sets up the initial document as:
    //
    // ```
    // 
    // blah-blah[[[[[[[[[[]]]]]]]]]]
    //                    ^(cursor position)
    // ```
    //
    // Note that in reality when we insert autoclosing pairs with the 'typePair' action, the pairs 
    // are randomly selected. However for notational convenience, we use `[]` to represent pairs.
    prelude: async (context) => {
        await context.typeText({ text: '\nblah-blah\n' });
        await context.moveCursors({ direction: 'up' });
        await context.end();
        await context.typePair({ repetitions: 10 });
        context.assertPairsPrelude([ { line: 1, sides: range(9, 29) } ]);
        context.assertCursorsPrelude([ [1, 19] ]);
    },

    action: async (context) => {
        const pairs: CompactClusters = [ { line: 1, sides: range(9, 29) } ];

        // 1. Insert 17 code units between the opening sides of the first and second pairs.
        //
        // After this, the sides of the pairs are at character indices:
        // 
        //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[[[[]]]]]]]]]]
        //                                       ^(cursor position)
        // ```
        await context.insertText({ position: [1, 10], text: '❤🧡💛💚💙💜🤎🖤🤍' });
        sliceAdd(pairs[0].sides, 1, 20, 17);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 36] ]);

        // 2. Insert 11 code units in between the closing sides of the fourth and fifth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        // 
        //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 53, 54, 55, 56
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[[[[]]]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                       ^(cursor position)
        // ```
        await context.insertText({ position: [1, 42], text: 'H᭭a᭰p⃠p᭬ỳ֑' });
        sliceAdd(pairs[0].sides, 16, 20, 11);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 36] ]);

        // 3. Type 10 code units at the cursor.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 46, 47, 48, 49, 50, 51, 63, 64, 65, 66
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[[[[Pretzel 🥨]]]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                 ^(cursor position)
        // ```
        await context.typeText({ text: 'Pretzel 🥨' });
        sliceAdd(pairs[0].sides, 10, 20, 10);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 46] ]);

        // 4. Type 20 code units at the cursor.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 66, 67, 68, 69, 70, 71, 83, 84, 85, 86
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。]]]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                  ^(cursor position)
        // ```
        await context.typeText({ text: '蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。' });
        sliceAdd(pairs[0].sides, 10, 20, 20);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 66] ]);

        // 5. Insert 8 code units at the cursor (simulating a paste action).
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 74, 75, 76, 77, 78, 79, 91, 92, 93, 94
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣😖🤯]]]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                          ^(cursor position)
        // ```
        await context.insertText({ position: [1, 66], text: '😮😣😖🤯' });
        sliceAdd(pairs[0].sides, 10, 20, 8);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 74] ]);

        // 6. Backspace 2 times, deleting 4 code units at the cursor.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 70, 71, 72, 73, 74, 75, 87, 88, 89, 90
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]]]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                      ^(cursor position)
        // ```
        await context.backspace({ repetitions: 2 });
        sliceSub(pairs[0].sides, 10, 20, 4);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 70] ]);

        // 7. Insert 12 code units between the opening sides of the seventh and eighth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 45, 46, 47, 82, 83, 84, 85, 86, 87, 99, 100, 101, 102
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice Cream 🍦[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]]]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                                  ^(cursor position)
        // ```
        await context.insertText({ position: [1, 33], text: 'Ice Cream 🍦' });
        sliceAdd(pairs[0].sides, 7, 20, 12);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 82] ]);

        // 8. Insert 10 code units between the closing sides of the eighth and ninth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 45, 46, 47, 82, 83, 94, 95, 96, 97, 109, 110, 111, 112
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice Cream 🍦[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]]🙏🙏🙏🙏🙏]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                                  ^(cursor position)
        // ```
        await context.insertText({ position: [1, 84], text: '🙏🙏🙏🙏🙏' });
        sliceAdd(pairs[0].sides, 12, 20, 10);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 82] ]);

        // 9. Delete 9 code units between the opening sides of the seventh and eighth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 38, 73, 74, 85, 86, 87, 88, 100, 101, 102, 103
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]]🙏🙏🙏🙏🙏]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                         ^(cursor position)
        // ```
        await context.replaceText({ replace: { start: [1, 36], end: [1, 45] }, insert: '' });
        sliceSub(pairs[0].sides, 7, 20, 9);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 73] ]);

        // 10. Insert 8 code units between the closing sides of the ninth and tenth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 38, 73, 82, 93, 94, 95, 96, 108, 109, 110, 111
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                         ^(cursor position)
        // ```
        await context.insertText({ position: [1, 74], text: '🥰😍🤫🤓' });
        sliceAdd(pairs[0].sides, 11, 20, 8);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 73] ]);

        // 11. Insert 13 code units between the opening sides of the ninth and tenth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //  
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 51, 86, 95, 106, 107, 108, 109, 121, 122, 123, 124
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Bubble Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]H᭭a᭰p⃠p᭬ỳ֑]]]]
        //                                                                                                      ^(cursor position)
        // ```
        await context.insertText({ position: [1, 38], text: 'Bubble Tea 🧋' });
        sliceAdd(pairs[0].sides, 9, 20, 13);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 86] ]);
        
        // 12. Delete 11 code units between the closing side of the fourth and fifth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //  
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 51, 86, 95, 106, 107, 108, 109, 110, 111, 112, 113
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Bubble Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]]]]
        //                                                                                                      ^(cursor position)
        // ```
        await context.replaceText({ replace: { start: [1, 110], end: [1, 121] }, insert: '' });
        sliceSub(pairs[0].sides, 16, 20, 11);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 86] ]);

        // 13. Delete 7 code units between the opening sides of the ninth and tenth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 79, 88, 99, 100, 101, 102, 103, 104, 105, 106
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在水一方。😮😣]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]]]]
        //                                                                                               ^(cursor position)
        // ```
        await context.replaceText({ replace: { start: [1, 38], end: [1, 45] }, insert: '' });
        sliceSub(pairs[0].sides, 9, 20, 7);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 79] ]);

        // 14. Backspace 6 times, deleting 8 code units at the cursor.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 71, 80, 91, 92, 93, 94, 95, 96, 97, 98
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]]]]
        //                                                                                    ^(cursor position)
        // ```
        await context.backspace({ repetitions: 6 });
        sliceSub(pairs[0].sides, 10, 20, 8);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 71] ]);

        // 15a. Move the cursor back 3 times, moving back 3 code units.
        //
        // After this, the sides of the pairs are still at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 71, 80, 91, 92, 93, 94, 95, 96, 97, 98
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊人、在]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]]]]
        //                                                                               ^(cursor position)
        // ```
        await context.moveCursors({ direction: 'left', repetitions: 3 });
        context.assertPairs(pairs);
        context.assertCursors([ [1, 68] ]);

        // 15b. Type in 7 code units.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 78, 87, 98, 99, 100, 101, 102, 103, 104, 105
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊Fire 🔥人、在]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]]]]
        //                                                                                      ^(cursor position)
        // ```
        await context.typeText({ text: 'Fire 🔥' });
        sliceAdd(pairs[0].sides, 10, 20, 7);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 75] ]);

        // 16. Insert 10 code units between the closing sides of the third and fourth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 28, 29, 30, 31, 32, 36, 37, 44, 78, 87, 98, 99, 100, 101, 102, 113, 114, 115
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊Fire 🔥人、在]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]Chicken 🍗]]]
        //                                                                                      ^(cursor position)
        // ```
        await context.insertText({ position: [1, 103], text: 'Chicken 🍗' });
        sliceAdd(pairs[0].sides, 17, 20, 10);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 75] ]);

        // 17. Insert 10 code units between the opening sides of the second and third pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 27, 38, 39, 40, 41, 42, 46, 47, 54, 88, 97, 108, 109, 110, 111, 112, 123, 124, 125
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛💚💙💜🤎🖤🤍[Popcorn 🍿[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊Fire 🔥人、在]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]Chicken 🍗]]]
        //                                                                                                ^(cursor position)
        // ```
        await context.insertText({ position: [1, 28], text: 'Popcorn 🍿' });
        sliceAdd(pairs[0].sides, 2, 20, 10);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 85] ]);

        // 18. Replace 8 code units between the opening sides of the first and second pairs with 2 
        //     code units.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 82, 91, 102, 103, 104, 105, 106, 117, 118, 119
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛🫀🖤🤍[Popcorn 🍿[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊Fire 🔥人、在]🥰😍🤫🤓]🙏🙏🙏🙏🙏]]]]]Chicken 🍗]]]
        //                                                                                          ^(cursor position)
        // ```
        await context.replaceText({ replace: { start: [1, 15], end: [1, 23] }, insert: '🫀' });
        sliceSub(pairs[0].sides, 1, 20, 6);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 79] ]);

        // 19. Delete 6 code units between the closing sides of the eighth and ninth pairs.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 82, 91, 96, 97, 98, 99, 100, 111, 112, 113
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛🫀🖤🤍[Popcorn 🍿[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊Fire 🔥人、在]🥰😍🤫🤓]🙏🙏]]]]]Chicken 🍗]]]
        //                                                                                          ^(cursor position)
        // ```
        await context.replaceText({ replace: { start: [1, 96], end: [1, 102] }, insert: '' });
        sliceSub(pairs[0].sides, 12, 20, 6);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 79] ]);

        // 20a. Move the cursor back 6 times, moving back 7 code units.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 82, 91, 96, 97, 98, 99, 100, 111, 112, 113
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛🫀🖤🤍[Popcorn 🍿[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊Fire 🔥人、在]🥰😍🤫🤓]🙏🙏]]]]]Chicken 🍗]]]
        //                                                                                   ^(cursor position)
        // ```
        await context.moveCursors({ direction: 'left', repetitions: 6 });
        context.assertPairs(pairs);
        context.assertCursors([ [1, 72] ]);

        // 20b. Delete right 5 code units.
        //
        // After this, the sides of the pairs are at character indices:
        //
        //   9, 21, 32, 33, 34, 35, 36, 40, 41, 48, 77, 86, 91, 92, 93, 94, 95, 106, 107, 108
        //
        // Document state after:
        //
        // ```
        // 
        // blah-blah[❤🧡💛🫀🖤🤍[Popcorn 🍿[[[[[Ice[[Tea 🧋[Pretzel 🥨蒹葭蒼蒼、白露為霜。所謂伊🔥人、在]🥰😍🤫🤓]🙏🙏]]]]]Chicken 🍗]]]
        //                                                                                   ^(cursor position)
        // ```
        await context.deleteRight({ repetitions: 5 });
        sliceSub(pairs[0].sides, 10, 20, 5);
        context.assertPairs(pairs);
        context.assertCursors([ [1, 72] ]);
    }
});

/**
 * Test case to check whether this extension can handle autocompleted text insertions between pairs.
 */
const AUTOCOMPLETIONS_OK_TEST_CASE = new TestCase({
    name: 'Autocompletions OK',

    // This sets up the document:
    //
    // ```
    // function main(){
    //     const reallyLongVariableName = 10;
    //     [[[[[[[[[[]]]]]]]]]]
    // }
    // ```
    //
    // Note that in reality when we insert autoclosing pairs with the 'typePair' action, the pairs 
    // are randomly selected. However for notational convenience, we use `[]` to represent pairs.
    prelude: async (context) => {
        await context.insertText({
            position: [0, 0], 
            text:     'function main(){\n    const reallyLongVariableName = 10;\n    \n}'
        });
        await context.setCursors({ cursors: [ [2, 4] ] });
        await context.typePair({ repetitions: 10 });
        context.assertPairsPrelude([ { line: 2, sides: range(4, 24) } ]);
        context.assertCursorsPrelude([ [2, 14] ]);
    },

    action: async (context) => {
        const pairs: CompactClusters = [ { line: 2, sides: range(4, 24) } ];

        // Autocomplete the variable name and check that all pairs are correctly tracked.
        //
        // Document state after:
        // 
        // ```
        // function main(){
        //     const reallyLongVariableName = 10;
        //     [[[[[[[[[[reallyLongVariableName]]]]]]]]]]
        // }
        // ```
        await context.typeText({ text: 'really' });
        await context.triggerAndAcceptSuggestion();
        sliceAdd(pairs[0].sides, 10, 20, 22);
        context.assertPairs(pairs);
        context.assertCursors([ [2, 36] ]);

        // As an additional check, perform another autocompletion.
        //
        // Document state after:
        // 
        // ```
        // function main(){
        //     const reallyLongVariableName = 10;
        //     [[[[[[[[[[reallyLongVariableName reallyLongVariableName]]]]]]]]]]
        // }
        // ```
        await context.setCursors({ cursors: [ [2, 14] ] });
        await context.typeText({ text: ' ' });
        await context.moveCursors({ direction: 'left' });
        await context.typeText({ text: 'really' });
        await context.triggerAndAcceptSuggestion();
        sliceAdd(pairs[0].sides, 10, 20, 23);
        context.assertPairs(pairs);
        context.assertCursors([ [2, 36] ]);
    }
});

/**
 * Test case to check whether this extension can handle snippet text insertions between pairs.
 * 
 * Note that because multi-line text insertions between pairs cause pairs to be untracked, 
 * multi-line snippets also cause pairs to be untracked, and are therefore tested in the 
 * `pair-invalidation.ts` module.
 */
const SNIPPETS_OK_TEST_CASE = new TestCase({
    name: 'Snippets OK',

    // This sets up the initial document as:
    //
    // ```
    // function main() {
    //     const x = someFn({ outer: { inner: }})
    // }                                      ^(cursor position)
    // ```
    prelude: async (context) => {
        await context.typeText({ text: 'function main() {\nconst x = ' });
        await context.setCursors({ cursors: [ [1, 14] ] });
        await context.typeText({ text: 'someFn({ outer: { inner: ' });
        context.assertPairsPrelude([ { line: 1, sides: [20, 21, 30, 39, 40, 41] } ]);
        context.assertCursorsPrelude([ [1, 39] ]);
    },
    action: async (context) => {

        // Insert the snippet.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(float, binary), arg3:  })}})
        // }                                                                |----^(cursor selection)
        // ```
        await context.insertSnippet({
            snippet: new SnippetString('fn1({ arg1: `$3`, arg2: fn2(${1:float}, ${2:binary}), arg3: $4 })$0')
        });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 90, 91, 92] } ]);
        context.assertCursors([ { anchor: [1, 65], active: [1, 70] } ]);
    
        // Insert a floating point number at the first tabstop.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, binary), arg3:  })}})
        // }                                                                             ^(cursor position)
        // ```
        await context.typeText({ text: '3.14159265359' });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 98, 99, 100] } ]);
        context.assertCursors([ [1, 78] ]);

        // (User presses Tab)
        //
        // Jump to the second tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, binary), arg3:  })}})
        // }                                                                               |-----^(cursor position)
        // ```
        await context.jumpToNextTabstop();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 98, 99, 100] } ]);
        context.assertCursors([ { anchor: [1, 80], active: [1, 86]} ]);

        // Insert a binary number at the second tabstop.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3:  })}})
        // }                                                                                       ^(cursor position)
        // ```
        await context.typeText({ text: '0b101010' });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 100, 101, 102] } ]);
        context.assertCursors([ [1, 88] ]);

        // (User presses Tab) 
        //
        // Jump to the third tabstop without inserting anything there yet.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3:  })}})
        // }                                                   ^(cursor position)
        // ```
        await context.jumpToNextTabstop();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 100, 101, 102] } ]);
        context.assertCursors([ [1, 52] ]);

        // (User presses Tab) 
        //
        // Jump to to the fourth tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3:  })}})
        // }                                                                                                ^(cursor position)
        // ```
        await context.jumpToNextTabstop();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 100, 101, 102] } ]);
        context.assertCursors([ [1, 97] ]);

        // Insert a single-element array at the fourth tabstop.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello'] })}})
        // }                                                                                                       ^(cursor position)
        // ```
        await context.typeText({ text: "['hello" });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 97, 98, 104, 105, 109, 110, 111] } ]);
        context.assertCursors([ [1, 104] ]);

        // (User presses Tab) 
        //
        // Leap out of the array element's autoclosed quotes.
        //
        // Note that 'Leap' executes when Tab is pressed here because:
        //
        //  1. There is line of sight to the nearst pair.
        //  2. By default the `leaper.leap` command has higher keybinding priority than the 
        //     `jumpToNextTabstop` command.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello'] })}})
        // }                                                                                                        ^(cursor position)
        // ```
        await context.leap();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 97, 105, 109, 110, 111] } ]);
        context.assertCursors([ [1, 105] ]);

        // Insert another array element.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] })}})
        // }                                                                                                                ^(cursor position)
        // ```
        await context.typeText({ text: ", 'world" });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 97, 107, 113, 114, 118, 119, 120] } ]);
        context.assertCursors([ [1, 113] ]);

        // (User presses Shift+Tab) 
        //
        // Jump back to the third tabstop.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: ``, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] })}})
        // }                                                   ^(cursor position)
        // ```
        await context.jumpToPrevTabstop();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 118, 119, 120] } ]);
        context.assertCursors([ [1, 52] ]);

        // Fill in the template string at the third tabstop.
        //
        // Document state after:
        //  
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] })}})
        // }                                                            ^(cursor position)
        // ```
        await context.typeText({ text: '${168 / 4' });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 53, 61, 128, 129, 130] } ]);
        context.assertCursors([ [1, 61] ]);

        // (User presses Tab) 
        //
        // Leap out of the curly braces within the template string.
        //
        // Note that Leap executes when Tab is pressed here because:
        //
        //  1. There is line of sight to the nearst pair.
        //  2. By default the `leaper.leap` command has higher keybinding priority than the 
        //     `jumpToNextTabstop` command.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] })}})
        // }                                                             ^(cursor position)
        // ```
        await context.leap();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 128, 129, 130] } ]);
        context.assertCursors([ [1, 62] ]);

        // (User presses Tab) 
        //
        // Jump to the fourth tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] })}})
        // }                                                                                                          |-----------------^(cursor selection)
        // ```
        await context.jumpToNextTabstop();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 128, 129, 130] } ]);
        context.assertCursors([ { anchor: [1, 107], active: [1, 125] } ]);

        // (User presses Tab) 
        //
        // Jump to the final tabstop.
        //
        // Note that 'jumpToNextTabstop' executes when Tab is pressed here because there is no line 
        // of sight to the nearest pair.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] })}})
        // }                                                                                                                               ^(cursor position)
        // ```
        await context.jumpToNextTabstop();
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 128, 129, 130] } ]);
        context.assertCursors([ [1, 128] ]);

        // Add spacing.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] }) }})
        // }                                                                                                                                ^(cursor position)
        // ```
        await context.typeText({ text: ' ' });
        context.assertPairs([ { line: 1, sides: [20, 21, 30, 129, 130, 131] } ]);
        context.assertCursors([ [1, 129] ]);

        // (User presses Tab)
        // 
        // Jump out of the third remaining pair.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] }) }})
        // }                                                                                                                                 ^(cursor position)
        // ```
        await context.leap();
        context.assertPairs([ { line: 1, sides: [20, 21, 130, 131] } ]);
        context.assertCursors([ [1, 130] ]);

        // Add more spacing.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] }) } })
        // }                                                                                                                                  ^(cursor position)
        // ```
        await context.typeText({ text: ' ' });
        context.assertPairs([ { line: 1, sides: [20, 21, 131, 132] } ]);
        context.assertCursors([ [1, 131] ]);

        // (User presses Tab)
        // 
        // Jump out of the second remaining pair.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] }) } })
        // }                                                                                                                                   ^(cursor position)
        // ```
        await context.leap();
        context.assertPairs([ { line: 1, sides: [20, 132] } ]);
        context.assertCursors([ [1, 132] ]);

        // (User presses Tab)
        // 
        // Jump out of the final pair.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] }) } })
        // }                                                                                                                                    ^(cursor position)
        // ```
        await context.leap();
        context.assertPairs([ { line: -1, sides: [] } ]);
        context.assertCursors([ [1, 133] ]);

        // Complete the line with a semicolon at the end.
        //
        // Document state after:
        // 
        // ```
        // function main() {
        //     const x = someFn({ outer: { inner: fn1({ arg1: `${168 / 4}`, arg2: fn2(3.14159265359, 0b101010), arg3: ['hello', 'world'] }) } });
        // }                                                                                                                                     ^(cursor position)
        // ```
        await context.typeText({ text: ';' });
        context.assertPairs([ { line: -1, sides: [] } ]);
        context.assertCursors([ [1, 134] ]);
    }
});

/**
 * Test case to check whether this extension can handle text modifications after pairs.
 * 
 * Within this test case we will be trying all possible variants of text modifications after pairs.
 * 
 * Text modifications after pairs are not expected to affect the cursor and the pairs being tracked.
 */
const TEXT_MODIFICATIONS_AFTER_PAIRS_TEST_CASE = new TestCase({
    name: 'Text Modifications After Pairs',

    // This sets up the initial document as:
    //
    // ```
    // function main() {
    //     [[[[[[[[[[]]]]]]]]]]
    // }
    // ```
    //
    // Note that in reality when we insert autoclosing pairs with the 'typePair' action, the 
    // pairs are randomly selected. However for notational convenience, we use `[]` to represent 
    // pairs.
    prelude: async (context) => {
        await context.typeText({ text: 'function main() {\n' });
        await context.typePair({ repetitions: 10 });
        context.assertPairsPrelude([ { line: 1, sides: range(4, 24) } ]);
        context.assertCursorsPrelude([ [1, 14] ]);
    },

    action: async (context) => {

        // Because the pairs and cursors are not expected to change due to text modification 
        // occurring after them, this convenience method allows us to cut down on boilerplate.
        const check = () => {
            context.assertPairs([ { line: 1, sides: range(4, 24) } ]);
            context.assertCursors([ [1, 14] ]);
        };

        // 1. Insert single-line text on the same line after the pairs. 
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Goodbye World 🌍! 
        // }
        // ```
        await context.insertText({ position: [1, 24], text: ' Goodbye World 🌍! ' });
        check();

        // 2. Insert multi-line text on the same line after the pairs.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Goodbye World 🌍! Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to 
        // do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
        // conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'
        // 
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.insertText({ position: [1, 43], text: ALICE_TEXT_1 });
        check();
        
        // 3. Delete single-line text on the same line after the pairs.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Goodbye World 🌍! Alice was tired of sitting by her sister on the bank, and of having nothing to 
        // do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
        // conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'
        // 
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({  replace: { start: [1, 53], end: [1, 75] }, insert: '' });
        check();

        // 4. Delete multi-line text starting from the same line after the pairs and ending on a line 
        //    below.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Goodbye World 🌍! Alice
        //
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ``` 
        await context.replaceText({ replace: { start: [1, 48], end: [3, 104] }, insert: '' });
        check();

        // 5. Replace single-line text on the same line after the pairs with single-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! Alice
        //        
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({ replace: { start: [1, 25], end: [1, 32] }, insert: 'Hello' });
        check();

        // 6. Replace single-line text on the same line after the pairs with multi-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam facilisis, libero at viverra 
        // egestas, ipsum nunc venenatis felis, at ultrices nulla ex vitae quam. Etiam convallis purus eget 
        // nibh commodo, a molestie sapien rhoncus. Vestibulum ante ipsum primis in faucibus orci luctus et 
        // ultrices posuere cubilia curae; Aenean at sodales elit, ut ornare arcu. Donec vulputate auctor 
        // libero eu sollicitudin. Phasellus lacinia lectus sed metus consequat fringilla. Maecenas lobortis 
        // mauris sed sagittis vestibulum. Aliquam et tortor nunc. Integer in sapien quis tellus dignissim 
        // sodales non et mi. In egestas ac orci vitae viverra. Suspendisse non purus lacus.
        //
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ``` 
        await context.replaceText({ replace: { start: [1, 41], end: [1, 46] }, insert: LOREM_IPSUM_1 });
        check();

        // 7. Replace multi-line text starting from the same line after the pairs and ending on a line 
        //    below with single-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! Cat 😺!
        //
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ``` 
        await context.replaceText({ replace: { start: [1, 41], end: [7, 81] }, insert: 'Cat 😺!' });
        check();

        // 8. Replace multi-line text starting from the same line after the pairs and ending on a line 
        //    below with multi-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge.
        // }
        // ```
        await context.replaceText({ replace: { start: [1, 41], end: [5, 89] }, insert: ALICE_TEXT_2 });
        check();

        // 9. Insert single-line text on a line below the pairs.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to 😤 hmph 😤 have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge.
        // }
        // ```
        await context.insertText({ position: [3, 37], text: '😤 hmph 😤 ' });
        check();

        // 10. Insert multi-line text on a line below the pairs.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to 😤 hmph 😤 have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge.
        // 
        // Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to 
        // do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
        // conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'
        // 
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.insertText({ position: [8, 16], text: '\n\n' + ALICE_TEXT_1 });
        check();

        // 11. Delete single-line text on a line below the pairs. 
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge.
        // 
        // Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to 
        // do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
        // conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'
        // 
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({ replace: { start: [3, 37], end: [3, 48] }, insert: '' });
        check();

        // 12. Delete multi-line text on a line below the pairs.
        //
        // Document text after: 
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge.
        // 
        // So she was considering in her own mind (as well as she could, for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({ replace: { start: [10, 0], end: [13, 0] }, insert: '' });
        check();

        // 13. Replace single-line text on a line below the pairs with single-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge.
        // 
        // So she was considering 🥳🥳🥳🥳🥳🥳🥳🥳🥳🥳 for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // } 
        // ```
        await context.replaceText({ replace: { start: [10, 23], end: [10, 61] }, insert: '🥳🥳🥳🥳🥳🥳🥳🥳🥳🥳' });
        check();

        // 14. Replace single-line text on a line below the pairs with multi-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam facilisis, libero at viverra 
        // egestas, ipsum nunc venenatis felis, at ultrices nulla ex vitae quam. Etiam convallis purus eget 
        // nibh commodo, a molestie sapien rhoncus. Vestibulum ante ipsum primis in faucibus orci luctus et 
        // ultrices posuere cubilia curae; Aenean at sodales elit, ut ornare arcu. Donec vulputate auctor 
        // libero eu sollicitudin. Phasellus lacinia lectus sed metus consequat fringilla. Maecenas lobortis 
        // mauris sed sagittis vestibulum. Aliquam et tortor nunc. Integer in sapien quis tellus dignissim 
        // sodales non et mi. In egestas ac orci vitae viverra. Suspendisse non purus lacus.
        // to see it pop down a large rabbit-hole 
        // under the hedge.
        //
        // So she was considering 🥳🥳🥳🥳🥳🥳🥳🥳🥳🥳 for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({ replace: { start: [7, 35], end: [7, 64] }, insert: LOREM_IPSUM_1 + '\n' });
        check();

        // 15. Replace multi-line text on lines below the pairs with single-line text.
        //
        // Document text after:
        // 
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Hey now, you're an all star!'
        //
        // So she was considering 🥳🥳🥳🥳🥳🥳🥳🥳🥳🥳 for the hot day made her feel very 
        // sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({
            replace: { start: [2, 32], end: [15, 16] }, 
            insert:  `Hey now, you're an all star!'` 
        });
        check();

        // 16. Replace multi-line text on lines below the pairs with multi-line text.
        //
        // Document text after:
        //
        // ```
        // function main() {
        //     [[[[[[[[[[]]]]]]]]]] Hello World 🌍! There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
        // hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
        // it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
        // but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
        // hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
        // a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
        // ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
        // under the hedge. the pleasure of making a daisy-chain would be worth the trouble of getting 
        // up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.
        // }
        // ```
        await context.replaceText({ replace: { start: [2, 23], end: [5, 27] }, insert: ALICE_TEXT_2 });
        check();
    }
});

export const SINGLE_CURSOR_TRACKING_TEST_GROUP = new TestGroup({
    name: 'Tracking',
    testCases: [
        TEXT_MODIFICATIONS_BEFORE_PAIRS_TEST_CASE,
        SINGLE_LINE_TEXT_MODIFICATIONS_BETWEEN_PAIRS_TEST_CASE,
        AUTOCOMPLETIONS_OK_TEST_CASE,
        SNIPPETS_OK_TEST_CASE,
        TEXT_MODIFICATIONS_AFTER_PAIRS_TEST_CASE,
    ]
});
