import { commands } from 'vscode';

/**
 * [`when` keybinding context].
 * 
 * # Laziness
 * 
 * Context values are lazily calculated via the `calc` callback provided in the constructor. 
 * 
 * Calculated values are cached and will only be recalculated if either `get` or `broadcast` are
 * called when the existing context value is stale. 
 * 
 * An existing context value can be marked as stale by calling `markStale`. 
 * 
 * # Private and Global Values
 * 
 * From the persepective of this class, there are two values for a `when` keybinding context.
 * 
 * Firstly, there is the private value. Each instance of this class has its own private value for 
 * the same keybinding context. The current private value can be obtained via the `get` method. 
 * 
 * Then, there is the global value. All instances of this class for the same keybinding context 
 * share the same global value. This is the value that is broadcasted to and acknowledged by vscode,
 * and is the value is that is used by vscode to determine if a keybinding is active or not.
 * 
 * Note that while the global value can be broadcasted to vscode, it cannot be retrieved. 
 * 
 * [`when` keybinding context]: https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
 */
export class WhenContext {

    /**
     * Cached value of this context.
     */
    private value: boolean = false;

    /** 
     * Whether the cached context value is stale.
     * 
     * This is used to cut down on the number of recalculations we have to do, as those could be
     * expensive.
     */
    private isStale: boolean = false;

    /**
     * @param name Full name of this `when` keybinding context.
     * @param calc Callback used to calculate the latest context value. 
     * 
     * Note that the context value is always initialised to `false`, and this value is immediately 
     * broadcasted in the constructor of this class.
     */
    public constructor(
        private readonly name: string, 
        private readonly calc: () => boolean,
    ) {
        commands.executeCommand('setContext', this.name, false);
    }

    /**
     * Mark the context value as stale so that its value will be recalculated when `get` or 
     * `broadcast` is next called.
     */
    public markStale(): void {
        this.isStale = true;
    }

    /**
     * Get the private value of this keybinding context.
     * 
     * # Laziness
     * 
     * This method only recalculates a new value for the keybinding context if the existing value is
     * stale.
     */
    public get(): boolean {
        if (this.isStale) {
            this.value   = this.calc();
            this.isStale = false;
        }
        return this.value;
    }

    /**
     * Broadcast the latest value of this keybinding context to vscode.
     * 
     * # Laziness
     * 
     * This method only recalculates a new value for the keybinding context if the existing value
     * is stale.
     * 
     * # Delay in Acknowledgement
     * 
     * Note that it may take multiple event loop cycles before the broadcasted value is acknowledged
     * by vscode.
     */
    public broadcast(): void {
        commands.executeCommand('setContext', this.name, this.get());
    }

    /** 
     * Set the context value to `false`.
     * 
     * This falsy value is immediately broadcasted.
     */
    public clear(): void {
        this.value   = false;
        this.isStale = false;
        commands.executeCommand('setContext', this.name, false);
    }

}