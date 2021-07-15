/**
 * Anything which may be `T` but has not been typechecked as such. 
 */
export class Unchecked<T> {

    public constructor(private v: unknown) {}

    /**
     * Get the value casted to the target type.
     */
    public cast(): T {
        return this.v as T;
    }

}