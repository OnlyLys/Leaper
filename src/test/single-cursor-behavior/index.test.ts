import { TestCategory } from '../utilities/framework';
import { SINGLE_CURSOR_CONTEXT_MANAGEMENT_TEST_GROUP } from './context-management';
import { SINGLE_CURSOR_DECORATIONS_TEST_GROUP } from './decorations';
import { SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP } from './escape-leaper-mode';
import { SINGLE_CURSOR_INTEGRATION_TEST_GROUP } from './integration';
import { SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP } from './leap';
import { SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP } from './pair-invalidation';
import { SINGLE_CURSOR_PAIR_TRANSLATION_TEST_GROUP } from './pair-translation';

/**
 * Tests how the engine behaves when there is a single cursor.
 */
const TEST_CATEGORY = new TestCategory(
    'Single Cursor Behavior Tests',
    [
        SINGLE_CURSOR_CONTEXT_MANAGEMENT_TEST_GROUP,
        SINGLE_CURSOR_DECORATIONS_TEST_GROUP,
        SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_INTEGRATION_TEST_GROUP,
        SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP,
        SINGLE_CURSOR_PAIR_TRANSLATION_TEST_GROUP,
    ]
);

TEST_CATEGORY.run();
