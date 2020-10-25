import { TestCategory } from '../utilities/framework';
import { CONFIGURATION_READING_TEST_GROUP } from './configuration-reading';

const TEST_CATEGORY = new TestCategory({
    name: 'Miscellaneous Tests',
    testGroups: [
        CONFIGURATION_READING_TEST_GROUP
    ]
});

TEST_CATEGORY.run();