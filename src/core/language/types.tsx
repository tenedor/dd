import * as _ from 'lodash';

import {ROArray} from '@utils/types';
import {assertUnreachable, capitalizeFirstLetter} from '@utils/utils';

export enum PrimitiveType {
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  STRING = "STRING",
}

export enum DrawingType {
  DRAWING = "DRAWING",
}

interface ListTypeBase {
  itemType: Type,
}

export interface ListType<T extends Type = Type> extends ListTypeBase {
  itemType: T,
}

export interface DictType<I extends Identifier = Identifier> {
  schemaId: I,
}

export type SchemaIdentifier<I extends Identifier = Identifier> = Identifier;

export type RowType<I extends Identifier = Identifier> = DictType<SchemaIdentifier<I>>;

export interface GridType<I extends Identifier = Identifier> extends ListType<RowType<I>>, DictType<I> {
  itemType: RowType<I>,
  schemaId: I,
}

interface LambdaTypeBase {
  inputType: Type,
  outputType: Type,
}

export interface LambdaType<I extends Type = Type, O extends Type = Type> extends LambdaTypeBase {
  inputType: I,
  outputType: O,
}

export enum BoundingType {
  TOP = "TOP",
  BOTTOM = "BOTTOM",
}

export type Identifier = string;
export type Type = PrimitiveType | DrawingType | ListTypeBase | DictType | RowType |
    GridType | LambdaTypeBase | BoundingType;


export class TypeUtils {

  // ============
  // Constructors
  // ============

  public static readonly Number = PrimitiveType.NUMBER;
  public static readonly Boolean = PrimitiveType.BOOLEAN;
  public static readonly String = PrimitiveType.STRING;
  public static readonly Drawing = DrawingType.DRAWING;

  public static ListOf = <T extends Type> (itemType: T): ListType<T> => {
    return {itemType};
  }

  public static DictOf = <I extends Identifier> (schemaId: I): DictType<I> => {
    return {schemaId};
  }

  public static RowOf = <I extends Identifier> (schemaId: I): RowType<I> => {
    return {schemaId};
  }

  public static GridOf = <I extends Identifier>(schemaId: I): GridType<I> => {
    return {itemType: TypeUtils.RowOf(schemaId), schemaId};
  }

  public static LambdaOf = <I extends Type, O extends Type> (inputType: I, outputType: O): LambdaType<I, O> => {
    return {inputType, outputType};
  }


  // ===========
  // Type Guards
  // ===========

  public static isNumber = (t: Type): t is PrimitiveType.NUMBER => t === PrimitiveType.NUMBER

  public static isBoolean = (t: Type): t is PrimitiveType.BOOLEAN => t === PrimitiveType.BOOLEAN

  public static isString = (t: Type): t is PrimitiveType.STRING => t === PrimitiveType.STRING

  public static isDrawing = (t: Type): t is DrawingType => t === DrawingType.DRAWING

  public static isList = (t: Type): t is ListType => !TypeUtils.isAtomic(t) && 'itemType' in t

  public static isDict = (t: Type): t is DictType => !TypeUtils.isAtomic(t) && 'schemaId' in t

  public static isRow = (t: Type): t is RowType => TypeUtils.isDict(t)

  public static isGrid = (t: Type): t is GridType => TypeUtils.isList(t) && TypeUtils.isRow(t)

  public static isLambda = (t: Type): t is LambdaType => !TypeUtils.isAtomic(t) &&
    'inputType' in t && 'outputType' in t

  private static isTop = (t: Type): t is BoundingType.TOP => t === BoundingType.TOP

  private static isBottom = (t: Type): t is BoundingType.BOTTOM => t === BoundingType.BOTTOM

  public static isPrimitive = (t: Type): t is PrimitiveType => {
    return TypeUtils.isNumber(t) || TypeUtils.isBoolean(t) || TypeUtils.isString(t);
  }

  private static isBoundingType = (t: Type): t is BoundingType => {
    return TypeUtils.isTop(t) || TypeUtils.isBottom(t);
  }

  private static isAtomic = (t: Type): t is PrimitiveType | DrawingType | BoundingType => {
    return TypeUtils.isPrimitive(t) || TypeUtils.isDrawing(t) || TypeUtils.isBoundingType(t);
  }


  // ===========
  // Types Logic
  // ===========

  public static isAssignableTo = (t1: Type, t2: Type): boolean => {
    if (TypeUtils.isBottom(t1)) {
      return true;
    }

    if (TypeUtils.isTop(t2)) {
      return true;
    } else if (TypeUtils.isBottom(t2)) {
      return false;
    } else if (TypeUtils.isLambda(t2)) {
      return TypeUtils.isLambda(t1) && TypeUtils.isAssignableTo(t2.inputType, t1.inputType)
        && TypeUtils.isAssignableTo(t1.outputType, t2.outputType);
    } else if (TypeUtils.isGrid(t2)) {
      // TODO support grid inheritance
      return TypeUtils.isGrid(t1) && t1.schemaId === t2.schemaId;
    } else if (TypeUtils.isDict(t2)) {
      return TypeUtils.isDict(t1) && t1.schemaId === t2.schemaId;
    } else if (TypeUtils.isList(t2)) {
      return TypeUtils.isList(t1) && TypeUtils.isAssignableTo(t1.itemType, t2.itemType);
    } else if (TypeUtils.isDrawing(t2)) {
      return TypeUtils.isDrawing(t1);
    } else if (TypeUtils.isPrimitive(t2)) {
      return TypeUtils.isPrimitive(t1) && t1 === t2;
    } else {
      return assertUnreachable(t2);
    }
  }

