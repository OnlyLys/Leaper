import { DecorationRenderOptions, DecorationRangeBehavior, ThemeColor } from 'vscode';
import { VCDualReader } from '@onlylys/vscode-validated-configuration-reader';
import { Unchecked } from './unchecked';

/** 
 * A handle to the extension's configurations.
 */
export class Configurations { 

    /** 
     * The `leaper.decorateAll` configuration.
     * 
     * This configuration determines whether all pairs or just the ones nearest to each cursor are
     * decorated. 
     */
    public static readonly decorateAll = new VCDualReader({

        name:      'leaper.decorateAll',
        validate:  (value: unknown): value is boolean => typeof value === 'boolean',
        transform: (value: boolean) => value,

        deprName:      'leaper.decorateOnlyNearestPair',
        deprValidate:  (value: unknown): value is boolean => typeof value === 'boolean',
        deprTransform: (deprValue: boolean) => !deprValue,

    });

    /**
     * The `leaper.decorationOptions` configuration.
     * 
     * This configuration determines the style of the decorations applied.
     * 
     * SAFETY NOTE: The value of this configuration should not be directly accessed since it has not
     * been typechecked. It should only be passed to vscode as options for decoration.
     */
    public static readonly decorationOptions = new VCDualReader({

        name: 'leaper.decorationOptions',

        // Notes:
        //
        //   1. The type validation for this configuration is just a check to see if it is either an 
        //      object without a `rangeBehavior` property or `null` (see the next point for why we
        //      allow `null`), because the actual `DecorationRenderOptions` type has too many 
        //      properties to manually typecheck. New properties are always being added to that type 
        //      by vscode, so it is difficult for us to keep up with it. 
        //
        //   2. If the user wants to disable decorations, we require them to specify `null` instead 
        //      of an empty object because of a bug in vscode (as of version 1.58.0) where if a 
        //      configuration is set to `{}` in a workspace or workspace folder that previously did 
        //      not have a value for that configuration, the `{}` will be ignored.
        //
        validate: (v: unknown): v is Object | null => {
            return typeof v === 'object' && (v === null || !Reflect.has(v, 'rangeBehavior'));
        },

        transform: (v: Object | null): Unchecked<DecorationRenderOptions> => {

            // When the user specifies `null`, it means they want decorations disabled, so we just
            // convert `null` to an empty object. As for why we didn't just allow the user to specify 
            // `{}` in the first place, please see the note for the `validate` callback above.
            if (v === null) {
                v = {};
            }

            /**
             * Convert all theme color identifier strings to `ThemeColor` objects.
             *
             * For color properties, users are allowed to specify either a hex [RGB(A) value] string 
             * or a [theme color identifier] string. However, the vscode API requires a `ThemeColor` 
             * object when theme colors are specified. Thus, we have to go through the configuration 
             * value and convert every property that specifies a theme color identifer to a `ThemeColor`.
             * 
             * [RGB(A) value]: https://code.visualstudio.com/api/references/theme-color#color-formats
             * [theme color identifier]: https://code.visualstudio.com/api/references/vscode-api#ThemeColor
             */
            function convertColors(obj: Object): void {
                for (const key of Reflect.ownKeys(obj)) {
                    const value = Reflect.get(obj, key);
                    if (typeof value === 'object' && value !== null) {
                        convertColors(value); 
                    } else if (typeof key === 'string' && /[cC]olor$/.test(key) && typeof value === 'string') {

                        // If a string specifying a color starts with a `#`, we treat it as a hex
                        // RGB(A) value and leave it as is. Otherwise, we treat it as a theme color 
                        // identifier.
                        if (value.length === 0 || value[0] !== '#') {
                            Reflect.set(obj, key, new ThemeColor(value));
                        }
                    }
                }
            }
            convertColors(v);
            
            // This cast is safe because all we ever do with this configuration, aside from the color 
            // conversion we did above and the setting of the `rangeBehavior` we shall do below, is 
            // to pass it to vscode as options when decorating pairs. Thus, there is no risk from 
            // the object having an incorrect structure since we never access it as part of any 
            // computation.
            //
            // Still, instead of casting directly into a `DecorationRenderOptions`, we wrap the 
            // object in an `Unchecked` type as a reminder to the rest of the code that the value
            // contained within has not been typechecked.
            const decorationOptions = new Unchecked<DecorationRenderOptions>(v);

            // The decoration must be closed on both sides so that it will not expand when text is 
            // inserted next to it.
            decorationOptions.cast().rangeBehavior = DecorationRangeBehavior.ClosedClosed;

            return decorationOptions;
        },

        deprName: 'leaper.customDecorationOptions',
        
        // The behavior of the deprecated configuration is to pass the object specified by the user
        // as is to vscode. Thus, as long as the object is non-null, we accept it.
        // 
        // Note the null check is needed because `null` is an object in JS.
        deprValidate: (v: unknown): v is Object => typeof v === 'object' && v !== null,
    
        // To preserve behavior of the deprecated configuration, we do not convert the colors like 
        // we do for the new configuration. 
        //
        // Overall, we maintain the behavior we have always had, which is to keep every property 
        // except for `rangeBehavior` as is.
        deprTransform: (v: Object): Unchecked<DecorationRenderOptions> => {

            // Wrap the object in `Unchecked` as a reminder that the value has not been typechecked.
            const decorationOptions = new Unchecked<DecorationRenderOptions>(v);

            // This is something we have always enforced, since we never want the decorations to
            // expand when text is inserted next to them.
            decorationOptions.cast().rangeBehavior = DecorationRangeBehavior.ClosedClosed;

            return decorationOptions;
        }   

    });

