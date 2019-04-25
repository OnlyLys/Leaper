import { DecorationRenderOptions, DecorationRangeBehavior } from 'vscode';
import { ConfigurationHandler, ConfigurationHandlerCompat } from '@onlylys/vscode-configuration-handler';

/** Class containing a readonly snapshot of the configuration values of this extension. */
export class Configuration { 

    /** Flag for whether decoration should apply to all pairs instead of the most nested one only. */
    public readonly decorateAll: boolean;

    /** What pairs we should detect and track. */
    public readonly detectedPairs: ReadonlyArray<string>;

    /** Decoration style for the closing character of each tracked pair. */
    public readonly decorationOptions: Readonly<DecorationRenderOptions>;

    /** Flag for whether the user should be warned when deprecated configurations are being used. */
    public readonly neverWarnDeprecated: boolean;

    private constructor() {
        // Each handler's `.get()` method call here may throw if default value is bad
        this.decorateAll         = decorateAllHandler.get().effectiveValue;
        this.detectedPairs       = detectedPairsHandler.get().effectiveValue;
        const decorationOptions  = decorationOptionsHandler.get().effectiveValue;
        /* The range behavior must be closed on both sides since we don't want the decoration to
        expand when inserting text adjacent to it. */
        decorationOptions.rangeBehavior = DecorationRangeBehavior.ClosedClosed;
        this.decorationOptions   = decorationOptions;
        this.neverWarnDeprecated = neverWarnDeprecatedHandler.get().effectiveValue;
    }

    /** 
     * Get the latest configuration values. 
     * 
     * @throws Will throw `ConfigurationBadDefaultError` if any of the configurations have a bad
     *         default values.
     */
    public static get(): Configuration {
        return new Configuration();
    }

    /** 
     * `true` if there are currently any deprecated configurations being used†. Otherwise `false`.
     * 
     * †By 'being used', we mean having non-default values for the configuration.
     */
    public get hasDeprUse(): boolean {
        /* Even though the `.hasUserDefinedDeprValues()` callsd may throw, we are sure that since we
        called the handlers's `.get()` methods in the constructor of this class that the default 
        values of all the configurations are valid, and thus the `hasUserDefinedDeprValues()` calls 
        here will not throw. */
        return decorateAllHandler.hasUserDefinedDeprValues() 
            || detectedPairsHandler.hasUserDefinedDeprValues()
            || decorationOptionsHandler.hasUserDefinedDeprValues();
    }

    /**
     * Migrate all configuration values. 
     * 
     * @return A promise that resolves to the latest configuration values upon migration completion.
     */
    public async migrate(): Promise<Configuration> {
        await decorateAllHandler.migrate();
        await detectedPairsHandler.migrate();
        await decorationOptionsHandler.migrate();
        return Configuration.get();
    }
    
}

/** Handler to the `leaper.detectedPairs` configuration. */
export const detectedPairsHandler = new ConfigurationHandlerCompat({
    name: `leaper.detectedPairs`,
    typecheck: (arr: any): arr is ReadonlyArray<string> => {
        return Array.isArray(arr) && arr.every(pair => typeof pair === 'string' && pair.length === 2);
    },
    deprName: `leaper.additionalTriggerPairs`,
    deprTypecheck: (arr: any): arr is ReadonlyArray<Readonly<{ open: string, close: string }>> => {
        return Array.isArray(arr) && arr.every((elem: any) => elemTypeGuard(elem));
        function elemTypeGuard(val: any): val is { open: string, close: string } {
            return typeof val === 'object'
                && Reflect.ownKeys(val).length === 2
                && typeof val.open  === 'string' 
                && typeof val.close === 'string'
                && val.open.length  === 1
                && val.close.length === 1;
        } 
    },
    normalize: deprValue => deprValue.map(({ open, close }) => `${open}${close}`)
});

/** Handler to the `leaper.decorateAll` configuration. */
export const decorateAllHandler = new ConfigurationHandlerCompat({
    name: `leaper.decorateAll`,
    typecheck: (value: any): value is boolean => typeof value === 'boolean',
    deprName: `leaper.decorateOnlyNearestPair`,
    deprTypecheck: (value: any): value is boolean => typeof value === 'boolean',
    normalize: deprValue => !deprValue
});

/** 
 * Handler to the `leaper.decorationOptions` configuration. 
 * 
 * Note that the typecheck for this configuration is just an object check because the actual type is
 * too always evolving (as it is part of the VS Code API) and is very complex due to having many 
 * properties.
 */
export const decorationOptionsHandler = new ConfigurationHandlerCompat({
    name: `leaper.decorationOptions`,
    typecheck: (value: any): value is DecorationRenderOptions => typeof value === 'object',
    deprName: `leaper.customDecorationOptions`,
    deprTypecheck: (value: any): value is DecorationRenderOptions => typeof value === 'object',
    normalize: value => value
});

/** 
 * Handler to the `leaper.neverWarnDeprecated` configuration which determines if we warn the user for
 * deprecated configuration use.
 */
export const neverWarnDeprecatedHandler = new ConfigurationHandler({
    name: `leaper.neverWarnDeprecated`,
    typecheck: (value: any): value is boolean => typeof value === 'boolean'
});
    