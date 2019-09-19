import * as _ from 'lodash';

import {loadBuiltInGrids} from '@core/built_in_grids';
import {getDrawing, hasNonEmptyDrawing, makeDrawingGroupValue} from '@core/drawing_grid_utilities';
import {CoordinateSystem} from '@core/geometry';
import {UpdateManager} from '@models/core/update_manager';
import {BuiltInEval, BuiltInFormula, BuiltInFormulaSpec, Parameter,
        ResolutionTimeTypeHelper} from '@models/domain_specific/constructor';
import {RODictionary} from '@utils/types';
import {UnresolvedAST} from './ast';
import {DrawingVariant} from './drawing_value';
import {FormulaEnvironment} from './formula_environment';
import {ParseError, TypeError} from './language_errors';
import {Parser} from './parser';
import {BoundingType, Identifier, LambdaOfAnyType, LambdaType, ListOfAnyType, ListType,
        PrimitiveType, Type, TypeUtils} from './types';
import {DrawingValue, LambdaValue, ListValue, NumberValue, PartialRowValue,
        PrimitiveValue, RowValue, Value, ValueUtils} from './values';

type Primitive = number | boolean | string;
type MaterializedValue = Primitive | DrawingValue | ListValue | LambdaValue;
type MaterializedEval = (parameters: {[name: string]: MaterializedValue}) => MaterializedValue;

interface ParameterGenerator<T extends Type = Type> {
  type: T,
  defaultValue: MaterializedValue,
}

interface FormulaGenerator<R extends Type = Type> {
  returnType: R,
  parameters: {[name: string]: ParameterGenerator};
  eval: MaterializedEval,
  resolutionTimeTypeHelper?: ResolutionTimeTypeHelper,
}

interface BaseDrawingParameters {
  X: number,
  Y: number,
  Fill: string,
}

class ParameterUtils {
  public static readonly defaultListValue = ValueUtils.emptyList();
  public static readonly defaultLambdaValue = ValueUtils.lambdaOf(v => v, TypeUtils.LambdaOfAny);

  public static number = (defaultValue: number): ParameterGenerator<PrimitiveType.NUMBER> => {
    return {type: TypeUtils.Number, defaultValue};
  }

  public static boolean = (defaultValue: boolean): ParameterGenerator<PrimitiveType.BOOLEAN> => {
    return {type: TypeUtils.Boolean, defaultValue};
  }

  public static string = (defaultValue: string): ParameterGenerator<PrimitiveType.STRING> => {
    return {type: TypeUtils.String, defaultValue};
  }

  public static listOfAny = (defaultValue: ListValue = ParameterUtils.defaultListValue): ParameterGenerator<ListOfAnyType> => {
    return {type: TypeUtils.ListOfAny, defaultValue};
  }

  public static lambdaOfAny = (defaultValue: LambdaValue = ParameterUtils.defaultLambdaValue): ParameterGenerator<LambdaOfAnyType> => {
    return {type: TypeUtils.LambdaOfAny, defaultValue};
  }

  public static readonly baseShapeDrawing = {
    Fill: ParameterUtils.string("black"),
  }
}

const getUID = (name: string) => `stdlib-${name}`;
const getParameterUID = (formulaId: Identifier, parameterName: string) => `${formulaId}-${parameterName}`;

const dematerializeValue = <T extends Type = Type> (value: MaterializedValue, type: T): Value<T> => {
  if (TypeUtils.isDrawing(type)) {
    return value as DrawingValue & Value<T>;
  } else if (TypeUtils.isLambda(type)) {
    return value as LambdaOfAnyType & Value<T>;
  } else if (TypeUtils.isList(type)) {
    return value as ListValue<BoundingType.TOP> & Value<T>;
  } else if (TypeUtils.isPrimitive(type)) {
    return ValueUtils.primitiveOf(value as Primitive, type);
  }
  throw new TypeError(`Cannot dematerialize values for ${TypeUtils.toString(type)} types currently`);
}

