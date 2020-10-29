import { Event } from "vscode";

/**
 * Private [`when` keybinding context].
 * 
 * # Listening to Updates
 * 
 * Listeners can be notified of any updates in the context value through the `onDidUpdate` method.
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
 * is what is used by vscode to determine if a keybinding is active or not. 
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
export interface PrivateContext {

    /**
     * Get the current context value.
     */
    get(): boolean;

    /**
     * Subscribe to be notified when this context value is updated.
     */
    readonly onDidUpdate: Event<undefined>;

}