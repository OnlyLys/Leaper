import { TestCategory } from '../utilities/framework';
import { SINGLE_CURSOR_CONTEXT_MANAGEMENT_TEST_GROUP } from './test-groups/context-management';
import { SINGLE_CURSOR_DECORATIONS_TEST_GROUP } from './test-groups/decorations';
import { SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP } from './test-groups/escape-leaper-mode';
import { SINGLE_CURSOR_INTEGRATION_TEST_GROUP } from './test-groups/integration';
import { SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP } from './test-groups/leap';
import { SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP } from './test-groups/pair-invalidation';
import { SINGLE_CURSOR_PAIR_TRANSLATION_TEST_GROUP } from './test-groups/pair-translation';

const TEST_CATEGORY = new TestCategory({
    name: 'Single Cursor Tests',
    testGroups: [
        SINGLE_CURSOR_CONTEXT_MANAGEMENT_TEST_GROUP,
        SINGLE_CURSOR_DECORATIONS_TEST_GROUP,
        SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_INTEGRATION_TEST_GROUP,
        SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP,
        SINGLE_CURSOR_PAIR_TRANSLATION_TEST_GROUP,
    ]
});

TEST_CATEGORY.run();
