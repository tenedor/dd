import * as _ from 'lodash';

import {ResolutionTimeTypeHelper, ResolutionTimeTypeHelperVariant, UnresolvedAST}
        from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {ParseError, TypeError} from '@language/language_errors';
import {Parser} from '@language/parser';
import {BoundingType, Identifier, LambdaOfAnyType, LambdaType, ListOfAnyType, ListType,
        PrimitiveType, Type, TypeUtils} from '@language/types';
import {LambdaValue, ListValue, NumberValue, PartialRowValue, PrimitiveValue, RowValue,
        StringValue, Value, ValueUtils} from '@language/values';
import {UpdateManager} from '@models/core/update_manager';
import {BuiltInEval, BuiltInFormula, BuiltInFormulaSpec, Formula, Parameter}
        from '@models/domain_specific/procedure';
import {RODictionary} from '@utils/types';
import {loadBuiltInGrids} from './built_in_grids';

type Primitive = number | boolean | string;
type MaterializedValue = Primitive | ListValue | LambdaValue;
interface EvalEnvironment {
  resolvedReturnType: Type,
}
type MaterializedEval = (parameters: {[name: string]: MaterializedValue}, env: EvalEnvironment) => MaterializedValue;

const isPrimitive = (value: MaterializedValue): value is Primitive => {
  return typeof value !== 'object';
}

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

// Report bottom for resolution-time formula return types to ensure the formula is assignable
const ResolutionTimeReturnType = BoundingType.BOTTOM;

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

  public static listOfType = <T extends Type> (itemType: T, defaultValue: ListValue<T>): ParameterGenerator<ListType<T>> => {
    return {type: TypeUtils.ListOf(itemType), defaultValue};
  }

  public static listOfAny = (defaultValue: ListValue = ParameterUtils.defaultListValue): ParameterGenerator<ListOfAnyType> => {
    return {type: TypeUtils.ListOfAny, defaultValue};
  }

  public static lambdaOfAny = (defaultValue: LambdaValue = ParameterUtils.defaultLambdaValue): ParameterGenerator<LambdaOfAnyType> => {
    return {type: TypeUtils.LambdaOfAny, defaultValue};
  }

  public static any = (defaultValue: MaterializedValue): ParameterGenerator<BoundingType.TOP> => {
    return {type: TypeUtils.Top, defaultValue};
  }

  public static readonly baseShapeDrawing = {
    Fill: ParameterUtils.string("black"),
  }
}

const getUID = (name: string) => `stdlib-${name}`;
const getParameterUID = (formulaId: Identifier, parameterName: string) => `${formulaId}-${parameterName}`;

const dematerializeValue = <T extends Type = Type> (value: MaterializedValue, type: T): Value<T> => {
  if (TypeUtils.isLambda(type)) {
    return value as LambdaOfAnyType & Value<T>;
  } else if (TypeUtils.isList(type)) {
    return value as ListValue & Value<T>;
  } else if (TypeUtils.isRow(type)) {
    return value as RowValue & Value<T>;
  } else if (TypeUtils.isPrimitive(type)) {
    return ValueUtils.primitiveOf(value as Primitive, type);
  } else if (TypeUtils.isTop(type)) {
    switch (typeof value) {
      case 'number':
      case 'boolean':
      case 'string':
        return ValueUtils.primitiveOfInferType(value) as Value<T>;
    }
  }
  throw new TypeError(`Cannot dematerialize values for ${TypeUtils.toString(type)} types currently`);
}

