import * as _ from 'lodash';

import {ConvertibleToValue, JestErrorMatcher, TestUtils} from '@test_utils/test_utils';
import {DictReferenceResolver} from '../dict_reference_resolver';
import {FormulaEnvironment} from '../formula_environment';
import {NameResolver} from '../name_resolver';
import {Parser} from '../parser';
import {Value, ValueUtils} from '../values';

enum FailureStage {
  FAILS_PARSE = "FAILS_PARSE",
  FAILS_RESOLUTION = "FAILS_RESOLUTION",
  FAILS_EVALUATION = "FAILS_EVALUATION",
  SUCCEEDS = "SUCCEEDS",
}

interface FormulaTestInput {
  formula: string,
  result?: ConvertibleToValue,
  lambdaArg?: ConvertibleToValue,
  error?: JestErrorMatcher,
  asText?: string,
}

interface FormulaTestConfig {
  failureStage?: FailureStage,
  nameResolver?: NameResolver,
  resolver?: DictReferenceResolver,
}

interface FormulaTestConfigDefaults {
  failureStage: FailureStage,
  nameResolver: NameResolver,
  resolver: DictReferenceResolver,
}

const makeTestConfigDefaults = (environment: FormulaEnvironment): FormulaTestConfigDefaults => {
  return {
    failureStage: FailureStage.SUCCEEDS,
    nameResolver: environment.nameResolver,
    resolver: new DictReferenceResolver({}, environment),
  };
}

const testFormulas = (name: string, formulas: FormulaTestInput[], environment: FormulaEnvironment, config: FormulaTestConfig = {}) => {
  const {failureStage, nameResolver, resolver} = _.defaults({}, config, makeTestConfigDefaults(environment));

  it(name, () => {
    formulas.forEach(({formula, result: expectedResult, lambdaArg, error: expectedError, asText: expectedText}) => {
      // parse
      const parseResult = Parser.parseExpression(formula);
      if (failureStage === FailureStage.FAILS_PARSE) {
        expect(parseResult.succeeded).toBe(false);
        return;
      }
      expect(parseResult.succeeded).toBe(true);

      const lambdaArgV = lambdaArg === undefined ? undefined : TestUtils.asValue(lambdaArg, environment);

      if (parseResult.succeeded) {
        // resolve
        const {ast} = parseResult;
        const extendedNameResolver = lambdaArgV ? nameResolver.extendWithIteratorType(lambdaArgV.type) : nameResolver;
        const resolve = () => ast.resolve(extendedNameResolver);
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
        const evaluate = () => astR.eval(resolver);
        if (failureStage === FailureStage.FAILS_EVALUATION) {
          expect(evaluate).toThrow(expectedError);
          return;
        }
        const _result = evaluate();
        const result = lambdaArgV && ValueUtils.isLambda(_result) ? _result.lambda(lambdaArgV) : _result;

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
  resolver?: DictReferenceResolver,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`runtime error - ${name}`, tests, environment, {failureStage: FailureStage.FAILS_EVALUATION, nameResolver, resolver});
}

const expectResults = (
  name: string,
  formulas: Array<{formula: string, result: ConvertibleToValue, lambdaArg?: ConvertibleToValue}>,
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  resolver?: DictReferenceResolver,
) => {
  testFormulas(name, formulas, environment, {failureStage: FailureStage.SUCCEEDS, nameResolver, resolver});
}

const expectToTextIrregular = (
  name: string,
  formulas: Array<{formula: string, asText: string}>,
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  resolver?: DictReferenceResolver,
) => {
  testFormulas(name, formulas, environment, {failureStage: FailureStage.SUCCEEDS, nameResolver, resolver});
}

const expectToText = (
  name: string,
  formulas: string[],
  environment: FormulaEnvironment,
  nameResolver?: NameResolver,
  resolver?: DictReferenceResolver,
) => {
  const tests = formulas.map(formula => ({formula, asText: formula}));
  testFormulas(name, tests, environment, {failureStage: FailureStage.SUCCEEDS, nameResolver, resolver});
}


export const buildLanguageTestHelpers = (environment: FormulaEnvironment) => {
  return {
    expectParseErrors: (name: string, formulas: string[]) => {
      expectParseErrors(name, formulas, environment);
    },
    expectResolutionErrors: (name: string, formulas: string[], nameResolver?: NameResolver) => {
      expectResolutionErrors(name, formulas, environment, nameResolver);
    },
    expectEvaluationErrors: (name: string, formulas: string[], nameResolver?: NameResolver, resolver?: DictReferenceResolver) => {
      expectEvaluationErrors(name, formulas, environment, nameResolver, resolver);
    },
    expectResults: (name: string, formulas: Array<{formula: string, result: ConvertibleToValue, lambdaArg?: ConvertibleToValue}>, nameResolver?: NameResolver, resolver?: DictReferenceResolver) => {
      expectResults(name, formulas, environment, nameResolver, resolver);
    },
    expectToTextIrregular: (name: string, formulas: Array<{formula: string, asText: string}>, nameResolver?: NameResolver, resolver?: DictReferenceResolver) => {
      expectToTextIrregular(name, formulas, environment, nameResolver, resolver);
    },
    expectToText: (name: string, formulas: string[], nameResolver?: NameResolver, resolver?: DictReferenceResolver) => {
      expectToText(name, formulas, environment, nameResolver, resolver);
    },
  };
}