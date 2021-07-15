import { TestCategory } from '../utilities/framework';
import { MULTI_CURSORS_INTEGRATION_TEST_GROUP } from './integration';

/**
 * A collection of test groups that test how the engine behaves when there are multiple cursors.
 */
const MULTI_CURSOR_BEHAVIOR_TESTS = new TestCategory(
    'Multi Cursor Behavior Tests',
    [
        MULTI_CURSORS_INTEGRATION_TEST_GROUP
    ]
);

MULTI_CURSOR_BEHAVIOR_TESTS.run();
