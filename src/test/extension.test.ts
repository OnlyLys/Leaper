import * as shiftFnTests from './shift-fn-tests';
import * as integrationTests from './integration-tests';
import * as preliminaryTests from './preliminary-tests';
import { window } from 'vscode';

suite('Preliminary Tests', () => {
    window.showWarningMessage(`[Leaper] Tests are running, please do not close window.`);
    for (const preliminaryTest of preliminaryTests.allTests) {
        test(preliminaryTest.description, preliminaryTest.run);
    }
});

suite('Shift Function Unit Tests', () => {
    for (const unitTest of shiftFnTests.allTests) {
        test(unitTest.description, unitTest.run);
    }
});

suite('Integration Tests', () => {
    for (const integrationTest of integrationTests.allTests) {
        test(integrationTest.description, integrationTest.run);
    }
});
