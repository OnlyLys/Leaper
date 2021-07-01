/**
 * Anything which has been cast to `T` but has not been typechecked as such. 
 */
export class Unchecked<T> {

    public constructor(v: unknown) {
        this.value = v as T;
    }

    /**
     * The unchecked value.
     */
    public readonly value: T;

}