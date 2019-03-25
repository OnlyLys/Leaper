import * as testRunner from 'vscode/lib/testrunner';

// Mocha JS options
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure({
    ui: 'tdd', 		
    useColors: true
});

module.exports = testRunner;