import * as _deepEqual from 'deep-equal';
import * as _ from 'lodash';
import * as shallow from 'shallow-equals';

export function assert(e: any, message?: string): true {
  if (!e) {
    throw new Error(message);
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

export function generateUID(namespace?: string): string {
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
  //    Note that (?!pattern) is a negative lookahead on pattern.
  // 2. Then replace all double escape characters with a single escape character.
  const x = str.replace(RegExp(`${regExpStr}(?!${regExpStr})`, 'g'), '');
  return x.replace(RegExp(`${regExpStr}${regExpStr}`, 'g'), escapeChar);
}

export function escapeAndQuote(str: string, quoteChar: string): string {
  const escapedStr = escape(str, '\\', [quoteChar]);
  return `${quoteChar}${escapedStr}${quoteChar}`;
}

export function classNames(...args: Array<string | ClassNameMap>): string {
  const stringArgs = args.filter(a => typeof a === "string") as string[];
  const stringClasses = stringArgs;

  const mapArgs = args.filter(a => typeof a === "object") as ClassNameMap[];
  const mapArg = Object.assign.apply(null, [{}].concat(mapArgs)) as ClassNameMap;
  const mapClasses = Object.keys(mapArg).filter(c => mapArg[c]);

  const classes = stringClasses.concat(mapClasses);
  return classes.join(" ");
}