import * as _ from 'lodash';

import {assertUnreachable} from '@utils/utils';
import {DivideByZeroError, TypeError} from './language_errors';
import {Type, TypeUtils} from './types';
import {BooleanValue, Value, ValueUtils} from './values';

// (boolean, boolean) -> boolean
enum BinaryOpBBB {
  AND = "&",
  OR = "|",
}

// (T, T) -> boolean
enum BinaryOpTTB {
  EQ = "==",
  NEQ = "!=",
  LT = "<",
  LTE = "<=",
  GT = ">",
  GTE = ">=",
}

// (T, T) -> T
enum BinaryOpTTT {
  PLUS = "+",
  MINUS = "-",
}

// (T, number) -> T
enum BinaryOpTNT {
  TIMES = "*",
  DIV = "/",
}

// (number, number) -> number
enum BinaryOpNNN {
  MOD = "%",
}

export type BinaryOp = BinaryOpBBB | BinaryOpTTB | BinaryOpTTT | BinaryOpTNT | BinaryOpNNN;


type primitiveValue = number | boolean | string;

const assertOpTypes = (valid: boolean, op: string, requirement: string) => {
  if (!valid) {
    throw new TypeError(`Operation \`${op}\` is only supported on ${requirement}.`);
  }
}

const throwError = (error: Error): never => { throw error };

export class BinaryOpUtils {

  // ===========
  // Type Guards
  // ===========

  public static isBBB = (op: BinaryOp): op is BinaryOpBBB => Object.values(BinaryOpBBB).includes(op)
  public static isTTB = (op: BinaryOp): op is BinaryOpTTB => Object.values(BinaryOpTTB).includes(op)
  public static isTTT = (op: BinaryOp): op is BinaryOpTTT => Object.values(BinaryOpTTT).includes(op)
  public static isTNT = (op: BinaryOp): op is BinaryOpTNT => Object.values(BinaryOpTNT).includes(op)
  public static isNNN = (op: BinaryOp): op is BinaryOpNNN => Object.values(BinaryOpNNN).includes(op)

  public static isBinaryOp = (op: string): op is BinaryOp => {
    const _op = op as BinaryOp;
    return BinaryOpUtils.isBBB(_op) || BinaryOpUtils.isTTB(_op) || BinaryOpUtils.isTTT(_op) ||
      BinaryOpUtils.isTNT(_op) || BinaryOpUtils.isNNN(_op);
  }


  // =========================
  // Validation and Evaluation
  // =========================

  public static validateOperandTypes = (op: BinaryOp, t1: Type, t2: Type): Type => {
    if (BinaryOpUtils.isBBB(op)) {
        assertOpTypes(TypeUtils.isBoolean(t1) && TypeUtils.isBoolean(t2), op, 'boolean values');
        return TypeUtils.Boolean;
    } else if (BinaryOpUtils.isTTB(op)) {
        assertOpTypes(TypeUtils.areEqual(t1, t2), op, 'values with matching types');
        assertOpTypes(TypeUtils.isPrimitive(t1) && TypeUtils.isPrimitive(t2), op, 'primitive values');
        return TypeUtils.Boolean;
    } else if (BinaryOpUtils.isTTT(op)) {
      switch (op) {
        case BinaryOpTTT.PLUS:
          const bothNumbers = TypeUtils.isNumber(t1) && TypeUtils.isNumber(t2);
          const bothStrings = TypeUtils.isString(t1) && TypeUtils.isString(t2);
          assertOpTypes(bothNumbers || bothStrings, op, 'a pair of numbers or text values');
          return t1;
        case BinaryOpTTT.MINUS:
          assertOpTypes(TypeUtils.isNumber(t1) && TypeUtils.isNumber(t2), op, 'numbers');
          return t1;
        default:
          return assertUnreachable(op);
      }
    } else if (BinaryOpUtils.isTNT(op)) {
        assertOpTypes(TypeUtils.isNumber(t1) && TypeUtils.isNumber(t2), op, 'numbers');
        return t1;
    } else if (BinaryOpUtils.isNNN(op)) {
        assertOpTypes(TypeUtils.isNumber(t1) && TypeUtils.isNumber(t2), op, 'numbers');
        return TypeUtils.Number;
    }
    return assertUnreachable(op);
  }

