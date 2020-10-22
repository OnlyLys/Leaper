//! The following script is called by node when tests are launched in the command line via the 
//! `npm test` command.

import * as path from 'path';
import { runTests } from 'vscode-test';

async function main() {

	try {

		// The folder containing the Extension Manifest package.json.
		// Passed to `--extensionDevelopmentPath`.
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner.
		// Passed to --extensionTestsPath.
		const extensionTestsPath = path.resolve(__dirname, './index');

		// The path to the multi-root workspace we shall be running our tests in.
		const testWorkspacePath = path.resolve(__dirname, '../../.test-environment-tmp/multi.code-workspace');

		// Download VS Code, unzip it and run the integration test.
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs: [
				testWorkspacePath,
				'--disable-extensions'
			] 
        });
        
	} catch (err) {
		console.error('Failed to run tests');
        process.exit(1);
	}
}

main();
