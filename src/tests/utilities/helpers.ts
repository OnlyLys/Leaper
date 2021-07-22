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
 * Add `a` to each element within `arr[start..endNotInclusive]`.
 */
export function sliceAdd(arr: number[], start: number, endNotInclusive: number, a: number): void {
    for (let i = start; i < endNotInclusive; ++i) {
        arr[i] += a;
    }
}

/** 
 * Subtract `a` from each element within `arr[start..endNotInclusive]`.
 */
export function sliceSub(arr: number[], start: number, endNotInclusive: number, a: number): void {
    for (let i = start; i < endNotInclusive; ++i) {
        arr[i] -= a;
    }
}

/** 
 * Timeout by `n` milliseconds. 
 */
export async function waitFor(n: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, n));
}

/**
 * Zip two iterables together.
 */
export function* zip<T>(a: Iterable<T>, b: Iterable<T>): Generator<[T, T], undefined, undefined> {
    const iterA = a[Symbol.iterator]();
    const iterB = b[Symbol.iterator]();
    while (true) {
        let nextA = iterA.next();
        let nextB = iterB.next();
        if (!nextA.done && !nextB.done) {
            yield [nextA.value, nextB.value];
        } else {
            return;
        }
    }
}
