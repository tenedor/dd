import * as _ from 'lodash';
import {Namespace} from 'ohm-js';

import {RODictionary} from '@utils/types';
import {assertUnreachable, escapeAndQuote, unescape} from '@utils/utils';
import {AssignmentsUnres, BinaryOpUnres, CallUnres, ExpressionUnres, IdentifierUnres,
        IndexUnres, LambdaUnres, ListUnres, ParenthesesUnres, PrimitiveUnres,
        ProjectUnres, UnaryOpUnres, UnresolvedAST} from './ast';
import {BinaryOpUtils} from './binary_op';
import {Grammar, Node, ohm, Semantics} from './ohm';
import {Type, TypeUtils} from './types';
import {UnaryOpUtils} from './unary_op';

interface SuccessfulParseResult {
  readonly succeeded: true;
  readonly ast: UnresolvedAST;
}

interface SuccessfulExpressionParseResult extends SuccessfulParseResult {
  readonly ast: ExpressionUnres;
}

interface ParseFailure {
  readonly succeeded: false;
  readonly message: string;
}

export type ValueParseResult = SuccessfulParseResult | ParseFailure;
export type ExpressionParseResult = SuccessfulExpressionParseResult | ParseFailure;

export class Parser {
  private static initialized = false;
  private static _grammar: Namespace;
  private static formulaGrammar: Grammar;
  private static formulaSemantics: Semantics;

  private static success = (ast: UnresolvedAST): SuccessfulParseResult => {
    return {ast, succeeded: true};
  }

  private static failureOf = (message: string): ParseFailure => {
    return {succeeded: false, message};
  }

  private static expressionSuccess = (ast: ExpressionUnres): SuccessfulExpressionParseResult => {
    return {ast, succeeded: true};
  }

  private static parseNumber = (unparsed: string): ValueParseResult => {
      const v = parseFloat(unparsed);
      if (isNaN(v)) {
        return Parser.failureOf(`${unparsed} is not a number`);
      }
      return Parser.success(new PrimitiveUnres(v, TypeUtils.Number));
  }

  private static parseBoolean = (unparsed: string): ValueParseResult => {
    if (unparsed !== "true" && unparsed !== "false") {
      return Parser.failureOf(`${unparsed} is not a boolean`);
    }
    const v = unparsed === "true";
    return Parser.success(new PrimitiveUnres(v, TypeUtils.Boolean));
  }

  private static parseString = (unparsed: string): SuccessfulParseResult => {
    return Parser.success(new PrimitiveUnres(unparsed, TypeUtils.String));
  }

  private static parseRowLiteral = (unparsed: string): ValueParseResult => {
    Parser.ensureInitialized();
    const match = Parser.formulaGrammar.match(unparsed, "CallExp");
    if (match.succeeded()) {
      const ast = Parser.formulaSemantics(match).toAST() as CallUnres;
      return Parser.success(ast);
    }
    return Parser.failureOf(match.message || `Failed to parse row literal ${unparsed}`);
  }

  public static parseLiteral = (unparsed: string, type: Type): ValueParseResult => {
    if (!TypeUtils.supportsLiterals(type)) {
      return Parser.failureOf(`Literal ${type} values are not supported.`);
    } else if (TypeUtils.isNumber(type)) {
      return Parser.parseNumber(unparsed);
    } else if (TypeUtils.isBoolean(type)) {
      return Parser.parseBoolean(unparsed);
    } else if (TypeUtils.isString(type)) {
      return Parser.parseString(unparsed);
    } else if (TypeUtils.OLD_isDrawing(type)) {
      // for now
      return Parser.failureOf(`Literal ${type} values are not currently supported.`);
    } else if (TypeUtils.isList(type)) {
      // for now
      return Parser.failureOf(`Literal ${type} values are not currently supported.`);
    } else if (TypeUtils.isRow(type)) {
      return Parser.parseRowLiteral(unparsed);
    } else {
      return assertUnreachable(type);
    }
  }

  public static parseExpression = (unparsed: string): ExpressionParseResult => {
    Parser.ensureInitialized();
    const match = Parser.formulaGrammar.match(unparsed);
    if (match.succeeded()) {
      const ast = Parser.formulaSemantics(match).toAST() as ExpressionUnres;
      return Parser.expressionSuccess(ast);
    }
    return Parser.failureOf(match.message || `Failed to parse expression ${unparsed}`);
  }

  private static isValidUnquotedIdent = (ident: string): boolean => {
    Parser.ensureInitialized();
    return Parser.formulaGrammar.match(ident, 'unquotedIdent').succeeded();
  }

  public static identToText(ident: string): string {
    return Parser.isValidUnquotedIdent(ident) ? ident : escapeAndQuote(ident, "'");
  }

