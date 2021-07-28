/**
 * A reusable timer to execute a callback after a period of delay.
 */
export class TimeoutReusable {
    
    private timer: NodeJS.Timer | undefined = undefined;

    /**
     * @param callback The callback to execute.
     * @param countdown How many milliseconds to wait before the executing the callback.
     */
    public constructor(
        private callback: () => void,
        private countdown: number
    ) {}

    /**
     * Set this timer to go off after `countdown` milliseconds defined in the constructor.
     * 
     * Does nothing if this timer has already been set.
     */
    public set(): void {
        this.timer ??= setTimeout(() => {
            this.callback();
            this.timer = undefined;
        }, this.countdown);
    }

    /**
     * Reset the countdown of this timer if it has already been set. 
     * 
     * Does nothing otherwise.
     */
    public resetCountdown(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.callback();
                this.timer = undefined;
            }, this.countdown);
        }
    }

    public clear(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    public dispose(): void {
        this.clear();
        this.callback = () => {};
    }

}
