import * as _ from 'lodash';

import {Row} from '@models/domain_specific/row'; // only a type dependency
import {RODictionary} from '@utils/types';
import {assertUnreachable} from '@utils/utils';
import {CallRes, ResolvedAST} from './ast';
import {Drawing, drawingsAreEqual, DrawingVariant} from './drawing_value';
import {FormulaEnvironment} from './formula_environment';
import {TypeError} from './language_errors';
import {NameResolver} from './name_resolver';
import {Parser} from './parser';
import {BoundingType, DictType, DrawingType, GridIdentifier, GridType, Identifier,
        LambdaType, ListType, PartialRowType, PrimitiveType, RowIdentifier, RowType,
        SchemaIdentifier, SupportsLiteralsType, Type, TypeUtils} from './types';

export interface BaseValue<T extends Type = Type> {
  type: T,
}

export interface NumberValue extends BaseValue<PrimitiveType.NUMBER> {
  value: number,
}

export interface BooleanValue extends BaseValue<PrimitiveType.BOOLEAN> {
  value: boolean,
}

export interface StringValue extends BaseValue<PrimitiveType.STRING> {
  value: string,
}

export type PrimitiveValue = NumberValue | BooleanValue | StringValue;

export interface DrawingValue extends BaseValue<DrawingType> {
  drawing: Drawing,
}

export interface ListValue<T extends Type = Type> extends BaseValue<ListType<T>> {
  list: Array<Value<T>>,
}

interface BaseDictValue<SI extends SchemaIdentifier> extends BaseValue<DictType> {
  dict: RODictionary<Value>,
}

export interface PartialRowValue<I extends Identifier = Identifier>
  extends BaseValue<PartialRowType<I>>, BaseDictValue<RowIdentifier<I>> {
  type: PartialRowType<I>,
  dict: RODictionary<Value>,
}

export interface RowValue<I extends Identifier = Identifier>
  extends BaseValue<RowType<I>>, PartialRowValue<I> {
  type: RowType<I>,
  dict: RODictionary<Value>,
}

export interface GridValue<I extends Identifier = Identifier>
    extends BaseValue<GridType<I>>, ListValue<RowType<I>>, BaseDictValue<GridIdentifier<I>> {
  type: GridType<I>,
  dict: RODictionary<ListValue>,
  list: Array<RowValue<I>>,
}

type DictValue = PartialRowValue | GridValue;

export interface LambdaValue<I extends Type = Type, O extends Type = Type>
    extends BaseValue<LambdaType<I, O>> {
  lambda: (input: Value<I>) => Value<O>,
}

type ValueUnion = PrimitiveValue | DrawingValue | ListValue | DictValue | LambdaValue;
export type Value<T extends Type = Type> = BaseValue<T> & ValueUnion;

export type ValueOrAST<T extends Type = Type> = ResolvedAST<T> | Value<T>;

type primitiveValue = number | boolean | string;

const throwValueConstructionTypeError = (value: any, type: Type) => {
  throw new TypeError(`Cannot construct ${TypeUtils.toString(type)} from value ${value}`);
}


export class ValueUtils {

  // ============
  // Constructors
  // ============

  public static numberOf = (value: number): NumberValue => {
    return {value, type: PrimitiveType.NUMBER};
  }

  public static booleanOf = (value: boolean): BooleanValue => {
    return {value, type: PrimitiveType.BOOLEAN};
  }

  public static stringOf = (value: string): StringValue => {
    return {value, type: PrimitiveType.STRING};
  }

  public static primitiveOfInferType = (value: primitiveValue): Value => {
    if (typeof value === 'number') {
      return ValueUtils.numberOf(value);
    } else if (typeof value === 'boolean') {
      return ValueUtils.booleanOf(value);
    } else if (typeof value === 'string') {
      return ValueUtils.stringOf(value);
    } else {
      throw new Error('This code should never be reached.');
    }
  }

  public static primitiveOf = <T extends PrimitiveType> (value: primitiveValue, type: T): Value<T> => {
    const wrappedValue = ValueUtils.primitiveOfInferType(value);
    if (TypeUtils.areEqual(wrappedValue.type, type)) {
      return wrappedValue as Value<T>;
    }
    return throwValueConstructionTypeError(value, type);
  }

