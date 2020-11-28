import * as _ from 'lodash';

import {ConvertibleToValue, JestErrorMatcher, TestUtils} from '@test_utils/test_utils';
import {TypeEnvironmentWithProcedures} from '../ast';
import {FormulaEnvironment} from '../formula_environment';
import {Parser} from '../parser';
import {Namespace} from '../reference/namespace';
import {ReferenceResolver} from '../reference/reference_resolver';
import {ValueUtils} from '../values';

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
  namespace?: Namespace,
  resolver?: ReferenceResolver,
  env?: TypeEnvironmentWithProcedures,
}

interface FormulaTestConfigDefaults {
  failureStage: FailureStage,
  namespace: Namespace,
  resolver: ReferenceResolver,
  env: TypeEnvironmentWithProcedures,
}

const makeTestConfigDefaults = (environment: FormulaEnvironment): FormulaTestConfigDefaults => {
  return {
    failureStage: FailureStage.SUCCEEDS,
    namespace: environment.getGlobalNamespace(),
    resolver: environment.getGlobalResolver(),
    env: environment,
  };
}

const testFormulas = (name: string, formulas: FormulaTestInput[], environment: FormulaEnvironment, config: FormulaTestConfig = {}) => {
  const {failureStage, namespace, env, resolver} = _.defaults({}, config, makeTestConfigDefaults(environment));

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
        const extendedNameResolver = lambdaArgV ? namespace.extendWithIteratorType_DEPRECATED(lambdaArgV.type) : namespace;
        const resolve = () => ast.resolve(extendedNameResolver, env);
        if (failureStage === FailureStage.FAILS_RESOLUTION) {
          expect(resolve).toThrow(expectedError);
          return;
        }
        const astR = resolve();

        // to text
        if (expectedText !== undefined) {
          const actualText = astR.toText(namespace);
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
  namespace?: Namespace,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`static error - ${name}`, tests, environment, {failureStage: FailureStage.FAILS_RESOLUTION, namespace});
}

const expectEvaluationErrors = (
  name: string,
  formulas: string[],
  environment: FormulaEnvironment,
  namespace?: Namespace,
  resolver?: ReferenceResolver,
) => {
  const tests = formulas.map(formula => ({formula}));
  testFormulas(`runtime error - ${name}`, tests, environment, {failureStage: FailureStage.FAILS_EVALUATION, namespace, resolver});
}

const expectResults = (
  name: string,
  formulas: Array<{formula: string, result: ConvertibleToValue, lambdaArg?: ConvertibleToValue}>,
  environment: FormulaEnvironment,
  namespace?: Namespace,
  resolver?: ReferenceResolver,
) => {
  testFormulas(name, formulas, environment, {failureStage: FailureStage.SUCCEEDS, namespace, resolver});
}

const expectToTextIrregular = (
  name: string,
  formulas: Array<{formula: string, asText: string}>,
  environment: FormulaEnvironment,
  namespace?: Namespace,
  resolver?: ReferenceResolver,
) => {
  testFormulas(name, formulas, environment, {failureStage: FailureStage.SUCCEEDS, namespace, resolver});
}

const expectToText = (
  name: string,
  formulas: string[],
  environment: FormulaEnvironment,
  namespace?: Namespace,
  resolver?: ReferenceResolver,
) => {
  const tests = formulas.map(formula => ({formula, asText: formula}));
  testFormulas(name, tests, environment, {failureStage: FailureStage.SUCCEEDS, namespace, resolver});
}


export const buildLanguageTestHelpers = (environment: FormulaEnvironment) => {
  return {
    expectParseErrors: (name: string, formulas: string[]) => {
      expectParseErrors(name, formulas, environment);
    },
    expectResolutionErrors: (name: string, formulas: string[], namespace?: Namespace) => {
      expectResolutionErrors(name, formulas, environment, namespace);
    },
    expectEvaluationErrors: (name: string, formulas: string[], namespace?: Namespace, resolver?: ReferenceResolver) => {
      expectEvaluationErrors(name, formulas, environment, namespace, resolver);
    },
    expectResults: (name: string, formulas: Array<{formula: string, result: ConvertibleToValue, lambdaArg?: ConvertibleToValue}>, namespace?: Namespace, resolver?: ReferenceResolver) => {
      expectResults(name, formulas, environment, namespace, resolver);
    },
    expectToTextIrregular: (name: string, formulas: Array<{formula: string, asText: string}>, namespace?: Namespace, resolver?: ReferenceResolver) => {
      expectToTextIrregular(name, formulas, environment, namespace, resolver);
    },
    expectToText: (name: string, formulas: string[], namespace?: Namespace, resolver?: ReferenceResolver) => {
      expectToText(name, formulas, environment, namespace, resolver);
    },
  };
}