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

  private static makeListValue = (literals: ArrayLiteral): ListValue => {
    const valuesList = literals.map(lit => typeof lit === 'object' ?
      TestUtils.makeListValue(lit as ArrayLiteral) :
      ValueUtils.primitiveOfInferType(lit));
    return ValueUtils.listOfInferType(valuesList);
  }

  public static asValue = (value: ConvertibleToValue): Value => {
    if (typeof value !== 'object') {
      return ValueUtils.primitiveOfInferType(value);
    } else if (Array.isArray(value)) {
      return TestUtils.makeListValue(value);
    }
    return value;
  }
}