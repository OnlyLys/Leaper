'use strict';

import { workspace, DecorationRenderOptions, ThemeColor, window, WorkspaceConfiguration, DecorationRangeBehavior } from 'vscode';
import { EXT_IDENT } from './extension';

/** 
 * Class containing settings obtained from the default/global/workspace configuration. 
 * 
 * Settings obtained from the configuration are cached within this class, and it does not update on 
 * its own so the user has to retrieve the latest settings via the `getLatest()` when necessary.
 */
export class Settings {

    /* The pairs that will trigger tracking for the current language. */
    public readonly languageRule: ReadonlyArray<string> = getLanguageRule();

    /* The decoration options for the closing character of a pair. */
    public readonly decorationOptions: DecorationRenderOptions = getDecorationOptions();

    /* Flag for whether decoration should apply to only the most nested pair or all of them. */ 
    public readonly decorateOnlyNearestPair: boolean = getDecorateOnlyNearestPairFlag();

    private constructor() {}

    /**
     * Queries if the extension is enabled for the current language by checking if the language rule
     * is non-empty.
     * 
     * @return `true` if the extension is enabled for the current language. Otherwise `false`.
     */
    get isEnabled(): boolean {
        return this.languageRule.length > 0;
    }

    /**
     * Get the latest settings from the default/global/workspace configuration.
     *
     * @return An instance of `Settings` with the latest settings.
     */
    public static getLatest(): Settings {
        return new Settings();
    }

}

/** 
 * Get the pairs that will trigger tracking for the current language. The insertion of any of 
 * these pairs is constantly being watched for.
 * 
 * @return An array containing pairs in string form. These pairs are the 'trigger pairs'.
 */
function getLanguageRule(): ReadonlyArray<string> { 
    if (!window.activeTextEditor) {
        return [];
    }
    const languageRules: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}.languageRules`);
    const languageId: string = window.activeTextEditor.document.languageId;
    const languageSpecificRule: ReadonlyArray<string> | undefined = languageRules.get(`${languageId}`);
    const globalRule: ReadonlyArray<string> | undefined = languageRules.get(`*`);
    // If format is wrong then the rule will not be used
    return checkFormat(languageSpecificRule) ? languageSpecificRule : (checkFormat(globalRule) ? globalRule : []);

    function checkFormat(arr: ReadonlyArray<string> | undefined): arr is ReadonlyArray<string> {
        return Array.isArray(arr) && arr.every((pair) => typeof pair === 'string' && pair.length === 2);
    }
}

/** 
 * The default decoration is just an outline over the closing character. The colour is taken to be the 
 * same as the one used for bracket matching in the current theme. 
 */
const DEFAULT_DECORATION_OPTIONS: DecorationRenderOptions = {
    outlineColor: new ThemeColor('editorBracketMatch.border'),
    outlineWidth: '1px',
    outlineStyle: 'solid',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed
};

/** @return The decoration options for the closing character of a pair. */
function getDecorationOptions(): DecorationRenderOptions { 
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    const custom: DecorationRenderOptions | undefined = extensionConfig.get(`customDecorationOptions`);
    if (custom) {
        // We want the decoration to only stick to the closing character
        custom.rangeBehavior = DecorationRangeBehavior.ClosedClosed;
        return custom;
    }
    return DEFAULT_DECORATION_OPTIONS;   
}

/** @return The value of the `leaper.decorateOnlyNearestPair` contribution. */
function getDecorateOnlyNearestPairFlag(): boolean {
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    return extensionConfig.get(`decorateOnlyNearestPair`) === true;
}
