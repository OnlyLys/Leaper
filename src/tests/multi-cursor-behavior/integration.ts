import { CompactCluster, CompactCursor } from '../utilities/compact';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * A convenient way to assert the pairs and cursors for multiple cursors, provided there are the
 * same number of pairs being tracked for each cursor, and provided the relative positions of each 
 * cursor's pairs is the same for all cursors.
 */
async function multiAssert(
    executor:               Executor, 
    expectFirstCursorPairs: CompactCluster, 
    expectCursors:          CompactCursor[],
    expectDecorations:      'nearest' | 'all'
): Promise<void> {

    if (expectFirstCursorPairs === 'None') {
        await executor.assertPairs(Array(expectCursors.length).fill('None'));
        await executor.assertCursors(expectCursors);
        return;
    }

    // We choose to use the anchor of a cursor as the "base"s by which its pairs are relative to.
    const anchors = expectCursors.map(cursor => Array.isArray(cursor) ? cursor : cursor.anchor);

    // Use the first cursor and its pairs to calculate the relative positions of its pairs. 
    const relative: CompactCluster = { 
        line:  expectFirstCursorPairs.line - anchors[0][0],
        sides: expectFirstCursorPairs.sides.map(side => side - anchors[0][1])
    };

    // Since the relative positions of the pairs being tracked for each cursor is the same, we can 
    // construct the full array of absolute positions of pairs.
    const expectPairs: CompactCluster[] = anchors.map(([cursorLine, cursorChar]) => { 
        return {
            line:  relative.line + cursorLine,
            sides: relative.sides.map(side => side + cursorChar)
        };
    });
    
    await executor.assertPairsFull(expectPairs, expectDecorations);
    await executor.assertCursors(expectCursors);
}

const REAL_USER_SIMULATION_1_INITIAL_TEXT = 
`function printArr(x: any[]): void {
    x.forEach((elem, i) => { 
        console.log(i);
        console.log(elem);
    });
}

function main(): void {
    function inner() {
        const innerInner = () => console.log([
            { a: { b: [ "Hello", "World" ] } }
        ]);
        innerInner();
    }
    for (let _ = 0; _ < 10; ++_) {
        console.log([ 1, 2, 3 ]);
        inner();
    }
}

console.log([ 
    [ "H", "e", "l", "l", "o" ], 
    "World",
]);

main();`;

/**
 * Much like the user simulation test case for single cursors, we do the same thing for multi cursors.
 */
