//! The following script is meant to be run by Node.JS before running the tests.
//!
//! This script makes a copy of the test environment so that the tests may run on that copy instead. 
//! By doing this, we allow the tests to modify the workspace it is in without permanently dirtying 
//! the test environment.

import * as fs from 'fs';
import * as path from 'path';

/**
 * @param src Absolute path to the source.
 * @param dest Absolute path to the destination.
 */
function recursiveCopy(src: string, dest: string): void {
    if (!fs.existsSync(src)) {
        return;
    }
    const srcStats = fs.statSync(src);
    if (srcStats.isDirectory()) {
        fs.mkdirSync(dest);
        fs.readdirSync(src).forEach((content) => {
            recursiveCopy(path.join(src, content), path.join(dest, content));
        });
    } else if (srcStats.isFile() || srcStats.isSymbolicLink()) {
        fs.copyFileSync(src, dest);
    }
}

// Delete old test environment.
fs.rmSync(path.resolve('.test-environment-tmp'), { recursive: true, force: true });

// Make copy of test environment.
recursiveCopy(
    path.resolve('.test-environment'),
    path.resolve('.test-environment-tmp')
);