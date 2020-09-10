import { commands } from 'vscode';

/**
 * [`when` keybinding context].
 * 
 * # Laziness
 * 
 * Context values are lazily calculated via the `calc` callback provided in the constructor. 
 * 
 * Calculated context values are cached and will only be recalculated if either `get` or `broadcast`
 * are called when the `isStale` flag is `true`. 
 * 
 * # Internal and External Values
 * 
 * From the persepective of this extension, there are two values for a `when` keybinding context: 
 * 
 *  - An internal value that is only known within this extension.
 *  - An external value that is known to vscode.
 * 
 * There are two kinds of values becase context values broadcasted to vscode could take multiple 
 * event loop cycles before they are acknowledged. Furthermore, the context values in vscode cannot 
 * be retrieved by us. Therefore, the code in this extension can only rely on the internal value. 
 * The external value is only used to toggle keybindings.  
 * 
 * [`when` keybinding context]: https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
 */
export class WhenContext {

    /**
     * Cached value of this context.
     */
    private value: boolean;

    /** 
     * Flag to mark the current context value as stale.
     */
    public isStale: boolean;

    /**
     * @param name Full name of this `when` keybinding context.
     * @param calc Callback used to calculate the latest context value. 
     * @param init Initial value of the context. This value will also be broadcastest to vscode.
     */
    public constructor(
        private readonly name: string, 
        private readonly calc: () => boolean,
        init: boolean
    ) {
        this.value   = init;
        this.isStale = false;
        commands.executeCommand('setContext', this.name, init);
    }

    /**
     * Get the latest value of this `when` keybinding context.
     * 
     * If `isStale` is `true`, then calling this method recalculates the keybinding context with the 
     * `calc` callback specified in the constructor. 
     */
    public get(): boolean {
        if (this.isStale) {
            this.value   = this.calc();
            this.isStale = false;
        }
        return this.value;
    }

    /**
     * Broadcast the latest value of this `when` keybinding context to vscode.
     * 
     * If `isStale` is `true`, then calling this method recalculates the keybinding context with the 
     * `calc` callback specified in the constructor. 
     */
    public broadcast(): void {
        commands.executeCommand('setContext', this.name, this.get());
    }

    /** 
     * Set the context value and `isStale` flag to `false`.
     * 
     * This falsy value is immediately broadcasted.
     */
    public clear(): void {
        this.value   = false;
        this.isStale = false;
        commands.executeCommand('setContext', this.name, false);
    }

}