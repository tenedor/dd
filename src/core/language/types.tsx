import * as _ from 'lodash';

import {ROArray} from '@utils/types';
import {assertUnreachable, capitalizeFirstLetter} from '@utils/utils';
import {FormulaEnvironment} from './formula_environment';

export type Identifier = string;

export enum SchemaIdentifierType {
  PARTIAL_ROW = "PARTIAL_ROW",
  ROW = "ROW",
  GRID = "GRID",
}

type PartialRowIdentifierType = SchemaIdentifierType.PARTIAL_ROW | SchemaIdentifierType.ROW;

export interface PartialRowIdentifier<I extends Identifier = Identifier> {
  identifierType: PartialRowIdentifierType;
  gridId: I;
}

export interface RowIdentifier<I extends Identifier = Identifier> extends PartialRowIdentifier {
  identifierType: SchemaIdentifierType.ROW;
  gridId: I;
}

export interface GridIdentifier<I extends Identifier = Identifier> {
  identifierType: SchemaIdentifierType.GRID;
  gridId: I;
}

export type SchemaIdentifier<I extends Identifier = Identifier> = PartialRowIdentifier<I> | GridIdentifier<I>;

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

interface BaseDictType<SI extends SchemaIdentifier> {
  schemaId: SI,
}

export interface PartialRowType<I extends Identifier = Identifier> extends BaseDictType<PartialRowIdentifier<I>> {
  schemaId: PartialRowIdentifier<I>,
}

export interface RowType<I extends Identifier = Identifier> extends PartialRowType<I>, BaseDictType<RowIdentifier<I>> {
  schemaId: RowIdentifier<I>,
}

export interface GridType<I extends Identifier = Identifier> extends ListType<RowType<I>>, BaseDictType<GridIdentifier<I>> {
  itemType: RowType<I>,
  schemaId: GridIdentifier<I>,
}

export type DictType = PartialRowType | GridType;

interface LambdaTypeBase {
  inputType: Type,
  outputType: Type,
}

export interface LambdaType<I extends Type = Type, O extends Type = Type> extends LambdaTypeBase {
  inputType: I,
  outputType: O,
}

export enum BoundingType {
  TOP = "TOP",        // the "any" type to which any type may be assigned
  BOTTOM = "BOTTOM",  // the "never" type which can be assigned to any type
}

export type EmptyListType = ListType<BoundingType.BOTTOM>;
export type ListOfAnyType = ListType<BoundingType.TOP>;

// ListType only supports literals if its item type is Bottom or is a
// SupportsLiteralsType, but TypeScript's types cannot express this concept.
export type SupportsLiteralsType = PrimitiveType | DrawingType | ListType | RowType;

export type Type = PrimitiveType | DrawingType | ListTypeBase | DictType |
  LambdaTypeBase | BoundingType;


export class TypeUtils {

  // ============
  // Constructors
  // ============

  public static readonly Number = PrimitiveType.NUMBER;
  public static readonly Boolean = PrimitiveType.BOOLEAN;
  public static readonly String = PrimitiveType.STRING;
  public static readonly Drawing = DrawingType.DRAWING;
  public static readonly Bottom: BoundingType.BOTTOM = BoundingType.BOTTOM;
  public static readonly Top: BoundingType.TOP = BoundingType.TOP;
  public static readonly EmptyList: EmptyListType = {itemType: BoundingType.BOTTOM};
  public static readonly ListOfAny: ListOfAnyType = {itemType: BoundingType.TOP};

  public static ListOf = <T extends Type> (itemType: T): ListType<T> => {
    return {itemType};
  }

  public static PartialRowOf = <I extends Identifier> (gridId: I): PartialRowType<I> => {
    const schemaId: PartialRowIdentifier<I> = {identifierType: SchemaIdentifierType.PARTIAL_ROW, gridId};
    return {schemaId};
  }

  public static RowOf = <I extends Identifier> (gridId: I): RowType<I> => {
    const schemaId: RowIdentifier<I> = {identifierType: SchemaIdentifierType.ROW, gridId};
    return {schemaId};
  }

  public static GridOf = <I extends Identifier>(gridId: I): GridType<I> => {
    const schemaId: GridIdentifier<I> = {identifierType: SchemaIdentifierType.GRID, gridId};
    return {itemType: TypeUtils.RowOf(gridId), schemaId};
  }

  public static LambdaOf = <I extends Type, O extends Type> (inputType: I, outputType: O): LambdaType<I, O> => {
    return {inputType, outputType};
  }


