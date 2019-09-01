import {FormulaEnvironment} from '@language/formula_environment';
import {Parser} from "@language/parser";
import {ListValue, Value, ValueUtils} from '@language/values';
import {ohmGrammar} from './grammar';

export type JestErrorMatcher = string | jest.Constructable | RegExp | Error;

type primitive = number | boolean | string;

// This type should be Array<primitive | Literals> but TS can't handle circular references
type ArrayLiteral = Array<primitive | any[]>;

export type ConvertibleToValue = Value | ArrayLiteral | primitive;

export class TestUtils {
  public static defaultBeforeAll = () => {
    Parser.setGrammarForTests(ohmGrammar);
  }

  private static makeListValue = (literals: ArrayLiteral, environment: FormulaEnvironment): ListValue => {
    const valuesList = literals.map(lit => typeof lit === 'object' ?
      TestUtils.makeListValue(lit as ArrayLiteral, environment) :
      ValueUtils.primitiveOfInferType(lit));
    return ValueUtils.listOfInferType(valuesList, environment);
  }

  public static asValue = (value: ConvertibleToValue, environment: FormulaEnvironment): Value => {
    if (typeof value !== 'object') {
      return ValueUtils.primitiveOfInferType(value);
    } else if (Array.isArray(value)) {
      return TestUtils.makeListValue(value, environment);
    }
    return value;
  }
}