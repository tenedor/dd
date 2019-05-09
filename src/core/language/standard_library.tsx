import * as _ from 'lodash';
import {RODictionary} from 'src/utils/types';
import {DrawingVariant} from './drawing_value';
import {Identifier, PrimitiveType, Type, TypeUtils} from './types';
import {DictValue, DrawingValue, PrimitiveValue, Value, ValueUtils} from './values';

type BuiltInEval<I extends Identifier = Identifier, R extends Type = Type> = (parameters: DictValue<I>) => Value<R>;

export interface Parameter<T extends Type = Type> {
  readonly id: Identifier,
  readonly name: string,
  readonly type: T,
  readonly defaultValue: Value<T>,
}

export interface BuiltInFormula<R extends Type = Type, I extends Identifier = Identifier> {
  readonly id: I,
  readonly name: string,
  readonly returnType: R,
  readonly parameters: Readonly<{[id: string]: Parameter}>,
  readonly eval: BuiltInEval<I, R>,
}

type Primitive = number | boolean | string;
type MaterializedValue = Primitive | DrawingValue;
type MaterializedEval = (parameters: {[name: string]: MaterializedValue}) => MaterializedValue;

interface ParameterGenerator<T extends Type = Type> {
  type: T,
  defaultValue: MaterializedValue,
}

interface FormulaGenerator<R extends Type = Type> {
  returnType: R,
  parameters: {[name: string]: ParameterGenerator};
  eval: MaterializedEval,
}

interface BaseDrawingParameters {
  X: number,
  Y: number,
  Fill: string,
}

class ParameterUtils {
  public static number = (defaultValue: number): ParameterGenerator<PrimitiveType.NUMBER> => {
    return {type: TypeUtils.Number, defaultValue};
  }

  public static boolean = (defaultValue: boolean): ParameterGenerator<PrimitiveType.BOOLEAN> => {
    return {type: TypeUtils.Boolean, defaultValue};
  }

  public static string = (defaultValue: string): ParameterGenerator<PrimitiveType.STRING> => {
    return {type: TypeUtils.String, defaultValue};
  }

  public static readonly baseDrawing = {
    X: ParameterUtils.number(0),
    Y: ParameterUtils.number(0),
    Fill: ParameterUtils.string("black"),
  }
}

const getUID = (name: string) => `stdlib-${name}`;
const getParameterUID = (formulaId: Identifier, parameterName: string) => `${formulaId}-${parameterName}`;

const dematerializeValue = <T extends Type = Type> (value: MaterializedValue, type: T): Value<T> => {
  if (TypeUtils.isDrawing(type)) {
    return value as DrawingValue & Value<T>;
  } else if (TypeUtils.isPrimitive(type)) {
    return ValueUtils.primitiveOf(value as Primitive, type);
  }
  throw new TypeError("Can only dematerialize values for primitive types and drawings currently");
}

const materializeValue = (value: PrimitiveValue): MaterializedValue => {
  return value.value;
}

const generateParameters = (
  formulaId: Identifier,
  parameters: {[name: string]: ParameterGenerator},
): {[id: string]: Parameter} => {
  const parametersByName = _.mapValues(parameters, (parameter, name) => {
    const {type, defaultValue: dv} = parameter;
    const id = getParameterUID(formulaId, name);
    const defaultValue = dematerializeValue(dv, type);
    return {
      id,
      name,
      type,
      defaultValue,
    };
  });
  return _.mapKeys(parametersByName, 'id');
}

const dematerializeEval = <R extends Type = Type> (
  materializedEval: MaterializedEval,
  parameterDefs: {[id: string]: Parameter},
  returnType: R,
): BuiltInEval<Identifier, R> => {
  return (parameters: DictValue): Value<R> => {
    const defaultParametersByName = _.mapValues(parameterDefs, p => p.defaultValue);
    const parametersWithDefaults = _.extend({}, defaultParametersByName, parameters.dict);
    const parametersByName = _.mapKeys(parametersWithDefaults, (parameter: Value, id: string) => {
      return parameterDefs[id].name;
    });
    const materializedParameters = _.mapValues(parametersByName, materializeValue);
    const materializedValue = materializedEval(materializedParameters);
    return dematerializeValue(materializedValue, returnType);
  }
}

const generateFormula = (formulaDef: FormulaGenerator, name: string): BuiltInFormula => {
  const {returnType} = formulaDef;
  const id = getUID(name);
  const parameters = generateParameters(id, formulaDef.parameters);
  return {
    id,
    name,
    returnType,
    parameters,
    eval: dematerializeEval(formulaDef.eval, parameters, returnType),
  };
}

const formulaDefs: {[name: string]: FormulaGenerator} = {
  Square: {
    returnType: TypeUtils.Number,
    parameters: {
      Value: ParameterUtils.number(1),
    },
    eval: ({Value: value}: {Value: number}): number => value * value,
  },
  DrawCircle: {
    returnType: TypeUtils.Drawing,
    parameters: _.extend({}, ParameterUtils.baseDrawing, {
      Radius: ParameterUtils.number(10),
    }),
    eval: ({
      Radius: radius, X: x, Y: y, Fill: fill,
    }: {Radius: number} & BaseDrawingParameters): DrawingValue => {
      const drawingType = DrawingVariant.CIRCLE;
      const center = {x, y};
      return ValueUtils.drawingOf({drawingType, radius, center, fill});
    },
  },
  DrawEllipse: {
    returnType: TypeUtils.Drawing,
    parameters: _.extend({}, ParameterUtils.baseDrawing, {
      Radius1: ParameterUtils.number(15),
      Radius2: ParameterUtils.number(10),
    }),
    eval: ({
      Radius1: radius1, Radius2: radius2, X: x, Y: y, Fill: fill,
    }: {Radius1: number, Radius2: number} & BaseDrawingParameters): DrawingValue => {
      const drawingType = DrawingVariant.ELLIPSE;
      const center = {x, y};
      return ValueUtils.drawingOf({drawingType, radius1, radius2, center, fill});
    },
  },
  DrawPath: {
    returnType: TypeUtils.Drawing,
    parameters: _.extend({}, ParameterUtils.baseDrawing, {
      Path: ParameterUtils.string("TODO!"),
    }),
    eval: ({
      Path: path, X: x, Y: y, Fill: fill,
    }: {Path: string} & BaseDrawingParameters): DrawingValue => {
      const drawingType = DrawingVariant.PATH;
      const center = {x, y};
      return ValueUtils.drawingOf({drawingType, path, center, fill});
    },
  },
};

const builtInFormulas: RODictionary<BuiltInFormula> = _.mapValues(formulaDefs, generateFormula);

export const getBuiltInFormulas = () => builtInFormulas;