'use strict';

import { Position, Selection, commands } from 'vscode';
import { type, leap, openNewTextDocument, moveCursorRight, moveCursorDown } from './integration-tests-util';
import * as assert from 'assert';
import * as extension from '../extension';

/** Array containing all the tests and descriptions. */
export const allTests: { description: string, run: () => Promise<void> }[] = [];

/** Test 1 - Single leap. */
allTests.push({
    description: '1 - Single leap',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{');
        await leap({ textEditor, expectMove: 1, expectClosing: '}' });
    }
});

/** Test 2 - Multiple consecutive leaps. */
allTests.push({
    description: '2 - Multiple consecutive leaps',
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
        assert.deepStrictEqual(preLeapPos.translate({ characterDelta : 10 }), textEditor.selection.active, '2.2 Failed');
    }
});

/** Test 3 - Single leap across whitespace. */
allTests.push({
    description: '3 - Single leap across whitespace',
    run: async () => {
        const textEditor = await openNewTextDocument();
        await type('{', '          ');        // 10 spaces
        await moveCursorRight(-10);           // Move cursor to start of spaces
        await leap({ textEditor, expectMove: 11, expectClosing: '}' });
    }
});


/** Test 4 - Check consecutive leaps across whitespace. */
allTests.push({
    description: '4 - Multiple consecutive leaps across whitespace',
    run: async () => {
        const textEditor = await openNewTextDocument();
        const openers = ['{', '{', '{', '(', '(', '(', '[', '[', '[', '['];
        const closers = [']', ']', ']', ']', ')', ')', ')', '}', '}', '}'];
        for (const opener of openers) {
            await type(opener, '     ');      // Open a pair then insert 5 spaces
            await moveCursorRight(-5);        // Move cursor back to the start of the spaces
        }
        for (let i = 0; i !== closers.length; ++i) {
            await leap({ textEditor, expectMove: 6, expectClosing: closers[i], errMsg: 'Iteration: ' + i});
        }
    }
});

/** Test 5 - Move out rightwards incrementally. */
allTests.push({
    description: '5 - Remove pairs from tracking by moving out rightwards incrementally',
    run: async () => {
        // When the cursor moves out of a pair, the controller should remove it from tracking
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        const initialPairs = extension.controller.listPairs;    // List of pairs before any removal
        for (let i = 0; i !== 10; ++i) {
            // Move out of a pair then check that the pair is removed from tracking
            await moveCursorRight(1);
            initialPairs.pop();
            assert.deepStrictEqual(initialPairs, extension.controller.listPairs, 'Iteration: ' + i);
        }
    }
});

/** Test 6 - Move out rightwards in one go. */
allTests.push({
    description: '6 - Remove pairs from tracking by moving out rightwards in one go',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        await moveCursorRight(10);
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 7 - Move out leftwards incrementally. */
allTests.push({
    description: '7 - Remove pairs from tracking by moving out leftwards incrementally',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        const initialPairs = extension.controller.listPairs;
        for (let i = 0; i !== 10; ++i) {
            await moveCursorRight(-1);
            initialPairs.pop();
            assert.deepStrictEqual(initialPairs, extension.controller.listPairs, 'Iteration: ' + i);
        }
    }
});

/** Test 8 - Move out leftwards in one go. */
allTests.push({
    description: '8 - Remove pairs from tracking by moving out leftwards in one go',
    run: async () => {
        await openNewTextDocument();
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        await moveCursorRight(-10);
        assert.ok(!extension.controller.hasPairs);
    }
});

/** Test 9 - Move out upwards. */
allTests.push({
    description: '9 - Remove pairs from tracking by moving cursor up',
    run: async () => {
        const textEditor = await openNewTextDocument('\n\n');
        // Start on second line
        textEditor.selection = new Selection(new Position(1, 0), new Position(1, 0));
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        // 9.1 - Check that pair insertion and detect was successful
        assert.ok(extension.controller.hasPairs, '9.1 Failed');
        // 9.2 - Move cursor up and out of the pairs
        await moveCursorDown(-1);       
        assert.ok(!extension.controller.hasPairs, '9.2 Failed');
    }
});

/** Test 10 - Move out downwards. */
allTests.push({
    description: '10 - Remove pairs from tracking by moving cursor down',
    run: async () => {
        const textEditor = await openNewTextDocument('\n\n');
        // Start on first line
        textEditor.selection = new Selection(new Position(0, 0), new Position(0, 0));
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        // 10.1 - Check that pair insertion and detect was successful
        assert.ok(extension.controller.hasPairs, '10.1 Failed');
        // 10.2 - Move cursor down and out of the pairs
        await moveCursorDown(1);
        assert.ok(!extension.controller.hasPairs, '10.2 Failed');
    }
});

/** Test 11 - Test pairs cleared on multi cursor. */
allTests.push({
    description: '11 - Check that multicursor mode removes pairs from tracking',
    run: async () => {
        // Leaper doesn't support multicursors so we always clear pairs when multicursors are engaged
        const textEditor = await openNewTextDocument('\n\n\n');
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
        textEditor.selection = new Selection(new Position(0, 0), new Position(0, 0));
        await commands.executeCommand('editor.action.insertCursorBelow');
        assert(!extension.controller.hasPairs);
    }
});

/** Test 12 - Test Escape Leaper Mode works. */
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
    description: '13 - Check leap doesn\'t execute when there are no pairs being tracked',
    run: async () => {
        const textEditor = await openNewTextDocument();
        // Create some pairs and then leap out of them first to simulate a typical usage scenario
        await type('[', '[', '[', '[', '[');
        for (let i = 0; i !== 5; ++i) {
            await leap();
        }
        // 13.1 - Check that there are no more pairs being tracked
        assert.ok(!extension.controller.hasPairs, '13.1 Failed');
        // 13.2 - Leap 10 times when there are no pairs being tracked and check that leap never occurs
        for (let i = 0; i !== 10; ++i) {
            await leap({ textEditor, expectMove: 0, errMsg: '13.2 Failed. Iteration: ' + i});
        }
    }
});
