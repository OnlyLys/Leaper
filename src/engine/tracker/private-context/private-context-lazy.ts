import { Event, EventEmitter } from 'vscode';
import { PrivateContext } from './private-context';

/**
 * An implementation of the `PrivateContext` interface that lazily calculates the context value.
 * 
 * The context value is only recalculated when the `get` method is called on a private context that
 * was marked as stale.
 */
export class PrivateContextLazy implements PrivateContext {

    /**
     * The most recently calculated value.
     * 
     * The `stale` flag determines if the context value requires recalculation.
     */
    private readonly cached: { stale: boolean, value: boolean };

    /**
     * Emitter to inform listeners that this context has been updated.
     * 
     * For more info, please see the `onDidUpdate` method.
     */
    private readonly onDidUpdateEventEmitter = new EventEmitter<undefined>();

    /**
     * @param init The initial value to give the context.
     * @param calc Callback used to calculate the latest context value. 
     */
    public constructor(
        init: boolean, 
        private calc: () => boolean
    ) {
        this.cached = { stale: false, value: init };
    }

    /**
     * Mark the cached value as stale.
     * 
     * Calling this method will cause:
     * 
     *  1. Subscribers of `onDidUpdate` to be notified. 
     *  2. A recalculation to occur when `get` is next called.
     */
    public markStale(): void {
        this.cached.stale = true;
        this.onDidUpdateEventEmitter.fire(undefined);
    }

    /**
     * Get the latest value of this keybinding context.
     * 
     * A recalculation will occur if the cached value was marked as stale.
     */
    public get(): boolean {
        if (this.cached.stale) {
            this.cached.value = this.calc();
            this.cached.stale = false;
        }
        return this.cached.value;
    }

    /**
     * Subscribe to be notified when this keybinding context has been updated.
     * 
     * Note that because the context value is lazily calculated, this event actually fires when the
     * keybinding context has been marked stale, and not when it has been recalculated. 
     */
    public get onDidUpdate(): Event<undefined> {
        return this.onDidUpdateEventEmitter.event;
    }

    /**
     * Permanently set the context value to `false` and terminate the `onDidUpdate` event emitter.
     */
    public dispose(): void {
        this.calc         = () => false;
        this.cached.value = false;
        this.cached.stale = false;
        this.onDidUpdateEventEmitter.dispose();
    }

}
