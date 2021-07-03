import { TestCategory } from '../utilities/framework';
import { CONFIGURATION_READING_TEST_GROUP } from './configuration-reading';

const TEST_CATEGORY = new TestCategory(
    'Miscellaneous Tests',
    [
        CONFIGURATION_READING_TEST_GROUP
    ]
);

TEST_CATEGORY.run();