  public static stringToText(str: string): string {
    return escapeAndQuote(str, '"');
  }

  public static setGrammarForTests = (source: string) => {
    Parser._grammar = ohm.grammars(source);
  }

  private static get grammar(): Namespace {
    if (!Parser._grammar) {
      Parser._grammar = ohm.grammarsFromScriptElements();
    }
    return Parser._grammar;
  }

  private static ensureInitialized = () => {
    if (Parser.initialized) {
      return;
    }
    Parser.initialized = true;

    Parser.formulaGrammar = Parser.grammar.Formula;
    Parser.formulaSemantics = Parser.formulaGrammar.createSemantics().addOperation('toAST', {
      Exp(e) {
        return new ExpressionUnres(e.toAST());
      },
      LambdaExp_lambda(id, _a, e) {
        const ident = new IdentifierUnres(id.toAST());
        return new LambdaUnres(ident, e.toAST());
      },
      AndOrExp_and: createBinaryOpUnres,
      AndOrExp_or: createBinaryOpUnres,
      EqExp_eq: createBinaryOpUnres,
      EqExp_neq: createBinaryOpUnres,
      RelExp_lt: createBinaryOpUnres,
      RelExp_lte: createBinaryOpUnres,
      RelExp_gt: createBinaryOpUnres,
      RelExp_gte: createBinaryOpUnres,
      AddExp_plus: createBinaryOpUnres,
      AddExp_minus: createBinaryOpUnres,
      MulExp_times: createBinaryOpUnres,
      MulExp_divide: createBinaryOpUnres,
      MulExp_mod: createBinaryOpUnres,
      UnaryOpExp_not: createUnaryOpUnres,
      UnaryOpExp_negate: createUnaryOpUnres,
      IndexExp_index(e1, _b1, e2, _b2) {
        return new IndexUnres(e1.toAST(), e2.toAST());
      },
      IndexExp_project(e1, _dot, e2) {
        return new ProjectUnres(e1.toAST(), e2.toAST());
      },
      CallExp_call(id, _p1, asmts, _c, _p2) {
        const asmtPTuples = asmts.toAST() as Array<[string, UnresolvedAST]>;
        const asmtsPList = asmtPTuples.map(([asmtId, e]) => ({[asmtId]: e}));
        const asmtsP = _.extend({}, ...asmtsPList) as RODictionary<UnresolvedAST>;
        const asmtIds = asmtPTuples.map(([asmtId, _e]) => asmtId);
        const assignmentsUnres = new AssignmentsUnres(asmtsP, asmtIds);
        return new CallUnres(id.toAST(), assignmentsUnres);
      },
      Assignment(id, _op, e) {
        // Strictly speaking this is not a toAST operation...
        return [id.toAST(), e.toAST()];
      },
      IdentExp_ident(id) {
        return new IdentifierUnres(id.toAST());
      },
      GroupExp_parens(_p1, e, _p2) {
        return new ParenthesesUnres(e.toAST());
      },
      GroupExp_list(_b1, es, _c, _b2) {
        return new ListUnres(es.toAST());
      },
      number(_int, _dot, _fraction) {
        const num = parseFloat((this as Node).sourceString);
        return new PrimitiveUnres(num, TypeUtils.Number);
      },
      boolean_true(_t) {
        return new PrimitiveUnres(true, TypeUtils.Boolean);
      },
      boolean_false(_f) {
        return new PrimitiveUnres(false, TypeUtils.Boolean);
      },
      string(_q1, str, _q2) {
        const s = unescape(str.sourceString, "\\");
        return new PrimitiveUnres(s, TypeUtils.String);
      },
      unquotedIdent(_char, _str) {
        return (this as Node).sourceString;
      },
      quotedIdent(_q1, str, _q2) {
        return unescape(str.sourceString, "\\");
      },
      NonemptyListOf(e, _sep, es) {
        return [e.toAST()].concat(es.toAST());
      },
      EmptyListOf() {
        return [];
      },
    });
  }
}


const createBinaryOpUnres = (e1: Node, op: Node, e2: Node): BinaryOpUnres  => {
  const _op = op.sourceString.trim();
  if (!BinaryOpUtils.isBinaryOp(_op)) {
    throw new Error(`Invalid parser match: op node source string \`${_op}\` is not a BinaryOp`);
  }
  return new BinaryOpUnres(_op, e1.toAST(), e2.toAST());
}

const createUnaryOpUnres = (op: Node, e: Node): UnaryOpUnres  => {
  const _op = op.sourceString.trim();
  if (!UnaryOpUtils.isUnaryOp(_op)) {
    throw new Error(`Invalid parser match: op node source string \`${_op}\` is not a UnaryOp`);
  }
  return new UnaryOpUnres(_op, e.toAST());
}