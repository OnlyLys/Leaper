'use strict';

import { Range, commands, Position } from 'vscode';
import { type, openNewTextDocument } from './integration-tests-util';
import * as assert from 'assert';
import * as extension from '../extension';

/** Array containing all the tests and descriptions. */
export const allTests: { description: string, run: () => Promise<void> }[] = [];

/** Preliminary Test 1 - Check that editor's autoclosing pair setting is enabled. */
allTests.push({
    description: '1 - Check that editor\'s autoclosing bracket setting is enabled',
    run: async () => {
        const textEditor = await openNewTextDocument();
        const initialPos = textEditor.selection.active;
        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');       // Create 10 brackets
        // If autoclosing pairs is enabled then we expect to see 10 nested brackets with the cursor in between
        assert.equal(textEditor.document.getText(new Range(0, 0, 0, 20)), '{[({[({[({})]})]})]}');
        assert.deepStrictEqual(textEditor.selection.active, initialPos.translate({ characterDelta: 10 }));
    }
});

/** Preliminary Test 2 - Check that `.hasPairs` correctly reports whether there are pairs being tracked. */
allTests.push({
    description: '2 - Check that `.hasPairs` correctly reports whether there are pairs being tracked',
    run: async () => {
        await openNewTextDocument();
        // 2.1 - `hasPairs` should be false when there are initially no pairs being tracked
        assert.ok(!extension.controller.hasPairs, '2.1 Failed');
        // 2.2 - Insert 15 pairs and check that `hasPairs` is true each time
        for (let i = 0; i !== 15; ++i) {
            await type('[');
            assert.ok(extension.controller.hasPairs, '2.2 Failed. Iteration: ' + i);
        }
        // 2.3 - Clear the document and check that the extension is no longer tracking any pairs
        await commands.executeCommand('editor.action.selectAll');
        await commands.executeCommand('deleteLeft');
        assert.ok(!extension.controller.hasPairs, '2.3 Failed');
    }
});

/** Preliminary Test 3 - Check that `.listPairs()` reports correct pair positions. */
allTests.push({
    description: '3 - Check that `.listPairs()` reports correct pair positions',
    run: async () => {
        await openNewTextDocument();
        const input = ['[', '{', '(', '[', '{', '(', '[', '{', '(', '[', '{', '(', '[', '{', '(' ];
        await type(...input);
        const trackedPairs = extension.controller.listPairs();
        for (let i = 0; i !== trackedPairs.length; ++i) {
            assert.deepStrictEqual(
                trackedPairs[i], 
                { open: new Position(0, i), close: new Position(0, 2 * trackedPairs.length - 1 - i) },
                'Iteration: ' + i
            );
        }
    }
});