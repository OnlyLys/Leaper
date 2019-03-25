import * as shiftFnTests from './shift.test';
import * as integrationTests from './integration-tests';
import * as preliminaryTests from './preliminary-tests';
import { window } from 'vscode';

describe('Preliminary Tests', () => {
    window.showWarningMessage(`[Leaper] Tests are running, please do not close window.`);
    for (const preliminaryTest of preliminaryTests.allTests) {
        it(preliminaryTest.description, preliminaryTest.run);
    }
});

describe('Shift Function Unit Tests', () => {
    for (const unitTest of shiftFnTests.allTests) {
        it(unitTest.description, unitTest.run);
    }
});

describe('Integration Tests', () => {
    for (const integrationTest of integrationTests.allTests) {
        it(integrationTest.description, integrationTest.run);
    }
});
