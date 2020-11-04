import { DecorationRenderOptions, DecorationRangeBehavior, ConfigurationScope } from 'vscode';
import { VCDualReader } from '@onlylys/vscode-validated-configuration-reader';

/** 
 * A snapshot of this extension's configuration values. 
 * 
 * This value is not live, meaning any changes to the configuration values by the user will not be
 * reflected in each instance of this class. To get the latest values, call the `read()` factory 
 * function.
 */
export class Configuration { 

    /** 
     * Whether decorations should be applied to all pairs or just the ones nearest to each cursor.
     */
    public readonly decorateAll: boolean;

    /** 
     * Which pairs should be detected and tracked. 
     */
    public readonly detectedPairs: ReadonlyArray<string>;

    /** 
     * Decoration style for the closing side of pairs. 
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
        normalize:    (deprValue) => !deprValue,

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
        normalize:   (deprValue) => {

            // Prior to version 0.7.0, `leaper.additionalTriggerPairs` was the only way to configure
            // which pair was to be tracked. However, that configuration only allowed the user to 
            // specify _additional_ pairs to be tracked. There was a base set of pairs that could 
            // not be changed; This is that set.
            const BASE: ReadonlyArray<string> = [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ];

            return BASE.concat(deprValue.map(({ open, close }) => `${open}${close}`));
        }

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

    private constructor(scope?: ConfigurationScope) {

        // The `read()` calls here may throw if an effective value cannot be calculated. 
        this.decorateAll        = Configuration.decorateAllReader.read(scope).effectiveValue;
        this.detectedPairs      = Configuration.detectedPairsReader.read(scope).effectiveValue;
        this.decorationOptions  = Configuration.decorationOptionsReader.read(scope).effectiveValue; 

        // Override the range behavior of the decoration such that it is closed on both sides.
        //
        // We have to do this because we don't want the decoration of the closing pair to expand
        // when inserting text next to it.
        this.decorationOptions.rangeBehavior = DecorationRangeBehavior.ClosedClosed;
    }

    /** 
     * Get the current configuration values. 
     * 
     * @param scope The scope to read configuration values from. If `undefined`, will use the 
     *              default scope (which is usually the active text editor).
     * @throws Will throw if any of the configurations cannot be read.
     */
    public static read(scope?: ConfigurationScope): Configuration {
        return new Configuration(scope);
    }

}
