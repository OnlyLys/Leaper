import { Position, Selection, commands, SnippetString } from 'vscode';
import { type, leap, openNewTextDocument, moveCursorRight, moveCursorDown, insertText } from './integration-tests-util';
import * as assert from 'assert';
import * as extension from '../extension';

/** Array containing all the tests and descriptions. */
export const allTests: { description: string, run: () => Promise<void> }[] = [];

/** Test 1 - Check single leap. */
allTests.push({
    description: '1 - Check that single leap works',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{');
        await leap({ textEditor, expectMove: 1, expectClosing: '}' });
    }
});

/** Test 2 - Check multiple consecutive leaps. */
allTests.push({
    description: '2 - Check that multiple consecutive leaps work',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        const matchingPairs = [ '}', ')', ']', '}', ')', ']','}', ')', ']', '}' ];
        const preLeapPos: Position = textEditor.selection.active;
        // 2.1 - Check that consecutive leaps work
        for (let i = 0; i !== matchingPairs.length; ++i) {
            await leap({ textEditor, expectMove: 1, expectClosing: matchingPairs[i], errMsg: '2.1 Failed. Iteration: ' + i });
        }
        // 2.2 - Check that final position is correct
        assert.deepStrictEqual(textEditor.selection.active, preLeapPos.translate({ characterDelta : 10 }), '2.2 Failed');
    }
});

/** Test 3 - Check single leap across whitespace. */
allTests.push({
    description: '3 - Check that single leap across whitespace works',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', ' ', ' ', ' ', ' ', ' ');       // Simulate entering in 5 spaces
        await moveCursorRight(-5);                      // Move cursor to start of spaces
        await leap({ textEditor, expectMove: 6, expectClosing: '}' });
    }
});


/** Test 4 - Check consecutive leaps across whitespace. */
allTests.push({
    description: '4 - Check that multiple consecutive leaps across whitespace work',
    run: async () => {
        const textEditor = await openNewTextDocument();
        const openers = ['{', '(', '[', '{', '(', '['];
        const closers = [']', ')', '}', ']', ')', '}'];
        for (const opener of openers) {
            await type(opener, ' ', ' ', ' ', ' ', ' ');   // Open a pair then insert 5 spaces
            await moveCursorRight(-5);          // Move cursor back to the start of the spaces
        }
        for (let i = 0; i !== closers.length; ++i) {
            await leap({ textEditor, expectMove: 6, expectClosing: closers[i], errMsg: 'Iteration: ' + i});
        }
    }
});

/** Test 5 - Move cursor out rightwards incrementally. */
allTests.push({
    description: '5 - Check that pairs are removed from tracking after cursor moves out (rightwards incremental)',
    run: async () => {
        // When the cursor moves out of a pair, the controller should remove it from tracking
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        const initialPairs = extension.controller.listPairs();  // Copy the list of pairs before any removal
        for (let i = 0; i !== 10; ++i) {
            // Move out of a pair then check that the pair is removed from tracking
            await moveCursorRight(1);
            initialPairs.pop();
            assert.deepStrictEqual(extension.controller.listPairs(), initialPairs, 'Iteration: ' + i);
        }
    }
});

