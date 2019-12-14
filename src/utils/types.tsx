export type JSPrimitive = boolean | number | string | symbol | undefined | null;
export type ROArray<T> = ReadonlyArray<T>;

export interface Dictionary<T> {
  [k: string]: T;
}
export type RODictionary<T> = Readonly<Dictionary<T>>;

export type Constructor<T, A extends any[] = any[]> = new (...args: A) => T;