import { DecorationRangeBehavior, ThemeColor, ViewColumn } from 'vscode';
import { Executor, TestCase, TestGroup } from '../utilities/framework';

/**
 * The color converted (DO-1) preconfigured value in the test workspace.
 */
const DO_1 = {
    outlineColor: new ThemeColor("editorWarning.foreground"),
    outlineStyle: "solid",
    outlineWidth: "1px",
    fontWeight: "bolder"
};

/**
 * The color converted (DO-2) preconfigured value in the test workspace.
 */
const DO_2 = {
    outlineColor: new ThemeColor("editorInfo.foreground"),
    outlineStyle: "solid",
    outlineWidth: "1px",
    dark: {
        after: {
            contentText: "🖚",
            color: new ThemeColor("editorInfo.foreground"),
        },
    },
    light: {
        before: {
            contentText: "➝",
            color: new ThemeColor("editorInfo.foreground")
        },
    }
};

/** 
 * The color converted (DO-3) preconfigured value in the test workspace.
 */
const DO_3 = {
    backgroundColor: "#0000FF9E",
    outlineColor: new ThemeColor("editorBracketMatch.border"),
    outlineStyle: "outset",
    outlineWidth: "1px",
    fontWeight: "bolder",
    light: {
        backgroundColor: "#0000001A"
    }
};

/**
 * The color converted (DO-4) preconfigured value in the test workspace.
 */
const DO_4 = {
    outlineColor: new ThemeColor("editorBracketMatch.border"),
    outlineStyle: "solid",
    outlineWidth: "1px",
    fontWeight: "bold"
};

/**
 * The color converted (DO-5) preconfigured value in the test workspace.
 */
const DO_5 = {
    letterSpacing: "2px",
    borderColor: new ThemeColor("editorWarning.foreground"),
    borderStyle: "none solid none none",
    borderWidth: "2px",
    fontWeight: "bolder",
};

/**
 * Open 4 files in exclusive view columns.
 * 
 * The following table shows the relevant configuration values for each file:
 * 
 *     View Column                      1            2            3            4
 *     ------------------------------------------------------------------------------------
 *     Workspace Folder               | 0          | 1          | 2          | 3          |
 *     File                           | text.ts    | text.txt   | text.ts    | text.md    |
 *     ------------------------------------------------------------------------------------
 *     Language                       | Typescript | Plaintext  | Typescript | Markdown   |
 *                                    |            |            |            |            |
 *     leaper.decorationOptions Value |            |            |            |            |
 *       - Workspace                  | (DO-1)     | (DO-1)     | (DO-1)     | (DO-1)     |
 *       - Workspace Folder           | undefined  | null       | (DO-4)     | undefined  |
 *       - Language Workspace         | undefined  | undefined  | undefined  | (DO-2)     |
 *       - Language Workspace Folder  | undefined  | (DO-3)     | (DO-5)     | undefined  |
 *       - Effective                  | (DO-1)     | (DO-3)     | (DO-5)     | (DO-2)     |
 *     ------------------------------------------------------------------------------------
 * 
 */
async function openFourFiles(executor: Executor): Promise<void> {
    await executor.openFile('./workspace-0/text.ts',  ViewColumn.One);
    await executor.openFile('./workspace-1/text.txt', ViewColumn.Two);
    await executor.openFile('./workspace-2/text.ts',  ViewColumn.Three);
    await executor.openFile('./workspace-3/text.md',  ViewColumn.Four);
}

/**
 * Check that `leaper.decorationOptions` is being read and that theme color identifier strings are 
 * being converted to `ThemeColor` types.
 */
const IS_BEING_READ_AND_THEME_COLOR_IDS_CORRECTLY_CONVERTED_TEST_CASE = new TestCase({
    name: 'Is Being Read and Theme Color IDs Correctly Converted',
    prelude: openFourFiles,
    task: async (executor) => {
        await executor.assertEffectiveDecorationOptions(DO_1, ViewColumn.One);
        await executor.assertEffectiveDecorationOptions(DO_3, ViewColumn.Two);
        await executor.assertEffectiveDecorationOptions(DO_5, ViewColumn.Three);
        await executor.assertEffectiveDecorationOptions(DO_2, ViewColumn.Four);
    }
});