  public static evalOp = (op: BinaryOp, v1Thunk: () => Value, v2Thunk: () => Value): Value => {
    if (BinaryOpUtils.isBBB(op)) {
      return ValueUtils.booleanOf(BinaryOpUtils.evalBBB(op, v1Thunk, v2Thunk));
    }
    const v1 = v1Thunk();
    const v2 = v2Thunk();
    if (!ValueUtils.isPrimitive(v1) || !ValueUtils.isPrimitive(v2)) {
      throw new TypeError("Binary operations are not supported on non-primitive values");
    } else if (BinaryOpUtils.isTTB(op)) {
      return ValueUtils.booleanOf(BinaryOpUtils.evalTTB(op, v1.value, v2.value));
    } else if (BinaryOpUtils.isTTT(op)) {
      return ValueUtils.primitiveOf(BinaryOpUtils.evalTTT(op, v1.value, v2.value), v1.type);
    } else if (BinaryOpUtils.isTNT(op)) {
      return ValueUtils.primitiveOf(BinaryOpUtils.evalTNT(op, v1.value, v2.value as number), v1.type);
    } else if (BinaryOpUtils.isNNN(op)) {
      return ValueUtils.numberOf(BinaryOpUtils.evalNNN(op, v1.value as number, v2.value as number));
    }
    return assertUnreachable(op);
  }

  private static forceBooleanThunk = (thunk: () => Value, op: BinaryOp): boolean => {
      const v = thunk();
      assertOpTypes(ValueUtils.isBoolean(v), op, 'boolean values');
      return (v as BooleanValue).value;
  }

  // short-circuit evaluation
  private static evalBBB = (op: BinaryOpBBB, v1Thunk: () => Value, v2Thunk: () => Value): boolean => {
    const b1 = BinaryOpUtils.forceBooleanThunk(v1Thunk, op);
    const b2Thunk = () => BinaryOpUtils.forceBooleanThunk(v2Thunk, op);
    switch (op) {
      case BinaryOpBBB.AND: return b1 && b2Thunk();
      case BinaryOpBBB.OR: return b1 || b2Thunk();
      default:
        return assertUnreachable(op);
    }
  }

  private static evalTTB = (op: BinaryOpTTB, v1: primitiveValue, v2: primitiveValue): boolean => {
    switch (op) {
      case BinaryOpTTB.EQ: return v1 === v2;
      case BinaryOpTTB.NEQ: return v1 !== v2;
      case BinaryOpTTB.LT: return v1 < v2;
      case BinaryOpTTB.LTE: return v1 <= v2;
      case BinaryOpTTB.GT: return v1 > v2;
      case BinaryOpTTB.GTE: return v1 >= v2;
      default:
        return assertUnreachable(op);
    }
  }

  private static evalTTT = (op: BinaryOpTTT, v1: primitiveValue, v2: primitiveValue): primitiveValue => {
    const bothNumbers = typeof v1 === 'number' && typeof v2 === 'number';
    const bothStrings = typeof v1 === 'string' && typeof v2 === 'string';
    switch (op) {
      case BinaryOpTTT.PLUS:
        assertOpTypes(bothNumbers || bothStrings, op, 'a pair of numbers or text values');
        return bothNumbers ? (v1 as number) + (v2 as number) : (v1 as string) + (v2 as string);
      case BinaryOpTTT.MINUS:
        assertOpTypes(bothNumbers, op, 'numbers');
        return (v1 as number) - (v2 as number);
      default:
        return assertUnreachable(op);
    }
  }

  private static evalTNT = (op: BinaryOpTNT, v1: primitiveValue, n2: number): primitiveValue => {
    assertOpTypes(typeof v1 === 'number', op, 'numbers');
    const n1 = v1 as number;
    switch (op) {
      case BinaryOpTNT.TIMES: return n1 * n2;
      case BinaryOpTNT.DIV: return n2 === 0 ? throwError(new DivideByZeroError()) : n1 / n2;
      default:
        return assertUnreachable(op);
    }
  }

  private static evalNNN = (op: BinaryOpNNN, n1: number, n2: number): number => {
    switch (op) {
      case BinaryOpNNN.MOD: return n1 % n2;
      default:
        return assertUnreachable(op);
    }
  }
}