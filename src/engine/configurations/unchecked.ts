/**
 * An object which may be `T` but has not been typechecked as such. 
 */
export type Unchecked<T> = {
    [Property in keyof T]: unknown;
}
