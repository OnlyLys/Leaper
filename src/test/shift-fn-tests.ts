'use strict';

import { shift } from '../pairs';         // Function to test
import { Position, Range } from 'vscode';
import * as assert from 'assert';

/** Array containing all the tests and descriptions. */
export const allTests: { description: string, run: () => void }[] = [];

/** Position to use as the base of our testing. */
const initial = new Position(5, 10);

/**
 * Apply the shift function to a position then assert that it meets the expected value.
 * 
 * @param initial The initial position to apply the shift to.
 * @param replace The range that is replaced.
 * @param insert The new text that was inserted at the start of `replace`.
 * @param expect The expected position after the shift is applied. If the position is expected to
 * be deleted then pass `undefined` to this parameter instead.
 */
function validate(arg: { initial: Position, replace: Range, insert: string, expect: Position | undefined }): void {
    const { initial, replace, insert, expect } = arg;
    const shifted: Position | undefined = shift(initial, replace, insert);
    assert.deepStrictEqual(shifted, expect);
}

allTests.push({
    description: '1 - Single line range on same line but before position replaced with long single line text',
    run: () => validate({
        initial, 
        replace: new Range(5, 0, 5, 5),         
        insert: 'Resistance is Futile',     // 20 characters
        expect: initial.translate({ characterDelta: -5 + 20 })
    })
});

allTests.push({
    description: '2 - Single line range on same line but before position replaced with short single line text',
    run: () => validate({
        initial,
        replace: new Range(5, 0, 5, 5),
        insert: 'R',                        // 1 Character
        expect: initial.translate({ characterDelta: -5 + 1 })
    })
});

allTests.push({
    description: '3 - Single line range on same line but before position replaced with multi line text',
	run: () => validate({
        initial,
        replace: new Range(5, 0, 5, 5),
        insert: 'Resistance\nis\nFutile',    // Last line has 6 characters
        expect: initial.translate({ lineDelta: 2, characterDelta: -5 + 6 })
    })
});

allTests.push({
    description: '4 - Single line range in lines above position replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(4, 0, 4, 100),
        insert: 'Hello World',
        expect: initial                     // No change expected
    })
});

allTests.push({
    description: '5 - Single line range in lines above position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(4, 0, 4, 100),
        insert: 'Hello\nWorld\nGoodbye\nWorld',
        expect: initial.translate({ lineDelta: 3 })
    })
});

allTests.push({
    description: '6 - Multi line range in lines above positiion replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(0, 0, 4, 0),
        insert: 'Hello World',
        expect: initial.translate({ lineDelta: -4 })
    })
});

allTests.push({
    description: '7 - Multi line range in lines above position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(0, 0, 4, 0),
        insert: 'Hello\nWorld\nGoodbye\nWorld',
        expect: initial.translate({ lineDelta: -4 + 3 })
    })
});

allTests.push({
    description: '8 - Multi line range from lines above to left of position replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(1, 20, 5, 10),
        insert: 'Hello World',                      // 11 Characters
        expect: initial.translate({ lineDelta: -4, characterDelta: -10 + 20 + 11 })
    })
});

allTests.push({
    description: '9 - Multi line range from lines above to left of position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(1, 20, 5, 10),
        insert: 'Hello\nWorld\nGoodbye\nWorld',     // Last line has 5 characters
        expect: initial.translate({ lineDelta: -4 + 3, characterDelta: -10 + 5 })
    })
});

allTests.push({
    description: '10 - Single line range on same line but after position replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(5, 11, 5, 60),
        insert: 'Hello World',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '11 - Single line range on same line but after position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(5, 11, 5, 60),
        insert: 'Hello\nWorld\nGoodbye\nWorld',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '12 - Single line range in lines below position replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(6, 0, 6, 100),
        insert: 'Hello World', 
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '13 - Single line range in lines below position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(6, 0, 10, 100),
        insert: 'Hello\nWorld\nGoodbye\nWorld',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '14 - Multi line range in lines below position replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(6, 0, 10, 100),
        insert: 'Hello World',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '15 - Multi line range in lines below position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(6, 0, 10, 100),
        insert: 'Hello\nWorld\nGoodbye\nWorld',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '16 - Multi line range from lines below up to right of position replaced with single line text',
    run: () => validate({
        initial,
        replace: new Range(5, 11, 10, 100),
        insert: 'Hello World',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '17 - Multi line range from lines below up to right of position replaced with multi line text',
    run: () => validate({
        initial,
        replace: new Range(5, 11, 10, 100),
        insert: 'Hello\nWorld\nGoodbye\nWorld',
        expect: initial                             // Expect no change
    })
});

allTests.push({
    description: '18 - Position overwritten by single line range',
    run: () => validate({
        initial,
        replace: new Range(5, 0, 5, 20),
        insert: 'Hello World',
        expect: undefined                           // Expect deletion
    })
});

allTests.push({
    description: '19 - Position overwritten by mutli line range',
    run: () => validate({
        initial,
        replace: new Range(4, 10, 6, 20),
        insert: 'Hello World',
        expect: undefined                           // Expect deletion
    })
});

allTests.push({
    description: '20 - Edge case: Position overwritten by range with end that is just one unit past position',
    run: () => validate({
        initial,
        replace: new Range(5, 0, 5, 11),
        insert: 'Hello World',
        expect: undefined                           // Expect deletion
    })
});


allTests.push({
    description: '21 - Edge case: Position overwritten by range which starts at the position',
    run: () => validate({
        initial,
        replace: new Range(5, 10, 7, 0),
        insert: 'Hello World',
        expect: undefined                           // Expect deletion
    })
});

allTests.push({
    description: '22 - Edge case: Just position itself is deleted by a 1 character wide range',
    run: () => validate({
        initial,
        replace: new Range(5, 10, 5, 11),
        insert: '',
        expect: undefined                           // Expect deletion
    })
});

allTests.push({
    description: '23 - Edge case: Just text insertion at the position of the position, pushing it rightwards',
    run: () => validate({
        initial,
        replace: new Range(5, 10, 5, 10),
        insert: 'Hello World',                      // 11 Characters
        expect: initial.translate({ characterDelta: 11 })
    })
});