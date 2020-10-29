import { Event, EventEmitter } from 'vscode';
import { PrivateContext } from './private-context';

/**
 * An implementation of the `PrivateContext` interface that lazily calculates context values.
 * 
 * # Laziness
 * 
 * Context values are lazily updated via the `calc` callback provided in the constructor. 
 * 
 * Calculated values are cached and will only be recalculated if `get` is called on a context value
 * that was marked stale.
 * 
 * An existing context value can be marked as stale by calling `markStale`. 
 */
export class PrivateContextLazy implements PrivateContext {

    /**
     * The cached value.
     * 
     * The `stale` flag determines if the context value requires recalculation.
     */
    private readonly cached: { stale: boolean, value: boolean };

    /**
     * Emitter to inform listeners this context value has been updated.
     * 
     * Note that because context values are lazily recalculated, we actually emit this event when 
     * the context values have been marked as stale, and not when they have been recalculated. 
     * 
     * However, that should not create any problems, since the laziness in recalculating context 
     * values is transparent to users who are seeing this class through the `PrivateContext` 
     * interface.
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
     * Get the latest value.
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
     * Subscribe to be notified when this context value is updated.
     * 
     * Note that because this class lazily calculates context values, we consider the context value
     * updated when `markStale` is called. The actual value being calculated on-demand does not 
     * change the fact that the context value has effectively changed for users of this class.
     */
    public get onDidUpdate(): Event<undefined> {
        return this.onDidUpdateEventEmitter.event;
    }

    /**
     * Permanently set the context value to `false`.
     * 
     * Furthermore, stop notifying listeners of `onDidUpdate` of any updates in the context value.
     */
    public dispose(): void {
        this.calc         = () => false;
        this.cached.value = false;
        this.cached.stale = false;
        this.onDidUpdateEventEmitter.dispose();
    }

}
