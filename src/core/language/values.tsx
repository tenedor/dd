import * as _ from 'lodash';
import {assertUnreachable} from 'src/utils/utils';
import {Drawing, drawingsAreEqual} from './drawing_value';
import {DictType, DrawingType, GridType, Identifier, LambdaType, ListType, PrimitiveType,
        SchemaIdentifier, Type, TypeUtils} from './types';

interface BaseValue<T extends Type = Type> {
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

export interface DictValue<I extends Identifier = Identifier> extends BaseValue<DictType<I>> {
  dict: {[id: string]: Value},
}

export interface GridValue<I extends Identifier = Identifier>
    extends BaseValue<GridType<I>>, ListValue<DictType<SchemaIdentifier<I>>>, DictValue<I> {
  type: GridType<I>,
  dict: {[id: string]: ListValue},
  list: Array<Value<DictType<I>>>,
}

export interface LambdaValue<I extends Type = Type, O extends Type = Type>
    extends BaseValue<LambdaType<I, O>> {
  lambda: (input: Value<I>) => Value<O>,
}

type ValueUnion = PrimitiveValue | DrawingValue | ListValue | DictValue | GridValue | LambdaValue;
export type Value<T extends Type = Type> = BaseValue<T> & ValueUnion;


type primitiveValue = number | boolean | string;
type TypeWithDefaultValue = PrimitiveType | ListType;

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

  public static primitiveOf = <T extends PrimitiveType> (value: primitiveValue, type: T): Value<T> => {
    // Apologies to R. Milner for the type casts, here and elsewhere...
    //
    // Typescript does not support enum generics properly and needs help.
    // See https://github.com/Microsoft/TypeScript/issues/24085
    if (TypeUtils.isNumber(type)) {
      return typeof value === 'number' ? ValueUtils.numberOf(value) as Value<T> :
        throwValueConstructionTypeError(value, type);
    } else if (TypeUtils.isBoolean(type)) {
      return typeof value === 'boolean' ? ValueUtils.booleanOf(value) as Value<T> :
        throwValueConstructionTypeError(value, type);
    } else if (TypeUtils.isString(type)) {
      return typeof value === 'string' ? ValueUtils.stringOf(value) as Value<T> :
        throwValueConstructionTypeError(value, type);
    } else {
      throw new Error('This code should never be reached.');
    }
  }

  public static drawingOf = (drawing: Drawing): DrawingValue => {
    return {drawing, type: DrawingType.DRAWING};
  }

  public static listOf = <T extends Type> (list: Array<Value<T>>, itemType: T): ListValue<T> => {
    return {list, type: TypeUtils.ListOf(itemType)};
  }

  public static dictOf = <I extends Identifier> (dict: {[id: string]: Value}, id: I): DictValue<I> => {
    return {dict, type: TypeUtils.DictOf(id)};
  }

  public static gridOf = <I extends Identifier> (...rest: any[]): GridValue<I> => {
    throw new Error("Constructing a grid value with Value.gridOf is not allowed.");
  }

  public static lambdaOf = <I extends Type, O extends Type> (lambda: (input: Value<I>) => Value<O>,
      inputType: I, outputType: O): LambdaValue<I, O> => {
    return {lambda, type: TypeUtils.LambdaOf(inputType, outputType)};
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
  public static isDict = (v: Value): v is DictValue => TypeUtils.isDict(v.type)
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
    } else if (ValueUtils.isDict(v1) && ValueUtils.isDict(v2)) {
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

  // Each type that a user can manually input has a default value
  public static supportsDefaultValue = (type: Type): type is TypeWithDefaultValue => {
    return TypeUtils.isPrimitive(type) || TypeUtils.isList(type);
  }

  public static get defaultNumber() { return ValueUtils.numberOf(0); }
  public static get defaultBoolean() { return ValueUtils.booleanOf(false); }
  public static get defaultString() { return ValueUtils.stringOf(""); }
  public static defaultListOfType = <T extends Type> (itemType: T) => ValueUtils.listOf([], itemType)

  public static getDefaultValue = <T extends TypeWithDefaultValue> (type: T & TypeWithDefaultValue): Value<T> => {
    // Apologies to R. Milner
    if (TypeUtils.isNumber(type)) {
      return ValueUtils.defaultNumber as Value<T>;
    } else if (TypeUtils.isString(type)) {
      return ValueUtils.defaultNumber as Value<T>;
    } else if (TypeUtils.isBoolean(type)) {
      return ValueUtils.defaultBoolean as Value<T>;
    } else if (TypeUtils.isList(type)) {
      return ValueUtils.defaultListOfType(type.itemType) as Value<T>;
    } else {
      return assertUnreachable(type);
    }
  }

  // TODO this is terrible
  public static toString = (v: Value): string => {
    if (ValueUtils.isLambda(v)) {
      return 'fn';
    } else if (ValueUtils.isGrid(v)) {
      return `Grid{${v.type.schemaId}}`;
    } else if (ValueUtils.isDict(v)) {
      return `InstanceOf{${v.type.schemaId}}`;
    } else if (ValueUtils.isList(v)) {
      const values = v.list.map(e => ValueUtils.toString(e));
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