    /**
     * The `leaper.detectedPairs` configuration.
     * 
     * This configuration determines which pairs are detected and then tracked. 
     * 
     * OPTIMIZATION NOTE: It might be tempting to replace the type of this configuration with a `Set`, 
     * but micro benchmarks (https://jsbench.me/5qkqg886lo/1) show that for small array sizes (such 
     * as the default value of this configuration), checking for inclusion is faster with an array 
     * than it is with a set.
     */
    public static readonly detectedPairs = new VCDualReader({

        name: 'leaper.detectedPairs',
        validate: (arr: unknown): arr is string[] => {
            return Array.isArray(arr) 
                && arr.length <= Configurations.DETECTED_PAIRS_MAX_ITEMS
                && arr.every(pair => typeof pair === 'string' && pair.length === 2)
                && arr.length === (new Set(arr)).size;  // Elements must be unique.
        },
        transform: (value: string[]) => value,

        deprName: 'leaper.additionalTriggerPairs',
        deprValidate: (arr: unknown): arr is { open: string, close: string }[] => {
            function checkElement(elem: any): elem is { open: string, close: string } {
                return typeof elem === 'object'
                    && elem !== null    // Need this because `null` is an object in JS.
                    && Reflect.ownKeys(elem).length === 2
                    && Reflect.has(elem, 'open')
                    && Reflect.has(elem, 'close')
                    && typeof elem.open  === 'string' 
                    && typeof elem.close === 'string'
                    && elem.open.length  === 1
                    && elem.close.length === 1;
            } 
            return Array.isArray(arr) 
                && arr.length <= Configurations.DETECTED_PAIRS_MAX_ITEMS
                && arr.every(checkElement);
        },
        deprTransform: (deprValue: { open: string, close: string }[]) => {

            // Prior to version 0.7.0, `leaper.additionalTriggerPairs` was the only way to configure
            // which pair was to be tracked. However, that configuration only allowed the user to 
            // specify _additional_ pairs to be tracked. There was a base set of pairs that could 
            // not be changed; This is that set.
            const BASE: ReadonlyArray<string> = [ "()", "[]", "{}", "<>", "``", "''", "\"\"" ];

            return BASE.concat(deprValue.map(({ open, close }) => `${open}${close}`));
        }

    });

    /**
     * The max number of pairs that can be specified for the `leaper.detectedPairs` configuration.
     * 
     * We limit the max number of pairs that can be specified for the `leaper.detectedPairs` 
     * configuration to prevent a malicious workspace from slowing down the extension by supplying
     * a huge array for that configuration. With this limit in place, it should be safe to enable 
     * the `leaper.detectedPairs` configuration in untrusted workspaces.
     */
    public static readonly DETECTED_PAIRS_MAX_ITEMS = 100;

}
