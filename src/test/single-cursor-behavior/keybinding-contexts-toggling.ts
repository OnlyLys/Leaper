import { ViewColumn } from 'vscode';
import { TestCase, TestGroup } from '../utilities/framework';
import { range } from '../utilities/helpers';

/**
 * Test whether the keybinding contexts are appropriately toggled while using a given text editor.
 */
const WORKS_FOR_A_GIVEN_TEXT_EDITOR_TEST_CASE = new TestCase({
    name: 'Works for a Given Text Editor',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');

        // The Typescript text editor starts out empty (and therefore without any pairs) so we would 
        // expect the engine to have initially disabled both keybinding contexts.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);
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
        await executor.typeText('const ARR = ');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 12] ]);

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
        await executor.typeText('[');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 13] } ]);
        await executor.assertCursors([ [0, 13] ]);

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
        await executor.typeText(' ', 2);
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 15] } ]);
        await executor.assertCursors([ [0, 15] ]);

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
        await executor.moveCursors('left');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 15] } ]);
        await executor.assertCursors([ [0, 14] ]);

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
        await executor.typeText("'");
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 14, 15, 17] } ]);
        await executor.assertCursors([ [0, 15] ]);

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
        await executor.typeText('World');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 14, 20, 22] } ]);
        await executor.assertCursors([ [0, 20] ]);

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
        await executor.moveCursors('left');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        await executor.assertPairs([ { line: 0, sides: [12, 14, 20, 22] } ]);
        await executor.assertCursors([ [0, 19] ]);

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
        await executor.moveCursors('left', 4);
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        await executor.assertPairs([ { line: 0, sides: [12, 14, 20, 22] } ]);
        await executor.assertCursors([ [0, 15] ]);

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
        await executor.moveCursors('left');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        await executor.assertPairs([ { line: 0, sides: [12, 22] } ]);
        await executor.assertCursors([ [0, 14] ]);

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
        await executor.moveCursors('left');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        await executor.assertPairs([ { line: 0, sides: [12, 22] } ]);
        await executor.assertCursors([ [0, 13] ]);

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
        await executor.typeText(" '");
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 14, 15, 25] } ]);
        await executor.assertCursors([ [0, 15] ]);

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
        await executor.typeText('Hello');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 14, 20, 30] } ]);
        await executor.assertCursors([ [0, 20] ]);

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
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        await executor.assertPairs([ { line: 0, sides: [12, 30] } ]);
        await executor.assertCursors([ [0, 21] ]);

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
        await executor.typeText(',');
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        await executor.assertPairs([ { line: 0, sides: [12, 31] } ]);
        await executor.assertCursors([ [0, 22] ]);

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
        await executor.moveCursors('right', 8);
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
        await executor.assertPairs([ { line: 0, sides: [12, 31] } ]);
        await executor.assertCursors([ [0, 30] ]);

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
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 32] ]);
    }
});

/**
 * Test whether the keybinding contexts are appropriately toggled when switching between text editors.
 */
