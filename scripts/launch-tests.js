'use strict';
var shell = require('shelljs');

/* This script is used to ensure that tests launched via the `npm test` shell command uses the proper
multi-root workspace environment. So we have to supply the environment variables that are normally 
set when tests are launched via VS Code's 'launch debug' command. For more information, please see 
the test launch option in `./vscode/launch.json`. Note that this script does not build the code,
it merely runs them.*/
const workspaceFolder = shell.pwd();
shell.env['CODE_TESTS_PATH']      = `${workspaceFolder}/out/test`;
shell.env['CODE_TESTS_WORKSPACE'] = `${workspaceFolder}/.test-environment/multi.code-workspace`;
shell.exec(`node ${workspaceFolder}/node_modules/vscode/bin/test`);