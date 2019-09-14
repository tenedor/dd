export class CustomError extends Error {
  constructor(message: string = "", errorClass: typeof CustomError = CustomError) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, errorClass);
    }
    this.name = errorClass.name;

    // This is the recommended workaround for a TS bug. See:
    // - https://github.com/Microsoft/TypeScript/issues/13965
    // - https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, errorClass.prototype);
  }
}