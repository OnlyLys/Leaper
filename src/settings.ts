'use strict';

import { workspace, DecorationRenderOptions, ThemeColor, WorkspaceConfiguration, window, DecorationRangeBehavior } from 'vscode';
import { EXT_NAME, EXT_IDENT } from './controller';

/** 
 * Class containing settings obtained from the default/global/workspace configuration. 
 * 
 * Settings obtained from the configuration are cached within each instance, and it does not update 
 * on its own so the user has manually call `update()` when necessary.
 */
export class Settings {

    /** 
     * The pairs that will trigger tracking. Insertion of any of these pairs will constantly be 
     * watched for by the extension.
     */
    private _triggerPairs: { open: string, close: string }[] = getTriggerPairs();
    get triggerPairs(): ReadonlyArray<{ open: string, close: string }> {
        return this._triggerPairs;
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

    private constructor() {}

    /** @return An instance of `Settings` with the latest values. */
    public static load(): Settings {
        return new Settings();
    }

    /** Update to the latest settings obtained from the default/global/workspace configuration. */
    public update(): void {
        this._triggerPairs = getTriggerPairs();
        this._decorationOptions = getDecorationOptions();
        this._decorateOnlyNearestPairFlag = getDecorateOnlyNearestPairFlag();
    }

}

const DEFAULT_TRIGGER_PAIRS: { open: string, close: string }[] = [
    { "open": "(", "close": ")" },
    { "open": "[", "close": "]" },
    { "open": "{", "close": "}" },
    { "open": "<", "close": ">" },
    { "open": "`", "close": "`" },
    { "open": "'", "close": "'" },
    { "open": "\"", "close": "\"" }
];

function getTriggerPairs(): { open: string, close: string }[] { 
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    const additionalPairs: any = extensionConfig.get('additionalTriggerPairs');
    return checkFormat(additionalPairs) ? DEFAULT_TRIGGER_PAIRS.concat(additionalPairs) : DEFAULT_TRIGGER_PAIRS;

    function checkFormat(arr: any): arr is { open: string, close: string }[] {
        if (!Array.isArray(arr) || arr.some(p => typeof p.open !== 'string' || typeof p.close !== 'string')) {
            window.showWarningMessage(`
                [${EXT_NAME}] Incorrect format specified for 'leaper.additionalTriggerPairs'!`
            );
            return false;
        } else if (arr.some(p => p.open.length !== 1 || p.close.length !== 1)) {
            window.showWarningMessage(
                `[${EXT_NAME}] There is no support pairs that are more than 1 character wide on each \
                side! Please fix the 'leaper.additionalTriggerPairs' setting!`
            );
            return false;
        } else {
            return true;
        }
    }
}

const DEFAULT_DECORATION_OPTIONS: DecorationRenderOptions = {
    outlineColor: new ThemeColor('editorBracketMatch.border'),
    outlineWidth: '1px',
    outlineStyle: 'solid',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed
};

function getDecorationOptions(): DecorationRenderOptions { 
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    const custom: DecorationRenderOptions | undefined = extensionConfig.get(`customDecorationOptions`);
    if (custom) {
        // Range behavior closed so that decoration doesn't expand when inserting text to the left of it
        custom['rangeBehavior'] = DecorationRangeBehavior.ClosedClosed;
        return custom;
    }
    return DEFAULT_DECORATION_OPTIONS;   
}

function getDecorateOnlyNearestPairFlag(): boolean {
    const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration(`${EXT_IDENT}`);
    return extensionConfig.get(`decorateOnlyNearestPair`) === true;
}