  public static drawingOf = (drawing: Drawing): DrawingValue => {
    return {drawing, type: DrawingType.DRAWING};
  }

  public static listOfInferType = (list: Value[], environment: FormulaEnvironment): ListValue => {
    const itemType = TypeUtils.unionAll(list.map(v => v.type), environment);
    return {list, type: TypeUtils.ListOf(itemType)};
  }

  public static listOf = <T extends Type> (list: Array<Value<T>>, itemType: T): ListValue<T> => {
    return {list, type: TypeUtils.ListOf(itemType)};
  }

  public static emptyList = (): ListValue<BoundingType.BOTTOM> => {
    return {list: [], type: TypeUtils.EmptyList};
  }

  public static partialRowOf = <I extends Identifier> (dict: RODictionary<Value>, id: I): PartialRowValue<I> => {
    return {dict, type: TypeUtils.PartialRowOf(id)};
  }

  public static rowOf = <I extends Identifier> (row: Row<I>, id: I): RowValue<I> => {
    const cellValues = _.mapValues(row.cells.d, c => c.value);
    return {dict: cellValues, type: TypeUtils.RowOf(id)};
  }

  public static gridOf = (): never => {
    throw new Error("Constructing a grid value with Value.gridOf is not allowed.");
  }

  public static lambdaOf = <I extends Type, O extends Type>(
    lambda: (input: Value<I>) => Value<O>,
    type: LambdaType<I, O>,
  ): LambdaValue<I, O> => {
    return {lambda, type};
  }


  // ===========
  // Type Guards
  // ===========

  public static isNumber = (v: Value): v is NumberValue => TypeUtils.isNumber(v.type)
  public static isBoolean = (v: Value): v is BooleanValue => TypeUtils.isBoolean(v.type)
  public static isString = (v: Value): v is StringValue => TypeUtils.isString(v.type)
  public static isPrimitive = (v: Value): v is PrimitiveValue => TypeUtils.isPrimitive(v.type)
  public static isDrawing = (v: Value): v is DrawingValue => TypeUtils.isDrawing(v.type)
  public static isList = (v: Value): v is ListValue => TypeUtils.isList(v.type)
  public static isListOfList = (v: ListValue): v is ListValue<ListType> => TypeUtils.isListOfList(v.type)
  public static isDict = (v: Value): v is DictValue => TypeUtils.isDict(v.type)
  public static isPartialRow = (v: Value): v is PartialRowValue => TypeUtils.isPartialRow(v.type)
  public static isRow = (v: Value): v is RowValue => TypeUtils.isRow(v.type)
  public static isGrid = (v: Value): v is GridValue => TypeUtils.isGrid(v.type)
  public static isLambda = (v: Value): v is LambdaValue => TypeUtils.isLambda(v.type)


  // ============
  // Values Logic
  // ============

  public static areEqual = (v1: Value, v2: Value): boolean => {
    if (!TypeUtils.areEqual(v1.type, v2.type)) {
      return false;
    }
    if (ValueUtils.isLambda(v1) && ValueUtils.isLambda(v2)) {
      return v1.lambda === v2.lambda;
    } else if (ValueUtils.isGrid(v1) && ValueUtils.isGrid(v2)) {
      return true;
    } else if (ValueUtils.isPartialRow(v1) && ValueUtils.isPartialRow(v2)) {
      const keys1 = Object.keys(v1.dict);
      const keys2 = Object.keys(v2.dict);
      return _.isEqual(new Set(keys1), new Set(keys2)) &&
          _.every(keys1, k => ValueUtils.areEqual(v1.dict[k], v2.dict[k]));
    } else if (ValueUtils.isList(v1) && ValueUtils.isList(v2)) {
      const list1 = v1.list;
      const list2 = v2.list;
      return list1.length === list2.length &&
          _.every(_.range(list1.length), i => ValueUtils.areEqual(list1[i], list2[i]));
    } else if (ValueUtils.isDrawing(v1) && ValueUtils.isDrawing(v2)) {
      return drawingsAreEqual(v1.drawing, v2.drawing);
    } else if (ValueUtils.isPrimitive(v1) && ValueUtils.isPrimitive(v2)) {
      return v1.value === v2.value;
    }
    throw new Error("unreachable code");
  }


  // =========
  // Utilities
  // =========

