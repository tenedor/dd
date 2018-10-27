import * as _deepEqual from 'deep-equal';
import * as shallow from 'shallow-equals';

export function assert(e: any, message?: string): true {
  if (!e) {
    throw new Error(message);
  }
  return true;
}

export function shallowEqual<A, B>(a: A, b: B, compare?: (a: A, b: B) => boolean) {
  return shallow(a, b, compare);
}

export function deepEqual(a: any, b: any) {
  // always use strict comparisons
  return _deepEqual(a, b, {strict: true});
}

// O(n log n) for n keys on the object with fewer keys
export function keysEqual(object1: object, object2: object): boolean {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  keys1.sort();
  keys2.sort();
  for (let i = 0; i < keys1.length; i++) {
    if (keys1[i] !== keys2[i]) {
      return false;
    }
  }
  return true;
}

interface ClassNameMap {
  [className: string]: boolean,
};

export function classNames(...args: Array<string | ClassNameMap>): string {
  const stringArgs = args.filter(a => typeof a === "string") as string[];
  const stringClasses = stringArgs;

  const mapArgs = args.filter(a => typeof a === "object") as ClassNameMap[];
  const mapArg = Object.assign.apply(null, [{}].concat(mapArgs)) as ClassNameMap;
  const mapClasses = Object.keys(mapArg).filter(c => mapArg[c]);

  const classes = stringClasses.concat(mapClasses);
  return classes.join(" ");
}

export function setArrayValueFunctionally<V>(array: V[], index: number, value: V): V[] {
  const newArray = array.slice();
  newArray[index] = value;
  return newArray;
}

export function setObjectValueFunctionally<T, K extends keyof T>(object: T, key: K, value: T[K]): T {
  return Object.assign({}, object, {[key]: value});
}

export function deleteObjectKeyFunctionally<T, K extends keyof T>(object: T, key: K): T {
  const newObject = Object.assign({}, object);
  delete newObject[key];
  return newObject;
}