/** Test 6 - Move cursor out rightwards in one go. */
allTests.push({
    description: '6 - Check that pairs are removed from tracking after cursor moves out (rightwards in one go)',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        await moveCursorRight(10);
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 7 - Move cursor out leftwards incrementally. */
allTests.push({
    description: '7 - Check that pairs are removed from tracking after cursor moves out (leftwards incremental)',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        const initialPairs = extension.controller.listPairs();  // Copy the list of pairs before any removal
        for (let i = 0; i !== 10; ++i) {
            await moveCursorRight(-1);
            initialPairs.pop();
            assert.deepStrictEqual(extension.controller.listPairs(), initialPairs, 'Iteration: ' + i);
        }
    }
});

/** Test 8 - Move cursor out leftwards in one go. */
allTests.push({
    description: '8 - Check that pairs are removed from tracking after cursor moves out (leftwards in one go)',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        await moveCursorRight(-10);
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 9 - Move cursor out upwards. */
allTests.push({
    description: '9 - Check that pairs are removed from tracking after cursor moves out (upwards)',
    run: async () => {
        const textEditor = await openNewTextDocument('\n\n');
        textEditor.selection = new Selection(new Position(1, 0), new Position(1, 0));
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        await moveCursorDown(-1);       
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 10 - Move cursor out downwards. */
allTests.push({
    description: '10 - Check that pairs are removed from tracking after cursor moves out (downwards)',
    run: async () => {
        const textEditor = await openNewTextDocument('\n\n');
        // Start on first line
        textEditor.selection = new Selection(new Position(0, 0), new Position(0, 0));
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        await moveCursorDown(1);
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 11 - Check that pairs are cleared on multi cursor engagement. */
allTests.push({
    description: '11 - Check that multicursor mode removes all pairs from tracking',
    run: async () => {
        // Leaper doesn't support multicursors so we always clear pairs when multicursors are engaged
        const textEditor = await openNewTextDocument('\n\n\n');
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        textEditor.selection = new Selection(new Position(0, 0), new Position(0, 0));
        await commands.executeCommand('editor.action.insertCursorBelow');
        assert(!extension.controller.hasPairs);
    }
});

/** Test 12 - Check that `leaper.escapeLeapderMode` command works. */
allTests.push({
    description: '12 - Check that `Escape Leaper Mode` command works',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        commands.executeCommand('leaper.escapeLeaperMode');
        assert(!extension.controller.hasPairs);
    }
});

/** Test 13 - Check that leap doesn't execute when there are no pairs being tracked. */
allTests.push({
    description: '13 - Check that leap doesn\'t execute when there are no pairs being tracked',
    run: async () => {
        const textEditor = await openNewTextDocument();
        // Create some pairs and then leap out of them first to simulate a typical usage scenario
        await type('[', '[', '[', '[', '[');
        for (let i = 0; i !== 5; ++i) {
            await leap();
        }
        // 13.1 - Check that there are no more pairs being tracked
        assert.ok(!extension.controller.hasPairs, '13.1 Failed');
        // 13.2 - Leap 10 times and check that leap never occurs
        for (let i = 0; i !== 10; ++i) {
            await leap({ textEditor, expectMove: 0, errMsg: '13.2 Failed. Iteration: ' + i});
        }
    }
});

/** Test 14 - Check single line text insertion between pairs doesn't remove pairs from tracking. */
allTests.push({
    description: '14 - Check that single line text insertion between pairs doesn\'t remove them from tracking',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('[', '[', '[', '[', '[');
        await insertText({ textEditor, text: 'Hello World' });
        for (let i = 0; i !== 5; ++i) {
            await leap({ textEditor, expectMove: 1, expectClosing: ']', errMsg: 'Iteration: ' + i });
        }
    }
});

/** Test 15 - Check newline insertion between pairs removes them from tracking. */
allTests.push({
    description: '15 - Check that newline insertion between pairs removes them from tracking',
    run: async () => {
        await openNewTextDocument();
        await type('{', '{', '{', '{', '{');
        await type('\n');
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 16 - Check multi line text insertion between pairs removes them from tracking. */
allTests.push({
    description: '16 - Check that multi line insertion between pairs removes them from tracking',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', '{', '{', '{', '{');
        await insertText({ textEditor, text: 'Hello World\nHello World\nHello World' });
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 17 - Check that snippets and pairs do not interfere when snippet is inserted between pairs. */
allTests.push({
    description: '17 - Check that snippet and pairs work properly when snippet is inserted between pairs',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', '{', '{', '{', '{');
        // The tabstops are expected to have positions: 
        // $1: line 0 character 16, $2: line 0 character 18, $0: line 0 character 19
        const snippet: SnippetString = new SnippetString('assert_eq!($1, $2)$0');  // 14 Characters
        await textEditor.insertSnippet(snippet);
        // 17.1 - Check tabstop 2
        await commands.executeCommand('jumpToNextSnippetPlaceholder');
        assert.deepStrictEqual(textEditor.selection.active, new Position(0, 18), '17.1 Failed');
        // 17.2 - Check tabstop 1 
        await commands.executeCommand('jumpToPrevSnippetPlaceholder');
        assert.deepStrictEqual(textEditor.selection.active, new Position(0, 16), '17.2 Failed');
        // 17.3 - Check tabstop 0
        await commands.executeCommand('jumpToNextSnippetPlaceholder');
        await commands.executeCommand('jumpToNextSnippetPlaceholder');
        assert.deepStrictEqual(textEditor.selection.active, new Position(0, 19), '17.3 Failed');
        // 17.4 - Check moving between tabstops does not affect ability to leap
        for (let i = 0; i !== 5; ++i) {
            await leap({ textEditor, expectMove: 1, expectClosing: '}', errMsg: '17.4 Failed. Iteration: ' + i});
        }
    }
});

/** Test 18 - Check that pairs are removed after right sides overwritten. */
allTests.push({
    description: '18 - Check that pairs are removed after right sides overwritten',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', '[', '(', '{', '[');
        const initialPairs = extension.controller.listPairs();
        // 18.1 - Delete the 2 most nested pairs then check remaining pairs correct
        await insertText({ textEditor, start: textEditor.selection.active, end: 2, text: '' });
        initialPairs.pop();
        initialPairs.pop();
        initialPairs[0].close = new Position(0, 9 - 2);
        initialPairs[1].close = new Position(0, 8 - 2);
        initialPairs[2].close = new Position(0, 7 - 2);
        assert.deepStrictEqual(extension.controller.listPairs(), initialPairs, '18.1 Failed');
        // 18.2 - Overwrite the next 2 pairs then check remaining pair correct
        await insertText({ textEditor, start: textEditor.selection.active, end: 2, text: 'Hello World' });
        initialPairs.pop();
        initialPairs.pop();
        initialPairs[0].close = new Position(0, 9 - 4 + 11);    // - 4 closers + 'Hello World'
        assert.deepStrictEqual(extension.controller.listPairs(), initialPairs, '18.2 Failed');
    }
});

/** Test 19 - Check that pairs are removed after left side overwritten */
allTests.push({
    description: '19 - Check that pairs are removed after left sides overwritten',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', '[', '(', '{', '[');
        const initialPairs = extension.controller.listPairs();
        // 19.1 - Backspace delete the 2 most nested pairs then check remaining pairs correct. When
        // autoclosing pairs are backspace deleted both sides are removed by the editor provided both 
        // sides of the pair are touching, which are are here.
        await commands.executeCommand('deleteLeft');
        await commands.executeCommand('deleteLeft');
        initialPairs.pop();
        initialPairs.pop();
        initialPairs[0].close = new Position(0, 9 - 2 - 2);
        initialPairs[1].close = new Position(0, 8 - 2 - 2);
        initialPairs[2].close = new Position(0, 7 - 2 - 2);
        assert.deepStrictEqual(extension.controller.listPairs(), initialPairs, '19.1 Failed');
        // 19.2 - Overwrite two openers with random text then check remaining pair correct
        const start = textEditor.selection.active.translate({ characterDelta: -2 });
        await insertText({ textEditor, start, end: 2, text: 'Goodbye World' });
        initialPairs.pop();
        initialPairs.pop();
        initialPairs[0].close = new Position(0, 9 - 4 - 2 + 13);   // - 2 pairs - 2 openers + 'Goodbye World'
        assert.deepStrictEqual(extension.controller.listPairs(), initialPairs, '19.2 Failed');
    }
});

/** Test 20 - Check that tracking follows pairs after text modification before them. */
allTests.push({
    description: '20 - Check that text edits before pairs do not affect tracking',
    run: async () => {
        // Our goal here is to insert random text at positions before the pairs (but remembering to 
        // disable cursor move so that pairs are not removed) then checking that the pairs remain
        // tracked afterwards and that the locations are correct
        //
        // Definitions of terms: 
        // - 'left of pairs' means any position to the left of the pairs on the same line
        // - 'above pairs' menas any position on a line above the line of the pairs
        const textEditor = await openNewTextDocument();
        await type('{', '[', '(', '{', '[');
        await insertText({ textEditor, text: 'Hello World' });
        const initialPairs = extension.controller.listPairs();
        let expectedLineDelta = 0;       // Expected line shift
        let expectedCharacterDelta = 0;  // Expected character shift
        // Text insertion to left of pairs
        await insertText({ textEditor, start: new Position(0, 0), follow: false, text: aliceText1 });
        expectedLineDelta += 6;
        expectedCharacterDelta += 89;    // Last line of aliceText1 has 89 chars
        // Text replacement from above pairs to left of pairs
        await insertText({ textEditor, start: new Position(4, 10), end: new Position(6, 20), follow: false, text: 'Goodbye World' });
        expectedLineDelta -= 2;
        expectedCharacterDelta += (10 - 20 + 13);   // 'Goodbye World' has 13 characters
        // Text replacement above pairs
        await insertText({ textEditor, start: new Position(0, 0), end: new Position(3, 0), follow: false, text: aliceText2 });
        expectedLineDelta += (7 - 3);    // aliceText2 has 7 new lines - 3 deleted lines
        // Apply expected shifts to our initial copy of the list of pairs then check if they match
        for (const initialPair of initialPairs) {
            initialPair.open = initialPair.open.translate({
                lineDelta: expectedLineDelta,
                characterDelta: expectedCharacterDelta
            });
            initialPair.close = initialPair.close.translate({
                lineDelta: expectedLineDelta,
                characterDelta: expectedCharacterDelta
            });
        }
        assert.deepStrictEqual(extension.controller.listPairs(), initialPairs);
    }
});

/** Test 21 - Check that text modification after pairs do not affect them. */
allTests.push({
    description: '21 - Check that text edits after pairs do not affect tracking',
    run: async () => {
        // Our goal here is to insert random text at positions after the pairs (but remembering to 
        // disable cursor move so that pairs are not removed) then checking that the pairs remain
        // tracked and not moved at all
        //
        // Definitions of terms: 
        // - 'right of' means any position to the right of the pairs on the same line
        // - 'below pairs' menas any position on a line below the line of the pairs
        const textEditor = await openNewTextDocument();
        await type('{', '[', '(', '{', '[');
        await insertText({ textEditor, text: 'Hello World' });
        const initialPairs = extension.controller.listPairs();
        // Text insertion to right of pairs
        await insertText({ textEditor, start: new Position(0, 21), follow: false, text: aliceText1 });
        // Text replacement from right of pairs to below pairs
        await insertText({ textEditor, start: new Position(0, 21), end: new Position(2, 50), follow: false, text: 'Goodbye World' });
        // Text replacement below pairs
        await insertText({ textEditor, start: new Position(2, 0), end: new Position(4, 0), follow: false, text: aliceText2 });
        // Check that pairs remain tracked and unchanged
        assert.deepStrictEqual(extension.controller.listPairs(), initialPairs);
    }
});

// Line count: 7
// Last line length: 89
const aliceText1 = 
`Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to 
do: once or twice she had peeped into the book her sister was reading, but it had no pictures or 
conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'

So she was considering in her own mind (as well as she could, for the hot day made her feel very 
sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting 
up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.`;

// Line count: 8
// Last line length: 16
const aliceText2 = 
`There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to 
hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, 
it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); 
but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then 
hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen 
a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she 
ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole 
under the hedge.`;