const materializeValue = (value: PrimitiveValue | DrawingValue | ListValue): MaterializedValue => {
  return ValueUtils.isPrimitive(value) ? value.value : value;
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
): BuiltInEval<R> => {
  return (parameters: PartialRowValue): Value<R> => {
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

const generateFormulaSpec = (formulaDef: FormulaGenerator, name: string): BuiltInFormulaSpec => {
  const {returnType, resolutionTimeTypeHelper} = formulaDef;
  const id = getUID(name);
  const parameters = generateParameters(id, formulaDef.parameters);
  return {
    id,
    name,
    returnType,
    parameters,
    eval: dematerializeEval(formulaDef.eval, parameters, returnType),
    resolutionTimeTypeHelper,
  };
}

const buildDefaultAsmtUnres = (unparsed: string): UnresolvedAST => {
  const parseResult = Parser.parseExpression(unparsed);
  if (parseResult.succeeded) {
    return parseResult.ast;
  }
  throw new ParseError(`Failed to parse standard library default assignment ${unparsed}`);
}

const formulaDefs: {[name: string]: FormulaGenerator} = {
  /**
   * List Processing Formulas
   */

  Size: {
    returnType: TypeUtils.Number,
    parameters: {
      List: ParameterUtils.listOfAny(),
    },
    eval: ({List: list}: {List: ListValue}): number => list.list.length,
  },

  Range: {
    returnType: TypeUtils.ListOf(TypeUtils.Number),
    parameters: {
      N: ParameterUtils.number(3),
      Start: ParameterUtils.number(1),
      Step: ParameterUtils.number(1),
    },
    eval: ({N: n, Start: start, Step: step}: {
      N: number, Start: number, Step: number,
    }): ListValue<PrimitiveType.NUMBER> => {
      const end = start + n * step;
      const list = _.range(start, end, step).map(ValueUtils.numberOf);
      return ValueUtils.listOf(list, PrimitiveType.NUMBER);
    },
  },

  Map: {
    returnType: TypeUtils.ListOf(BoundingType.BOTTOM),
    parameters: {
      Values: ParameterUtils.listOfAny(),
      Fn: ParameterUtils.lambdaOfAny(),
    },
    eval: ({Values: values, Fn: fn}: {Values: ListValue, Fn: LambdaValue}): ListValue => {
      const {lambda, type} = fn;
      const mappedValues = values.list.map(lambda);
      return ValueUtils.listOf(mappedValues, type.outputType);
    },
    resolutionTimeTypeHelper: {
      lambdaAsmtName: "Fn",
      resolutionTimeAsmtDefaultValues: {
        Values: buildDefaultAsmtUnres('[]'),
        Fn: buildDefaultAsmtUnres('V -> V'),
      },
      resolveLambdaType: ({Values: valuesType}: RODictionary<Type>) =>
          TypeUtils.LambdaOf((valuesType as ListType).itemType, BoundingType.BOTTOM),
      resolveCallReturnType: ({Fn: fnType}: RODictionary<Type>) =>
          TypeUtils.ListOf((fnType as LambdaType).outputType),
    },
  },

  /**
   * Arithmetic Formulas
   */

  Square: {
    returnType: TypeUtils.Number,
    parameters: {
      Value: ParameterUtils.number(1),
    },
    eval: ({Value: value}: {Value: number}): number => value * value,
  },

  Sqrt: {
    returnType: TypeUtils.Number,
    parameters: {
      Value: ParameterUtils.number(1),
    },
    eval: ({Value: value}: {Value: number}): number => Math.sqrt(value),
  },

  Power: {
    returnType: TypeUtils.Number,
    parameters: {
      Base: ParameterUtils.number(2),
      Exponent: ParameterUtils.number(3),
    },
    eval: ({Base: base, Exponent: exponent}: {Base: number, Exponent: number}): number => Math.pow(base, exponent),
  },

  Log: {
    returnType: TypeUtils.Number,
    parameters: {
      Value: ParameterUtils.number(1),
      Base: ParameterUtils.number(2),
    },
    eval: ({Value: value, Base: base}: {Value: number, Base: number}): number => Math.log(value) / Math.log(base),
  },

  E: {
    returnType: TypeUtils.Number,
    parameters: {},
    eval: ({}: {}): number => Math.E,
  },

  /**
   * Trigonometry Formulas
   */

  Pi: {
    returnType: TypeUtils.Number,
    parameters: {},
    eval: ({}: {}): number => Math.PI,
  },

  Sin: {
    returnType: TypeUtils.Number,
    parameters: {
      Radians: ParameterUtils.number(0),
    },
    eval: ({Radians: radians}: {Radians: number}): number => Math.sin(radians),
  },

  Cos: {
    returnType: TypeUtils.Number,
    parameters: {
      Radians: ParameterUtils.number(0),
    },
    eval: ({Radians: radians}: {Radians: number}): number => Math.cos(radians),
  },

  Tan: {
    returnType: TypeUtils.Number,
    parameters: {
      Radians: ParameterUtils.number(0),
    },
    eval: ({Radians: radians}: {Radians: number}): number => Math.tan(radians),
  },

  Atan2: {
    returnType: TypeUtils.Number,
    parameters: {
      X: ParameterUtils.number(1),
      Y: ParameterUtils.number(0),
    },
    eval: ({X: x, Y: y}: {X: number, Y: number}): number => Math.atan2(y, x),
  },

  /**
   * Drawing Formulas
   */

  DrawCircle: {
    returnType: TypeUtils.Drawing,
    parameters: _.extend({}, ParameterUtils.baseShapeDrawing, {
      Radius: ParameterUtils.number(10),
    }),
    eval: ({
      Radius: radius, Fill: fill,
    }: {Radius: number} & BaseDrawingParameters): DrawingValue => {
      const drawingType = DrawingVariant.CIRCLE;
      return ValueUtils.drawingOf({drawingType, radius, fill});
    },
  },

  DrawEllipse: {
    returnType: TypeUtils.Drawing,
    parameters: _.extend({}, ParameterUtils.baseShapeDrawing, {
      Radius1: ParameterUtils.number(15),
      Radius2: ParameterUtils.number(10),
    }),
    eval: ({
      Radius1: radius1, Radius2: radius2, Fill: fill,
    }: {Radius1: number, Radius2: number} & BaseDrawingParameters): DrawingValue => {
      const drawingType = DrawingVariant.ELLIPSE;
      return ValueUtils.drawingOf({drawingType, radius1, radius2, fill});
    },
  },

  DrawPath: {
    returnType: TypeUtils.Drawing,
    parameters: _.extend({}, ParameterUtils.baseShapeDrawing, {
      Path: ParameterUtils.string("m -15 9, c 10 -25, 20 -25, 30 0 z"),
    }),
    eval: ({
      Path: path, Fill: fill,
    }: {Path: string} & BaseDrawingParameters): DrawingValue => {
      const drawingType = DrawingVariant.PATH;
      return ValueUtils.drawingOf({drawingType, path, fill});
    },
  },

  DrawDrawings: {
    returnType: TypeUtils.Drawing,
    parameters: {
      // TODO: encode coordinate system as something less idiotic than a list
      'Coordinate System': ParameterUtils.listOfAny(),
      Values: ParameterUtils.listOfAny(),
    },
    eval: ({
      'Coordinate System': coordinateSystemList,
      Values: values,
    }: {'Coordinate System': ListValue, Values: ListValue}): DrawingValue => {
      const drawings = values.list.filter(hasNonEmptyDrawing).map(getDrawing);
      const coordinateSystem = coordinateSystemList.list.length ?
        getCoordinateSystemData(coordinateSystemList.list[0] as RowValue) :
        undefined;
      return makeDrawingGroupValue(drawings, coordinateSystem);
    },
  },
};

const builtInFormulas: RODictionary<BuiltInFormula> = _.mapValues(formulaDefs, (def, name) => {
  const spec = generateFormulaSpec(def, name);
  return new BuiltInFormula(spec);
});

export const loadStandardLibrary = (updateManager: UpdateManager): FormulaEnvironment => {
  const environment = new FormulaEnvironment();
  formulaEnvironmentReference.set(environment);
  Object.values(builtInFormulas).map(environment.addBuiltInFormula);
  loadBuiltInGrids(updateManager, environment);
  return environment;
}

export const getExampleFormulaForTesting = (): BuiltInFormula => {
  const spec = generateFormulaSpec(formulaDefs.Power, "Power");
  return new BuiltInFormula(spec);
}


// TODO clean this up
const formulaEnvironmentReference = (() => {
  let env: FormulaEnvironment;
  return {
    set: (environment: FormulaEnvironment) => { env = environment; },
    get: () => env,
  };
})();

const getCoordinateSystemData = (rowValue: RowValue): CoordinateSystem => {
  const environment = formulaEnvironmentReference.get();
  const centerValue = project(rowValue, 'Center', environment) as RowValue;
  const xValue = project(centerValue, 'X', environment) as NumberValue;
  const yValue = project(centerValue, 'Y', environment) as NumberValue;
  const scaleValue = project(rowValue, 'Scale', environment) as NumberValue;
  const rotationValue = project(rowValue, 'Rotation', environment) as RowValue;
  const ccwValue = project(rotationValue, 'Rotation CCW', environment) as NumberValue;
  const x = xValue.value;
  const y = yValue.value;
  const center = {x, y}
  const scale = scaleValue.value;
  const ccw = ccwValue.value;
  const rotation = {ccw};
  return {center, scale, rotation};
}

const project = (rowValue: RowValue, columnName: string, environment: FormulaEnvironment): Value => {
  const grid = environment.getGridById(rowValue.type.schemaId.gridId);
  const ns = grid.namespace;
  const columnId = ns.getReferenceForName(columnName)!.id;
  return rowValue.dict[columnId];
}