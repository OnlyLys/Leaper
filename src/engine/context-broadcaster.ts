import { commands } from 'vscode';
import { ImmediateReusable } from './tracker/immediate-reusable';

/**
 * Class used to broadcast [keybinding context] values to vscode.
 * 
 * # Efficiency
 * 
 * To reduce overhead, this class does three things.
 * 
 * First of all, context values are only broadcasted to vscode when they are different from the 
 * value that was most recently broadcasted. This eliminates any unnecessary broadcasts.
 * 
 * Secondly, context values are only broadcasted at the end of [event loop cycles]. This is done 
 * because vscode only processes context change requests once at the end of each event loop cycle. 
 * When vscode processes context change requests, it makes the last one received the effective one 
 * and discards any that have come before it. Thus, in a situation where in this extension, a context 
 * value has changed 5 times during one event loop cycle, we can cut down on the wasteful broadcasts
 * by only broadcasting the last one. 
 *
 * Thirdly, to facilitate the second point, the value to broadcast is only calculated (by calling 
 * the `getValue` callback) at the end of each event loop where a broadcast has been requested. This 
 * way, the context value does not have to be calculated multiple times in the event of multiple 
 * broadcast requests within an event loop cycle.
 * 
 * [keybinding context]: https://code.visualstudio.com/api/references/when-clause-contexts
 * [event loop cycles]: https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
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
    private readonly endOfLoopTimer = new ImmediateReusable(() => {
        const latestValue = this.getValue();
        if (latestValue !== this.prevBroadcasted) {
            commands.executeCommand('setContext', this.name, latestValue);
            this._prevBroadcasted = latestValue;
        }
    });

    /**
     * Note a broadcast is **not** automatically done upon instantiation. 
     * 
     * @param name The full name of the keybinding context.
     * @param getValue Callback used to calculate the value to broadcast.
     */
    public constructor(
        private readonly name: string,
        private getValue: () => boolean
    ) {}

    /** 
     * Request for a broadcast to occur at the end of the current event loop cycle. 
     */
    public requestBroadcast(): void {
        this.endOfLoopTimer.set();
    }

    /** 
     * Immediately broadcast `false`, then terminates this broadcaster instance. 
     */
    public dispose(): void {
        this.endOfLoopTimer.clear();
        commands.executeCommand('setContext', this.name, false);
        
        // So that future calls to `requestBroadcast` will no longer broadcast any more values.
        this.getValue = () => false;
        this._prevBroadcasted = false;
    }

}
