import { SINGLE_CURSOR_INTEGRATION_TEST_GROUP } from './test-groups/integration';
import { SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP } from './test-groups/leap';
import { SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP } from './test-groups/escape-leaper-mode';
import { SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP } from './test-groups/pair-invalidation';
import { SINGLE_CURSOR_TRACKING_TEST_GROUP } from './test-groups/tracking';
import { TestCategory } from '../utilities/framework';

const TEST_CATEGORY = new TestCategory({
    name: 'Single Cursor Tests',
    testGroups: [
        SINGLE_CURSOR_INTEGRATION_TEST_GROUP,
        SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP,
        SINGLE_CURSOR_TRACKING_TEST_GROUP
    ]
});

TEST_CATEGORY.run();