  // ===========
  // Type Guards
  // ===========

  public static isPartialRowIdentifier= (id: SchemaIdentifier): id is RowIdentifier =>
    id.identifierType === SchemaIdentifierType.PARTIAL_ROW || TypeUtils.isRowIdentifier(id)

  public static isRowIdentifier= (id: SchemaIdentifier): id is RowIdentifier =>
    id.identifierType === SchemaIdentifierType.ROW

  public static isGridIdentifier= (id: SchemaIdentifier): id is GridIdentifier =>
    id.identifierType === SchemaIdentifierType.GRID

  public static isNumber = (t: Type): t is PrimitiveType.NUMBER => t === PrimitiveType.NUMBER

  public static isBoolean = (t: Type): t is PrimitiveType.BOOLEAN => t === PrimitiveType.BOOLEAN

  public static isString = (t: Type): t is PrimitiveType.STRING => t === PrimitiveType.STRING

  public static isDrawing = (t: Type): t is DrawingType => t === DrawingType.DRAWING

  public static isList = (t: Type): t is ListType => !TypeUtils.isAtomic(t) && 'itemType' in t

  public static isDict = (t: Type): t is DictType => !TypeUtils.isAtomic(t) && 'schemaId' in t

  public static isPartialRow = (t: Type): t is PartialRowType => TypeUtils.isDict(t) &&
    TypeUtils.isPartialRowIdentifier(t.schemaId)

  public static isRow = (t: Type): t is RowType => TypeUtils.isDict(t) &&
    TypeUtils.isRowIdentifier(t.schemaId)

  public static isGrid = (t: Type): t is GridType => TypeUtils.isList(t) && TypeUtils.isRow(t.itemType) &&
    TypeUtils.isDict(t) && TypeUtils.isGridIdentifier(t.schemaId)

  public static isLambda = (t: Type): t is LambdaType => !TypeUtils.isAtomic(t) &&
    'inputType' in t && 'outputType' in t

  private static isTop = (t: Type): t is BoundingType.TOP => t === BoundingType.TOP

  private static isBottom = (t: Type): t is BoundingType.BOTTOM => t === BoundingType.BOTTOM

  public static isPrimitive = (t: Type): t is PrimitiveType => {
    return TypeUtils.isNumber(t) || TypeUtils.isBoolean(t) || TypeUtils.isString(t);
  }

  public static isBoundingType = (t: Type): t is BoundingType => {
    return TypeUtils.isTop(t) || TypeUtils.isBottom(t);
  }

  private static isAtomic = (t: Type): t is PrimitiveType | DrawingType | BoundingType => {
    return TypeUtils.isPrimitive(t) || TypeUtils.isDrawing(t) || TypeUtils.isBoundingType(t);
  }

  public static supportsLiterals = (t: Type): t is SupportsLiteralsType => {
    return TypeUtils.isPrimitive(t) || TypeUtils.isDrawing(t) || TypeUtils.isRow(t) ||
        (TypeUtils.isList(t) && TypeUtils.listItemTypeSupportsLiterals(t.itemType));
  }

  private static listItemTypeSupportsLiterals = (itemType: Type): boolean => {
    return TypeUtils.isBottom(itemType) || TypeUtils.supportsLiterals(itemType);
  }


  // ===========
  // Types Logic
  // ===========

  public static isAssignableTo = (t1: Type, t2: Type, environment: FormulaEnvironment): boolean => {
    if (TypeUtils.isBottom(t1)) {
      return true;
    }

    if (TypeUtils.isTop(t2)) {
      return true;
    } else if (TypeUtils.isBottom(t2)) {
      return false;
    } else if (TypeUtils.isLambda(t2)) {
      return TypeUtils.isLambda(t1) && TypeUtils.isAssignableTo(t2.inputType, t1.inputType, environment)
        && TypeUtils.isAssignableTo(t1.outputType, t2.outputType, environment);
    } else if (TypeUtils.isGrid(t2)) {
      return TypeUtils.isGrid(t1) && TypeUtils.isGridAssignableTo(t1, t2, environment);
    } else if (TypeUtils.isRow(t2)) {
      return TypeUtils.isRow(t1) && TypeUtils.isRowAssignableTo(t1, t2, environment);
    } else if (TypeUtils.isPartialRow(t2)) {
      return TypeUtils.isPartialRow(t1) && TypeUtils.isRowAssignableTo(t1, t2, environment);
    } else if (TypeUtils.isList(t2)) {
      return TypeUtils.isList(t1) && TypeUtils.isAssignableTo(t1.itemType, t2.itemType, environment);
    } else if (TypeUtils.isDrawing(t2)) {
      return TypeUtils.isDrawing(t1);
    } else if (TypeUtils.isPrimitive(t2)) {
      return TypeUtils.isPrimitive(t1) && t1 === t2;
    } else {
      return assertUnreachable(t2);
    }
  }

