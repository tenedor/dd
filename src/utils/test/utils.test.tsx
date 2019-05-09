import {assert, classNames, escape, escapeAndQuote, unescape} from '../utils';

it('assert', () => {
  expect(() => assert(true)).not.toThrow();
  expect(() => assert(false)).toThrow();
});

it('escape', () => {
  expect(escape("abc!d!!e", "!", [])).toBe("abc!!d!!!!e");
  expect(escape("abc!d!!ee", "!", ["d", "e"])).toBe("abc!!!d!!!!!e!e");
});

it('unescape', () => {
  expect(unescape(escape("abc!d!!e", "!", []), "!")).toBe("abc!d!!e");
  expect(unescape(escape("abc!d!!ee", "!", ["d", "e"]), "!")).toBe("abc!d!!ee");
});

it('escapeAndQuote', () => {
  expect(escapeAndQuote("ab\\c'd''e", "'")).toBe("'ab\\\\c\\'d\\'\\'e'");
});

it('classNames', () => {
  const classes = classNames("class1", {class2: false, class3: true}, "class4", {class5: true});
  const classesSorted = classes.split(" ").sort().join(" ");
  expect(classesSorted).toBe("class1 class3 class4 class5");
});