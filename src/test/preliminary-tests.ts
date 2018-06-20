'use strict';

import { Range, commands } from 'vscode';
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

/** Preliminary Test 2 - Check that `.hasPairs` method of controller returns `true` when there are pairs. */
allTests.push({
    description: '2 - Check that `.hasPairs` method of controller returns `true` when there are pairs',
    run: async () => {
        await openNewTextDocument();
        // 2.1 - `hasPairs` should be false when there are initially no pairs being tracked
        assert.ok(!extension.controller.hasPairs, '2.1 Failed');
        // 2.2 - Insert 30 pairs and check that `hasPairs` is true each time
        for (let i = 0; i !== 30; ++i) {
            await type('[');
            assert.ok(extension.controller.hasPairs, '2.2 Failed. Iteration: ' + i);
        }
        // 2.3 - Clear the document and check that the extension is no longer tracking any pairs
        await commands.executeCommand('editor.action.selectAll');
        await commands.executeCommand('deleteLeft');
        assert.ok(!extension.controller.hasPairs, '2.3 Failed');
    }
});