import * as _ from 'lodash';

import {RODictionary} from '@utils/types';
import {escapeAndQuote} from '@utils/utils';
import {AssignmentsUnres, BinaryOpUnres, CallUnres, ExpressionUnres, IdentifierUnres,
        IndexUnres, LambdaUnres, ListUnres, PrimitiveUnres, ProjectUnres, UnaryOpUnres,
        UnresolvedAST} from './ast';
import {BinaryOpUtils} from './binary_op';
import {Grammar, Node, ohm, Semantics} from './ohm';
import {TypeUtils} from './types';
import {UnaryOpUtils} from './unary_op';

interface SuccessfulParseResult {
  succeeded: true;
  ast: ExpressionUnres;
}

interface ParseError {
  succeeded: false;
}

export type ParseResult = SuccessfulParseResult | ParseError;

export class Parser {
  private static initialized = false;
  private static formulaGrammar: Grammar;
  private static formulaSemantics: Semantics;

  public static parse = (exp: string): ParseResult => {
    Parser.ensureInitialized();
    const match = Parser.formulaGrammar.match(exp);
    if (match.succeeded()) {
      const ast = Parser.formulaSemantics(match).toAST() as ExpressionUnres;
      return {ast, succeeded: true};
    }
    return {succeeded: false};
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

  private static ensureInitialized = () => {
    if (Parser.initialized) {
      return;
    }
    Parser.initialized = true;

    const g = ohm.grammarsFromScriptElements();
    Parser.formulaGrammar = g.Formula;
    Parser.formulaSemantics = Parser.formulaGrammar.createSemantics().addOperation('toAST', {
      Exp(e) {
        return new ExpressionUnres(e.toAST());
      },
      LambdaExp_lambda(id, _a, e) {
        return new LambdaUnres(id.toAST(), e.toAST());
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
      CallExp_call(id, _p1, asmts, _p2) {
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
        // TODO add a ParensAST node to support proper toText conversion (technically a CST)
        return e.toAST();
      },
      GroupExp_list(_b1, es, _b2) {
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
        const s = unescape(str.sourceString);
        return new PrimitiveUnres(s, TypeUtils.String);
      },
      unquotedIdent(_char, _str) {
        return (this as Node).sourceString;
      },
      quotedIdent(_q1, str, _q2) {
        return unescape(str.sourceString);
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


const unescape = (str: string): string => {
  return str.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
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
