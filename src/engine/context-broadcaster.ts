import { commands } from 'vscode';
import { ImmediateReusable } from './tracker/immediate-reusable';

/**
 * Class used to broadcast keybinding context values to vscode.
 * 
 * Note that keybinding contexts are only obtained and broadcasted at the end of event loop cycles.
 * 
 * # Why We Only Broadcast Keybinding Contexts at the End of Event Loop Cycles
 * 
 * For keybinding contexts broadcasted to vscode (i.e. global keybinding contexts), we only broadcast 
 * them the end of event loop cycles since broadcasts received by vscode are only acknowledged during 
 * subsequent event loop cycles.
 * 
 * For instance, consider a situation where a context value has changed 5 times during one event loop 
 * cycle. Had we broadcasted after each change, then that would have placed 5 context change commands 
 * into vscode's event queue. However, when it comes time for vscode to process the commands, only 
 * the last context value broadcasted matters, since it is the one that ends up being the effective 
 * value anyways. 
 *
 * Therefore, by delaying broadcasts until the end of event loop cycles we can reduce the number of 
 * broadcasts we have to do. 
 * 
 * # Laziness
 * 
 * Another thing that we do to reduce the overhead of our extension is to only broadcast context
 * values when they are different from the context values that we most recently broadcasted.
 */
export class ContextBroadcaster {

    private _prevBroadcasted: boolean | undefined;

    /**
     * The context value that was most recently broadcasted.
     */
    public get prevBroadcasted(): boolean | undefined {
        return this._prevBroadcasted;
    }

    /**
     * Timer to broadcast at the end of the current event loop cycle.
     */
    private endOfLoopTimer = new ImmediateReusable(() => {
        
        // Only broadcast a value if it was different from what we previously broadcasted.
        const newValue = this.getValue();
        if (newValue !== this.prevBroadcasted) {
            this.broadcast(newValue);
        }
    });

    /**
     * The context value is **not** broadcasted in this constructor.
     * 
     * @param name The full name of the keybinding context.
     * @param getValue Callback used to get the latest value of the keybinding context.
     */
    public constructor(
        private readonly name: string,
        private getValue: () => boolean
    ) {
        this.getValue = getValue;
    }

    /**
     * Immediately broadcast a context value to vscode. 
     */    
    private broadcast(value: boolean): void {
        commands.executeCommand('setContext', this.name, value);
        this._prevBroadcasted = value;
    }

    /**
     * Set this broadcaster to broadcast at the end of the current event loop cycle.
     */
    public set(): void {
        this.endOfLoopTimer.set();
    }

    /**
     * Disable the keybinding context by **immediately** broadcasting `false`.
     * 
     * This broadcaster is then terminated, disabling it from any further use.
     */
    public dispose(): void {
        this.broadcast(false);

        // So that future calls to `endOfLoopTimer.set()` will no longer broadcast any more values.
        this.getValue = () => false;
    }

}
