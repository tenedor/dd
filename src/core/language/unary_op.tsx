import * as _ from 'lodash';

import {assertUnreachable} from '@utils/utils';
import {Type, TypeUtils} from './types';
import {Value, ValueUtils} from './values';

// (boolean) -> boolean
enum UnaryOpBB {
  NOT = "!",
}

// (T) -> T
enum UnaryOpTT {
  NEGATE = "-",
}

export type UnaryOp = UnaryOpBB | UnaryOpTT;

const assertOpTypes = (valid: boolean, op: string, requirement: string) => {
  if (!valid) {
    throw new TypeError(`Operation \`${op}\` is only supported on ${requirement}.`);
  }
}

export class UnaryOpUtils {

  // ===========
  // Type Guards
  // ===========

  private static isBB = (op: UnaryOp): op is UnaryOpBB => Object.values(UnaryOpBB).includes(op)
  private static isTT = (op: UnaryOp): op is UnaryOpTT => Object.values(UnaryOpTT).includes(op)

  public static isUnaryOp = (op: string): op is UnaryOp => {
    const _op = op as UnaryOp;
    return UnaryOpUtils.isBB(_op) || UnaryOpUtils.isTT(_op);
  }


  // =========================
  // Validation and Evaluation
  // =========================

  public static validateOperandType = (op: UnaryOp, t: Type): Type => {
    if (UnaryOpUtils.isBB(op)) {
        assertOpTypes(TypeUtils.isBoolean(t), op, 'a boolean value');
        return TypeUtils.Boolean;
    } else if (UnaryOpUtils.isTT(op)) {
        assertOpTypes(TypeUtils.isNumber(t), op, 'a number');
        return TypeUtils.Number;
    }
    return assertUnreachable(op);
  }

  public static evalOp = (op: UnaryOp, v: Value): Value => {
    if (!ValueUtils.isPrimitive(v) || !ValueUtils.isPrimitive(v)) {
      throw new Error("Unary operations are not supported on non-primitive values");
    } else if (UnaryOpUtils.isBB(op)) {
      return ValueUtils.booleanOf(UnaryOpUtils.evalBB(op, v.value as boolean));
    } else if (UnaryOpUtils.isTT(op)) {
      return ValueUtils.numberOf(UnaryOpUtils.evalTT(op, v.value as number));
    }
    return assertUnreachable(op);
  }

  private static evalBB = (op: UnaryOpBB, b: boolean): boolean => {
    switch (op) {
      case UnaryOpBB.NOT: return !b;
      default:
        return assertUnreachable(op);
    }
  }

  private static evalTT = (op: UnaryOpTT, n: number): number => {
    switch (op) {
      case UnaryOpTT.NEGATE: return -n;
      default:
        return assertUnreachable(op);
    }
  }
}