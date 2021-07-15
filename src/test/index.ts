import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

/**
 * This function is called by vscode in order to run the tests.
 */
export function run(): Promise<void> {

    const mocha = new Mocha({
        ui:	     'bdd',
        color:   true,
        timeout: 120000,    // Our tests take a while so a 2 minute timeout is appropriate.
        slow:    60000      
    });

    const testsRoot = path.resolve(__dirname, "..");

    // Test every `.test.ts` suffixed file in the test direcotry with Mocha.
    return new Promise((c, e) => {
        glob("**/**.test.js", { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
            try {
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}