/**
 * Check that configuration values which specify `rangeBehavior` are rejected.
 */
const REJECT_VALUE_IF_RANGE_BEHAVIOR_SPECIFIED_TEST_CASE = new TestCase({
    name: 'Reject Value if `rangeBehavior` Specified',
    prelude: openFourFiles,
    task: async (executor) => {

        // This test case exists because the engine's configuration reader should reject decoration
        // options with with `rangeBehavior` specified. For more info, see the `Configurations` type.

        // 1. Modify the Plaintext specific value in Workspace Folder 1 to specify a `rangeBehavior`.
        //
        // This is expected to change the effective value for the text editor in view column 2.
        await executor.setConfiguration({
            name: 'leaper.decorationOptions', 
            value: {
                backgroundColor: "#0000FF9E",
                outlineColor: "editorBracketMatch.border",
                outlineStyle: "outset",
                outlineWidth: "1px",
                fontWeight: "bolder",
                light: {
                    "backgroundColor": "#0000001A",
                },
                rangeBehavior: DecorationRangeBehavior.ClosedOpen
            },
            targetWorkspaceFolder: 'workspace-1',
            targetLanguage: 'plaintext'
        });
        
        // The effective value for the text editor in view column 2 should now come from the 
        // workspace folder scope (which is `null`) since the Plaintext specific value would be 
        // rejected.
        await executor.assertEffectiveDecorationOptions({}, ViewColumn.Two);

        // 2. Replace the root workspace's Markdown specific value with one that specifies a 
        // `rangeBehavior`.
        //
        // This is expected to change the effective value for the text editor in view column 4.
        await executor.setConfiguration({
            name: 'leaper.decorationOptions', 
            value: {
                outlineColor: "editorInfo.foreground",
                outlineStyle: "solid",
                outlineWidth: "1px",
                rangeBehavior: DecorationRangeBehavior.ClosedClosed
            },
            targetLanguage: 'markdown'
        });

        // Even though the `rangeBehavior` was specified as `ClosedClosed`, which is the value the
        // engine requires it to be, the engine's configuration reader will still reject it. Thus, 
        // we expect the effective value for the text editor in view column 4 to come from the root
        // workspace scope.
        await executor.assertEffectiveDecorationOptions(DO_1, ViewColumn.Four);
    }
});

/**
 * Check that new effective values of `leaper.decorationOptions` are automatically hot reloaded.
 */
