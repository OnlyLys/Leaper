//! Definition of types for use in tests only.
//!
//! These types are 'compact' because they take up less space in the source code.

/**
 * For the sake of compactness, we use a tuple to represent positions in the tests. 
 * 
 * The first number of the tuple is the line index while the second is the character index.
 * 
 * Character indices are in units of UTF-16 code units.
 */
export type CompactPosition = [number, number];

/** 
 * Compact way to represent a range in the document. 
 */
export type CompactRange = { start: CompactPosition, end: CompactPosition };

/**
 * Compact way to represent the pairs for a cursor.
 * 
 * Since all the pairs for a cursor must be on the same line, we can represent them in a 'flatter' 
 * form, allowing for a more compact representation.
 * 
 * For example, say we have:
 *  
 *  1. Pair at line 1, opening side at character 10 and closing side at character 20.
 *  2. Pair at line 1, opening side at character 14 and closing side at character 17.
 *  3. Pair at line 1, opening side at character 15 and closing side at character 16.
 * 
 * Then we can represent the above in a more compact way:
 * 
 *     { line: 1, sides: [ 10, 14, 15, 16, 17, 20 ] }
 */
export type CompactCluster = { line: number, sides: number[] };

/** 
 * Compact way to represent pairs for all cursors.
 * 
 * The pairs for a cursor is `undefined` if there are no pairs being tracked for it. 
 * 
 * Specify 'None' if there are no pairs for a given cursor.
 */
export type CompactClusters = (CompactCluster | 'None')[];

/**
 * Compact way to represent a cursor in the editor.
 * 
 * If a `CompactPosition` type is specified, then the cursor is assumed to have the same `anchor`
 * and `active` positions.
 */
export type CompactCursor = CompactPosition | { anchor: CompactPosition, active: CompactPosition };

/**
 * Compact way to represent all the cursors in the editor.
 */
export type CompactCursors = CompactCursor[];
