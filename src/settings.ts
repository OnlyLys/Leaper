'use strict';

import { workspace, DecorationRenderOptions, ThemeColor, window, WorkspaceConfiguration } from 'vscode';
import { EXT_IDENT } from './controller';

/** 
 * Class containing settings obtained from the default/global/workspace configuration. 
 * 
 * Settings obtained from the configuration are cached within each instance, and it does not update 
 * on its own so the user has manually call `update()` when necessary.
 */
export class Settings {

    /** 
     * The pairs that will trigger tracking for the current language. The insertion of any of these 
     * pairs is constantly being watched for by the extension. These are also known as the trigger 
     * pairs.
     */
    private _languageRule: ReadonlyArray<string> = getLanguageRule();
    get languageRule(): ReadonlyArray<string> {
        return this._languageRule;
    }

    /* The decoration options for the closing character of a pair. */
    private _decorationOptions: DecorationRenderOptions = getDecorationOptions();
    get decorationOptions(): Readonly<DecorationRenderOptions> {
        return this._decorationOptions;
    }

    /* Flag for whether decoration should apply to only the most nested pair or all of them. */ 
    private _decorateOnlyNearestPairFlag: boolean = getDecorateOnlyNearestPairFlag();
    get decorateOnlyNearestPair(): Readonly<boolean> {
        return this._decorateOnlyNearestPairFlag;
    }

    /**
     * Queries if the extension is enabled for the current language by checking if the language rule
     * is non-empty.
     * 
     * @return `true` only if the extension is enabled for the current language.
     */
    public get isEnabled(): boolean {
        return this.languageRule.length > 0;
    }

    private constructor() {}

    /** @return Obtain an instance of `Settings` with the latest values. */
    public static load(): Settings {
        return new Settings();
    }

    /** Update to the latest settings obtained from the default/global/workspace configuration. */
    public update(): void {
        this._languageRule = getLanguageRule();
        this._decorationOptions = getDecorationOptions();
        this._decorateOnlyNearestPairFlag = getDecorateOnlyNearestPairFlag();
    }

}

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

const DEFAULT_DECORATION_OPTIONS: DecorationRenderOptions = {
    outlineColor: new ThemeColor('editorBracketMatch.border'),
    outlineWidth: '1px',
    outlineStyle: 'solid',
};

function getDecorationOptions(): DecorationRenderOptions { 
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    const custom: DecorationRenderOptions | undefined = extensionConfig.get(`customDecorationOptions`);
    if (custom) {
        return custom;
    }
    return DEFAULT_DECORATION_OPTIONS;   
}

function getDecorateOnlyNearestPairFlag(): boolean {
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    return extensionConfig.get(`decorateOnlyNearestPair`) === true;
}
