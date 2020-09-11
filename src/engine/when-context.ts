import { commands } from 'vscode';

/**
 * [`when` keybinding context].
 * 
 * # Laziness
 * 
 * Context values are lazily calculated via the `calc` callback provided in the constructor. 
 * 
 * Calculated values are cached and will only be recalculated if either `get` or `syncExternal` are 
 * called when the `isStale` flag is `true`. 
 * 
 * # Internal and External Values
 * 
 * From the persepective of this extension, there are two values for a `when` keybinding context: 
 * 
 *  - An internal value that is only known within this extension. 
 *  - An external value that is known to vscode.
 * 
 * External values have to be broadcasted to vscode using the `'setContext'` command, and could take 
 * multiple event loop cycles before they are acknowledged. Furthermore, external values cannot be 
 * directly retrieved, and are only implicitly known based on side effects like whether certain 
 * keybindings were able to be triggered by the user. 
 * 
 * For the aforementioned reasons, the code path in this extension relies entirely on the internal
 * value. The external value is only used to toggle keybindings.
 * 
 * [`when` keybinding context]: https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
 */
export class WhenContext {

    /**
     * Cached value of this context.
     */
    private value: boolean = false;

    /** 
     * Flag to mark the cached context value as stale.
     */
    public isStale: boolean = false;

    /**
     * The most recent value broadcasted to vscode in `syncExternal`.
     * 
     * This is used to cut down on the number of broadcasts we have to do in `syncExternal`.
     */
    private mostRecentlyBroadcasted: boolean = false;

    /**
     * @param name Full name of this `when` keybinding context.
     * @param calc Callback used to calculate the latest context value. 
     * 
     * The context value is initialised to `false`, and this value is immediately broadcasted.
     */
    public constructor(
        private readonly name: string, 
        private readonly calc: () => boolean,
    ) {
        commands.executeCommand('setContext', this.name, false);
    }

    /**
     * Get the latest value of this keybinding context.
     * 
     * # Laziness
     * 
     * This method only recalculates a new value for the keybinding context if the `isStale` flag 
     * is `true`. Otherwise the previously cached value is used.
     */
    public get(): boolean {
        if (this.isStale) {
            const newValue = this.calc();
            this.value     = newValue;
            this.isStale   = false;
        }
        return this.value;
    }

    /**
     * Synchronize the latest value of this keybinding context to vscode.
     * 
     * # Laziness
     * 
     * This method only recalculates a new value for the keybinding context if the `isStale` flag 
     * is `true`.
     * 
     * Furthermore, this method only broadcasts a value if it is different from the most recently 
     * broadcasted value. 
     */
    public syncExternal(): void {
        const value = this.get();
        if (value !== this.mostRecentlyBroadcasted) {
            this.mostRecentlyBroadcasted = value;
            commands.executeCommand('setContext', this.name, value);
        }
    }

    /** 
     * Set the context value and `isStale` flag to `false`.
     * 
     * This falsy value is immediately broadcasted.
     */
    public clear(): void {
        this.value                   = false;
        this.isStale                 = false;
        this.mostRecentlyBroadcasted = false;
        commands.executeCommand('setContext', this.name, false);
    }

}