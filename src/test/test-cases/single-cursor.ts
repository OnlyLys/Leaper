import { SnippetString, TextEditor } from 'vscode';
import { type, insertText, jumpToNextTabstop, jumpToPrevTabstop, verifyCursor, verifyPairs, openNewTextEditor, getTestAPI, ALICE_TEXT_1, ALICE_TEXT_2 } from '../utilities';
import { TestAPI } from '../../extension';

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
                        insert: ALICE_TEXT_1,
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
                        insert: ALICE_TEXT_1,
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
                        insert: ALICE_TEXT_2,
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
                        insert: ALICE_TEXT_2,
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
                        insert: ALICE_TEXT_1,
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
                        insert: ALICE_TEXT_1,
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
                        insert: ALICE_TEXT_1
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
                        insert: ALICE_TEXT_1
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
                        insert: ALICE_TEXT_2
                    },
                    // 9 - Below pairs: single line text insertion
                    {
                        replace: [5, 10, 5, 10],
                        insert: 'Goodbye World!'
                    },
                    // 10 - Below pairs: multi line text insertion
                    {
                        replace: [4, 50, 4, 50],
                        insert: ALICE_TEXT_2
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
                        insert: ALICE_TEXT_1
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
                        insert: ALICE_TEXT_1
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
