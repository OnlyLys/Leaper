//! Definition of types for use in tests only.
//!
//! These types are 'compact' because they take up less visual space in the source code.

/**
 * Represents a position in a document.
 * 
 * The first element is the line index while the second is the character index. The character index
 * is in units of UTF-16 code units.
 */
export type CompactPosition = [number, number];

/**
 * Represents a range in a document. 
 */
export type CompactRange = { start: CompactPosition, end: CompactPosition };

/**
 * Represents a selection in an editor.
 */
export type CompactSelection = { anchor: CompactPosition, active: CompactPosition };

/**
 * Represents the position of a cursor in an editor.
 * 
 * If a `CompactPosition` type is specified, then the cursor is assumed to have an empty selection.
 */
export type CompactCursor = CompactPosition | CompactSelection;

/**
 * Represents all the pairs being tracked for a cursor in an editor.
 * 
 * Specify `'None'` if there are no pairs being tracked for a cursor.
 * 
 * # Why We Chose This Representation
 * 
 * Since all the pairs for a cursor must be on the same line, we can represent them in a 'flatter' 
 * form this way, allowing for a more compact representation.
 * 
 * For example, say we have:
 *  
 *  1. Pair at line 1, opening side at character 10 and closing side at character 20.
 *  2. Pair at line 1, opening side at character 14 and closing side at character 17.
 *  3. Pair at line 1, opening side at character 15 and closing side at character 16.
 * 
 * Then we can represent the above in a compact way:
 * 
 *     { line: 1, sides: [ 10, 14, 15, 16, 17, 20 ] }
 */
export type CompactCluster = { line: number, sides: number[] } | 'None';
