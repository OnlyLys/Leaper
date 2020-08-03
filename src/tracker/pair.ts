import { TextDocumentContentChangeEvent, Position, TextEditorDecorationType, DecorationRenderOptions, window, TextEditor, Range } from 'vscode';
import { shift } from './shift';

/** Represents a pair that is being tracked in the document. */
export class Pair {
    
    private decoration: TextEditorDecorationType | undefined;

    /** 
     * Create a resentation of a pair that is being tracked in the document. 
     * 
     * @param editor The text editor that the pair is in.
     * @param decorationOptions Decoration style to apply to the closing side of the pair.
     * @param open The opening position (left side) of the pair.
     * @param close The closing position (right side) of the pair. If this parameter is `undefined` 
     * then it will be set to 1 character to the right of `open`.
     */
    constructor(
        private readonly editor: TextEditor,
        private readonly decorationOptions: DecorationRenderOptions,
        private _open:  Position,
        private _close: Position = _open.translate({ characterDelta: 1 }),
    ) {}

    /** 
     * The opening position (left side) of the pair. If this pair is not alive then getting this
     * value is undefined behavior.
     */
    public get open(): Position {
        return this._open;
    }

    /** 
     * The closing position (right side) of the pair. If this pair is not alive then getting this
     * value is undefined behavior.
     */
    public get close(): Position {
        return this._close;
    }

    /** `true` if this pair presently decorated. */
    public get isDecorated(): boolean {
        return !!this.decoration;
    }

    /** Check if this pair encloses a position. */ 
    public encloses(pos: Position): boolean {
        return pos.isAfter(this._open) && pos.isBeforeOrEqual(this._close);
    }

    /** 
     * Update this `Pair` by applying a content change that may:
     * - Move the `Pair` to a new position by adding or removing text before or in-between it.
     * - Delete the `Pair` due to overwriting either side of it or if multi-line text was inserted
     * between the pair (we do this because we don't want to track pairs across newlines).
     * - Leave it unchanged due to only modifying text after it.
     * 
     * Be careful not to apply the content change that created the pair to the pair as it will cause
     * the `Pair` to shift.
     * 
     * If the pair is deleted, the return value is `false`. Otherwise `true` is returned.
     */
    public applyContentChange(contentChange: TextDocumentContentChangeEvent): boolean {
        const { range: replaced, text: inserted } = contentChange;
        const newOpen: Position | undefined = shift(this._open, replaced, inserted);
        if (!newOpen) {
            return false;       // Open side deleted
        }
        const newClose: Position | undefined = shift(this._close, replaced, inserted);
        if (!newClose || newOpen.line !== newClose.line) {
            return false;      // Close side deleted or if multiline text inserted in between pair
        }
        [this._open, this._close] = [newOpen, newClose];
        return true;
    }

    /** 
     * Decorate the closing side of this pair. 
     * 
     * Any prior active decoration will be replaced. 
     */
    public decorate(): void {
        this.decoration?.dispose();
        this.decoration = window.createTextEditorDecorationType(this.decorationOptions);
        this.editor.setDecorations(this.decoration, [new Range(this._close, this._close.translate(0, 1))]);
    }

    /** 
     * Remove the decoration for the closing side of this pair. 
     * 
     * Nothing is done if it was already undecorated. 
     */
    public undecorate(): void {
        this.decoration?.dispose();
        this.decoration = undefined;
    }

}