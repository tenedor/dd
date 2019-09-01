import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid';
import {ConvertibleToValue, JestErrorMatcher, TestUtils} from '@test_utils/test_utils';
import {FormulaEnvironment} from '../formula_environment';
import {buildNamespace, ConstructorNamespace, NameResolver, NamespaceResolver}
        from '../name_resolver';
import {Parser} from '../parser';
import {RelativeValueReference} from '../reference';
import {TypeUtils} from '../types';
import {ValueResolver} from '../value_resolver';
import {ValueUtils} from '../values';

const fakeGridId = 'fake-grid-id';

const fakeColumns = {
  'fake-column-1': {type: TypeUtils.Number, name: 'One', value: ValueUtils.numberOf(1)},
  'fake-column-2': {type: TypeUtils.ListOf(TypeUtils.Boolean), name: 'True and False', value: TestUtils.asValue([true, false])},
};

const fakeGridNamespace = {
  getReferenceForName: (name: string) => {
    const id = _.findKey(fakeColumns, c => c.name === name)!;
    const type = fakeColumns[id].type;
    return new RelativeValueReference(id, type, (r: NameResolver) => name);
  },
  getNameForReference: (columnId: string) => fakeColumns[columnId].name,
};

const fakeGrid = {id: fakeGridId, namespace: fakeGridNamespace};

const formulaEnvironment = new FormulaEnvironment();
// TODO make an actual grid to avoid casting
formulaEnvironment.addGrid(fakeGrid as any as Grid);

const gridColumnNameResolver = formulaEnvironment.nameResolver.resolverFor(TypeUtils.GridOf(fakeGridId));
const gridColumnValueResolver = new ValueResolver(_.mapValues(fakeColumns, 'value'));

const nullNamespaceResolver: NamespaceResolver = {resolveNamespace: () => {throw new Error("unexpected namespace resolution")}};
const nullNameResolver = new NameResolver(nullNamespaceResolver, new ConstructorNamespace({}), buildNamespace({}));
const nullValueResolver = new ValueResolver({});


enum FailureStage {
  FAILS_PARSE = "FAILS_PARSE",
  FAILS_RESOLUTION = "FAILS_RESOLUTION",
  FAILS_EVALUATION = "FAILS_EVALUATION",
  SUCCEEDS = "SUCCEEDS",
}

interface FormulaTestInput {
  formula: string,
  result?: ConvertibleToValue,
  error?: JestErrorMatcher,
  asText?: string,
}

interface FormulaTestConfig {
  failureStage?: FailureStage,
  nameResolver?: NameResolver,
  valueResolver?: ValueResolver,
}

const testFormulas = (name: string, formulas: FormulaTestInput[], {
  failureStage = FailureStage.SUCCEEDS,
  nameResolver = nullNameResolver,
  valueResolver = nullValueResolver,
}: FormulaTestConfig = {}) => {
  it(name, () => {
    formulas.forEach(({formula, result: expectedResult, error: expectedError, asText: expectedText}) => {
      // parse
      const parseResult = Parser.parseExpression(formula);
      if (failureStage === FailureStage.FAILS_PARSE) {
        expect(parseResult.succeeded).toBe(false);
        return;
      }
      expect(parseResult.succeeded).toBe(true);

      if (parseResult.succeeded) {
        // resolve
        const {ast} = parseResult;
        const resolve = () => ast.resolve(nameResolver);
        if (failureStage === FailureStage.FAILS_RESOLUTION) {
          expect(resolve).toThrow(expectedError);
          return;
        }
        const astR = resolve();

        // to text
        if (expectedText !== undefined) {
          const actualText = astR.toText(nameResolver);
          expect(actualText).toBe(expectedText);
        }

        // evaluate
        const evaluate = () => astR.eval(valueResolver);
        if (failureStage === FailureStage.FAILS_EVALUATION) {
          expect(evaluate).toThrow(expectedError);
          return;
        }
        const result = evaluate();

        // result
        if (expectedResult !== undefined) {
          const expectation = TestUtils.asValue(expectedResult);
          expect(result).toEqual(expectation);
        }
      }
    });
  });
}

const expectParseErrors = (name: string, formulas: string[]) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(name, tests, {failureStage: FailureStage.FAILS_PARSE});
}

export const expectResolutionErrors = (
  name: string,
  formulas: string[],
  nameResolver: NameResolver = nullNameResolver,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`static error - ${name}`, tests, {failureStage: FailureStage.FAILS_RESOLUTION, nameResolver});
}

export const expectEvaluationErrors = (
  name: string,
  formulas: string[],
  nameResolver: NameResolver = nullNameResolver,
  valueResolver: ValueResolver = nullValueResolver,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`runtime error - ${name}`, tests, {failureStage: FailureStage.FAILS_EVALUATION, nameResolver, valueResolver});
}

