import { commands, SnippetString, TextEditor, Range } from 'vscode';
import { type, leap, moveCursorRight, moveCursorDown, insertText, jumpToNextTabstop, jumpToPrevTabstop, clearDocument, backspace, verifyCursor, verifyPairs, openNewTextEditor, getTestAPI, aliceText1, aliceText2, verifyEmpty } from './utilities';
import { TestAPI } from '../../extension';
import * as assert from 'assert';

/** 
 * The following array contains test groups which each contain a `generate()` callback. The callback
 * is expected to return an array of tests belonging to the test group.
 * 
 * Each test group is given a fresh text editor.
 */
const testGroups: {
    groupDescription: string,
    generate: () => {
        description: string,
        action: (editor: TextEditor, testAPI: TestAPI) => Promise<void>
    }[]
}[] = [
    {
        groupDescription: 'I - Preliminary checks',
        generate: () => [
            {
                description: 'No pairs tracked when the editor is empty',
                action: async (_: TextEditor, testAPI: TestAPI) => verifyEmpty(testAPI)
            },
            {
                description: 'Autoclosing pairs feature enabled - A',
                action: async (editor: TextEditor, _: TestAPI) => {
                    // Insert 10 pairs 
                    const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];
                    await type(...input);
                    /* If autoclosing pairs feature is enabled, the editor would have filled in 10 
                    closing brackets. */
                    assert.deepStrictEqual(
                        editor.document.getText(new Range(0, 0, 0, 20)),
                        '{[({[({[({})]})]})]}'
                    );
                    // Furthermore, the cursor would be enclosed between the brackets
                    verifyCursor(editor, [0, 10]);
                }
            },
            {
                description: 'Can track pairs - A',
                action: async (_: TextEditor, testAPI: TestAPI) => {
                    // Verify that 10 pairs are being tracked
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 19],
                        [0, 1, 0, 18],
                        [0, 2, 0, 17],
                        [0, 3, 0, 16],
                        [0, 4, 0, 15],
                        [0, 5, 0, 14],
                        [0, 6, 0, 13],
                        [0, 7, 0, 12],
                        [0, 8, 0, 11],
                        [0, 9, 0, 10],
                    ]]);
                }
            },
            {
                description: 'Autoclosing pairs feature enabled - B',
                action: async (editor: TextEditor, _: TestAPI) => {
                    // Clear the document to make way for this test
                    await clearDocument();
                    // Insert some text before the pairs to create a realistic scenario
                    await type(...'Hello World\nGoodbye World');
                    /* Insert 10 pairs one at a time and check that the editor completes the other
                    side and that the cursor is in between the pairs at all times. */
                    const pairs = ['{}', '[]', '()', '{}', '[]', '()', '{}', '[]', '()', '{}'];
                    for (const [i, [opener]] of pairs.entries()) {
                        await type(opener);
                        // Check that series of pairs inserted so far is accurate
                        const inserted = pairs.slice(0, i + 1).reduce((acc: string, curr: string) => {
                            return `${acc.substring(0, acc.length / 2)}${curr}${acc.substring(acc.length / 2)}`;
                        });
                        assert.deepStrictEqual(
                            editor.document.getText(new Range(1, 13, 1, inserted.length + 13)),
                            inserted
                        );
                        // Verify that the cursor is enclosed between the pairs 
                        verifyCursor(editor, [1, 13 + inserted.length / 2]);
                    }
                }
            },
            {
                description: 'Can track pairs - B', 
                action: async (_: TextEditor, testAPI: TestAPI) => {
                    verifyPairs(testAPI, [[
                        [1, 0 + 13, 1, 19 + 13],
                        [1, 1 + 13, 1, 18 + 13],
                        [1, 2 + 13, 1, 17 + 13],
                        [1, 3 + 13, 1, 16 + 13],
                        [1, 4 + 13, 1, 15 + 13],
                        [1, 5 + 13, 1, 14 + 13],
                        [1, 6 + 13, 1, 13 + 13],
                        [1, 7 + 13, 1, 12 + 13],
                        [1, 8 + 13, 1, 11 + 13],
                        [1, 9 + 13, 1, 10 + 13],
                    ]]);
                }
            }
        ]
    },
    {
        groupDescription: 'II - Single leap',
        generate: () => [
            {
                description: 'Insert single pair',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    await type('{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 1]
                    ]]);
                    verifyCursor(editor, [0, 1]);
                }
            },
            {
                description: 'Leap',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    await leap(editor, [0, 1], '}');
                    verifyEmpty(testAPI);
                }
            }
        ]
    },
    {
        groupDescription: 'III - Multiple consecutive leaps',
        generate: () => {
            const pairs = ['{}', '[]', '()', '{}', '[]', '()', '{}', '[]', '()', '{}']; // 10 pairs
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...pairs.map(([open]) => open));
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Leap',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        for (const [, close] of pairs.reverse()) {
                            await leap(editor, [0, 1], close);
                        }
                        verifyEmpty(testAPI);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'VI - Single leap across whitespace',
        generate: () => [
            {
                description: 'Insert single pair with whitespace between',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    await type('{', ' ', ' ', ' ', ' ', ' ');
                    await moveCursorRight(-5);  // Move cursor to the start of spaces
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 6]
                    ]]);
                    verifyCursor(editor, [0, 1]);
                }
            },
            {
                description: 'Leap',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    await leap(editor, [0, 6], '}');
                    verifyEmpty(testAPI);
                }
            }
        ]
    },
    {
        groupDescription: 'V - Multiple consecutive leaps across whitespace',
        generate: () => {
            const pairs = ['{}', '()', '[]', '{}', '()', '[]'];  // 6 pairs
            return [
                {
                    description: 'Insert multiple pairs with whitespace between',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        for (const [open] of pairs) {
                            await type(open, ' ', ' ', ' ', ' ', ' ');
                            await moveCursorRight(-5);      // Move cursor to start of spaces
                        }
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 41],
                            [0, 1, 0, 35],
                            [0, 2, 0, 29],
                            [0, 3, 0, 23],
                            [0, 4, 0, 17],
                            [0, 5, 0, 11],
                        ]]);
                        verifyCursor(editor, [0, 6]);
                    }
                },
                {
                    description: 'Leap',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        for (const [, close] of pairs.reverse()) {
                            await leap(editor, [0, 6], close);
                        }
                        verifyEmpty(testAPI);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'VI - Pairs removed after cursor moves out (rightwards incremental)',
        generate: () => {
            const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];   // 10 pairs
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...input);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Incrementally moving right invalidates pairs',
                    action: async (_: TextEditor, testAPI: TestAPI) => {
                        const initialSnapshotBare = (testAPI.snapshot() ?? []).map(
                            (cluster) => cluster.map(
                                (pair): [number, number, number, number] => 
                                    [pair.open.line, pair.open.character, pair.close.line, pair.close.character]
                            )
                        );
                        for (const _ of input) {
                            await moveCursorRight(1);
                            initialSnapshotBare[0].pop();
                            verifyPairs(testAPI, initialSnapshotBare);
                        }
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'VII - Pairs invalidated after cursor moves out (rightwards in one go)',
        generate: () => {
            const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];   // 10 pairs
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...input);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Moving right in one go invalidates all pairs',
                    action: async (_: TextEditor, testAPI: TestAPI) => {
                        await moveCursorRight(input.length);
                        verifyEmpty(testAPI);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'IX - Pairs invalidated after cursor moves out (leftwards incremental)',
        generate: () => {
            const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];   // 10 pairs
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...input);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Incrementally moving left invalidates pairs',
                    action: async (_: TextEditor, testAPI: TestAPI) => {
                        const initialSnapshotBare = (testAPI.snapshot() ?? []).map(
                            (cluster) => cluster.map(
                                (pair): [number, number, number, number] => 
                                    [pair.open.line, pair.open.character, pair.close.line, pair.close.character]
                            )
                        );
                        for (const _ of input) {
                            await moveCursorRight(-1);
                            initialSnapshotBare[0].pop();
                            verifyPairs(testAPI, initialSnapshotBare);
                        }
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'X - Pairs invalidated after cursor moves out (leftwards in one go)',
        generate: () => {
            const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];   // 10 pairs
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...input);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Moving left in one go invalidates all pairs',
                    action: async (_: TextEditor, testAPI: TestAPI) => {
                        await moveCursorRight(-input.length);
                        verifyEmpty(testAPI);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'XI - Pairs invalidated after cursor moves out (upwards)',
        generate: () => [
            {
                description: 'Insert multiple pairs',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Insert some text at the start of document so cursor has room to move up
                    await insertText(editor, [0, 0, 0, 0], 'Hello World\nHello World\nHello World\nHello World');
                    // Move cursor to middle of second line
                    await moveCursorDown(-1);
                    await moveCursorRight(-6);
                    verifyCursor(editor, [2, 5]);
                    // Insert 10 pairs
                    const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];
                    await type(...input);
                    verifyPairs(testAPI, [[
                        [2,  5, 2, 24],
                        [2,  6, 2, 23],
                        [2,  7, 2, 22],
                        [2,  8, 2, 21],
                        [2,  9, 2, 20],
                        [2, 10, 2, 19],
                        [2, 11, 2, 18],
                        [2, 12, 2, 17],
                        [2, 13, 2, 16],
                        [2, 14, 2, 15],
                    ]]);
                }
            },
            {

                description: 'Moving up in one go invalidates all pairs',
                action: async (_: TextEditor, testAPI: TestAPI) => {
                    await moveCursorDown(-1);
                    verifyEmpty(testAPI);
                }
            }
        ]
    },
    {
        groupDescription: 'XII - Pairs invalidated after cursor moves out (downwards)',
        generate: () => [
            {
                description: 'Insert multiple pairs',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Insert some newlines at the start of document so cursor has room to move down
                    await insertText(editor, [0, 0, 0, 0], '\n\n');
                    // Move cursor to start of document
                    await moveCursorDown(-2);
                    // Insert 10 pairs
                    const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];
                    await type(...input);
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 19],
                        [0, 1, 0, 18],
                        [0, 2, 0, 17],
                        [0, 3, 0, 16],
                        [0, 4, 0, 15],
                        [0, 5, 0, 14],
                        [0, 6, 0, 13],
                        [0, 7, 0, 12],
                        [0, 8, 0, 11],
                        [0, 9, 0, 10],
                    ]]);
                    verifyCursor(editor, [0, 10]);
                }
            },
            {
                description: 'Moving down in one go invalidates all pairs',
                action: async (_: TextEditor, testAPI: TestAPI) => {
                    await moveCursorDown(1);
                    verifyEmpty(testAPI);
                }
            }
        ]
    },
    {
        groupDescription: 'XII - `leaper.escapeLeaperMode` command',
        generate: () => [
            {
                description: 'Insert multiple pairs',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Insert 10 pairs
                    await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 19],
                        [0, 1, 0, 18],
                        [0, 2, 0, 17],
                        [0, 3, 0, 16],
                        [0, 4, 0, 15],
                        [0, 5, 0, 14],
                        [0, 6, 0, 13],
                        [0, 7, 0, 12],
                        [0, 8, 0, 11],
                        [0, 9, 0, 10],
                    ]]);
                    verifyCursor(editor, [0, 10]);
                }
            },
            {
                description: '`leaper.escapeLeaperMode` resets controller',
                action: async (_: TextEditor, testAPI: TestAPI) => {
                    await commands.executeCommand('leaper.escapeLeaperMode');
                    verifyEmpty(testAPI);
                }
            }
        ]
    },
    {
        groupDescription: 'XIV - Leap does not execute when there are no pairs',
        generate: () => [
            {
                description: 'Scenario A',
                action: async (editor: TextEditor, _: TestAPI) => {
                    // Insert some random text then move the cursor to in between it 
                    await insertText(editor, [0, 0, 0, 0], 'Some random text');
                    await moveCursorRight(-12);
                    verifyCursor(editor, [0, 4]);
                    // Leaps should not do anything to change cursor position
                    await leap(editor, [0, 0]);
                    await leap(editor, [0, 0]);
                    await leap(editor, [0, 0]);
                }
            },
            {
                description: 'Scenario B',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Clear document to make way for this test
                    await clearDocument();
                    // Insert some random text to this document
                    await insertText(editor, [0, 0, 0, 0], aliceText1);
                    // Move cursor to in between some text to simulate typical usage scenario
                    await moveCursorDown(-2);
                    await moveCursorRight(-3);
                    // Insert 10 pairs
                    const pairs = ['[]', '()', '{}', '[]', '()', '{}', '[]', '()', '{}', '[]'];
                    await type(...pairs.map(([open]) => open));
                    verifyPairs(testAPI, [[
                        [4, 86, 4, 105],
                        [4, 87, 4, 104],
                        [4, 88, 4, 103],
                        [4, 89, 4, 102],
                        [4, 90, 4, 101],
                        [4, 91, 4, 100],
                        [4, 92, 4, 99],
                        [4, 93, 4, 98],
                        [4, 94, 4, 97],
                        [4, 95, 4, 96],
                    ]]);
                    verifyCursor(editor, [4, 96]);
                    // Leap out of all available pairs
                    for (const [, close] of pairs.reverse()) {
                        await leap(editor, [0, 1], close);
                    }
                    // Then leap arbitrary number of times and check cursor does not change position
                    for (let i = 0; i !== 32; ++i) {
                        await leap(editor, [0, 0]);
                    }
                }
            }
        ]
    },
    {
        groupDescription: 'XV - Leap does not execute when there are obstacles (no line of sight)',
        generate: () => [
            {
                description: 'Scenario A',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    await type('[', '(', '{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 5],
                        [0, 1, 0, 4],
                        [0, 2, 0, 3],
                    ]]);
                    verifyCursor(editor, [0, 3]);
                    // Leap out of the innermost pair
                    await leap(editor, [0, 1], '}');
                    // Move cursor back into the innermost pair
                    await moveCursorRight(-1);
                    // Cannot leap out of 2nd pair since there is no line of sight
                    await leap(editor, [0, 0]);
                }
            },
            {
                description: 'Scenario B',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Clear document to make way for this test
                    await clearDocument();
                    // Insert 3 pairs
                    await type('[', '(', '{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 5],
                        [0, 1, 0, 4],
                        [0, 2, 0, 3],
                    ]]);
                    verifyCursor(editor, [0, 3]);
                    // Insert some text to obscure the line of sight
                    const text = 'I am an obstacle!';
                    await type(...text);
                    // Move cursor to within the 'I am an obstacle!' text
                    await moveCursorRight(-text.length);
                    // Cannot leap out of the inner most pair since there is no line of sight
                    await leap(editor, [0, 0]);
                }
            }
        ]
    },
    {
        groupDescription: 'XVI - Single line text inserted between pairs does not invalidate them',
        generate: () => {
            // Insert 10 pairs
            const input = ['{', '[', '(', '{', '[', '(', '{', '[', '(', '{'];
            const text = 'Very very very very very very very very very very very very long text';
            return [
                {
                    description: 'Insert multiple pairs then insert single line text between each',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...input);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                        // Insert text between the pairs
                        for (let i = (input.length * 2) - 1; i > 0; --i) {
                            await insertText(editor, [0, i, 0, i], text);
                        }
                    }
                },
                {
                    description: 'Pairs still valid',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        verifyPairs(testAPI, [[
                            [0, 0 + 0 * text.length, 0, 19 + 19 * text.length],
                            [0, 1 + 1 * text.length, 0, 18 + 18 * text.length],
                            [0, 2 + 2 * text.length, 0, 17 + 17 * text.length],
                            [0, 3 + 3 * text.length, 0, 16 + 16 * text.length],
                            [0, 4 + 4 * text.length, 0, 15 + 15 * text.length],
                            [0, 5 + 5 * text.length, 0, 14 + 14 * text.length],
                            [0, 6 + 6 * text.length, 0, 13 + 13 * text.length],
                            [0, 7 + 7 * text.length, 0, 12 + 12 * text.length],
                            [0, 8 + 8 * text.length, 0, 11 + 11 * text.length],
                            [0, 9 + 9 * text.length, 0, 10 + 10 * text.length]
                        ]]);
                        verifyCursor(editor, [0, 10 + 10 * text.length]);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'XVII - Newline inserted between pairs invalidates them',
        generate: () => [
            {
                description: 'Between single pair',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    await type('{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 1]
                    ]]);
                    verifyCursor(editor, [0, 1]);
                    // Insert whitespace
                    await type('\n');
                    verifyEmpty(testAPI);
                }
            },
            {
                description: 'Between multiple pairs',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Require clean document for this test
                    await clearDocument();
                    // Insert 6 pairs
                    const input = ['{', '{', '{', '{', '{', '{'];
                    await type(...input);
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 11],
                        [0, 1, 0, 10],
                        [0, 2, 0, 9],
                        [0, 3, 0, 8],
                        [0, 4, 0, 7],
                        [0, 5, 0, 6],
                    ]]);
                    verifyCursor(editor, [0, 6]);
                    // Insert whitespace that should invalidate all enclosing pairs
                    await type('\n');
                    verifyEmpty(testAPI);
                }
            },
            {
                description: 'Between pair openers and closers',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Require clean document for this test
                    await clearDocument();
                    // Insert 5 pairs
                    await type('{', '{', '{', '{', '{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 9],
                        [0, 1, 0, 8],
                        [0, 2, 0, 7],
                        [0, 3, 0, 6],
                        [0, 4, 0, 5]
                    ]]);
                    verifyCursor(editor, [0, 5]);
                    /* Insert between openers of the first and second pairs (when counting from out to in) 
                    - this moves the second pair and beyond to the next line. */
                    await insertText(editor, [0, 1, 0, 1], '\n');
                    // The first pair should be untracked
                    verifyPairs(testAPI, [[
                        [1, 0, 1, 7],
                        [1, 1, 1, 6],
                        [1, 2, 1, 5],
                        [1, 3, 1, 4]
                    ]]);
                    verifyCursor(editor, [1, 4]);
                    /* Of the four pairs remaining, insert between closers of the second and third pairs
                    (when counting from out to in)*/
                    await insertText(editor, [1, 6, 1, 6], `\n`);
                    // Ths first and second pairs should be untracked
                    verifyPairs(testAPI, [[
                        [1, 2, 1, 5],
                        [1, 3, 1, 4]
                    ]]);
                    verifyCursor(editor, [1, 4]);
                }
            }
        ]
    },
    {
        groupDescription: 'XVIII - Multiline text inserted between pairs invalidates them',
        generate: () => {
            const text = 'Hello World\nHello World\n';
            return [
                {
                    description: 'Between single pair',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type('{');
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 1]
                        ]]);
                        verifyCursor(editor, [0, 1]);
                        // Insert text in between the pair
                        await insertText(editor, [0, 1, 0, 1], text);
                        verifyEmpty(testAPI);
                    }
                },
                {
                    description: 'Between multiple pairs',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        // Require clean document for this test
                        await clearDocument();
                        // Insert 10 pairs
                        await type('{', '{', '{', '{', '{', '{', '{', '{', '{', '{');
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                        // Insert text in between pairs
                        await insertText(editor, [0, 10, 0, 10], text);
                        verifyEmpty(testAPI);
                    }
                },
                {
                    description: 'Between pair openers and closers',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        // Require clean document for this test
                        await clearDocument();
                        // Insert 5 pairs
                        await type('{', '{', '{', '{', '{');
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 9],
                            [0, 1, 0, 8],
                            [0, 2, 0, 7],
                            [0, 3, 0, 6],
                            [0, 4, 0, 5]
                        ]]);
                        verifyCursor(editor, [0, 5]);
                        /* Insert between openers of the first and second pairs (when counting from out to in)
                        - this moves the second pair and beyond down to by 2 lines. */
                        await insertText(editor, [0, 1, 0, 1], text);
                        verifyPairs(testAPI, [[
                            [2, 0, 2, 7],
                            [2, 1, 2, 6],
                            [2, 2, 2, 5],
                            [2, 3, 2, 4]
                        ]]);
                        verifyCursor(editor, [2, 4]);
                        /* Of the four pairs remaining, insert between closers of the second and third pairs
                        (when counting from out to in) - this should untrack the first and second pairs. */
                        await insertText(editor, [2, 6, 2, 6], text);
                        verifyPairs(testAPI, [[
                            [2, 2, 2, 5],
                            [2, 3, 2, 4]
                        ]]);
                        verifyCursor(editor, [2, 4]);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'XIX - Snippets work when inserted between pairs',
        generate: () => {
            const input = ['{', '[', '(', '[', '{', '(', '(', '[', '{', '['];   // 10 pairs
            return [
                {
                    description: 'Insert multiple pairs then a snippet in the middle',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await type(...input);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19],
                            [0, 1, 0, 18],
                            [0, 2, 0, 17],
                            [0, 3, 0, 16],
                            [0, 4, 0, 15],
                            [0, 5, 0, 14],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                        /* Insert snippet. The tabstops are expected to have positions: $1: line 0 char 16, 
                        $2: line 0 char 18, $0: line 0 char 19. */
                        editor.insertSnippet(new SnippetString('assert_eq!($1, $2)$0'));  // 14 Characters
                    }
                },
                {
                    description: 'Snippet works',
                    action: async (editor: TextEditor, _: TestAPI) => {
                        // Jump from tabstop from $1 to $2 (cursor defaults to $1 initially)
                        await jumpToNextTabstop();
                        verifyCursor(editor, [0, input.length + 'assert_eq!(, '.length]);
                        // Jump back from $2 to $1
                        await jumpToPrevTabstop();
                        verifyCursor(editor, [0, input.length + 'assert_eq!('.length]);
                        // Insert text at $1 then check that we can jump into $2 
                        await type(...'Hello');
                        await jumpToNextTabstop();
                        verifyCursor(editor, [0, input.length + 'assert_eq!(Hello, '.length]);
                        // Then jump for $2 to $0, which terminates the snippet
                        await jumpToNextTabstop();
                        verifyCursor(editor, [0, input.length + 'assert_eq!(Hello, )'.length]);
                    }
                },
                {
                    description: 'Enclosing pairs still valid',
                    action: async (_: TextEditor, testAPI: TestAPI) => {
                        // Check that that enclosing pairs still work
                        const snippetLength = 'assert_eq!(Hello, )'.length;
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 19 + snippetLength],
                            [0, 1, 0, 18 + snippetLength],
                            [0, 2, 0, 17 + snippetLength],
                            [0, 3, 0, 16 + snippetLength],
                            [0, 4, 0, 15 + snippetLength],
                            [0, 5, 0, 14 + snippetLength],
                            [0, 6, 0, 13 + snippetLength],
                            [0, 7, 0, 12 + snippetLength],
                            [0, 8, 0, 11 + snippetLength],
                            [0, 9, 0, 10 + snippetLength]
                        ]]);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'XX - Overwrite / deletion behavior (closing side)',
        generate: () => {
            const text = 'cheesecake';
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (_: TextEditor, __: TestAPI) => {
                        // Insert 10 pairs
                        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{'); 
                    }
                },
                {
                    description: 'Overwriting closing side of pairs removes them',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Overwrite the closing side of the 5th and 6th pairs (counted from out to in)
                        {[({[({[({})]})]})]} -> {[({[({[({})]}cheesecake})]}
                        12345678900987654321 -> 1234xx56788765xxxxxxxxxx4321 */
                        await insertText(editor, [0, 14, 0, 16], text);
                        verifyPairs(testAPI, [[
                            [0, 0, 0, 17 + text.length],
                            [0, 1, 0, 16 + text.length],
                            [0, 2, 0, 15 + text.length],
                            [0, 3, 0, 14 + text.length],
                            [0, 6, 0, 13],
                            [0, 7, 0, 12],
                            [0, 8, 0, 11],
                            [0, 9, 0, 10]
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Deleting closing side of pairs removes them',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Of the remaining pairs, delete the closing side of the first and last pairs 
                        {[({[({[({})]}cheesecake})]} -> {[({[({[({)]}cheesecake})] 
                        1234xx56788765xxxxxxxxxx4321 -> x123xx456x654xxxxxxxxxx321 */
                        await insertText(editor, [0, 17 + text.length, 0, 18 + text.length], '');
                        await insertText(editor, [0, 10, 0, 11], '');
                        verifyPairs(testAPI, [[
                            [0, 1, 0, 15 + text.length],
                            [0, 2, 0, 14 + text.length],
                            [0, 3, 0, 13 + text.length],
                            [0, 6, 0, 12],
                            [0, 7, 0, 11],
                            [0, 8, 0, 10],
                        ]]);
                        verifyCursor(editor, [0, 10]);
                    }
                },
                {
                    description: 'Overwriting closing side of pairs removes them - Again',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Of the remaining pairs, overwrite the closing side of the first and last pairs 
                        {[({[({[({)]}cheesecake})] -> {[({[({[({cheesecake]}cheesecake})cheesescake 
                        x123xx456x654xxxxxxxxxx321 -> xx12xx34xxxxxxxxxxxx43xxxxxxxxxx21xxxxxxxxxxx */
                        await insertText(editor, [0, 15 + text.length, 0, 16 + text.length], text);
                        // This step also pushes the cursor forward by `text.length`
                        await insertText(editor, [0, 10, 0, 11], text);
                        verifyPairs(testAPI, [[
                            [0, 2, 0, 13 + 2 * text.length],
                            [0, 3, 0, 12 + 2 * text.length],
                            [0, 6, 0, 11 +     text.length],
                            [0, 7, 0, 10 +     text.length],
                        ]]);
                        verifyCursor(editor, [0, 10 + text.length]);
                    }
                },
                {
                    description: 'Deleting closing side of pairs removes them - Again',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Of the remaining pairs, delete the closing side of the second and third pairs
                        {[({[({[({cheesecake]}cheesecake})cheesescake -> {[({[({[({cheesecake]cheesecake)cheesescake
                        xx12xx34xxxxxxxxxxxx43xxxxxxxxxx21xxxxxxxxxxx -> xx1xxxx4xxxxxxxxxxxx4xxxxxxxxxx1xxxxxxxxxxx */
                        await insertText(editor, [0, 12 + 2 * text.length, 0, 13 + 2 * text.length], '');
                        await insertText(editor, [0, 11 +     text.length, 0, 12 +     text.length], '');
                        verifyPairs(testAPI, [[
                            [0, 2, 0, 11 + 2 * text.length],
                            [0, 7, 0, 10 +     text.length],
                        ]]);
                        verifyCursor(editor, [0, 10 + text.length]);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'XXI - Overwrite / deletion behavior (opening side)',
        generate: () => {
            const text = 'cheesecake';
            return [
                {
                    description: 'Insert multiple pairs',
                    action: async (_: TextEditor, __: TestAPI) => {
                        // 10 pairs
                        await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
                    }
                },
                {
                    description: 'Overwriting opening side of pairs removes them',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Overwrite the closing side of the 5th and 6th pairs (counted from out to in)
                        {[({[({[({})]})]})]} -> {[({cheesecake{[({})]})]})]} 
                        12345678900987654321 -> 1234xxxxxxxxxx56788765xx4321 */
                        await insertText(editor, [0, 4, 0, 6], text);
                        verifyPairs(testAPI, [[
                            [0, 0,               0, 17 + text.length],
                            [0, 1,               0, 16 + text.length],
                            [0, 2,               0, 15 + text.length],
                            [0, 3,               0, 14 + text.length],
                            [0, 4 + text.length, 0, 11 + text.length],
                            [0, 5 + text.length, 0, 10 + text.length],
                            [0, 6 + text.length, 0, 9  + text.length],
                            [0, 7 + text.length, 0, 8  + text.length],
                        ]]);
                        verifyCursor(editor, [0, 8 + text.length]);
                    }
                },
                {
                    description: 'Deleting opening side of pairs removes them',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Of the remaining pairs, delete the opening side of the first and last pairs. Note
                        that the most nested pair (i.e. the last pair) is deleted with `backspace()` command, 
                        which automatically removes the closing side as well (this is the default editor 
                        behavior when the autoclosing pairs feature is enabled).
                        {[({cheesecake{[({})]})]})]} -> [({cheesecake{[()]})]})]}
                        1234xxxxxxxxxx56788765xx4321 -> 123xxxxxxxxxx456654xx321x */
                        await backspace();
                        await insertText(editor, [0, 0, 0, 1], '');
                        verifyPairs(testAPI, [[
                            [0, 0,               0, 13 + text.length],
                            [0, 1,               0, 12 + text.length],
                            [0, 2,               0, 11 + text.length],
                            [0, 3 + text.length, 0, 8  + text.length],
                            [0, 4 + text.length, 0, 7  + text.length],
                            [0, 5 + text.length, 0, 6  + text.length],
                        ]]);
                        verifyCursor(editor, [0, 6 + text.length]);
                    }
                },
                {
                    description: 'Overwriting opening side of pairs removes them - Again',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Of the remaining pairs, overwrite the opening side of the first and fourth pairs
                        [({cheesecake{[()]})]})]} -> cheesecake({cheesecakecheesecake[()]})]})]}
                        123xxxxxxxxxx456654xx321x -> xxxxxxxxxx12xxxxxxxxxxxxxxxxxxxx3443xxx21xx */
                        await insertText(editor, [0, 3 + text.length, 0, 4 + text.length], text);
                        await insertText(editor, [0, 0, 0, 1], text);
                        verifyPairs(testAPI, [[
                            [0,         text.length, 0, 10 + 3 * text.length],
                            [0,     1 + text.length, 0, 9  + 3 * text.length],
                            [0, 2 + 3 * text.length, 0, 5  + 3 * text.length],
                            [0, 3 + 3 * text.length, 0, 4  + 3 * text.length],
                        ]]);
                        verifyCursor(editor, [0, 4 + 3 * text.length]);
                    }
                },
                {
                    description: 'Deleting opening side of pairs removes them - Again',
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        /* Of the remaining pairs, delete the first two pairs
                        cheesecake({cheesecakecheesecake[()]})]})]} -> cheesecakecheesecakecheesecake[()]})]})]}
                        xxxxxxxxxx12xxxxxxxxxxxxxxxxxxxx3443xxx21xx -> xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1221xxxxxxx */
                        await insertText(editor, [0, text.length, 0, 2 + text.length], '');
                        verifyPairs(testAPI, [[
                            [0,     3 * text.length, 0, 3 + 3 * text.length],
                            [0, 1 + 3 * text.length, 0, 2 + 3 * text.length],
                        ]]);
                        verifyCursor(editor, [0, 2 + 3 * text.length]);
                    }
                }
            ];
        }
    },
    {
        groupDescription: 'XXII - Arbitrary text edits before pairs do not invalidate them',
        /* The goal here is to insert arbitrary text at positions before the pairs, then check that 
        the pairs remain properly tracked afterwards. 
        Definition of some terms that are used:
        - 'left of pairs' means any position to the left of the pairs on the same line
        - 'above pairs' menas any position on a line above the line of the pairs */
        generate: () => {
            const retVal: {
                description: string,
                action: ((editor: TextEditor, testAPI: TestAPI) => Promise<void>)
            }[] = [];
            // Insert pairs as the first action
            retVal.push({
                description: 'Insert multiple pairs',
                action: async (editor: TextEditor, testAPI: TestAPI) => {
                    // Insert 10 pairs
                    await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 19],
                        [0, 1, 0, 18],
                        [0, 2, 0, 17],
                        [0, 3, 0, 16],
                        [0, 4, 0, 15],
                        [0, 5, 0, 14],
                        [0, 6, 0, 13],
                        [0, 7, 0, 12],
                        [0, 8, 0, 11],
                        [0, 9, 0, 10],
                    ]]);
                    verifyCursor(editor, [0, 10]);
                }
            });
            /* This following array contains a series of text edits that are run in order. */
            const textEdits: {
                replace: [number, number, number, number],
                insert: string,
                /* The expected shift is the `[deltaLine, deltaCharacter]` on all pairs that is 
                expected after the text edit is applied. */
                expectedShift: [number, number]
            }[] = [
                    // 1 - Left of pairs: single line text inserted. Text inserted has 12 characters
                    {
                        replace: [0, 0, 0, 0],
                        insert: 'Hello World!',
                        expectedShift: [0, 12]
                    },
                    /* 2 - Left of pairs: multi line text inserted. Text inserted has 7 lines with 89 
                    characters on the last line. */
                    {
                        replace: [0, 0, 0, 0],
                        insert: aliceText1,
                        expectedShift: [6, 89]
                    },
                    // 3 - Left of pairs: single line text delete
                    {
                        replace: [6, 0, 6, 20],
                        insert: '',
                        expectedShift: [0, -20],
                    },
                    /* 4 - Left of pairs: single line text replaced with single line text. Text inserted 
                    has 10 characters. */
                    {
                        replace: [6, 0, 6, 20],
                        insert: 'Hi World!!',
                        expectedShift: [0, -20 + 10],
                    },
                    /* 5 - Left of pairs: single line text replaced with multi line text. Text inserted 
                    has 7 lines with 89 characters on the last line. */
                    {
                        replace: [6, 0, 6, 20],
                        insert: aliceText1,
                        expectedShift: [6, -20 + 89],
                    },
                    // 6 - From above pairs to left of pairs: multi line text deleted
                    {
                        replace: [6, 10, 12, 140],
                        insert: '',
                        expectedShift: [-6, -140 + 10]
                    },
                    /* 7 - From above pairs to left of pairs: multi line text replaced with single line 
                    text. Text inserted has 12 characters. */
                    {
                        replace: [4, 9, 6, 5],
                        insert: 'Hello World!',
                        expectedShift: [-2, -5 + 9 + 12]
                    },
                    /* 8 - From above pairs to left of pairs: multi line text replaced with multi line 
                    text. Text inserted has 8 lines with 16 characters on the last line. */
                    {
                        replace: [0, 10, 4, 6],
                        insert: aliceText2,
                        expectedShift: [-4 + 7, -6 + 16]
                    },
                    // 9 - Above pairs: Single line text inserted. Text inserted has 12 characters
                    {
                        replace: [2, 50, 2, 50],
                        insert: 'Hello World!',
                        expectedShift: [0, 0],
                    },
                    /* 10 - Above pairs: Multiline text inserted. Text inserted has 8 lines with 16 
                    characters on the last line. */
                    {
                        replace: [0, 0, 0, 0],
                        insert: aliceText2,
                        expectedShift: [7, 0]
                    },
                    // 11 - Above pairs: single line text deleted
                    {
                        replace: [10, 20, 10, 30],
                        insert: '',
                        expectedShift: [0, 0]
                    },
                    /* 12 - Above pairs: single line text replaced with single line text. Text inserted 
                    has 12 characters. */
                    {
                        replace: [5, 0, 5, 15],
                        insert: 'Hello World!',
                        expectedShift: [0, 0]
                    },
                    /* 13 - Above pairs: single line text replaced with multi line text. Text inserted 
                    has 7 lines with 89 characters on the last line. */
                    {
                        replace: [0, 0, 0, 10],
                        insert: aliceText1,
                        expectedShift: [6, 0]
                    },
                    // 14 - Above pairs: multi line text deleted
                    {
                        replace: [0, 10, 2, 100],
                        insert: '',
                        expectedShift: [-2, 0]
                    },
                    /* 15 - Above pairs: multi line text replaced with single line text. Text inserted 
                    has 12 characters. */
                    {
                        replace: [1, 0, 2, 0],
                        insert: 'Hello World!',
                        expectedShift: [-1, 0]
                    },
                    /* 16 - Above pairs: multi line text replaced with multi line text. Text inserted 
                    has 7 lines with 89 characters on the last line. */
                    {
                        replace: [1, 10, 4, 6],
                        insert: aliceText1,
                        expectedShift: [-3 + 6, 0]
                    }
                ];
            /* This is a placeholder variable for the current expected bare snapshot state. This
            variable is constantly updated after each text edit. This variable's initial value is
            that of just after the pairs are inserted. */
            let expectedState: [number, number, number, number][][] = [[
                [0, 0, 0, 19],
                [0, 1, 0, 18],
                [0, 2, 0, 17],
                [0, 3, 0, 16],
                [0, 4, 0, 15],
                [0, 5, 0, 14],
                [0, 6, 0, 13],
                [0, 7, 0, 12],
                [0, 8, 0, 11],
                [0, 9, 0, 10],
            ]];
            // This is a placeholder variable for the current expected cursor position
            let expectedCursorPos: [number, number] = [0, 10];
            /* Execute the text edits in order. After each text edit, the position of the pairs and
            the cursor is verified. */
            for (const [i, { replace, insert, expectedShift }] of textEdits.entries()) {
                retVal.push({
                    description: `Arbitrary text edit ${i + 1}`,
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await insertText(editor, replace, insert);
                        /* Shift the `expectedState` variable by the amount we expect then compare to
                        the actual state. */
                        expectedState = expectedState.map(
                            subarray => subarray.map(
                                ([openLine, openCharacter, closeLine, closeCharacter]) =>
                                    [
                                        openLine       + expectedShift[0],
                                        openCharacter  + expectedShift[1],
                                        closeLine      + expectedShift[0],
                                        closeCharacter + expectedShift[1]
                                    ] as [number, number, number, number]
                            )
                        );
                        // Also shift expected cursor position by the expected amount
                        expectedCursorPos = [
                            expectedCursorPos[0] + expectedShift[0],
                            expectedCursorPos[1] + expectedShift[1]
                        ];
                        verifyPairs(testAPI, expectedState);
                        verifyCursor(editor, expectedCursorPos);
                    }
                });
            }
            return retVal;
        }
    },
    {
        groupDescription: 'XXIII - Arbitrary text edits after pairs do not invalidate them',
        /* The goal here is to insert arbitrary text at positions after the pairs. Check that the 
        pairs are not shifted at all (as expected).
        Definition of some terms that are used:
        - 'right of' means any position to the right of the pairs on the same line
        - 'below pairs' menas any position on a line below the line of the pairs */
        generate: () => {
            const retVal: {
                description: string,
                action: ((editor: TextEditor, testAPI: TestAPI) => Promise<void>)
            }[] = [];
            // Insert pairs as the first action
            retVal.push({
                description: 'Insert multiple pairs',
                action: async (_: TextEditor, testAPI: TestAPI) => {
                    // Insert 10 pairs
                    await type('{', '[', '(', '{', '[', '(', '{', '[', '(', '{');
                    verifyPairs(testAPI, [[
                        [0, 0, 0, 19],
                        [0, 1, 0, 18],
                        [0, 2, 0, 17],
                        [0, 3, 0, 16],
                        [0, 4, 0, 15],
                        [0, 5, 0, 14],
                        [0, 6, 0, 13],
                        [0, 7, 0, 12],
                        [0, 8, 0, 11],
                        [0, 9, 0, 10],
                    ]]);
                }
            });
            /* This following array contains a series of text edits that are run in order. Since all
            the text edits occur after the pairs, no shift is expected to occur. */
            const textEdits: {
                replace: [number, number, number, number],
                insert: string
            }[] = [
                    // 1 - Right of pairs: single line text insertion
                    {
                        replace: [0, 20, 0, 20],
                        insert: 'Goodbye World!'
                    },
                    // 2 - Right of pairs: multi line text insertion
                    {
                        replace: [0, 30, 0, 30],
                        insert: aliceText1
                    },
                    // 3 - Right of pairs: single line text deleted
                    {
                        replace: [0, 20, 0, 30],
                        insert: ''
                    },
                    // 4 - Right of pairs: single line text replaced with single line text
                    {
                        replace: [0, 25, 0, 30],
                        insert: 'Goodbye World!'
                    },
                    // 5 - Right of pairs: single line text replaced with multi line text 
                    {
                        replace: [0, 40, 0, 50],
                        insert: aliceText1
                    },
                    // 6 - From right of pairs to below pairs: multi line text deleted
                    {
                        replace: [0, 40, 2, 0],
                        insert: ''
                    },
                    // 7 - From right of pairs to below pairs: multi line text replaced with single line text
                    {
                        replace: [0, 20, 4, 10],
                        insert: 'Goodbye World!'
                    },
                    // 8 - From right of pairs to below pairs: multi line text replaced with multi line text 
                    {
                        replace: [0, 20, 1, 100],
                        insert: aliceText2
                    },
                    // 9 - Below pairs: single line text insertion
                    {
                        replace: [5, 10, 5, 10],
                        insert: 'Goodbye World!'
                    },
                    // 10 - Below pairs: multi line text insertion
                    {
                        replace: [4, 50, 4, 50],
                        insert: aliceText2
                    },
                    // 11 - Below pairs: single line text deleted
                    {
                        replace: [4, 10, 4, 20],
                        insert: ''
                    },
                    // 12 - Below pairs: single line text replaced with single line text
                    {
                        replace: [6, 0, 6, 100],
                        insert: 'Goodbye World!'
                    },
                    // 13 - Below pairs: single line text replaced with multi line text
                    {
                        replace: [1, 0, 1, 50],
                        insert: aliceText1
                    },
                    // 14 - Below pairs: multi line text deleted
                    {
                        replace: [1, 0, 2, 0],
                        insert: ''
                    },
                    // 15 - Below pairs: multi line text replaced with single line text 
                    {
                        replace: [1, 0, 3, 10],
                        insert: 'Goodbye World!'
                    },
                    // 16 - Below pairs: multi line text replaced with multi line text 
                    {
                        replace: [1, 0, 10, 0],
                        insert: aliceText1
                    },
                ];
            /* The state of the controller after the pairs were inserted. The state is not expected
            to change since the text edits occur after the pairs. */
            const constExpectedState: [number, number, number, number][][] = [[
                [0, 0, 0, 19],
                [0, 1, 0, 18],
                [0, 2, 0, 17],
                [0, 3, 0, 16],
                [0, 4, 0, 15],
                [0, 5, 0, 14],
                [0, 6, 0, 13],
                [0, 7, 0, 12],
                [0, 8, 0, 11],
                [0, 9, 0, 10],
            ]];
            // The cursor position is not expected to change
            const constExpectedCursorPos: [number, number] = [0, 10];
            /* Execute the text edits in order. ter each text edit, the position of the pairs and
            the cursor is verified. */
            for (const [i, { replace, insert }] of textEdits.entries()) {
                retVal.push({
                    description: `Arbitrary text edit ${i + 1}`,
                    action: async (editor: TextEditor, testAPI: TestAPI) => {
                        await insertText(editor, replace, insert);
                        // No changes expected
                        verifyPairs(testAPI, constExpectedState);
                        verifyCursor(editor, constExpectedCursorPos);
                    }
                });
            }
            return retVal;
        }
    }
];

// Execute the tests
describe('Single Cursor Tracking Tests', function () {
    // Allow the tests access to the instance's API
    const testAPI = getTestAPI();
    // Execute the test groups
    for (const { groupDescription, generate } of testGroups) {
        context(groupDescription, function () {
            // Open new text editor for this test group just before the tests start
            let editor: TextEditor;
            before(async () => {
                editor = await openNewTextEditor();
            });
            // Run the tests for this group
            for (const { description, action } of generate()) {
                it(description, async function () {
                    await action(editor, testAPI);
                });
            }      
        });
    }
});
