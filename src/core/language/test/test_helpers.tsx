import * as _ from 'lodash';

import {ConvertibleToValue, JestErrorMatcher, TestUtils} from '@test_utils/test_utils';
import {FormulaEnvironment} from '../formula_environment';
import {NameResolver} from '../name_resolver';
import {Parser} from '../parser';
import {ValueResolver} from '../value_resolver';

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

interface FormulaTestConfigDefaults {
  failureStage: FailureStage,
  nameResolver: NameResolver,
  valueResolver: ValueResolver,
}

const makeTestConfigDefaults = (environment: FormulaEnvironment): FormulaTestConfigDefaults => {
  return {
    failureStage: FailureStage.SUCCEEDS,
    nameResolver: environment.nameResolver,
    valueResolver: new ValueResolver({}, environment),
  };
}

const testFormulas = (name: string, formulas: FormulaTestInput[], environment: FormulaEnvironment, config: FormulaTestConfig = {}) => {
  const {failureStage, nameResolver, valueResolver} = _.defaults({}, config, makeTestConfigDefaults(environment));

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
          const expectation = TestUtils.asValue(expectedResult, environment);
          expect(result).toEqual(expectation);
        }
      }
    });
  });
}

const expectParseErrors = (name: string, formulas: string[], environment: FormulaEnvironment) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(name, tests, environment, {failureStage: FailureStage.FAILS_PARSE});
}

const expectResolutionErrors = (
  name: string,
  formulas: string[],
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`static error - ${name}`, tests, environment, {failureStage: FailureStage.FAILS_RESOLUTION, nameResolver});
}

const expectEvaluationErrors = (
  name: string,
  formulas: string[],
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  valueResolver?: ValueResolver,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`runtime error - ${name}`, tests, environment, {failureStage: FailureStage.FAILS_EVALUATION, nameResolver, valueResolver});
}

const expectResults = (
  name: string,
  formulas: Array<{formula: string, result: ConvertibleToValue}>,
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  valueResolver?: ValueResolver,
) => {
  testFormulas(name, formulas, environment, {failureStage: FailureStage.SUCCEEDS, nameResolver, valueResolver});
}

const expectToTextIrregular = (
  name: string,
  formulas: Array<{formula: string, asText: string}>,
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  valueResolver?: ValueResolver,
) => {
  testFormulas(name, formulas, environment, {failureStage: FailureStage.SUCCEEDS, nameResolver, valueResolver});
}

const expectToText = (
  name: string,
  formulas: string[],
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  valueResolver?: ValueResolver,
) => {
  const tests = formulas.map(formula => ({formula, asText: formula}));
  testFormulas(name, tests, environment, {failureStage: FailureStage.SUCCEEDS, nameResolver, valueResolver});
}


export const buildLanguageTestHelpers = (environment: FormulaEnvironment) => {
  return {
    expectParseErrors: (name: string, formulas: string[]) => {
      expectParseErrors(name, formulas, environment);
    },
    expectResolutionErrors: (name: string, formulas: string[], nameResolver?: NameResolver) => {
      expectResolutionErrors(name, formulas, environment, nameResolver);
    },
    expectEvaluationErrors: (name: string, formulas: string[], nameResolver?: NameResolver, valueResolver?: ValueResolver) => {
      expectEvaluationErrors(name, formulas, environment, nameResolver, valueResolver);
    },
    expectResults: (name: string, formulas: Array<{formula: string, result: ConvertibleToValue}>, nameResolver?: NameResolver, valueResolver?: ValueResolver) => {
      expectResults(name, formulas, environment, nameResolver, valueResolver);
    },
    expectToTextIrregular: (name: string, formulas: Array<{formula: string, asText: string}>, nameResolver?: NameResolver, valueResolver?: ValueResolver) => {
      expectToTextIrregular(name, formulas, environment, nameResolver, valueResolver);
    },
    expectToText: (name: string, formulas: string[], nameResolver?: NameResolver, valueResolver?: ValueResolver) => {
      expectToText(name, formulas, environment, nameResolver, valueResolver);
    },
  };
}