  // TODO remove this method
  // tslint:disable-next-line
  private static isAssignableTo_NoEnvironment = (t1: Type, t2: Type): boolean => {
    if (TypeUtils.isBottom(t1)) {
      return true;
    }

    if (TypeUtils.isTop(t2)) {
      return true;
    } else if (TypeUtils.isBottom(t2)) {
      return false;
    } else if (TypeUtils.isLambda(t2)) {
      return TypeUtils.isLambda(t1) && TypeUtils.isAssignableTo_NoEnvironment(t2.inputType, t1.inputType)
        && TypeUtils.isAssignableTo_NoEnvironment(t1.outputType, t2.outputType);
    } else if (TypeUtils.isGrid(t2)) {
      return TypeUtils.isGrid(t1) && t1.schemaId.gridId === t2.schemaId.gridId;
    } else if (TypeUtils.isRow(t2)) {
      return TypeUtils.isRow(t1) && t1.schemaId.gridId === t2.schemaId.gridId;
    } else if (TypeUtils.isPartialRow(t2)) {
      return TypeUtils.isPartialRow(t1) && t1.schemaId.gridId === t2.schemaId.gridId;
    } else if (TypeUtils.isList(t2)) {
      return TypeUtils.isList(t1) && TypeUtils.isAssignableTo_NoEnvironment(t1.itemType, t2.itemType);
    } else if (TypeUtils.isDrawing(t2)) {
      return TypeUtils.isDrawing(t1);
    } else if (TypeUtils.isPrimitive(t2)) {
      return TypeUtils.isPrimitive(t1) && t1 === t2;
    } else {
      return assertUnreachable(t2);
    }
  }

  public static validateIsAssignableTo = <T extends Type> (t1: Type, t2: T, environment: FormulaEnvironment, errorMessage?: string): t1 is T => {
    if (!TypeUtils.isAssignableTo(t1, t2, environment)) {
      throw new TypeError(errorMessage ||
        `Expected type ${TypeUtils.toString(t1)} to be assignable to type ${TypeUtils.toString(t2)}`);
    }
    return true;
  }

  public static areEqual = (t1: Type, t2: Type): boolean => {
    // TODO: this should be:
    // return TypeUtils.isAssignableTo(t1, t2, environment) && TypeUtils.isAssignableTo(t2, t1, environment);

    return TypeUtils.isAssignableTo_NoEnvironment(t1, t2) && TypeUtils.isAssignableTo_NoEnvironment(t2, t1);
  }

  private static isGridAssignableTo = (t1: GridType, t2: GridType, environment: FormulaEnvironment): boolean => {
    return environment.isAssignableTo(t1, t2);
  }

  private static isRowAssignableTo = (t1: PartialRowType, t2: PartialRowType, environment: FormulaEnvironment): boolean => {
    const g1 = TypeUtils.GridOf(t1.schemaId.gridId);
    const g2 = TypeUtils.GridOf(t2.schemaId.gridId);
    return TypeUtils.isGridAssignableTo(g1, g2, environment);
  }