export const expectResults = (
  name: string,
  formulas: Array<{formula: string, result: ConvertibleToValue}>,
  nameResolver: NameResolver = nullNameResolver,
  valueResolver: ValueResolver = nullValueResolver,
) => {
  testFormulas(name, formulas, {failureStage: FailureStage.SUCCEEDS, nameResolver, valueResolver});
}

const expectToTextIrregular = (
  name: string,
  formulas: Array<{formula: string, asText: string}>,
  nameResolver: NameResolver = nullNameResolver,
  valueResolver: ValueResolver = nullValueResolver,
) => {
  testFormulas(name, formulas, {failureStage: FailureStage.SUCCEEDS, nameResolver, valueResolver});
}

const expectToText = (
  name: string,
  formulas: string[],
  nameResolver: NameResolver = nullNameResolver,
  valueResolver: ValueResolver = nullValueResolver,
) => {
  const tests = formulas.map(formula => ({formula, asText: formula}));
  testFormulas(name, tests, {failureStage: FailureStage.SUCCEEDS, nameResolver, valueResolver});
}


beforeAll(TestUtils.defaultBeforeAll);

describe('Language', () => {

  describe('Parse errors', () => {
    expectParseErrors('empty string', [
      "",
    ]);

    expectParseErrors('misformed numbers', [
      ".",
      "1.",
      ".1",
      "1.1.1",
    ]);

    expectParseErrors('mismatched enclosures', [
      "'beta",
      "beta'",
      "''beta'",
      "''beta''",
      "alpha.'beta",
      "alpha.beta'",
      "\"hello world",
      "hello world\"",
      "\"hello \" world\"",
      "\"hello world\"\"",
      "\"\"hello world\"\"",
      "(1 + 2",
      "(1 + 2))",
      "[1 + 2",
      "[1 + 2]]",
      "[1 2]",
      "[1,, 2]",
      "sum(",
      "sum)",
      "sum(v = 1",
      "sum(v == 1)",
      "sum(v 1)",
      "sum(v = 1 u = 2)",
      "sum(v = 1, , u = 2)",
      "v = 1",
      "(v = 1)",
    ]);

    expectParseErrors('missing operands', [
      "+",
      "+ 1",
      "1 +",
      "-",
      "!",
      "false !",
      "false & !",
      "[1, 2, 3][]",
      "()",
      "alpha.",
      ".alpha",
      "sum(v)",
      "sum(v = )",
      "sum( = 1)",
      "sum(1)",
      "alpha beta",
      "alpha ->",
      "-> beta",
    ]);

    expectParseErrors('illegal whitespace', [
      "alpha. beta",
      "alpha .beta",
      "alpha . beta",
      "alpha [1]",
      "sum ()",
      "sum (v = 1)",
    ]);

    expectParseErrors('reserved words', [
      "alpha.false",
      "alpha.true",
    ]);
  });


  describe('Primitives', () => {
    expectResults('numbers', [
      {formula: "3", result: 3},
      {formula: "3.95", result: 3.95},
    ]);

    expectResults('booleans', [
      {formula: "true", result: true},
      {formula: "false", result: false},
    ]);

    expectResults('strings', [
      {formula: '"alpha beta"', result: "alpha beta"},
      {formula: '"Honey I\'m home!"', result: "Honey I'm home!"},
      {
        formula: '" 12-3+4*5/(6%7)!==5>=<true&false|\'\\"^~`{}[1],,5.2?:\\\\"',
        result: " 12-3+4*5/(6%7)!==5>=<true&false|'\"^~`{}[1],,5.2?:\\",
      },
    ]);
  });


  describe('Lists and Indexing', () => {
    expectResolutionErrors('indexing things that aren\'t lists', [
      "1[1]",
      "false[1]",
      "[1, 2][1][2]",
    ]);

    expectResolutionErrors('narrowing a type from a heterogeneous list', [
      "[1, false][1] + 1",
      "[1, false][2] & false",
      "[[1, 2], 3][1][1]",
    ]);

    expectEvaluationErrors('index out of bounds', [
      "[][1]",
      "[1, 2, 3][-1]",
      "[1, 2, 3][0]",
      "[1, 2, 3][4]",
    ]);

    expectResults('lists', [
      {formula: "[1, 2, 3]", result: [1, 2, 3]},
      {formula: "[1, 2, 3,]", result: [1, 2, 3]},
      {formula: "[[1, 2, 3]]", result: [[1, 2, 3]]},
      {formula: "[[[1]], [[false]], [[\"alpha\"]]]", result: [[[1]], [[false]], [["alpha"]]]},
      {formula: "[1, [2], [[3]]]", result: [1, [2], [[3]]]},
    ]);

    expectResults('indexing', [
      {formula: "[1, 2, 3][1]", result: 1},
      {formula: "[1, 2, 3][1 + 1]", result: 2},
      {formula: "[[\"alpha\", 5, [false]], 9.2][2]", result: 9.2},
      {formula: "[[\"alpha\", 5, [false]], [9.2]][1][1]", result: "alpha"},
      {formula: "[[\"alpha\", 5, [false]], [9.2]][1][2]", result: 5},
      {formula: "[[[\"alpha\"], [5], [false]], [[9.2]]][1]", result: [["alpha"], [5], [false]]},
      {formula: "[[[\"alpha\"], [5], [false]], [[9.2]]][1][3]", result: [false]},
      {formula: "[[[\"alpha\"], [5], [false]], [[9.2]]][1][3][1]", result: false},
    ]);
  });


  describe('Grids and Projecting', () => {
    // not yet implemented
  });


  describe('Identifiers', () => {
    expectResults('function calls', [
      {formula: "One", result: 1},
      {formula: "'True and False'", result: [true, false]},
    ], gridColumnNameResolver, gridColumnValueResolver);
  });


  describe('Operators', () => {
    expectResolutionErrors('unary op type errors', [
      "-false",
      "-\"alpha\"",
      "!1",
      "!\"alpha\"",
    ]);

    expectResolutionErrors('biary op type errors', [
      // (boolean, boolean) -> boolean
      "false & 1",
      "false & \"alpha\"",
      "1 & \"alpha\"",

      // (T, T) -> boolean
      "false == 1",
      "false == \"alpha\"",
      "1 == \"alpha\"",

      // (T, T) -> T
      "1 + false",
      "1 + \"alpha\"",
      "false + \"alpha\"",
      "false + false",

      // (T, number) -> T
      "1 * false",
      "1 * \"alpha\"",
      "false * 1",
      "\"alpha\" * 1",

      // (number, number) -> number
      "1 % false",
      "1 % \"alpha\"",
    ]);

    expectEvaluationErrors('divide by zero', [
      "1 / 0",
    ]);

    expectResults('unary ops', [
      {formula: "-3", result: -3},
      {formula: "--3", result: 3},
      {formula: "---3", result: -3},
      {formula: "!false", result: true},
      {formula: "!!false", result: false},
      {formula: "!!!false", result: true},
    ]);

    expectResults('binary ops', [
      {formula: "3 + 2", result: 5},
      {formula: "3 - 2", result: 1},
      {formula: "3 * 2", result: 6},
      {formula: "3 / 2", result: 3 / 2},
      {formula: "3 % 2", result: 1},
      {formula: "3 < 2", result: false},
      {formula: "3 > 2", result: true},
      {formula: "3 <= 2", result: false},
      {formula: "3 >= 2", result: true},
      {formula: "3 != 2", result: true},
      {formula: "3 == 2", result: false},
      {formula: "false != true", result: true},
      {formula: "false | false", result: false},
      {formula: "false | true", result: true},
      {formula: "false & true", result: false},
      {formula: "true & true", result: true},
    ]);

    expectResults('multi-op expressions', [
      {formula: "-3+2", result: -1},
      {formula: "3*-2--5*4+1", result: 15},
      {formula: "false | 3 < 2", result: false},
    ]);
  });


  describe('Function Calls', () => {
    // Power defaults to Power(Base = 2, Exponent = 3)
    expectResults('function calls', [
      {formula: "Power()", result: 8},
      {formula: "Power(Base = 5)", result: 125},
      {formula: "Power(Exponent = 4)", result: 16},
      {formula: "Power(Base = 5, Exponent = 4)", result: 625},
      {formula: "Power(Exponent = Power(Base = 0))", result: 1},
    ], formulaEnvironment.nameResolver);
  });


  describe('Lambdas', () => {
    // not yet implemented
  });


  describe('Precedence', () => {
    expectResults('order of operations', [
      {formula: "-3+2", result: -1},
      {formula: "3*-2--5*4+1", result: 15},
      {formula: "(3*-2--5*4+1)", result: 15},
      {formula: "((3*(-2))-(((-5)*4)+1))", result: 13},
      {formula: "3*(-2--(5*4+1))", result: 57},
      {formula: "false | 3 < 2", result: false},
      {formula: "10 + Power(Exponent = 6 % 4) * 3", result: 22},
      {formula: "'True and False'[2] | false", result: false},
    ], gridColumnNameResolver, gridColumnValueResolver);
  });


  describe('To Text', () => {
    expectToText('various expressions', [
      "0.123 + 45.67 - ---1 / -2 % 3",
      "true | false & \"alpha beta\" > \"gamma\"",
      "[1, 2, [3, 4, []][1]][2]",
      "((0.123) + 45.67 - -(--1)) / -(2 % 3)",
      "Power(Base = 1, Exponent = 6 % 4) + One",
      "'True and False'[2] | false",
    ], gridColumnNameResolver, gridColumnValueResolver);

    expectToTextIrregular('whitespace is canonicalized', [
      {formula: "  1 ", asText: "1"},
      {formula: "1-  -1 ", asText: "1 - -1"},
      {formula: "((3*(-2))-(((-5)*4)+1))", asText: "((3 * (-2)) - (((-5) * 4) + 1))"},
    ]);

    expectToTextIrregular('trailing commas are removed', [
      {formula: "[1, 2, 3,]", asText: "[1, 2, 3]"},
    ]);
  });
});