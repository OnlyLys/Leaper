import { commands } from 'vscode';

/**
 * Type used to set [keybinding contexts].
 * 
 * [keybinding contexts]: https://code.visualstudio.com/api/references/when-clause-contexts
 */
export class KeybindingContextSetter<T> {

    private _mostRecent: T;

    /** 
     * The value that this keybinding context was most recently set to.
     */
    public get mostRecent(): T {
        return this._mostRecent;
    }

    /**
     * @param name The full name of the keybinding context.
     * @param init Initial value to set the keybinding context to.
     */
    public constructor(
        private readonly name: string,
        init: T
    ) {
        commands.executeCommand('setContext', this.name, init);
        this._mostRecent = init;
    }

    /** 
     * Set the keybinding context to `t`.
     * 
     * Note that the new keybinding context value might not take effect immediately, because vscode
     * processes requests to change keybinding contexts asynchronously.
     */
    public set(t: T): void {

        // For efficiency purposes, we only make a request to change the keybinding context when the 
        // new value is different from the previous one.
        if (t !== this._mostRecent) {
            commands.executeCommand('setContext', this.name, t);
            this._mostRecent = t;
        }
    }
    
}
