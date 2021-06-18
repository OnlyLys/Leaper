/**
 * A timer to execute a callback at most once at the end of the current event loop cycle.
 * 
 * Unlike the regular `Immediate` timer afforded by Node.js, this one is reusable.
 */
export class ImmediateReusable {

    private timer: NodeJS.Immediate | undefined = undefined;

    public constructor(private readonly callback: () => void) {}

    public set(): void {
        if (!this.timer) {
            this.timer = setImmediate(() => {
                this.callback();
                this.timer = undefined;
            });
        }
    }

    public clear(): void {
        if (this.timer) {
            clearImmediate(this.timer);
            this.timer = undefined;
        }
    }

}
