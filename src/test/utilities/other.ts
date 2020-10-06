import { CompactCursors, CompactClusters } from './compact';

/**
 * Generate an array of sequential integers.
 */
export function range(start: number, endNotInclusive: number): number[] {
    const result = [];
    for (let i = start; i < endNotInclusive; ++i) {
        result.push(i);
    }
    return result;
}

/** 
 * Add a number to each element within a slice of numbers.
 */
export function sliceAdd(arr: number[], start: number, endNotInclusive: number, add: number): void {
    for (let i = start; i < endNotInclusive; ++i) {
        arr[i] += add;
    }
}

/** 
 * Subtract a number from each element within a slice of numbers.
 */
export function sliceSub(arr: number[], start: number, endNotInclusive: number, sub: number): void {
    for (let i = start; i < endNotInclusive; ++i) {
        arr[i] -= sub;
    }
}

/** 
 * Create an copy of a compact clusters representation of pairs.
 */
export function clonePairs(pairs: CompactClusters): CompactClusters {
    return pairs.map(({ line, sides }) => ({ line, sides: [...sides] }));
}

/**
 * Create an independent copy of a compact cursors array.
 */
export function cloneCursors(cursors: CompactCursors): CompactCursors {
    return cursors.map((cursor) => {
        if (Array.isArray(cursor)) {
            return [cursor[0], cursor[1]];
        } else {
            return { anchor: cursor.anchor, active: cursor.active };
        }
    });
}

/**
 * Multiply an array (by repeating `arr`) `n` times.
 */
export function repeatArr(arr: ReadonlyArray<any>, n: number): any[] {
    return (new Array(n)).fill(arr).flat();
}