const REAL_SIMULATION_1_TEST_CASE = new TestCase({
    name: 'Real User Simulation 1',
    prelude: async (executor) => {

        // Suppose the user opens a Typescript document with some code already in it.
        await executor.openFile('./workspace-0/text.ts');
        await executor.editText([ 
            { kind: 'insert', at: [0, 0], text: REAL_USER_SIMULATION_1_INITIAL_TEXT } 
        ]);
        await multiAssert(executor, 'None', [ [25, 7] ], 'nearest');
    },
    task: async (executor) => {

        // What we will be doing here is simulating a series of actions the user would take to 
        // replace `console.log` calls with `printArr` calls.

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {           |----------˯(selection 1)
        //         const innerInner = () => console.log([
        //             { a: { b: [ "Hello", "World" ] } }
        //         ]);
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         console.log([ 1, 2, 3 ]);
        //         inner();
        //     }
        // }
        //
        // console.log([ 
        //     [ "H", "e", "l", "l", "o" ], 
        //     "World",
        // ]);
        //
        // main();
        // ```
        await executor.setCursors([ { anchor: [9, 33], active: [9, 44] } ]);
        await multiAssert(executor, 'None', [ { anchor: [9, 33], active: [9, 44] } ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {           |----------˯(selection 1)
        //         const innerInner = () => console.log([
        //             { a: { b: [ "Hello", "World" ] } }
        //         ]);
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         |----------˯(selection 2)
        //         console.log([ 1, 2, 3 ]);
        //         inner();
        //     }
        // }
        // |----------˯(selection 3)
        // console.log([ 
        //     [ "H", "e", "l", "l", "o" ], 
        //     "World",
        // ]);
        //
        // main();
        // ```
        await executor.addSelectionToNextFindMatch(2);
        await multiAssert(executor, 'None', [ 
            { anchor: [9, 33], active: [9, 44]  },
            { anchor: [15, 8], active: [15, 19] },
            { anchor: [20, 0], active: [20, 11] }
        ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {                   ˯(cursor 1)
        //         const innerInner = () => printArr([
        //             { a: { b: [ "Hello", "World" ] } }
        //         ]);
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //                 ˯(cursor 2)
        //         printArr([ 1, 2, 3 ]);
        //         inner();
        //     }
        // }
        //         ˯(cursor 3)
        // printArr([ 
        //     [ "H", "e", "l", "l", "o" ], 
        //     "World",
        // ]);
        //
        // main();
        // ```
        await executor.typeText('printArr');
        await multiAssert(executor, 'None', [ [9, 41], [15, 16], [20, 8] ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {                    ˯(cursor 1)
        //         const innerInner = () => printArr([
        //             { a: { b: [ "Hello", "World" ] } }
        //         ]);
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //                  ˯(cursor 2) 
        //         printArr([ 1, 2, 3 ]);
        //         inner();
        //     }
        // }
        //          ˯(cursor 3)
        // printArr([ 
        //     [ "H", "e", "l", "l", "o" ], 
        //     "World",
        // ]);
        //
        // main();
        // ```
        await executor.moveCursors('right');
        await multiAssert(executor, 'None', [ [9, 42], [15, 17], [20, 9] ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {                    |------------
        //         const innerInner = () => printArr([
        //             { a: { b: [ "Hello", "World" ] } }
        //         ]);
        // ---------^(selection 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([ 1, 2, 3 ]);
        //         inner(); |----------^(selection 2)
        //     }
        // }
        //          |------------
        // printArr([ 
        //     [ "H", "e", "l", "l", "o" ], 
        //     "World",
        // ]);
        // -^(selection 3)
        // main();
        // ```
        await executor.expandSelection(2);
        await multiAssert(executor, 'None', [ 
            { anchor: [9, 42],  active: [11, 9]  },
            { anchor: [15, 17], active: [15, 28] },
            { anchor: [20, 9],  active: [23, 1]  }
        ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {                    ˯(cursor 1)
        //         const innerInner = () => printArr();
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr();
        //         inner(); ^(cursor 2)
        //     }
        // }
        //          
        // printArr();
        //          ^(cursor 3)
        // main();
        // ```
        await executor.backspace();
        await multiAssert(executor, 'None', [ [9, 42], [13, 17], [18, 9] ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {                     ˯(cursor 1)
        //         const innerInner = () => printArr([]);
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([]);
        //         inner();  ^(cursor 2)
        //     }
        // }
        //          
        // printArr([]);
        //           ^(cursor 3)
        // main();
        // ```
        await executor.typeText('[');
        await multiAssert(executor, 
            { line: 9, sides: [42, 43] }, 
            [ [9, 43], [13, 18], [18, 10] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //          
        //         ]); ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //          
        //         ]); ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //  
        // ]); ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('\n');
        await multiAssert(executor, 'None', [ [10, 12], [16, 12], [23, 4] ], 'nearest');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             {}
        //         ]);  ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             {}
        //         ]);  ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     {}
        // ]);  ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('{');
        await multiAssert(executor, 
            { line: 10, sides: [12, 13] }, 
            [ [10, 13], [16, 13], [23, 5] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             {  }
        //         ]);    ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             {  }
        //         ]);    ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     {  }
        // ]);    ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' ', 2);
        await multiAssert(executor, 
            { line: 10, sides: [12, 15] }, 
            [ [10, 15], [16, 15], [23, 7] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             {  }
        //         ]);   ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             {  }
        //         ]);   ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     {  }
        // ]);   ^(cursor 3)
        //
        // main();
        // ```
        await executor.moveCursors('left');
        await multiAssert(executor, 
            { line: 10, sides: [12, 15] }, 
            [ [10, 14], [16, 14], [23, 6] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { {} }
            //         ]);    ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { {} }
            //         ]);    ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { {} }
            // ]);    ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText('{');
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 15, 17] }, 
                [ [10, 15], [16, 15], [23, 7] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { {q} }
            //         ]);     ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { {q} }
            //         ]);     ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { {q} }
            // ]);     ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText('q');
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 16, 18] }, 
                [ [10, 16], [16, 16], [23, 8] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { {} }
            //         ]);    ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { {} }
            //         ]);    ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { {} }
            // ]);    ^(cursor 3)
            //
            // main();
            // ```
            await executor.backspace();
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 15, 17] }, 
                [ [10, 15], [16, 15], [23, 7] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { {  } }
            //         ]);      ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { {  } }
            //         ]);      ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { {  } }
            // ]);      ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText(' ', 2);
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 17, 19] }, 
                [ [10, 17], [16, 17], [23, 9] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { {  } }
            //         ]);     ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { {  } }
            //         ]);     ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { {  } }
            // ]);     ^(cursor 3)
            //
            // main();
            // ```
            await executor.moveCursors('left');
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 17, 19] }, 
                [ [10, 16], [16, 16], [23, 8] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { { a: } }
            //         ]);       ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { { a: } }
            //         ]);       ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { { a: } }
            // ]);       ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText('a:');
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 19, 21] }, 
                [ [10, 18], [16, 18], [23, 10] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { { a: } }
            //         ]);      ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { { a: } }
            //         ]);      ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { { a: } }
            // ]);      ^(cursor 3)
            //
            // main();
            // ```
            await executor.moveCursors('left');
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 19, 21] }, 
                [ [10, 17], [16, 17], [23, 9] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { { a: } }
            //         ]);    ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { { a: } }
            //         ]);    ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { { a: } }
            // ]);    ^(cursor 3)
            //
            // main();
            // ```
            await executor.moveCursors('left', 2);
            await multiAssert(executor, 
                { line: 10, sides: [12, 14, 19, 21] }, 
                [ [10, 15], [16, 15], [23, 7] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             {  a: } }
            //         ]);   ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             {  a: } }
            //         ]);   ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     {  a: } }
            // ]);   ^(cursor 3)
            //
            // main();
            // ```
            await executor.backspace();
            await multiAssert(executor, 
                { line: 10, sides: [12, 20] }, 
                [ [10, 14], [16, 14], [23, 6] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
            
            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: } }
            //         ]);  ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: } }
            //         ]);  ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: } }
            // ]);  ^(cursor 3)
            //
            // main();
            // ```
            await executor.backspace();
            await multiAssert(executor, 
                { line: 10, sides: [12, 19] }, 
                [ [10, 13], [16, 13], [23, 5] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: } }
            //         ]);      ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: } }
            //         ]);      ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: } }
            // ]);      ^(cursor 3)
            //
            // main();
            // ```
            await executor.moveCursors('right', 4);
            await multiAssert(executor, 
                { line: 10, sides: [12, 19] }, 
                [ [10, 17], [16, 17], [23, 9] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

            // Mistake simulation: typed in another object instead of a property containing an object.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a:  }
            //         ]);      ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a:  }
            //         ]);      ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a:  }
            // ]);      ^(cursor 3)
            //
            // main();
            // ```
            await executor.deleteRight();
            await multiAssert(executor, 
                { line: 10, sides: [12, 18] }, 
                [ [10, 17], [16, 17], [23, 9] ], 
                'nearest'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: {} }
        //         ]);       ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: {} }
        //         ]);       ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: {} }
        // ]);       ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('{');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 18, 20] }, 
            [ [10, 18], [16, 18], [23, 10] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: } }
        //         ]);           ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: } }
        //         ]);           ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: } }
        // ]);           ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' b: ');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 24] },
            [ [10, 22], [16, 22], [23, 14] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });
            
        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: []} }
        //         ]);            ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: []} }
        //         ]);            ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: []} }
        // ]);            ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('[');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 23, 24, 26] },
            [ [10, 23], [16, 23], [23, 15] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ ]} }
        //         ]);             ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ ]} }
        //         ]);             ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ ]} }
        // ]);             ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' ');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 24, 25, 27] },
            [ [10, 24], [16, 24], [23, 16] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ '']} }
        //         ]);              ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ '']} }
        //         ]);              ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ '']} }
        // ]);              ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText("'");
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 24, 25, 26, 27, 29] },
            [ [10, 25], [16, 25], [23, 17] ], 
            'nearest'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // User enables the `leaper.decorateAll` configuration.
        //
        // The document state is not expected to change from this. Only the decorations will be 
        // affected.
        await executor.setConfiguration({
            name:  'leaper.decorateAll',
            value: true
        });
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 24, 25, 26, 27, 29] },
            [ [10, 25], [16, 25], [23, 17] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello']} }
        //         ]);                   ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello']} }
        //         ]);                   ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello']} }
        // ]);                   ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('Hello');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 24, 30, 31, 32, 34] },
            [ [10, 30], [16, 30], [23, 22] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello']} }
        //         ]);                    ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello']} }
        //         ]);                    ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello']} }
        // ]);                    ^(cursor 3)
        //
        // main();
        // ```
        await executor.leap();
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 31, 32, 34] },
            [ [10, 31], [16, 31], [23, 23] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', ]} }
        //         ]);                      ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', ]} }
        //         ]);                      ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', ]} }
        // ]);                      ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(', ');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 33, 34, 36] },
            [ [10, 33], [16, 33], [23, 25] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', '']} }
        //         ]);                       ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', '']} }
        //         ]);                       ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', '']} }
        // ]);                       ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText("'");
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 22, 33, 34, 35, 36, 38] },
            [ [10, 34], [16, 34], [23, 26] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'WORLD']} }
            //         ]);                            ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'WORLD']} }
            //         ]);                            ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'WORLD']} }
            // ]);                            ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText('WORLD');
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 22, 33, 39, 40, 41, 43] },
                [ [10, 39], [16, 39], [23, 31] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'WORLD']} }
            //         ]);                             ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'WORLD']} }
            //         ]);                             ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'WORLD']} }
            // ]);                             ^(cursor 3)
            //
            // main();
            // ```
            await executor.leap();
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 22, 40, 41, 43] },
                [ [10, 40], [16, 40], [23, 32] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'WORLD']} }
            //         ]);                              ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'WORLD']} }
            //         ]);                              ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'WORLD']} }
            // ]);                              ^(cursor 3)
            //
            // main();
            // ```
            await executor.leap();
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 41, 43] },
                [ [10, 41], [16, 41], [23, 33] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'WORLD'] } }
            //         ]);                               ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'WORLD'] } }
            //         ]);                               ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'WORLD'] } }
            // ]);                               ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText(' ');
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 42, 44] },
                [ [10, 42], [16, 42], [23, 34] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'WORLD'] } }
            //         ]);                            ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'WORLD'] } }
            //         ]);                            ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'WORLD'] } }
            // ]);                            ^(cursor 3)
            //
            // main();
            // ```
            await executor.moveCursors('left', 3);
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 42, 44] },
                [ [10, 39], [16, 39], [23, 31] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', ''] } }
            //         ]);                       ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', ''] } }
            //         ]);                       ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', ''] } }
            // ]);                       ^(cursor 3)
            //
            // main();
            // ```
            await executor.backspaceWord();
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 37, 39] },
                [ [10, 34], [16, 34], [23, 26] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });
        
            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'World'] } }
            //         ]);                            ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'World'] } }
            //         ]);                            ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'World'] } }
            // ]);                            ^(cursor 3)
            //
            // main();
            // ```
            await executor.typeText('World');
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 42, 44] },
                [ [10, 39], [16, 39], [23, 31] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

            // Mistake simulation: accidental all capitalized word.
            //
            // Document state after: 
            //
            // ```
            // function printArr(x: any[]): void {
            //     x.forEach((elem, i) => { 
            //         console.log(i);
            //         console.log(elem);
            //     });
            // }
            //
            // function main(): void {
            //     function inner() {
            //         const innerInner = () => printArr([
            //             { a: { b: [ 'Hello', 'World'] } }
            //         ]);                             ^(cursor 1)
            //         innerInner();
            //     }
            //     for (let _ = 0; _ < 10; ++_) {
            //         printArr([
            //             { a: { b: [ 'Hello', 'World'] } }
            //         ]);                             ^(cursor 2)
            //         inner();
            //     }
            // }
            //
            // printArr([
            //     { a: { b: [ 'Hello', 'World'] } }
            // ]);                             ^(cursor 3)
            //
            // main();
            // ```
            await executor.moveCursors('right');
            await multiAssert(executor, 
                { line: 10, sides: [12, 17, 42, 44] },
                [ [10, 40], [16, 40], [23, 32] ], 
                'all'
            );
            await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // Mistake simulation: accidental all capitalized word.
        //
        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } }
        //         ]);                              ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } }
        //         ]);                              ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } }
        // ]);                              ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' ');
        await multiAssert(executor, 
            { line: 10, sides: [12, 17, 43, 45] },
            [ [10, 41], [16, 41], [23, 33] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });


        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } }
        //         ]);                                   ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } }
        //         ]);                                   ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } }
        // ]);                                   ^(cursor 3)
        //
        // main();
        // ```
        await executor.moveCursors('end');
        await multiAssert(executor, 'None', [ [10, 46], [16, 46], [23, 38] ], 'all');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             
        //         ]); ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             
        //         ]); ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //             
        // ]); ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(',\n');
        await multiAssert(executor, 'None', [ [11, 12], [18, 12], [26, 4] ], 'all');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             []
        //         ]);  ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             []
        //         ]);  ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     []        
        // ]);  ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('[');
        await multiAssert(executor, 
            { line: 11, sides: [12, 13] }, 
            [ [11, 13], [18, 13], [26, 5] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ]
        //         ]);   ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ]
        //         ]);   ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ]        
        // ]);   ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' ');
        await multiAssert(executor, 
            { line: 11, sides: [12, 14] }, 
            [ [11, 14], [18, 14], [26, 6] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // User disables detection of `''` and `[]` pairs.
        //
        // The document state is not expected to change from this.
        await executor.setConfiguration({
            name:                  'leaper.detectedPairs',
            value:                 [ "{}", "()", "\"\"", "``" ],
            targetWorkspaceFolder: 'workspace-0',
            targetLanguage:        'typescript'
        });
        await multiAssert(executor, 
            { line: 11, sides: [12, 14] }, 
            [ [11, 14], [18, 14], [26, 6] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ '']
        //         ]);    ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ '']
        //         ]);    ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ '']        
        // ]);    ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText("'");
        await multiAssert(executor, 
            { line: 11, sides: [12, 16] }, 
            [ [11, 15], [18, 15], [26, 7] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ']
        //         ]);             ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ']
        //         ]);             ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ']        
        // ]);             ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' 🌍🌎🌏  ');
        await multiAssert(executor, 
            { line: 11, sides: [12, 25] }, 
            [ [11, 24], [18, 24], [26, 16] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ']
        //         ]);              ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ']
        //         ]);              ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ']        
        // ]);              ^(cursor 3)
        //
        // main();
        // ```
        await executor.moveCursors('right');
        await multiAssert(executor, 
            { line: 11, sides: [12, 25] }, 
            [ [11, 25], [18, 25], [26, 17] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', ]
        //         ]);                ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', ]
        //         ]);                ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', ]        
        // ]);                ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(', ');
        await multiAssert(executor, 
            { line: 11, sides: [12, 27] }, 
            [ [11, 27], [18, 27], [26, 19] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', []]
        //         ]);                 ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', []]
        //         ]);                 ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', []]        
        // ]);                 ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('[');
        await multiAssert(executor, 
            { line: 11, sides: [12, 29] }, 
            [ [11, 28], [18, 28], [26, 20] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // User re-enables detection of `''` pairs.
        //
        // The document state is not expected to change from this.
        await executor.setConfiguration({
            name:                  'leaper.detectedPairs',
            value:                 [ "{}", "()", "''", "\"\"", "``" ],
            targetWorkspaceFolder: 'workspace-0',
            targetLanguage:        'typescript'
        });
        await multiAssert(executor, 
            { line: 11, sides: [12, 29] }, 
            [ [11, 28], [18, 28], [26, 20] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '']]
        //         ]);                   ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '']]
        //         ]);                   ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '']]        
        // ]);                   ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(" '");
        await multiAssert(executor, 
            { line: 11, sides: [12, 29, 30, 32] }, 
            [ [11, 30], [18, 30], [26, 22] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐']]
        //         ]);                     ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐']]
        //         ]);                     ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '🌐']]        
        // ]);                     ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText('🌐');
        await multiAssert(executor, 
            { line: 11, sides: [12, 29, 32, 34] }, 
            [ [11, 32], [18, 32], [26, 24] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐']]
        //         ]);                      ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐']]
        //         ]);                      ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '🌐']]        
        // ]);                      ^(cursor 3)
        //
        // main();
        // ```
        await executor.leap();
        await multiAssert(executor, 
            { line: 11, sides: [12, 34] }, 
            [ [11, 33], [18, 33], [26, 25] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ]]
        //         ]);                       ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ]]
        //         ]);                       ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '🌐' ]]        
        // ]);                       ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' ');
        await multiAssert(executor, 
            { line: 11, sides: [12, 35] }, 
            [ [11, 34], [18, 34], [26, 26] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: false });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ]]
        //         ]);                        ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ]]
        //         ]);                        ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '🌐' ]]        
        // ]);                        ^(cursor 3)
        //
        // main();
        // ```
        await executor.moveCursors('right');
        await multiAssert(executor, 
            { line: 11, sides: [12, 35] }, 
            [ [11, 35], [18, 35], [26, 27] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ] ]
        //         ]);                         ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ] ]
        //         ]);                         ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '🌐' ] ]        
        // ]);                         ^(cursor 3)
        //
        // main();
        // ```
        await executor.typeText(' ');
        await multiAssert(executor, 
            { line: 11, sides: [12, 36] }, 
            [ [11, 36], [18, 36], [26, 28] ], 
            'all'
        );
        await executor.assertMostRecentContexts({ inLeaperMode: true, hasLineOfSight: true });

        // Document state after: 
        //
        // ```
        // function printArr(x: any[]): void {
        //     x.forEach((elem, i) => { 
        //         console.log(i);
        //         console.log(elem);
        //     });
        // }
        //
        // function main(): void {
        //     function inner() {
        //         const innerInner = () => printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ] ]
        //         ]);                          ^(cursor 1)
        //         innerInner();
        //     }
        //     for (let _ = 0; _ < 10; ++_) {
        //         printArr([
        //             { a: { b: [ 'Hello', 'World' ] } },
        //             [ ' 🌍🌎🌏  ', [ '🌐' ] ]
        //         ]);                          ^(cursor 2)
        //         inner();
        //     }
        // }
        //
        // printArr([
        //     { a: { b: [ 'Hello', 'World' ] } },
        //     [ ' 🌍🌎🌏  ', [ '🌐' ] ]        
        // ]);                          ^(cursor 3)
        //
        // main();
        // ```
        await executor.leap();
        await multiAssert(executor, 'None', [ [11, 37], [18, 37], [26, 29] ], 'all');
        await executor.assertMostRecentContexts({ inLeaperMode: false, hasLineOfSight: false });

    }
});

export const MULTI_CURSORS_INTEGRATION_TEST_GROUP: TestGroup = new TestGroup(
    'Integration',
    [
        REAL_SIMULATION_1_TEST_CASE
    ]
);
