/**
 * Private [`when` keybinding context].
 * 
 * # Laziness
 * 
 * Context values are lazily updated via the `calc` callback provided in the constructor. 
 * 
 * Calculated values are cached and will only be recalculated if `get` is called on a context value
 * that was marked stale.
 * 
 * An existing context value can be marked as stale by calling `markStale`. 
 * 
 * # 'Private' vs 'Global' 
 * 
 * From the persepective of this extension, there are two values for a keybinding context.
 * 
 * ## Private Keybinding Context
 * 
 * Each `Tracker` (and therefore each owning editor) has its own private value for any given 
 * keybinding context. This class is a representation of that private value. 
 * 
 * The current private value can be obtained via the `get` method. 
 * 
 * ## Global Keybinding Context
 * 
 * All `Tracker`s share the same global value for the same keybinding context. 
 * 
 * A global value is a value that was most recently broadcasted to and acknowledged by vscode, and 
 * is what is used by vscode to determine if a keybinding is active or not. Only the active text 
 * editor (and therefore active `Tracker`) has its context values be broadcasted to vscode. 
 * 
 * An analogy can be drawn to multi-threading on PCs. Each thread can have its own values for what
 * should go onto the CPU registers, but only the active thread has its values loaded onto the CPU 
 * registers.
 * 
 * Note that this class does not handle the broadcasting of global context values. And note that 
 * while global values can be broadcasted to vscode, they cannot be retrieved. 
 * 
 * [`when` keybinding context]: https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
 */
export class PrivateKeybindingContext {

    /**
     * The cached value.
     */
    private cached: boolean;

    /**
     * Whether the cached value is stale.
     */
    private stale: boolean;

    /**
     * Callback used to calculate the latest value.
     */
    private calc: () => boolean;

    /**
     * @param init The initial value to give the context.
     * @param calc Callback used to calculate the latest context value. 
     */
    public constructor(
        init: boolean, 
        calc: () => boolean
    ) {
        this.cached   = init;
        this.stale    = false;
        this.calc     = calc;        
    }

    /**
     * Mark the cached value as stale.
     * 
     * This will cause a recalculation to occur when `get` is next called.
     */
    public markStale(): void {
        this.stale = true;
    }

    /**
     * Get the latest value.
     * 
     * A recalculation will occur if the cached value was marked as stale.
     */
    public get(): boolean {
        if (this.stale) {
            this.cached = this.calc();
            this.stale  = false;
        }
        return this.cached;
    }

    /**
     * Set the value to `false`, and disable further recalculations.
     * 
     * Further calls to `get` after this method is called will always yield `false`.
     */
    public dispose(): void {
        this.calc   = () => false;
        this.cached = false;
        this.stale  = false;
    }

}
