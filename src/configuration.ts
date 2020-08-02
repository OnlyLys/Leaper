import { DecorationRenderOptions, DecorationRangeBehavior } from 'vscode';
import { VCDualReader, } from '@onlylys/vscode-validated-configuration-reader';

/** A snapshot of this extension's configuration values. */
export class Configuration { 

    /** 
     * Whether decorations should apply to all pairs instead of only just the most nested one. 
     * 
     * This supercedes the old `decorateOnlyNearestPair` configuration.
     */
    public readonly decorateAll: boolean;

    /** 
     * What pairs should be detected and then tracked. 
     * 
     * This supercedes the old `decorateOnlyNearestPair` configuration.
     */
    public readonly detectedPairs: string[];

    /** 
     * Decoration style for the closing side of pairs. 
     * 
     * This supercedes the old `customDecorationOptions` configuration.
     */
    public readonly decorationOptions: DecorationRenderOptions;

    /** 
     * Binding to the `decorateAll` configuration to read its value. 
     * 
     * This also reads the deprecated `decorateOnlyNearestPair` configuration.
     */
    public static readonly decorateAllReader = new VCDualReader({

        name:     `leaper.decorateAll`,
        validate: (value: any): value is boolean => typeof value === 'boolean',

        deprName:     `leaper.decorateOnlyNearestPair`,
        deprValidate: (value: any): value is boolean => typeof value === 'boolean',
        normalize:    deprValue => !deprValue,

    });
    
    /** 
     * Binding to the `detectedPairs` configuration to read its value. 
     * 
     * This also reads the deprecated `additionalTriggerPairs` configuration.
     */
    public static readonly detectedPairsReader = new VCDualReader({

        name:     `leaper.detectedPairs`,
        validate: (arr: any): arr is string[] => {
            return Array.isArray(arr) && arr.every(p => typeof p === 'string' && p.length === 2);
        },

        deprName:     `leaper.additionalTriggerPairs`,
        deprValidate: (arr: any): arr is { open: string, close: string }[] => {
            return Array.isArray(arr) && arr.every((elem: any) => elemTypeGuard(elem));
            function elemTypeGuard(elem: any): elem is { open: string, close: string } {
                return typeof elem === 'object'
                    && Reflect.ownKeys(elem).length === 2
                    && typeof elem.open  === 'string' 
                    && typeof elem.close === 'string'
                    && elem.open.length  === 1
                    && elem.close.length === 1;
            } 
        },
        normalize:   deprValue => deprValue.map(({ open, close }) => `${open}${close}`)

    });
    
    /** 
     * Binding to the `decorationOptions` configuration to read its value. 
     * 
     * This also reads the deprecated `customDecorationOptions` configuration.
     */
    public static readonly decorationOptionsReader = new VCDualReader({

        // Note that the type validation for this configuration is just a check to see if it's an 
        // `Object` type because the actual type has too many properties to manually typecheck, and 
        // furthermore is always evolving, as it is part of the VS Code API.
        // 
        // Perhaps in the future I can create a script that will automatically generate the 
        // typechecking code.
        name:     `leaper.decorationOptions`,
        validate: (v: any): v is DecorationRenderOptions => typeof v === 'object',

        // The new configuration above is just a rename of this deprecated configuration.
        deprName:     `leaper.customDecorationOptions`,
        deprValidate: (v: any): v is DecorationRenderOptions => typeof v === 'object',
        normalize:    value => value

    });

    private constructor() {

        // The `read()` calls here may throw if an effective value cannot be calculated. 
        this.decorateAll        = Configuration.decorateAllReader.read().effectiveValue;
        this.detectedPairs      = Configuration.detectedPairsReader.read().effectiveValue;
        this.decorationOptions  = Configuration.decorationOptionsReader.read().effectiveValue; 

        // Override the range behavior of the decoration such that it is closed on both sides.
        //
        // We have to do this because we don't want the decoration of the closing pair to expand
        // when inserting text next to it.
        this.decorationOptions.rangeBehavior = DecorationRangeBehavior.ClosedClosed;

    }

    /** 
     * Get the current configuration values. 
     * 
     * @throws Will throw if any of the configurations can't be read.
     */
    public static read(): Configuration {
        return new Configuration();
    }

}
