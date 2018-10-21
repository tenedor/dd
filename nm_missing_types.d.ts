// This announces node modules to TS when any of the following are true:
// - The module does not have a matching @types/<module>.d.ts file on npm.
// - The definitions in the provided .d.ts file do not compile.
// - Your friendly sys admin did not understand how to configure the build
//   system to make it compile.

declare module 'deep-equal';
declare module 'shallow-equals';
