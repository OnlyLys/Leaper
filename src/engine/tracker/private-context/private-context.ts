import { Event } from 'vscode';

/**
 * A private keybinding context.
 * 
 * # Private vs Global Keybinding Contexts
 * 
 * Within this extension, there are two kinds of keybinding contexts: 
 * 
 *  - 'Private' keybinding contexts which exist for each visible text editor. Such keybinding 
 *    contexts are only a concept within this extension.
 * 
 *  - 'Global' keybinding contexts which are [the values used by vscode to determine whether 
 *    keybindings are active]. Each instance of vscode has only one set of values that are 
 *    effective at any time.
 * 
 * Since in this extension, the tracking of context values are done on a per visible text editor 
 * basis by assigning to each visible text editor its own `Tracker` instance, we do not want each
 * `Tracker` instance to have to modify its behavior based on whether its owning text editor is 
 * visible or not. Instead, we have architected it such that each `Tracker` instance assumes that 
 * its owning text editor is visible and in focus, and exposes the keybinding context values it 
 * thinks vscode should have to the main `Engine` instance. The keybinding contexts that each 
 * `Tracker` exposes to the `Engine` is called the 'private' keybinding contexts.
 * 
 * The main `Engine` instance of this extension is then responsible for actually broadcasting to 
 * vscode the keybinding context values of the text editor that is in focus. Keybinding context 
 * values broadcasted to vscode become the 'global' keybinding context value, and are the effective 
 * values considered by a vscode instance when determining whether certain keybindings are active or 
 * not. The main `Engine` instance always makes sure to synchronize the global keybinding context to 
 * the private keybinding context of the text editor that is in focus (i.e. the 'active' text editor), 
 * since that is the text editor that is expected to react to keypresses.
 * 
 * [the values used by vscode to determine whether keybindings are active]: https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
 */
export interface PrivateContext {

    /** 
     * Get the current value. 
     */
    get(): boolean;

    /** 
     * Subscribe to be notified when the value of this private context has been updated. 
     */
    readonly onDidUpdate: Event<undefined>;

}
