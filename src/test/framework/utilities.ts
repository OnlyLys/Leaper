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
 * Randomly pick an element from an array.
 * 
 * Will throw an error if the input array is empty.
 */
export function pickRandom<T>(arr: ReadonlyArray<T>): T {
    if (arr.length < 1) {
        throw new Error('Input array cannot be empty.');
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

/** 
 * Timeout by `n` milliseconds. 
 */
export async function waitFor(n: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, n));
}

/**
 * Halt the control flow until the `callback` yields `true`.
 */
export async function waitUntil(callback: () => boolean): Promise<void> {
    while (!callback()) {}
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