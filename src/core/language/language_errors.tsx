import {CustomError} from '@utils/custom_error';

export class LanguageError extends CustomError {
  constructor(message: string = "", errorClass: typeof LanguageError = LanguageError) {
    super(message, errorClass);
  }
}

export class TypeError extends LanguageError {
  constructor(message: string = "", errorClass: typeof TypeError = TypeError) {
    super(message, errorClass);
  }
}

export class ParseError extends LanguageError {
  constructor(message: string = "", errorClass: typeof ParseError = ParseError) {
    super(message, errorClass);
  }
}

export class RuntimeError extends LanguageError {
  constructor(message: string = "", errorClass: typeof RuntimeError = RuntimeError) {
    super(message, errorClass);
  }
}

export class OutOfBoundsError extends RuntimeError {
  constructor(message: string = "", errorClass: typeof OutOfBoundsError = OutOfBoundsError) {
    super(message, errorClass);
  }
}

export class DivideByZeroError extends RuntimeError {
  constructor(message: string = "", errorClass: typeof DivideByZeroError = DivideByZeroError) {
    super(message, errorClass);
  }
}

export class ObjectResolutionError extends RuntimeError {
  constructor(message: string = "", errorClass: typeof ObjectResolutionError = ObjectResolutionError) {
    super(message, errorClass);
  }
}

export class ValueResolutionError extends ObjectResolutionError {
  constructor(message: string = "", errorClass: typeof ValueResolutionError = ValueResolutionError) {
    super(message, errorClass);
  }
}