  public static validateIsAssignableTo = <T extends Type> (t1: Type, t2: T, errorMessage?: string): t1 is T => {
    if (!TypeUtils.isAssignableTo(t1, t2)) {
      throw new TypeError(errorMessage ||
        `Expected type ${TypeUtils.toString(t1)} to be assignable to type ${TypeUtils.toString(t2)}`);
    }
    return true;
  }

  public static areEqual = (t1: Type, t2: Type): boolean => {
    return TypeUtils.isAssignableTo(t1, t2) && TypeUtils.isAssignableTo(t2, t1);
  }

  public static intersect = (t1: Type, t2: Type): Type => {
    if (TypeUtils.isTop(t1) || TypeUtils.isTop(t2)) {
      return TypeUtils.isTop(t1) ? t2 : t1;
    } else if (TypeUtils.isLambda(t1) && TypeUtils.isLambda(t2)) {
      const inputType = TypeUtils.union(t1.inputType, t2.inputType);
      const outputType = TypeUtils.intersect(t1.inputType, t2.inputType);
      return TypeUtils.LambdaOf(inputType, outputType);
    } else if (TypeUtils.isDict(t1) && TypeUtils.isDict(t2)) {
      // TODO fix this when Grid<I> is fixed to not be a Dict<I>
      const strongerType = TypeUtils.isGrid(t1) ? t1 : t2;
      // TODO support grid inheritance
      return t1.schemaId === t2.schemaId ? strongerType : BoundingType.BOTTOM;
    } else if (TypeUtils.isList(t1) && TypeUtils.isList(t2)) {
      const itemTypeIntersection = TypeUtils.intersect(t1.itemType, t2.itemType);
      if (TypeUtils.isGrid(t1) || TypeUtils.isGrid(t2)) {
        return TypeUtils.isDict(itemTypeIntersection)
          ? TypeUtils.GridOf(itemTypeIntersection.schemaId)
          : BoundingType.BOTTOM;
      }
      return TypeUtils.ListOf(itemTypeIntersection);
    } else if (TypeUtils.isDrawing(t1) && TypeUtils.isDrawing(t2)) {
      return DrawingType.DRAWING;
    } else if (TypeUtils.isPrimitive(t1) && TypeUtils.isPrimitive(t2)) {
      return t1 === t2 ? t2 : BoundingType.BOTTOM;
    } else {
      return BoundingType.BOTTOM;
    }
  }

  public static intersectAll = (types: Type[]): Type => {
    return _.reduce(types, TypeUtils.intersect, BoundingType.TOP);
  }

  public static union = (t1: Type, t2: Type): Type => {
    if (TypeUtils.isBottom(t1) || TypeUtils.isBottom(t2)) {
      return TypeUtils.isBottom(t1) ? t2 : t1;
    } else if (TypeUtils.isLambda(t1) && TypeUtils.isLambda(t2)) {
      const inputType = TypeUtils.intersect(t1.inputType, t2.inputType);
      const outputType = TypeUtils.union(t1.inputType, t2.inputType);
      return TypeUtils.LambdaOf(inputType, outputType);
    } else if (TypeUtils.isGrid(t1) && TypeUtils.isGrid(t2)) {
      // TODO support grid inheritance
      return t1.schemaId === t2.schemaId ? t2 :
        TypeUtils.ListOf(TypeUtils.union(t1.itemType, t2.itemType));
    } else if (TypeUtils.isDict(t1) && TypeUtils.isDict(t2)) {
      // TODO fix this when Grid<I> is fixed to not be a Dict<I>
      return t1.schemaId === t2.schemaId ? t2 : BoundingType.TOP;
    } else if (TypeUtils.isList(t1) && TypeUtils.isList(t2)) {
      return TypeUtils.ListOf(TypeUtils.union(t1.itemType, t2.itemType));
    } else if (TypeUtils.isDrawing(t1) && TypeUtils.isDrawing(t2)) {
      return DrawingType.DRAWING;
    } else if (TypeUtils.isPrimitive(t1) && TypeUtils.isPrimitive(t2)) {
      return t1 === t2 ? t2 : BoundingType.TOP;
    } else {
      return BoundingType.TOP;
    }
  }

  public static unionAll = (types: Type[]): Type => {
    return _.reduce(types, TypeUtils.union, BoundingType.BOTTOM);
  }


  // =========
  // Utilities
  // =========

  public static toString = (t: Type): string => {
    if (TypeUtils.isAtomic(t)) {
      return capitalizeFirstLetter(t.toLowerCase());
    }
    // TODO
    return `${t}`;
  }

  public static readonly atomicTypes: ROArray<Type> = [
    PrimitiveType.NUMBER,
    PrimitiveType.BOOLEAN,
    PrimitiveType.STRING,
    DrawingType.DRAWING,
  ];
}
