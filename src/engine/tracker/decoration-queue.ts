import { DecorationRenderOptions, Range, TextEditor, window } from 'vscode';
import { Unchecked } from '../configurations/unchecked';
import { Pair } from './pair';

/**
 * A queue that decorates the closing side of pairs at the end of the current event loop cycle.
 */
export class DecorationQueue {

    private timer: NodeJS.Immediate | undefined = undefined;

    private queue: PositionReadonlyPair[] = [];

    public constructor(
        private readonly owner: TextEditor,
        public readonly decorationOptions: Unchecked<DecorationRenderOptions>
    ) {}

    private applyDecorations(): void {
        for (const pair of this.queue) {
            if (!pair.decoration) {
                pair.decoration = window.createTextEditorDecorationType(this.decorationOptions.cast());
                this.owner.setDecorations(
                    pair.decoration,
                    [ new Range(pair.close, pair.close.translate(0, 1)) ]
                );
            }
        }
        this.queue = [];
    }

    public clear(): void {
        if (this.timer) {
            clearImmediate(this.timer);
            this.timer = undefined;
        }
        this.queue = [];
    }

    // Queue a pair to be decorated at the end of the current event loop cycle.
    // 
    // A pair will not be redecorated if it already has a decoration.
    public enqueue(pair: PositionReadonlyPair): void {
        this.queue.push(pair);
        this.timer ??= setImmediate(() => {
            this.applyDecorations();
            this.timer = undefined;
        });
    }

}

type PositionReadonlyPair = Pair & Readonly<Pick<Pair, 'open' | 'close'>>;