  // The intersection is the widest type that can be assigned to any of the input types
  public static intersect = (t1: Type, t2: Type, environment: FormulaEnvironment): Type => {
    if (TypeUtils.isTop(t1) || TypeUtils.isTop(t2)) {
      return TypeUtils.isTop(t1) ? t2 : t1;
    } else if (TypeUtils.isLambda(t1) && TypeUtils.isLambda(t2)) {
      const inputType = TypeUtils.union(t1.inputType, t2.inputType, environment);
      const outputType = TypeUtils.intersect(t1.inputType, t2.inputType, environment);
      return TypeUtils.LambdaOf(inputType, outputType);
    } else if (TypeUtils.isGrid(t1) && TypeUtils.isGrid(t2)) {
      return TypeUtils.isGridAssignableTo(t1, t2, environment) ? t1 :
             TypeUtils.isGridAssignableTo(t2, t1, environment) ? t2 :
             BoundingType.BOTTOM;
    } else if (TypeUtils.isRow(t1) && TypeUtils.isRow(t2)) {
      return TypeUtils.isRowAssignableTo(t1, t2, environment) ? t1 :
             TypeUtils.isRowAssignableTo(t2, t1, environment) ? t2 :
             BoundingType.BOTTOM;
    } else if (TypeUtils.isPartialRow(t1) && TypeUtils.isPartialRow(t2)) {
      return TypeUtils.isRowAssignableTo(t1, t2, environment) ? t1 :
             TypeUtils.isRowAssignableTo(t2, t1, environment) ? t2 :
             BoundingType.BOTTOM;
    } else if (TypeUtils.isList(t1) && TypeUtils.isList(t2)) {
      const itemTypeIntersection = TypeUtils.intersect(t1.itemType, t2.itemType, environment);
      if (TypeUtils.isGrid(t1) || TypeUtils.isGrid(t2)) {
        return TypeUtils.isRow(itemTypeIntersection)
          ? TypeUtils.GridOf(itemTypeIntersection.schemaId.gridId)
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

  public static intersectAll = (types: Type[], environment: FormulaEnvironment): Type => {
    return _.reduce(types, (t1, t2) => TypeUtils.intersect(t1, t2, environment), BoundingType.TOP);
  }

  // The union is the narrowest type to which any of the input types can be assigned
  public static union = (t1: Type, t2: Type, environment: FormulaEnvironment): Type => {
    if (TypeUtils.isBottom(t1) || TypeUtils.isBottom(t2)) {
      return TypeUtils.isBottom(t1) ? t2 : t1;
    } else if (TypeUtils.isLambda(t1) && TypeUtils.isLambda(t2)) {
      const inputType = TypeUtils.intersect(t1.inputType, t2.inputType, environment);
      const outputType = TypeUtils.union(t1.inputType, t2.inputType, environment);
      return TypeUtils.LambdaOf(inputType, outputType);
    } else if (TypeUtils.isGrid(t1) && TypeUtils.isGrid(t2)) {
      return TypeUtils.gridUnion(t1, t2, environment);
    } else if (TypeUtils.isRow(t1) && TypeUtils.isRow(t2)) {
      return TypeUtils.rowUnion(t1, t2, environment);
    } else if (TypeUtils.isPartialRow(t1) && TypeUtils.isPartialRow(t2)) {
      return TypeUtils.partialRowUnion(t1, t2, environment);
    } else if (TypeUtils.isList(t1) && TypeUtils.isList(t2)) {
      return TypeUtils.ListOf(TypeUtils.union(t1.itemType, t2.itemType, environment));
    } else if (TypeUtils.isDrawing(t1) && TypeUtils.isDrawing(t2)) {
      return DrawingType.DRAWING;
    } else if (TypeUtils.isPrimitive(t1) && TypeUtils.isPrimitive(t2)) {
      return t1 === t2 ? t2 : BoundingType.TOP;
    } else {
      return BoundingType.TOP;
    }
  }

  public static unionAll = (types: Type[], environment: FormulaEnvironment): Type => {
    return _.reduce(types, (t1, t2) => TypeUtils.union(t1, t2, environment), BoundingType.BOTTOM);
  }

  private static gridUnion = (t1: GridType, t2: GridType, environment: FormulaEnvironment): GridType | ListOfAnyType => {
    return environment.getUnionType(t1, t2);
  }

  private static rowUnion = (t1: RowType, t2: RowType, environment: FormulaEnvironment): RowType | BoundingType.TOP => {
    const g1 = TypeUtils.GridOf(t1.schemaId.gridId);
    const g2 = TypeUtils.GridOf(t2.schemaId.gridId);
    const gridUnion = TypeUtils.gridUnion(g1, g2, environment);
    return TypeUtils.isGrid(gridUnion) ? TypeUtils.RowOf(gridUnion.schemaId.gridId) : BoundingType.TOP;
  }

  private static partialRowUnion = (t1: PartialRowType, t2: PartialRowType, environment: FormulaEnvironment): PartialRowType | BoundingType.TOP => {
    const g1 = TypeUtils.GridOf(t1.schemaId.gridId);
    const g2 = TypeUtils.GridOf(t2.schemaId.gridId);
    const gridUnion = TypeUtils.gridUnion(g1, g2, environment);
    return TypeUtils.isGrid(gridUnion) ? TypeUtils.PartialRowOf(gridUnion.schemaId.gridId) : BoundingType.TOP;
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