const materializeValue = (value: PrimitiveValue | ListValue): MaterializedValue => {
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
  return (parameters: PartialRowValue, runtimeResolvedReturnType?: Type): Value<R> => {
    const defaultParametersByName = _.mapValues(parameterDefs, p => p.defaultValue);
    const parametersWithDefaults = _.extend({}, defaultParametersByName, parameters.dict);
    const parametersByName = _.mapKeys(parametersWithDefaults, (parameter: Value, id: string) => {
      return parameterDefs[id].name;
    });
    const materializedParameters = _.mapValues(parametersByName, materializeValue);
    const resolvedReturnType = runtimeResolvedReturnType as R || returnType;
    const materializedValue = materializedEval(materializedParameters, {resolvedReturnType});
    return dematerializeValue(materializedValue, resolvedReturnType);
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

const getFormulaDefs = (): {[name: string]: FormulaGenerator} => ({
  /**
   * Control Flow Formulas
   */

  // TODO Lazy Evaluate!
  If: {
    returnType: ResolutionTimeReturnType,
    parameters: {
      If: ParameterUtils.boolean(false),
      Then: ParameterUtils.any(true),
      Else: ParameterUtils.any(false),
    },
    eval: ({If: ifVal, Then: thenVal, Else: elseVal}: {
      If: boolean, Then: MaterializedValue, Else: MaterializedValue,
    }, {resolvedReturnType}: EvalEnvironment): MaterializedValue => {
      // clean up the hack of using boolean default values
      const booleanReturn = TypeUtils.isBoolean(resolvedReturnType);
      const _thenVal = typeof thenVal === 'boolean' && !booleanReturn ? elseVal : thenVal;
      const _elseVal = typeof elseVal === 'boolean' && !booleanReturn ? thenVal : elseVal;
      return ifVal ? _thenVal : _elseVal;
    },
    resolutionTimeTypeHelper: {
      variant: ResolutionTimeTypeHelperVariant.BASIC,
      resolveCallReturnType: (
        {Then: thenType, Else: elseType}: RODictionary<Type>,
        environment: FormulaEnvironment,
      ) => {
        return thenType && elseType ?
          TypeUtils.union(thenType, elseType, environment) :
          thenType || elseType || PrimitiveType.BOOLEAN;
      }
    },
  },

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
    returnType: TypeUtils.ListOf(ResolutionTimeReturnType),
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
      variant: ResolutionTimeTypeHelperVariant.LAMBDA,
      lambdaAsmtName: "Fn",
      resolutionTimeAsmtDefaultValues: {
        Values: buildDefaultAsmtUnres('[]'),
        Fn: buildDefaultAsmtUnres('V -> V'),
      },
      resolveLambdaType: ({Values: valuesType}: RODictionary<Type>) =>
          TypeUtils.LambdaOf((valuesType as ListType).itemType, BoundingType.BOTTOM),
      resolveCallReturnType: ({Fn: fnType}: RODictionary<Type>, environment: FormulaEnvironment) =>
          TypeUtils.ListOf((fnType as LambdaType).outputType),
    },
  },

  Concatenate: {
    returnType: TypeUtils.ListOf(ResolutionTimeReturnType),
    parameters: {
      Lists: ParameterUtils.listOfType(TypeUtils.ListOfAny, ValueUtils.listOf([], TypeUtils.ListOfAny)),
    },
    eval: <T extends Type> ({Lists: lists}: {Lists: ListValue<ListType<T>>}, {resolvedReturnType}: {resolvedReturnType: ListType<T>}): ListValue<T> => {
      const flattened = _.flatten(lists.list.map((ls: ListValue<T>) => ls.list));
      return ValueUtils.listOf(flattened, resolvedReturnType.itemType);
    },
    resolutionTimeTypeHelper: {
      variant: ResolutionTimeTypeHelperVariant.BASIC,
      resolveCallReturnType: ({Lists: listsType}: RODictionary<Type>, environment: FormulaEnvironment) => {
        return listsType && TypeUtils.isList(listsType) && TypeUtils.isListOfList(listsType) ?
          listsType.itemType :
          TypeUtils.EmptyList;
      }
    },
  },

  /**
   * String Formulas
   */

  Join: {
    returnType: TypeUtils.String,
    parameters: {
      Values: ParameterUtils.listOfType(TypeUtils.String, ValueUtils.listOf([], TypeUtils.String)),
      Separator: ParameterUtils.string(''),
    },
    eval: ({
      Values: values, Separator: separator
    }: {Values: ListValue<PrimitiveType.STRING>, Separator: string}): string => {
      const strings = values.list.map((v: StringValue) => v.value);
      return strings.join(separator);
    },
  },

  Split: {
    returnType: TypeUtils.ListOf(TypeUtils.String),
    parameters: {
      String: ParameterUtils.string(''),
      Separator: ParameterUtils.string(''),
    },
    eval: ({
      String: _string, Separator: separator
    }: {String: string, Separator: string}): ListValue<PrimitiveType.STRING> => {
      const strings = _string.split(separator).map(s => ValueUtils.stringOf(s));
      return ValueUtils.listOf(strings, TypeUtils.String);
    },
  },

  /**
   * Type Formulas
   */

  String: {
    returnType: TypeUtils.String,
    parameters: {
      Value: ParameterUtils.any(""),
    },
    eval: ({Value: value}: {Value: MaterializedValue}): string => {
      return `${isPrimitive(value) ? value : ValueUtils.toString_NoEnvironment(value)}`;
    },
  },

  /**
   * Arithmetic Formulas
   */

  Min: {
    returnType: TypeUtils.Number,
    parameters: {
      Values: ParameterUtils.listOfType(TypeUtils.Number, ValueUtils.listOf([], TypeUtils.Number)),
    },
    eval: ({Values: values}: {Values: ListValue<PrimitiveType.NUMBER>}): number => {
      const vs = values.list.map((v: NumberValue) => v.value);
      return Math.min(...vs);
    },
  },

  Max: {
    returnType: TypeUtils.Number,
    parameters: {
      Values: ParameterUtils.listOfType(TypeUtils.Number, ValueUtils.listOf([], TypeUtils.Number)),
    },
    eval: ({Values: values}: {Values: ListValue<PrimitiveType.NUMBER>}): number => {
      const vs = values.list.map((v: NumberValue) => v.value);
      return Math.max(...vs);
    },
  },

  Sq: {
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
});

const getBuiltInFormulas = (): RODictionary<Formula> => {
  return _.mapValues(getFormulaDefs(), (def, name) => {
    const spec = generateFormulaSpec(def, name);
    return new BuiltInFormula(spec);
  });
}

export const loadStandardLibrary = (updateManager: UpdateManager): FormulaEnvironment => {
  const environment = new FormulaEnvironment();
  Object.values(getBuiltInFormulas()).map(environment.addBuiltInFormula);
  loadBuiltInGrids(updateManager, environment);
  return environment;
}

export const getExampleFormulaForTesting = (): BuiltInFormula => {
  const def: FormulaGenerator = {
    returnType: TypeUtils.Number,
    parameters: {
      Base: ParameterUtils.number(2),
      Exponent: ParameterUtils.number(3),
    },
    eval: ({Base: base, Exponent: exponent}: {Base: number, Exponent: number}): number => Math.pow(base, exponent),
  };

  const spec = generateFormulaSpec(def, "Power");
  return new BuiltInFormula(spec);
}