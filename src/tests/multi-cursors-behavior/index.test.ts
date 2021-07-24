import { TestCategory } from '../utilities/framework';
import { MULTI_CURSORS_INTEGRATION_TEST_GROUP } from './integration';

/**
 * A collection of test groups that test how the engine behaves when there are multiple cursors.
 */
const MULTI_CURSORS_BEHAVIOR_TESTS = new TestCategory(
    'Multi Cursors Behavior Tests',
    [
        MULTI_CURSORS_INTEGRATION_TEST_GROUP,
    ]
);

MULTI_CURSORS_BEHAVIOR_TESTS.run();