const WORKS_WHEN_SWITCHING_BETWEEN_TEXT_EDITORS_TEST_CASE = new TestCase({
    name: 'Works When Switching Between Text Editors',
    prelude: async (executor) => {
        
        // 0a. We begin with an empty Typescript text editor.
        //
        // State of visible text editors after this step:
        // 
        //     View Column      | 1 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          |
        //     Language         | Typescript |
        //     Number of Pairs  | 0          |
        //     Cursor Position  | [0, 0]     |
        //     Line of Sight    | No         |
        //
        await executor.openFile('./workspace-0/text.ts');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);

        // 0b. Since the initial text editor is empty, the engine should have disabled both of the 
        //     keybinding contexts when it took focus.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

    },
    task: async (executor) => {

        // 1a. Now type a few pairs into the initial Typescript text editor.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          |
        //     Language         | Typescript |
        //     Number of Pairs  | 10         |
        //     Cursor Position  | [0, 10]    |
        //     Line of Sight    | Yes        |
        // 
        await executor.typeText('[({{{([(([');
        await executor.assertPairs([ { line: 0, sides: range(0, 20) } ]);
        await executor.assertCursors([ [0, 10] ]);

        // 1b. We expect both keybinding contexts to be enabled since the initial text editor is in
        //     focus.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 2a. Now open the Plaintext file from Workspace Folder 1.
        //
        // The opened file immediately takes focus.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2 (active) |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          |
        //     Language         | Typescript | Plaintext  |
        //     Number of Pairs  | 10         | 0          |
        //     Cursor Position  | [0, 10]    | [0, 0]     |
        //     Line of Sight    | Yes        | No         |
        //
        await executor.openFile('./workspace-1/text.txt', ViewColumn.Two);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);

        // 2b. Because the opened text editor has no pairs being tracked for it, we expect both 
        //     contexts to be disabled when it takes focus.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 3a. Attempt to insert some pairs into the file from Workspace Folder 1.
        //
        // However, because pair detection is disabled (since `leaper.detectedPairs` was set to `[]`
        // for Plaintext in the test workspace), we would not expect any of the inserted pairs to be 
        // detected. 
        // 
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2 (active) |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          |
        //     Language         | Typescript | Plaintext  |
        //     Number of Pairs  | 10         | 0          |
        //     Cursor Position  | [0, 10]    | [0, 10]    |
        //     Line of Sight    | Yes        | No         |
        //
        await executor.typeText('[{{([({{([');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 10] ]);

        // 3b. Since none of the inserted pairs were tracked, both keybinding contexts should remain 
        ///    disabled.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 4a. Now open the Typescript file from Workspace Folder 2.
        //
        // The opened file immediately takes focus.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3 (active) |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 10         | 0          | 0          |
        //     Cursor Position  | [0, 10]    | [0, 10]    | [0, 0]     |
        //     Line of Sight    | Yes        | No         | No         |
        //
        await executor.openFile('./workspace-2/text.ts', ViewColumn.Three);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);

        // 4b. Because the opened text editor has no pairs being tracked for it, we expect both 
        //     keybinding contexts to be disabled when it takes focus.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 5a. Insert some pairs into the file from Workspace Folder 2.
        //
        // We only insert `()` pairs as `leaper.detectedPairs` was set to `[ "()" ]` in the second
        // workspace folder.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3 (active) |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 10         | 0          | 10         |
        //     Cursor Position  | [0, 10]    | [0, 10]    | [0, 10]    |
        //     Line of Sight    | Yes        | No         | Yes        |
        //
        await executor.typeText('(', 10);
        await executor.assertPairs([ { line: 0, sides: range(0, 20) } ]);
        await executor.assertCursors([ [0, 10] ]);

        // 5b. The inserted pairs are tracked, causing both keybinding contexts to be enabled.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 6a. Switch to view column 2.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2 (active) | 3          |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 10         | 0          | 10         |
        //     Cursor Position  | [0, 10]    | [0, 10]    | [0, 10]    |
        //     Line of Sight    | Yes        | No         | Yes        |
        //
        await executor.focusEditorGroup('left');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 10] ]);

        // 6b. We expect both keybinding contexts to be disabled upon switching to it, since there 
        //     are no pairs being tracked for Workspace Folder 1's text editor.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 7a. Switch to view column 1.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          |
        //     ----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 10         | 0          | 10         |
        //     Cursor Position  | [0, 10]    | [0, 10]    | [0, 10]    |
        //     Line of Sight    | Yes        | No         | Yes        |
        //
        await executor.focusEditorGroup('left');
        await executor.assertPairs([ { line: 0, sides: range(0, 20) } ]);
        await executor.assertCursors([ [0, 10] ]);

        // 7b. We expect both keybinding contexts to be enabled upon returning to view column 1, 
        //     since there are 10 pairs being tracked for the text editor in it.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 8a. Simulate the user triggering the 'Leap' command a few times.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 5          | 0          | 10         |
        //     Cursor Position  | [0, 15]    | [0, 10]    | [0, 10]    |
        //     Line of Sight    | Yes        | No         | Yes        |
        //
        await executor.leap(5);
        await executor.assertPairs([ { line: 0, sides: [0, 1, 2, 3, 4, 15, 16, 17, 18, 19] } ]);
        await executor.assertCursors([ [0, 15] ]);

        // 8b. No change in keybinding contexts is expected since there are still 5 pairs remaining.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 9a. Open another text editor in view column 1.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 0          | 0          | 10         |
        //     Cursor Position  | [0, 0]     | [0, 10]    | [0, 10]    |
        //     Line of Sight    | No         | No         | Yes        |
        //
        await executor.openFile('./workspace-4/text.ts', ViewColumn.One);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);

        // 9b. The above should cause both keybinding contexts to be disabled, since the new text 
        //     editor does not have any pairs within it. 
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 10a. Switch view column 1 back to the original initial text editor.
        //
        // Since the pairs being tracked for the initial text editor were cleared when we first 
        // switched away from it, switching back to it will show that there are no pairs being 
        // tracked.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 0          | 0          | 10         |
        //     Cursor Position  | [0, 15]    | [0, 10]    | [0, 10]    |
        //     Line of Sight    | No         | No         | Yes        |
        //
        await executor.switchToEditorInGroup('prev');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 15] ]);

        // 10b. Since there are no pairs for the active text editor (the initial text editor), both 
        //      keybinding contexts should remain disabled.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 11a. Type a few pairs into the initial text editor.
        //
        // This tests that keybinding contexts are still correctly updated even after we have 
        // switched between text editors within a tab group. 
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 3          | 0          | 10         |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 10]    |
        //     Line of Sight    | Yes        | No         | Yes        |
        //
        await executor.moveCursors('end');
        await executor.typeText('[{(');
        await executor.assertPairs([ { line: 0, sides: range(20, 26) } ]);
        await executor.assertCursors([ [0, 23] ]);

        // 11b. Now that there are pairs (and line of sight), both keybinding contexts should be 
        //      enabled.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 12a. Delete the pairs in Workspace Folder 2's text editor without view column 3 being in 
        //      focus.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 3          | 0          | 0          |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 0]     |
        //     Line of Sight    | Yes        | No         | No         |
        //
        await executor.editText(
            [
                { kind: 'delete', range: { start: [0, 0], end: [0, 20] } }
            ], 
            ViewColumn.Three
        );
        await executor.assertPairs([ 'None' ],   ViewColumn.Three);
        await executor.assertCursors([ [0, 0] ], ViewColumn.Three);

        // 12b. Since view column 3 is not in focus, the fact that there are no longer any pairs in 
        //      view column 3 does not affect the keybinding contexts.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 13a. Switch to view column 3.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          |
        //     Language         | Typescript | Plaintext  | Typescript |
        //     Number of Pairs  | 3          | 0          | 0          |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 0]     |
        //     Line of Sight    | Yes        | No         | No         |
        //
        await executor.focusEditorGroup('third');
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);

        // 13b. Since we deleted the pairs in view column 3 in the previous step, switching to it 
        //      now means we are switching to a text editor without pairs.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 14a. Now open the Markdown file from Workspace Folder 3.
        //
        // The opened file immediately takes focus.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3          | 4 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 0          |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 0]     | [0, 0]     |
        //     Line of Sight    | Yes        | No         | No         | No         |
        //
        await executor.openFile('./workspace-3/text.md', ViewColumn.Four);
        await executor.assertPairs([ 'None' ]);
        await executor.assertCursors([ [0, 0] ]);

        // 14b. Clearly the newly opened text editor has no pairs within it, so both keybinding 
        //      contexts should remain disabled.
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // 15a. Type a few pairs into Workspace Folder 3's text editor.
        //
        // Note that we only type in `{}` and `<>` pairs because `leaper.detectedPairs` was set to
        // `[ "{}", "<>" ]` for Markdown in Workspace Folder 3.
        // 
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3          | 4 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 10         |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 0]     | [0, 10]    |
        //     Line of Sight    | Yes        | No         | No         | Yes        |
        //
        await executor.typeText('{<{<{<<{{<');
        await executor.assertPairs([ { line: 0, sides: range(0, 20) } ]);
        await executor.assertCursors([ [0, 10] ]);

        // 15b. Both keybinding contexts should be enabled, now that Workspace Folder 3's text 
        //      editor has pairs and line of sight.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 16a. Type some text in between the pairs in Workspace Folder 3's text editor.
        // 
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3          | 4 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 10         |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 0]     | [0, 22]    |
        //     Line of Sight    | Yes        | No         | No         | Yes        |
        //
        await executor.typeText('Hello World!');
        await executor.assertPairs([ { line: 0, sides: [ ...range(0, 10), ...range(22, 32)] } ]);
        await executor.assertCursors([ [0, 22] ]);

        // 16b. Line of sight should still be maintained.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 17a. Move the cursor back a little bit to break line of sight.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3          | 4 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 10         |
        //     Cursor Position  | [0, 23]    | [0, 10]    | [0, 0]     | [0, 17]    |
        //     Line of Sight    | Yes        | No         | No         | No         |
        //
        await executor.moveCursors('left', 5);
        await executor.assertPairs([ { line: 0, sides: [ ...range(0, 10), ...range(22, 32)] } ]);
        await executor.assertCursors([ [0, 17] ]);

        // 17b. Since line of sight was broken, but there are still pairs, we expect only the line 
        //      of sight keybinding context to be disabled.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // 18a. Insert some text into the initial text editor without view column 1 being in focus. 
        //
        // The text is inserted before the pairs in order to shift the position of the pairs and 
        // cursors.
        //
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3          | 4 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 10         |
        //     Cursor Position  | [5, 79]    | [0, 10]    | [0, 0]     | [0, 17]    |
        //     Line of Sight    | Yes        | No         | No         | No         |
        //
        await executor.editText(
            [
                { 
                    kind: 'insert', 
                    at:   [0, 0], 
                    text: '// Filler text...\n'
                        + '// Filler text...\n'
                        + '// Filler text...\n'
                        + '// Filler text...\n'
                        + '// Filler text...\n'
                        + '// Filler text..........................................'
                },
            ],
            ViewColumn.One
        );
        await executor.assertPairs([ { line: 5, sides: range(76, 82) } ], ViewColumn.One);
        await executor.assertCursors([ [5, 79] ],                         ViewColumn.One);

        // 18b. Since the text was inserted into a view column that is not in focus, it should not
        //      affect the keybinding contexts, since the keybinding contexts are only synchronized 
        //      to the active text editor.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // 19a. Switch to view column 1.
        //
        // This tests whether the engine can handle switching back to a text editor that previously 
        // had pairs and truthy keybinding contexts, but has since had text edits that translated 
        // the pairs.
        // 
        // State of visible text editors after this step:
        //
        //     View Column      | 1 (active) | 2          | 3          | 4          |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 10         |
        //     Cursor Position  | [5, 79]    | [0, 10]    | [0, 0]     | [0, 17]    |
        //     Line of Sight    | Yes        | No         | No         | No         |
        //
        await executor.focusEditorGroup('first');
        await executor.assertPairs([ { line: 5, sides: range(76, 82) } ]);
        await executor.assertCursors([ [5, 79] ]);

        // 19b. Since the text edit applied to the initial text editor only translated the pairs and 
        //      cursor, line of sight is still maintained within the initial text editor. Thus we 
        //      expect truthy values for both keybinding contexts to be enabled upon focusing back 
        //      on view column 1.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // 20a. Switch back to view column 4.
        //
        // This tests whether the engine can handle switching from one text editor where both 
        // context values are enabled to one where only one of them is disabled.
        // 
        // State of visible text editors after this step:
        //
        //     View Column      | 1          | 2          | 3          | 4 (active) |
        //     -----------------------------------------------------------------------------
        //     Workspace Folder | 0          | 1          | 2          | 3          |
        //     Language         | Typescript | Plaintext  | Typescript | Markdown   |
        //     Number of Pairs  | 3          | 0          | 0          | 10         |
        //     Cursor Position  | [5, 79]    | [0, 10]    | [0, 0]     | [0, 17]    |
        //     Line of Sight    | Yes        | No         | No         | No         |
        //
        await executor.focusEditorGroup('fourth');
        await executor.assertPairs([ { line: 0, sides: [ ...range(0, 10), ...range(22, 32)] } ]);
        await executor.assertCursors([ [0, 17] ]);

        // 20b. Since as before, the path from the cursor to the closing side of the nearest pair in
        //      Workspace Folder 3's text editor is obstructed, we expect `leaper.hasLineOfSight` to 
        //      be disabled upon switching to view column 3. 
        //
        //      Meanwhile, since there are still pairs, we expect the `leaper.inLeaperMode` to
        //      remain enabled.
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
    }
});

/**
 * A collection of test cases that test whether the keybinding contexts are being appropriately 
 * toggled when there is a single cursor.
 */
export const SINGLE_CURSOR_KEYBINDING_CONTEXTS_TOGGLING_TEST_GROUP = new TestGroup(
    'Keybinding Contexts Toggling',
    [
        WORKS_FOR_A_GIVEN_TEXT_EDITOR_TEST_CASE,
        WORKS_WHEN_SWITCHING_BETWEEN_TEXT_EDITORS_TEST_CASE
    ]
);