const HOT_RELOAD_TEST_CASE = new TestCase({
    name: 'Hot Reload',
    prelude: openFourFiles,
    task: async (executor) => {

        // 1. Change the root workspace's configuration value.
        //
        // This should change the effective value for view column 1's text editor.
        //
        // The relevant configuration values for each text editor after this step:
        // 
        //     View Column                      1            2            3            4
        //     ------------------------------------------------------------------------------------
        //     Workspace Folder               | 0          | 1          | 2          | 3          |
        //     File                           | text.ts    | text.txt   | text.ts    | text.md    |
        //     ------------------------------------------------------------------------------------
        //     Language                       | Typescript | Plaintext  | Typescript | Markdown   |
        //                                    |            |            |            |            |
        //     leaper.decorationOptions Value |            |            |            |            |
        //       - Workspace                  | (DO-6)     | (DO-6)     | (DO-6)     | (DO-6)     |
        //       - Workspace Folder           | undefined  | null       | (DO-4)     | undefined  |
        //       - Language Workspace         | undefined  | undefined  | undefined  | (DO-2)     |
        //       - Language Workspace Folder  | undefined  | (DO-3)     | (DO-5)     | undefined  |
        //       - Effective                  | (DO-6)     | (DO-3)     | (DO-5)     | (DO-2)     |
        //     ------------------------------------------------------------------------------------
        //     
        const DO_6 = {
            outlineColor: "#FFFFFFFF",
            outlineStyle: "dotted",
            outlineWidth: "1px",
            fontWeight: "bold"
        };
        await executor.setConfiguration({ 
            name:  'leaper.decorationOptions', 
            value: DO_6
        });

        // Check the effective configuration values for each text editor.
        await executor.assertEffectiveDecorationOptions(DO_6, ViewColumn.One);
        await executor.assertEffectiveDecorationOptions(DO_3, ViewColumn.Two);
        await executor.assertEffectiveDecorationOptions(DO_5, ViewColumn.Three);
        await executor.assertEffectiveDecorationOptions(DO_2, ViewColumn.Four);

        // 2. Change Workspace Folder 0's configuration value.
        //
        // This should change the effective value for view column 1's text editor.
        //
        // The relevant configuration values for each text editor after this step:
        // 
        //     View Column                      1            2            3            4
        //     ------------------------------------------------------------------------------------
        //     Workspace Folder               | 0          | 1          | 2          | 3          |
        //     File                           | text.ts    | text.txt   | text.ts    | text.md    |
        //     ------------------------------------------------------------------------------------
        //     Language                       | Typescript | Plaintext  | Typescript | Markdown   |
        //                                    |            |            |            |            |
        //     leaper.decorationOptions Value |            |            |            |            |
        //       - Workspace                  | (DO-6)     | (DO-6)     | (DO-6)     | (DO-6)     |
        //       - Workspace Folder           | null       | null       | (DO-4)     | undefined  |
        //       - Language Workspace         | undefined  | undefined  | undefined  | (DO-2)     |
        //       - Language Workspace Folder  | undefined  | (DO-3)     | (DO-5)     | undefined  |
        //       - Effective                  | null       | (DO-3)     | (DO-5)     | (DO-2)     |
        //     ------------------------------------------------------------------------------------
        //
        await executor.setConfiguration({
            name:                  'leaper.decorationOptions',
            targetWorkspaceFolder: 'workspace-0',
            value:                 null
        });

        // Check the effective configuration values for each text editor.
        await executor.assertEffectiveDecorationOptions({},   ViewColumn.One);
        await executor.assertEffectiveDecorationOptions(DO_3, ViewColumn.Two);
        await executor.assertEffectiveDecorationOptions(DO_5, ViewColumn.Three);
        await executor.assertEffectiveDecorationOptions(DO_2, ViewColumn.Four);

        // 3. Change the root workspace's Markdown specific configuration value.
        //
        // This should change the effective value for view column 4's text editor.
        //
        // The relevant configuration values for each text editor after this step:
        // 
        //     View Column                      1            2            3            4
        //     ------------------------------------------------------------------------------------
        //     Workspace Folder               | 0          | 1          | 2          | 3          |
        //     File                           | text.ts    | text.txt   | text.ts    | text.md    |
        //     ------------------------------------------------------------------------------------
        //     Language                       | Typescript | Plaintext  | Typescript | Markdown   |
        //                                    |            |            |            |            |
        //     leaper.decorationOptions Value |            |            |            |            |
        //       - Workspace                  | (DO-6)     | (DO-6)     | (DO-6)     | (DO-6)     |
        //       - Workspace Folder           | null       | null       | (DO-4)     | undefined  |
        //       - Language Workspace         | undefined  | undefined  | undefined  | (DO-7)     |
        //       - Language Workspace Folder  | undefined  | (DO-3)     | (DO-5)     | undefined  |
        //       - Effective                  | null       | (DO-3)     | (DO-5)     | (DO-7)     |
        //     ------------------------------------------------------------------------------------
        //     
        const DO_7 = {
            fontWeight: "bold"
        };
        await executor.setConfiguration({
            name:           'leaper.decorationOptions',
            targetLanguage: 'markdown',
            value:          DO_7
        });

        // Check the effective configuration values for each text editor.
        await executor.assertEffectiveDecorationOptions({},   ViewColumn.One);
        await executor.assertEffectiveDecorationOptions(DO_3, ViewColumn.Two);
        await executor.assertEffectiveDecorationOptions(DO_5, ViewColumn.Three);
        await executor.assertEffectiveDecorationOptions(DO_7, ViewColumn.Four);
        
        // 4. Clear Workspace Folder 2's Typescript specific configuration value.
        //
        // This should change the effective value for view column 3's text editor.
        //
        // The relevant configuration values for each text editor after this step:
        // 
        //     View Column                      1            2            3            4
        //     ------------------------------------------------------------------------------------
        //     Workspace Folder               | 0          | 1          | 2          | 3          |
        //     File                           | text.ts    | text.txt   | text.ts    | text.md    |
        //     ------------------------------------------------------------------------------------
        //     Language                       | Typescript | Plaintext  | Typescript | Markdown   |
        //                                    |            |            |            |            |
        //     leaper.decorationOptions Value |            |            |            |            |
        //       - Workspace                  | (DO-6)     | (DO-6)     | (DO-6)     | (DO-6)     |
        //       - Workspace Folder           | null       | null       | (DO-4)     | undefined  |
        //       - Language Workspace         | undefined  | undefined  | undefined  | (DO-7)     |
        //       - Language Workspace Folder  | undefined  | (DO-3)     | undefined  | undefined  |
        //       - Effective                  | null       | (DO-3)     | (DO-4)     | (DO-7)     |
        //     ------------------------------------------------------------------------------------
        //     
        await executor.setConfiguration({
            name:                  'leaper.decorationOptions',
            targetWorkspaceFolder: 'workspace-2',
            targetLanguage:        'typescript',
            value:                 undefined
        });

        // Check the effective configuration values for each text editor.
        await executor.assertEffectiveDecorationOptions({},   ViewColumn.One);
        await executor.assertEffectiveDecorationOptions(DO_3, ViewColumn.Two);
        await executor.assertEffectiveDecorationOptions(DO_4, ViewColumn.Three);
        await executor.assertEffectiveDecorationOptions(DO_7, ViewColumn.Four);
    }
});