  public static get defaultNumber() { return ValueUtils.numberOf(0); }
  public static get defaultBoolean() { return ValueUtils.booleanOf(false); }
  public static get defaultString() { return ValueUtils.stringOf(""); }

  public static get defaultDrawing() {
    const drawingType = DrawingVariant.CIRCLE;
    const radius = 10;
    const fill = "black";
    return ValueUtils.drawingOf({drawingType, radius, fill});
  }

  public static defaultListOfType = <T extends Type> (itemType: T) => ValueUtils.listOf([], itemType)

  public static getDefaultValue = <T extends SupportsLiteralsType> (type: T & SupportsLiteralsType, resolver: NameResolver): ValueOrAST<T> => {
    // Apologies to R. Milner for the type casts, here and elsewhere...
    //
    // Typescript does not support enum generics properly and needs help.
    // See https://github.com/Microsoft/TypeScript/issues/24085
    if (TypeUtils.isNumber(type)) {
      return ValueUtils.defaultNumber as Value<T>;
    } else if (TypeUtils.isString(type)) {
      return ValueUtils.defaultString as Value<T>;
    } else if (TypeUtils.isBoolean(type)) {
      return ValueUtils.defaultBoolean as Value<T>;
    } else if (TypeUtils.isDrawing(type)) {
      return ValueUtils.defaultDrawing as Value<T>;
    } else if (TypeUtils.isList(type)) {
      return ValueUtils.defaultListOfType(type.itemType) as Value<T>;
    } else if (TypeUtils.isRow(type)) {
      const constructorRef = resolver.resolveGridConstructorFromId(type.schemaId.gridId);
      return CallRes.buildDefaultConstructorCall(constructorRef) as CallRes<T>;
    } else {
      return assertUnreachable(type);
    }
  }

  public static deepFlattenList = (v: ListValue): ListValue => {
    if (ValueUtils.isListOfList(v)) {
      const baseType = TypeUtils.getListBaseType(v.type);
      const flattened = _.flatten(v.list.map(vv => ValueUtils.deepFlattenList(vv as ListValue).list));
      return ValueUtils.listOf(flattened, baseType);
    }
    return v;
  }

  public static toString = (v: Value, resolver: NameResolver): string => {
    if (ValueUtils.isLambda(v)) {
      return 'fn'; // TODO
    } else if (ValueUtils.isDict(v)) {
      const gridName = resolver.nameForConstructorId(v.type.schemaId.gridId);
      const escapedName = Parser.identToText(gridName);
      if (ValueUtils.isGrid(v)) {
        return `${escapedName}`;
      } else if (ValueUtils.isRow(v)) {
        return `${escapedName}(...)`;
      } else if (ValueUtils.isPartialRow(v)) {
        return `Partial Row of ${escapedName}`;
      } else {
        return assertUnreachable(v);
      }
    } else if (ValueUtils.isList(v)) {
      const values = v.list.map(e => ValueUtils.toString(e, resolver));
      return `[${values.join(", ")}]`;
    } else if (ValueUtils.isDrawing(v)) {
      return v.drawing.drawingType;
    } else if (ValueUtils.isPrimitive(v)) {
      return `${v.value}`;
    } else {
      return assertUnreachable(v);
    }
  }

  // TODO remove this method
  // tslint:disable-next-line
  public static toString_NoEnvironment = (v: Value): string => {
    if (ValueUtils.isLambda(v)) {
      return 'fn'; // TODO
    } else if (ValueUtils.isDict(v)) {
      const gridName = 'Grid';
      const escapedName = Parser.identToText(gridName);
      if (ValueUtils.isGrid(v)) {
        return `${escapedName}`;
      } else if (ValueUtils.isRow(v)) {
        return `${escapedName}(...)`;
      } else if (ValueUtils.isPartialRow(v)) {
        return `Partial Row of ${escapedName}`;
      } else {
        return assertUnreachable(v);
      }
    } else if (ValueUtils.isList(v)) {
      const values = v.list.map(e => ValueUtils.toString_NoEnvironment(e));
      return `[${values.join(", ")}]`;
    } else if (ValueUtils.isDrawing(v)) {
      return v.drawing.drawingType;
    } else if (ValueUtils.isPrimitive(v)) {
      return `${v.value}`;
    } else {
      return assertUnreachable(v);
    }
  }
}