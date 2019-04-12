import { shift } from '../tracker/shift';         // Function to test
import { Position, Range } from 'vscode';
import * as assert from 'assert';

/** Position to use as the reference point of the shifts. */
const initial = new Position(5, 10);

const testGroups: { 
    /** Description of the test group. */
    description: string,
    /** Array containing tests of the group. */
    tests: {
        /** Description of the test. */
        description: string,
        /** The range that is replaced. */
        replace: Range,
        /** The new text that was inserted at the start of `replace`. */
        insert: string,
        /** 
         * The expected position after the shift is applied. Set to `undefined` if the initial position
         * is expected to be deleted.
         */
        expect: Position | undefined
    }[]
}[] = [
    {
        description: 'I - Replace single line range before reference with',
        tests: [
            {
                description: 'Single line text (short)',
                replace: new Range(5, 0, 5, 5),
                insert: 'R',                        // 1 Character
                expect: initial.translate({ characterDelta: -5 + 1 })
            },
            {
                description: 'Single line text (long)',
                replace: new Range(5, 0, 5, 5),
                insert: 'Resistance is Futile',     // 20 characters
                expect: initial.translate({ characterDelta: -5 + 20 })
            },
            {
                description: 'Multi line text',
                replace: new Range(5, 0, 5, 5),
                insert: 'Resistance\nis\nFutile',    // Last line has 6 characters
                expect: initial.translate({ lineDelta: 2, characterDelta: -5 + 6 })
            },
        ]
    },
    {
        description: 'II - Replace single line range above reference with',
        tests: [
            {
                description: 'Single line text',
                replace: new Range(4, 0, 4, 100),
                insert: 'Hello World',
                expect: initial                     // No change expected
            },
            {
                description: 'Multi line text',
                replace: new Range(4, 0, 4, 100),
                insert: 'Hello\nWorld\nGoodbye\nWorld',
                expect: initial.translate({ lineDelta: 3 })
            }
        ]
    },
    {
        description: 'III - Replace multi line range above reference with', 
        tests: [
            {
                description: 'Single line text',
                replace: new Range(0, 0, 4, 0),
                insert: 'Hello World',
                expect: initial.translate({ lineDelta: -4 })
            },
            {
                description: 'Multi line text',
                replace: new Range(0, 0, 4, 0),
                insert: 'Hello\nWorld\nGoodbye\nWorld',
                expect: initial.translate({ lineDelta: -4 + 3 })
            },
        ]
    },
    {
        description: 'IV - Replace multi line range from above to left of reference with',
        tests: [
            {
                description: 'Single line text',
                replace: new Range(1, 20, 5, 10),
                insert: 'Hello World',                      // 11 Characters
                expect: initial.translate({ lineDelta: -4, characterDelta: -10 + 20 + 11 })
            },
            {
                description: 'Multi line text',
                replace: new Range(1, 20, 5, 10),
                insert: 'Hello\nWorld\nGoodbye\nWorld',     // Last line has 5 characters
                expect: initial.translate({ lineDelta: -4 + 3, characterDelta: -10 + 5 })
            },
        ]
    },
    {
        description: 'V - Replace single line range after reference with', 
        tests: [
            {
                description: 'Single line text',
                replace: new Range(5, 11, 5, 60),
                insert: 'Hello World',
                expect: initial                             // Expect no change
            },
            {
                description: 'Multi line text',
                replace: new Range(5, 11, 5, 60),
                insert: 'Hello\nWorld\nGoodbye\nWorld',
                expect: initial                             // Expect no change
            },
        ]
    },
    {
        description: 'VI - Replace single line range below reference with',
        tests: [
            {
                description: 'Single line text',
                replace: new Range(6, 0, 6, 100),
                insert: 'Hello World',
                expect: initial                             // Expect no change
            },
            {
                description: 'Multi line text',
                replace: new Range(6, 0, 10, 100),
                insert: 'Hello\nWorld\nGoodbye\nWorld',
                expect: initial                             // Expect no change
            },
        ]
    },
    {
        description: 'VII - Replace multi line range below reference with',
        tests: [
            {
                description: 'Single line text',
                replace: new Range(6, 0, 10, 100),
                insert: 'Hello World',
                expect: initial                             // Expect no change
            },
            {
                description: 'Multi line text',
                replace: new Range(6, 0, 10, 100),
                insert: 'Hello\nWorld\nGoodbye\nWorld',
                expect: initial                             // Expect no change
            },
        ]
    },
    {
        description: 'VII - Replace multi line range from right of to below reference with',
        tests: [
            {
                description: 'Single line text',
                replace: new Range(5, 11, 10, 100),
                insert: 'Hello World',
                expect: initial                             // Expect no change
            },
            {
                description: 'Multi line text',
                replace: new Range(5, 11, 10, 100),
                insert: 'Hello\nWorld\nGoodbye\nWorld',
                expect: initial                             // Expect no change
            }
        ]
    },
    {
        description: 'IX - Reference overwritten by',
        tests: [
            {
                description: 'Single line range',
                replace: new Range(5, 0, 5, 20),
                insert: 'Hello World',
                expect: undefined                           // Expect deletion
            },
            {
                description: 'Multi line range',
                replace: new Range(4, 10, 6, 20),
                insert: 'Hello World',
                expect: undefined                           // Expect deletion
            },
            {
                description: 'Range ending one unit past reference',
                replace: new Range(5, 0, 5, 11),
                insert: 'Hello World',
                expect: undefined                           // Expect deletion
            },
            {
                description: 'Range starting from reference',
                replace: new Range(5, 10, 7, 0),
                insert: 'Hello World',
                expect: undefined                           // Expect deletion
            },
            {
                description: 'One character wide range starting from reference (i.e. deletion)',
                replace: new Range(5, 10, 5, 11),
                insert: '',
                expect: undefined                           // Expect deletion
            },
        ]
    },
    {
        description: 'X - Reference pushed forwards by',
        tests: [
            {
                description: 'Text insertion at exact location of reference',
                replace: new Range(5, 10, 5, 10),
                insert: 'Hello World',                      // 11 Characters
                expect: initial.translate({ characterDelta: 11 })
            },
        ]
    }
];

// Execute the tests
describe('Shift Function - Unit Tests on Reference Position', function () {
    for (const { description: groupDescription, tests } of testGroups) {
        context(groupDescription, function () {
            for (const { description, replace, insert, expect } of tests) {
                it(description, function () {
                    /* Apply the shift function to the initial reference position then assert that 
                    it meets the expected value. */
                    const shifted: Position | undefined = shift(initial, replace, insert);
                    assert.deepStrictEqual(shifted, expect);
                });
            }
        });
    }
}); 