/**
 * Just a cursory test to make sure that the deprecated configuration is being read.
 */
const DEPRECATED_CONFIGURATION_TEST_CASE = new TestCase({
    name: 'Deprecated Configuration: `leaper.customDecorationOptions`',
    prelude: async (executor) => {
        await executor.openFile('./workspace-0/text.ts');

        // Disable `leaper.decorationOptions` in the root workspace so that it does not shadow the 
        // deprecated configuration.
        await executor.setConfiguration({
            name:  'leaper.decorationOptions',
            value: undefined
        });
    },
    task: async (executor) => {

        // Set the deprecated configuration in the root workspace and check that the decoration 
        // options are in effect.
        const D1 = {
            outlineColor: "#BBFA03FF",
            outlineStyle: "inset",
            outlineWidth: "1px",
            fontWeight:   "bold"
        };
        await executor.setDeprecatedConfiguration({
            name:  'leaper.customDecorationOptions',
            value: D1
        });
        await executor.assertEffectiveDecorationOptions(D1);

        // Change the deprecated configuration and check that it is hot reloaded.
        const D2 = {
            outlineColor: "#BBFA03FF",
            outlineStyle: "inset",
            outlineWidth: "1px",
            fontWeight:   "bold"
        };
        await executor.setDeprecatedConfiguration({
            name:  'leaper.customDecorationOptions',
            value: D2
        });
        await executor.assertEffectiveDecorationOptions(D2);
    }
});


export const SINGLE_CURSOR_DECORATION_OPTIONS_TEST_GROUP = new TestGroup(
    '`leaper.decorationOptions` Configuration',
    [
        IS_BEING_READ_AND_THEME_COLOR_IDS_CORRECTLY_CONVERTED_TEST_CASE,
        REJECT_VALUE_IF_RANGE_BEHAVIOR_SPECIFIED_TEST_CASE,
        HOT_RELOAD_TEST_CASE,
        DEPRECATED_CONFIGURATION_TEST_CASE
    ]
);
