//! This script is called by Node.JS when tests are launched in the command line via the `npm test` 
//! command.

import * as path from 'path';
import { runTests } from 'vscode-test';

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The entry point of the tests.
        const extensionTestsPath = path.resolve(__dirname, './index');

		// The path to the temporary multi-root workspace we shall be running our tests in.
		const testWorkspacePath = path.resolve(__dirname, '../../.test-environment-tmp/multi.code-workspace');

		// This will automatically download vscode, then run the tests on it.
        await runTests({ 
            extensionDevelopmentPath,
			extensionTestsPath,
            launchArgs: [
				testWorkspacePath,

				// We do not want other extensions running in the background affecting our tests.
				'--disable-extensions'
			] 
        });
	} catch (err) {
		console.error('Failed to run tests');
        process.exit(1);
	}
}

main();
