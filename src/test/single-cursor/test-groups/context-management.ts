import { TestCase, TestGroup } from '../../utilities/framework';

/**
 * Test whether the keybinding contexts are correctly toggled while using a given text editor.
 */
const CONTEXT_TOGGLING_FOR_A_GIVEN_TEXT_EDITOR_TEST_CASE = new TestCase({
    name: 'Context Toggling for a Given Text Editor',
    prelude: async (executor) => {

        // The provided text editor starts out empty (and therefore without any pairs) so we would 
        // expect this extension to have initially disabled both keybinding contexts.
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [0, 0] ] });
    },
    task: async (executor) => {

        // Type in some text to simulate a user typing in code.
        //
        // Document state after:
        // 
        // ```
        // const ARR = 
        // ```         ^(cursor position)
        //
        // # Expected Keybinding Contexts
        // 
        // `leaper.inLeaperMode`: `false` since there are no pairs inserted in this step.
        // `leaper.hasLineOfSight`: `false` since there are no pairs inserted in this step.
        await executor.typeText({ text: 'const ARR = ' });
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [0, 12] ] });

        // Now type in a square bracket pair.
        //
        // Document state after:
        // 
        // ```
        // const ARR = []
        // ```          ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is now a pair being tracked.
        // `leaper.hasLineOfSight`: `true` since the cursor is next to the closing side of the newly
        //                          autoclosed square brackets.
        await executor.typeText({ text: '[' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 13] } ] });
        executor.assertCursors({ expect: [ [0, 13] ] });

        // Type in some spacing for simulate the user performing some formatting on the code.
        //
        // Document state after:
        // 
        // ```
        // const ARR = [  ]
        // ```            ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is still a pair being tracked.
        // `leaper.hasLineOfSight`: `true` since the cursor is still next to the closing side of the
        //                          pair being tracked.
        await executor.typeText({ text: ' ', repetitions: 2 });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 15] } ] });
        executor.assertCursors({ expect: [ [0, 15] ] });

        // Move the cursor back by one unit.
        //
        // Document state after:
        // 
        // ```
        // const ARR = [  ]
        // ```           ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is still a pair being tracked.
        // `leaper.hasLineOfSight`: `true` since line of sight is maintained.
        await executor.moveCursors({ direction: 'left' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 15] } ] });
        executor.assertCursors({ expect: [ [0, 14] ] });

        // Type in a single quote pair.
        //
        // Document state after:
        // 
        // ```
        // const ARR = [ '' ]
        // ```            ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there are two pairs being tracked.
        // `leaper.hasLineOfSight`: `true` since the cursor is next to the closing side of the newly
        //                          autoclosed single quotes.
        await executor.typeText({ text: '\'' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 14, 15, 17] } ] });
        executor.assertCursors({ expect: [ [0, 15] ] });

        // Fill in the string.
        //
        // Document state after:
        //
        // ``` 
        // const ARR = [ 'World' ]
        // ```                 ^(cursor position)
        // 
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there are still two pairs being tracked.
        // `leaper.hasLineOfSight`: `true` since line of sight is maintained.
        await executor.typeText({ text: 'World' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 14, 20, 22] } ] });
        executor.assertCursors({ expect: [ [0, 20] ] });

        // Begin moving to the left.
        // 
        // Document state after:
        //
        // ``` 
        // const ARR = [ 'World' ]
        // ```                ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there are still two pairs being tracked.
        // `leaper.hasLineOfSight`: `false` since there is a character `d` preventing line of sight
        //                          from the cursor to the nearest pair's closing side.
        await executor.moveCursors({ direction: 'left' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 14, 20, 22] } ] });
        executor.assertCursors({ expect: [ [0, 19] ] });

        // Move to the left boundary of the nearest pair.
        //
        // Document state after:
        //
        // ``` 
        // const ARR = [ 'World' ]
        // ```            ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there are still two pairs being tracked.
        // `leaper.hasLineOfSight`: `false` since there is a word `World` preventing line of sight
        //                          from the cursor to the nearest pair's closing side.
        await executor.moveCursors({ direction: 'left', repetitions: 4 });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 14, 20, 22] } ] });
        executor.assertCursors({ expect: [ [0, 15] ] });

        // Move out of the nearest pair.
        //
        // Document state after:
        //
        // ``` 
        // const ARR = [ 'World' ]
        // ```           ^(cursor position)
        //
        // # Expected Keybinding Contexts
        // 
        // `leaper.inLeaperMode`: `true` because even though there is one less pair being tracked, 
        //                        there is still one pair being tracked, so we would expect this 
        //                        context to still be enabled.
        // `leaper.hasLineOfSight`: `false` since there is clearly no line of sight to the enclosing
        //                          square brackets's closing side.
        await executor.moveCursors({ direction: 'left' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 22] } ] });
        executor.assertCursors({ expect: [ [0, 14] ] });

        // Move to the left boundary of the remaining pair.
        //
        // Document state after: 
        //
        // ``` 
        // const ARR = [ 'World' ]
        // ```          ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is still one pair being tracked.
        // `leaper.hasLineOfSight`: `false` since there is still no line of sight to the enclosing
        //                          square brackets's closing side.
        await executor.moveCursors({ direction: 'left' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 22] } ] });
        executor.assertCursors({ expect: [ [0, 13] ] });

        // Insert a single quote pair as part of inserting a new array element.
        //
        // Document state after: 
        //
        // ``` 
        // const ARR = [ '' 'World' ]
        // ```            ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there are two pairs being tracked.
        // `leaper.hasLineOfSight`: `true` since the cursor is next to the closing side of the newly
        //                          autoclosed single quotes.
        await executor.typeText({ text: ' \'' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 14, 15, 25] } ] });
        executor.assertCursors({ expect: [ [0, 15] ] });

        // Fill in the new array element.
        // 
        // Document state after: 
        //
        // ``` 
        // const ARR = [ 'Hello' 'World' ]
        // ```                 ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there are still two pairs being tracked.
        // `leaper.hasLineOfSight`: `true` since line of sight to the nearest single quotes's 
        //                          closing side is maintained.
        await executor.typeText({ text: 'Hello' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 14, 20, 30] } ] });
        executor.assertCursors({ expect: [ [0, 20] ] });

        // Since both keybinding contexts are enabled, the user is able to press the Leap keybinding 
        // to move the cursor out of the new array element.
        //
        // Document state after: 
        //
        // ``` 
        // const ARR = [ 'Hello' 'World' ]
        // ```                  ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is still one pair being tracked.
        // `leaper.hasLineOfSight`: `false` since there is clearly no line of sight to the enclosing
        //                          square brackets's closing side.
        await executor.leap();
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 30] } ] });
        executor.assertCursors({ expect: [ [0, 21] ] });

        // Add the necessary comma in between the two array elements.
        //
        // Document state after: 
        //
        // ``` 
        // const ARR = [ 'Hello', 'World' ]
        // ```                   ^(cursor position)
        //
        // # Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is still one pair being tracked.
        // `leaper.hasLineOfSight`: `false` since there is still no line of sight to the enclosing
        //                          square brackets's closing side.
        await executor.typeText({ text: ',' });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 31] } ] });
        executor.assertCursors({ expect: [ [0, 22] ] });

        // Move to just past the second array element in preparation for a leap out of the enclosing
        // square brackets.
        //
        // Document state after: 
        //
        // ``` 
        // const ARR = [ 'Hello', 'World' ]
        // ```                           ^(cursor position)
        //
        // Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `true` since there is still one pair being tracked.
        // `leaper.hasLineOfSight`: `true` since the cursor has line of sight to the pair that it is
        //                          about to leap out of.
        await executor.moveCursors({ direction: 'right', repetitions: 8 });
        executor.assertMRBInLeaperModeContext(true);
        executor.assertMRBHasLineOfSightContext(true);
        executor.assertPairs(  { expect: [ { line: 0, sides: [12, 31] } ] });
        executor.assertCursors({ expect: [ [0, 30] ] });

        // Since both keybinding contexts are enabled, the user is able to press the Leap keybinding 
        // to leap out of the enclosing square brackets.
        //
        // Document state after: 
        //
        // ``` 
        // const ARR = [ 'Hello', 'World' ]
        // ```                             ^(cursor position)
        //
        // Expected Keybinding Contexts
        //
        // `leaper.inLeaperMode`: `false` since there are no more pairs being tracked.
        // `leaper.hasLineOfSight`: `false` since there are no pairs to have line of sight to.
        await executor.leap();
        executor.assertMRBInLeaperModeContext(false);
        executor.assertMRBHasLineOfSightContext(false);
        executor.assertPairs(  { expect: [ 'None' ] });
        executor.assertCursors({ expect: [ [0, 32] ] });
    }
});

/**
 * This test group tests whether the keybinding context values are being appropriately managed for
 * single cursor situations.
 */
export const SINGLE_CURSOR_CONTEXT_MANAGEMENT_TEST_GROUP = new TestGroup({
    name: 'Context Management',
    testCases: [
        CONTEXT_TOGGLING_FOR_A_GIVEN_TEXT_EDITOR_TEST_CASE
    ]
});