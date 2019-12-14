import * as _deepEqual from 'deep-equal';
import * as _ from 'lodash';
import * as shallow from 'shallow-equals';
import {Constructor} from './types';

type ErrorConstructor = Constructor<Error, [string]>;

export function assert(e: any, message: string = "", ErrorClass: ErrorConstructor = Error): true {
  if (!e) {
    throw new ErrorClass(message);
  }
  return true;
}

export function assertUnreachable(e: never, message?: string): never {
  throw new Error(message);
}

export function shallowEqual<A, B>(a: A, b: B, compare?: (a: A, b: B) => boolean) {
  return shallow(a, b, compare);
}

export function deepEqual(a: any, b: any) {
  // always use strict comparisons
  return _deepEqual(a, b, {strict: true});
}

export function keysEqual(object1: Readonly<object>, object2: Readonly<object>): boolean {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  const s1 = new Set(keys1);
  for (const k of keys2) {
    if (!s1.has(k)) {
      return false;
    }
  }
  return true;
}

export function keysDiff(
  oldObj: Readonly<object>,
  newObj: Readonly<object>,
): {removedIds: string[], addedIds: string[]} {
  const oldKeys = Object.keys(oldObj);
  const newKeys = Object.keys(newObj);
  const removedIds = _.difference(oldKeys, newKeys);
  const addedIds = _.difference(newKeys, oldKeys);
  return {removedIds, addedIds};
}

let nextSessionUID = 0;
export function generateSessionUID(namespace?: string): string {
  const idString = `0000000000${nextSessionUID++}`;
  return idString.slice(idString.length - 10, idString.length);
}

// This is relatively expensive if called for every model
export function generateGUID(namespace?: string): string {
  // c/o https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
  const uid = (Math.random().toString(36)+'00000000000000000').slice(2, 12);
  return namespace ? `${namespace}-${uid}` : uid;
}

interface ClassNameMap {
  [className: string]: boolean,
};

function escapeWith(str: string, escapeChar: string, charToEscape: string): string {
  const regExpStr = charToEscape === '\\' ? '\\\\' : charToEscape;
  return str.replace(RegExp(regExpStr, 'g'), `${escapeChar}${charToEscape}`);
}

// Replace all occurrences of the escape character with a pair of escape characters,
// then prefix each character-to-escape with an escape character.
export function escape(str: string, escapeChar: string, charsToEscape: string[]): string {
  let escaped = escapeWith(str, escapeChar, escapeChar);
  const toEscape = _.uniq(charsToEscape).filter(c => c !== escapeChar);
  toEscape.forEach(c => {
    escaped = escapeWith(escaped, escapeChar, c);
  });
  return escaped;
}

// Invert an escape call. The following identity holds for all values s, c, and cs:
//   `s === unescape(escape(s, c, cs), c)`
export function unescape(str: string, escapeChar: string): string {
  const regExpStr = escapeChar === '\\' ? '\\\\' : escapeChar;
  // This one gets fun...
  // 1. First, remove any escape character not followed by another escape character.
  //    Note that (?!pattern) is a negative look-ahead on pattern.
  // 2. Then replace all double escape characters with a single escape character.
  const x = str.replace(RegExp(`${regExpStr}(?!${regExpStr})`, 'g'), '');
  return x.replace(RegExp(`${regExpStr}${regExpStr}`, 'g'), escapeChar);
}

export function escapeAndQuote(str: string, quoteChar: string): string {
  const escapedStr = escape(str, '\\', [quoteChar]);
  return `${quoteChar}${escapedStr}${quoteChar}`;
}

export function splitEscapedString(str: string, splitChar: string, escapeChar: string): string[] {
  // This one also gets fun. Must distinguish a split char from an escaped split char,
  // but can't locally tell if a character is escaped (requires determining if there are
  // an odd number of escape chars in front of it). To solve this:
  // 1. Post-escape all double-escapes with a new escape char to make the problem local
  // 2. Split on each split char that is not escaped
  //    Note that (?<!pattern) is a negative look-behind on pattern
  // 3. Unescape the new escape char out of results

  // Choose new escape char to not clash with existing special characters. Also skip
  // backslash because it's annoying to work with.
  const dec = getDynamicEscapeChar([splitChar, escapeChar, '\\']);

  // Continue in helper to aid testing.
  return splitEscapedStringHelper(str, splitChar, escapeChar, dec);
}

// Visible for testing only
export function splitEscapedStringHelper(str: string, splitChar: string, escapeChar: string, dec: string): string[] {
  assert(dec !== splitChar, `Split char and dec cannot be the same. Both are: ${dec}`);
  assert(dec !== escapeChar, `Escape char and dec cannot be the same. Both are: ${dec}`);
  assert(dec !== '\\', "Backslash is not allowed for dec, it's annoying to work with.");

  const reSplitChar = splitChar === '\\' ? '\\\\' : splitChar;
  const reEscapeChar = escapeChar === '\\' ? '\\\\' : escapeChar;
  const decEscaped = str
    .replace(RegExp(dec, 'g'), `${dec}${dec}`)
    .replace(RegExp(`${reEscapeChar}${reEscapeChar}`, 'g'), `${escapeChar}${escapeChar}${dec}`);
  const splits = decEscaped.split(RegExp(`(?<!${reEscapeChar})${reSplitChar}`, 'g'));

  return splits.map(s => s
    .replace(RegExp(`${escapeChar}${escapeChar}${dec}`, 'g'), `${escapeChar}${escapeChar}`)
    .replace(RegExp(`${dec}${dec}`, 'g'), dec));
}

function getDynamicEscapeChar(disallowed: string[]): string {
  // Search printable ASCII characters for one that isn't disallowed.
  // Make it likely that an unusual character is chosen by searching in reverse.
  for (let i = 126; i >= 32; i--) {
    const s = String.fromCharCode(i);
    if (!disallowed.includes(s)) {
      return s;
    }
  }
  throw new Error("Every printable ASCII character was disallowed.");
}

export function capitalizeFirstLetter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function classNames(...args: Array<string | ClassNameMap | undefined>): string {
  const stringArgs = args.filter(a => typeof a === "string") as string[];
  const stringClasses = stringArgs;

  const mapArgs = args.filter(a => typeof a === "object") as ClassNameMap[];
  const mapArg = Object.assign.apply(null, [{}].concat(mapArgs)) as ClassNameMap;
  const mapClasses = Object.keys(mapArg).filter(c => mapArg[c]);

  const classes = stringClasses.concat(mapClasses);
  return classes.join(" ");
}