import { TestCategory } from '../utilities/framework';
import { SINGLE_CURSOR_KEYBINDING_CONTEXTS_TOGGLING_TEST_GROUP } from './keybinding-contexts-toggling';
import { SINGLE_CURSOR_DECORATE_ALL_TEST_GROUP } from './decorate-all';
import { SINGLE_CURSOR_DETECTED_PAIRS_TEST_GROUP } from './detected-pairs';
import { SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP } from './escape-leaper-mode';
import { SINGLE_CURSOR_INTEGRATION_TEST_GROUP } from './integration';
import { SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP } from './leap';
import { SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP } from './pair-invalidation';
import { SINGLE_CURSOR_PAIR_TRANSLATION_TEST_GROUP } from './pair-translation';

/**
 * A collection of test groups that test how the engine behaves when there is a single cursor.
 */
const TEST_CATEGORY = new TestCategory(
    'Single Cursor Behavior Tests',
    [
        SINGLE_CURSOR_DECORATE_ALL_TEST_GROUP,
        SINGLE_CURSOR_DETECTED_PAIRS_TEST_GROUP,
        SINGLE_CURSOR_ESCAPE_LEAPER_MODE_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_INTEGRATION_TEST_GROUP,
        SINGLE_CURSOR_KEYBINDING_CONTEXTS_TOGGLING_TEST_GROUP,
        SINGLE_CURSOR_LEAP_COMMAND_TEST_GROUP,
        SINGLE_CURSOR_PAIR_INVALIDATION_TEST_GROUP,
        SINGLE_CURSOR_PAIR_TRANSLATION_TEST_GROUP,
    ]
);

TEST_CATEGORY.run();
