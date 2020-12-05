import * as _ from 'lodash';

import {Constructor} from '@models/domain_specific/procedure'; // Only a type dependency
import {Dictionary, ROArray, RODictionary} from '@utils/types';
import {BinaryOp, BinaryOpUtils} from './binary_op';
import {NameResolutionError, OutOfBoundsError, TypeError} from './language_errors';
import {Parser} from './parser';
import {DictReferenceResolver} from './reference/dict_reference_resolver';
import {LambdaNamespace} from './reference/lambda_namespace';
import {LambdaReferenceResolver} from './reference/lambda_reference_resolver';
import {Namespace, NamespaceUtils} from './reference/namespace';
import {ConstructorReference, ProcedureReference, Reference, ValueReference}
        from './reference/reference';
import {ReferenceResolver, ReferenceResolverUtils} from './reference/reference_resolver';
import {DictType, GridType, Identifier, LambdaType, ListType, PartialRowType,
        PrimitiveType, RowType, Type, TypeEnvironment, TypeUtils} from './types';
import {UnaryOp, UnaryOpUtils} from './unary_op';
import {LambdaValue, ListValue, PartialRowValue, Value, ValueUtils} from './values';

interface BaseResolutionTimeTypeHelper {
  resolveCallReturnType: (asmtTypesByName: RODictionary<Type>, environment: TypeEnvironment) => Type,
}

export enum ResolutionTimeTypeHelperVariant {
  BASIC = "BASIC",
  LAMBDA = "LAMBDA",
}

export interface BasicResolutionTimeTypeHelper extends BaseResolutionTimeTypeHelper {
  variant: ResolutionTimeTypeHelperVariant.BASIC,
}

export interface LambdaResolutionTimeTypeHelper extends BaseResolutionTimeTypeHelper {
  variant: ResolutionTimeTypeHelperVariant.LAMBDA,
  lambdaAsmtName: string,
  resolutionTimeAsmtDefaultValues: RODictionary<UnresolvedAST>,
  resolveLambdaType: (nonLambdaAsmtTypesByName: RODictionary<Type>) => LambdaType,
}

export type ResolutionTimeTypeHelper = BasicResolutionTimeTypeHelper | LambdaResolutionTimeTypeHelper;


export interface TypeEnvironmentWithProcedures extends TypeEnvironment {
  getAssignmentsType<I extends Identifier>(ref: ProcedureReference<any, I>): PartialRowType<I> | undefined;
  getResolutionTimeTypeHelper(ref: ProcedureReference): ResolutionTimeTypeHelper | undefined;
}


class TypeEnvironmentWithProceduresUtils {

  public static getAssignmentsTypeOrThrow = <I extends Identifier>(
    ref: ProcedureReference<any, I>,
    env: TypeEnvironmentWithProcedures,
  ): PartialRowType<I> => {
    const asmtsType = env.getAssignmentsType(ref);
    if (!asmtsType) {
      throw new NameResolutionError(`No procedure exists in this scope for reference '${ref.id}'.`);
    }
    return asmtsType;
  }

}


enum ASTNodeType {
  EXPRESSION = "EXPRESSION",
  LAMBDA = "LAMBDA",
  BINARY_OP = "BINARY_OP",
  UNARY_OP = "UNARY_OP",
  INDEX = "INDEX",
  PROJECT = "PROJECT",
  CALL = "CALL",
  ASSIGNMENTS = "ASSIGNMENTS",
  IDENTIFIER = "IDENTIFIER",
  PARENTHESES = "PARENTHESES",
  LIST = "LIST",
  PRIMITIVE = "PRIMITIVE",
};

interface AST<N extends ASTNodeType = ASTNodeType> {
  readonly nodeType: N;

  // Force implementors to implement this method by not naming it `toString`
  toText: (namespace: Namespace) => string;
}

export interface UnresolvedAST<N extends ASTNodeType = ASTNodeType> extends AST<N> {
  resolve: (namespace: Namespace, env: TypeEnvironmentWithProcedures) => ResolvedAST<Type, N>;
}

export interface ResolvedAST<R extends Type = Type, N extends ASTNodeType = ASTNodeType> extends AST<N> {
  readonly type: R;
  readonly externalDependencies: ROArray<Reference>;
  readonly isLiteral: boolean;
  eval: (resolver: ReferenceResolver) => Value<R>;
}


export class ResolvedASTUtils {
  // ===========
  // Type Guards
  // ===========

  public static resolvesToNumber = (astR: ResolvedAST): astR is ResolvedAST<PrimitiveType.NUMBER> => {
    return TypeUtils.isNumber(astR.type);
  }
  public static resolvesToBoolean = (astR: ResolvedAST): astR is ResolvedAST<PrimitiveType.BOOLEAN> => {
    return TypeUtils.isBoolean(astR.type);
  }
  public static resolvesToString = (astR: ResolvedAST): astR is ResolvedAST<PrimitiveType.STRING> => {
    return TypeUtils.isString(astR.type);
  }
  public static resolvesToPrimitive = (astR: ResolvedAST): astR is ResolvedAST<PrimitiveType> => {
    return TypeUtils.isPrimitive(astR.type);
  }
  public static resolvesToList = (astR: ResolvedAST): astR is ResolvedAST<ListType> => {
    return TypeUtils.isList(astR.type);
  }
  public static resolvesToDict = (astR: ResolvedAST): astR is ResolvedAST<DictType> => {
    return TypeUtils.isDict(astR.type);
  }
  public static resolvesToPartialRow = (astR: ResolvedAST): astR is ResolvedAST<PartialRowType> => {
    return TypeUtils.isPartialRow(astR.type);
  }
  public static resolvesToRow = (astR: ResolvedAST): astR is ResolvedAST<RowType> => {
    return TypeUtils.isRow(astR.type);
  }
  public static resolvesToGrid = (astR: ResolvedAST): astR is ResolvedAST<GridType> => {
    return TypeUtils.isGrid(astR.type);
  }
  public static resolvesToLambda = (astR: ResolvedAST): astR is ResolvedAST<LambdaType> => {
    return TypeUtils.isLambda(astR.type);
  }

  // =========
  // Utilities
  // =========

  public static isConstant = (astR: ResolvedAST): boolean => {
    return astR.externalDependencies.length === 0;
  }

  public static mergeDeps = (...es: ResolvedAST[]): Reference[] => {
    return _.flatMap(es, e => e.externalDependencies);
  }
}


// ==============
// Expression AST
// ==============

abstract class ExpressionAST<A extends AST> implements AST<ASTNodeType.EXPRESSION> {
  public readonly nodeType = ASTNodeType.EXPRESSION;

  protected readonly e: A;

  constructor(e: A) {
    this.e = e;
  }

  public toText = (namespace: Namespace): string => {
    return this.e.toText(namespace);
  }
}

export class ExpressionUnres extends ExpressionAST<UnresolvedAST>
    implements UnresolvedAST<ASTNodeType.EXPRESSION> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const eR = this.e.resolve(namespace, env);
    return new ExpressionRes(eR, eR.type);
  }
}

export class ExpressionRes<R extends Type = Type> extends ExpressionAST<ResolvedAST<R>>
    implements ResolvedAST<R, ASTNodeType.EXPRESSION> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;

  constructor(e: ResolvedAST<R>, type: R) {
    super(e);
    this.type = type;
    this.externalDependencies = e.externalDependencies;
  }

  public get isLiteral() {
    return this.e.isLiteral;
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    return this.e.eval(resolver);
  }
}


// ==========
// Lambda AST
// ==========

abstract class LambdaAST<A extends AST, AI extends A = A, AE extends A = A>
    implements AST<ASTNodeType.LAMBDA> {
  public readonly nodeType = ASTNodeType.LAMBDA;

  protected readonly ident: AI;
  protected readonly e: AE;

  constructor(ident: AI, e: AE) {
    this.ident = ident;
    this.e = e;
  }

  protected getNamespace(namespace: Namespace): Namespace {
    return namespace;
  }

  public toText = (namespace: Namespace): string => {
    const res = this.getNamespace(namespace);
    return `${this.ident.toText(res)} -> ${this.e.toText(res)}`;
  }
}

export class LambdaUnres
    extends LambdaAST<UnresolvedAST, IdentifierUnres, UnresolvedAST>
    implements UnresolvedAST<ASTNodeType.LAMBDA> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const identName = this.ident.getName();
    const iteratorType: Type = namespace.getIteratorType_DEPRECATED();
    const identRef = ValueReference.buildForIteratorVariable(iteratorType, identName);
    const buildLambdaNamespace = (ns: Namespace) => new LambdaNamespace(ns, identName, identRef);
    const namespaceR = buildLambdaNamespace(namespace);
    const identR = new IdentifierRes(identRef);
    const eR = this.e.resolve(namespaceR, env);
    const type = TypeUtils.LambdaOf(identR.type, eR.type);
    return new LambdaRes(identR, eR, type, buildLambdaNamespace);
  }
}

export class LambdaRes<RI extends Type = Type, RO extends Type = Type>
    extends LambdaAST<ResolvedAST, IdentifierRes<RI>, ResolvedAST<RO>>
    implements ResolvedAST<LambdaType<RI, RO>, ASTNodeType.LAMBDA> {
  public readonly type: LambdaType<RI, RO>;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;
  private readonly buildLambdaNamespace: (namespace: Namespace) => Namespace;

  constructor(
    ident: IdentifierRes<RI>,
    e: ResolvedAST<RO>,
    type: LambdaType<RI, RO>,
    buildLambdaNamespace: (namespace: Namespace) => Namespace,
  ) {
    super(ident, e);
    this.type = type;
    this.externalDependencies = e.externalDependencies.filter(d => d !== ident.getRef());
    this.buildLambdaNamespace = buildLambdaNamespace;
  }

  public eval = (resolver: ReferenceResolver): LambdaValue<RI, RO> => {
    const lambda = (input: Value<RI>): Value<RO> => {
      const res = new LambdaReferenceResolver(resolver, this.ident.getRef().id, input);
      return this.e.eval(res);
    }
    return ValueUtils.lambdaOf(lambda, this.type);
  }

  protected getNamespace(namespace: Namespace): Namespace {
    return this.buildLambdaNamespace(namespace);
  }
}


// =============
// Binary Op AST
// =============

abstract class BinaryOpAST<A extends AST, A1 extends A = A, A2 extends A = A>
    implements AST<ASTNodeType.BINARY_OP> {
  public readonly nodeType = ASTNodeType.BINARY_OP;

  protected readonly op: BinaryOp;
  protected readonly e1: A1;
  protected readonly e2: A2;

  constructor(op: BinaryOp, e1: A1, e2: A2) {
    this.op = op;
    this.e1 = e1;
    this.e2 = e2;
  }

  public toText = (namespace: Namespace): string => {
    return `${this.e1.toText(namespace)} ${this.op} ${this.e2.toText(namespace)}`;
  }
}

export class BinaryOpUnres extends BinaryOpAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.BINARY_OP> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const eR1 = this.e1.resolve(namespace, env);
    const eR2 = this.e2.resolve(namespace, env);
    const type = BinaryOpUtils.validateOperandTypes(this.op, eR1.type, eR2.type);
    return new BinaryOpRes(this.op, eR1, eR2, type);
  }
}

export class BinaryOpRes<T1 extends Type = Type, T2 extends Type = Type, R extends Type = Type>
    extends BinaryOpAST<ResolvedAST, ResolvedAST<T1>, ResolvedAST<T2>>
    implements ResolvedAST<R, ASTNodeType.BINARY_OP> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;

  constructor(op: BinaryOp, e1: ResolvedAST<T1>, e2: ResolvedAST<T2>, type: R) {
    super(op, e1, e2);
    this.type = type;
    this.externalDependencies = ResolvedASTUtils.mergeDeps(e1, e2);
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    const eV1Thunk = () => this.e1.eval(resolver);
    const eV2Thunk = () => this.e2.eval(resolver);
    return BinaryOpUtils.evalOp(this.op, eV1Thunk, eV2Thunk) as Value<R>;
  }
}

// ============
// Unary Op AST
// ============

abstract class UnaryOpAST<A extends AST> implements AST<ASTNodeType.UNARY_OP> {
  public readonly nodeType = ASTNodeType.UNARY_OP;

  protected readonly op: UnaryOp;
  protected readonly e: A;

  constructor(op: UnaryOp, e: A) {
    this.op = op;
    this.e = e;
  }

  public toText = (namespace: Namespace): string => {
    return `${this.op}${this.e.toText(namespace)}`;
  }
}

export class UnaryOpUnres extends UnaryOpAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.UNARY_OP> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const eR = this.e.resolve(namespace, env);
    const type = UnaryOpUtils.validateOperandType(this.op, eR.type);
    return new UnaryOpRes(this.op, eR, type);
  }
}

export class UnaryOpRes<R extends Type = Type> extends UnaryOpAST<ResolvedAST<R>> implements ResolvedAST<R, ASTNodeType.UNARY_OP> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;

  constructor(op: UnaryOp, e: ResolvedAST<R>, type: R) {
    super(op, e);
    this.type = type;
    this.externalDependencies = e.externalDependencies;
  }

  public get isLiteral(): boolean {
    return UnaryOpUtils.isAllowedInLiterals(this.op);
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    const eV = this.e.eval(resolver);
    return UnaryOpUtils.evalOp(this.op, eV) as Value<R>;
  }
}

// =========
// Index AST
// =========

abstract class IndexAST<A extends AST, AL extends A = A, AI extends A = A>
    implements AST<ASTNodeType.INDEX> {
  public readonly nodeType = ASTNodeType.INDEX;

  protected readonly list: AL;
  protected readonly idx: AI;

  constructor(list: AL, idx: AI) {
    this.list = list;
    this.idx = idx;
  }

  public toText = (namespace: Namespace): string => {
    return `${this.list.toText(namespace)}[${this.idx.toText(namespace)}]`;
  }
}

export class IndexUnres extends IndexAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.INDEX> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const listR = this.list.resolve(namespace, env);
    const idxR = this.idx.resolve(namespace, env);
    if (!ResolvedASTUtils.resolvesToList(listR)) {
      throw new TypeError("Can only index into lists and grids");
    } else if (!ResolvedASTUtils.resolvesToNumber(idxR)) {
      throw new TypeError("Can only index into a list or grid with a number");
    }
    return new IndexRes(listR, idxR, listR.type.itemType);
  }
}

export class IndexRes<R extends Type = Type>
    extends IndexAST<ResolvedAST, ResolvedAST<ListType<R>>, ResolvedAST<PrimitiveType.NUMBER>>
    implements ResolvedAST<R, ASTNodeType.INDEX> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;

  constructor(list: ResolvedAST<ListType<R>>, idx: ResolvedAST<PrimitiveType.NUMBER>, type: R) {
    super(list, idx);
    this.type = type;
    this.externalDependencies = ResolvedASTUtils.mergeDeps(list, idx);
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    const listV = this.list.eval(resolver);
    const idxV = this.idx.eval(resolver);
    if (!ValueUtils.isList(listV)) {
      throw new TypeError("Can only index into lists and grids");
    } else if (!ValueUtils.isNumber(idxV)) {
      throw new TypeError("Can only index into a list or grid with a number");
    }
    const oneIndexedIndex = idxV.value;
    if (oneIndexedIndex < 1 || oneIndexedIndex > listV.list.length) {
      let zeroIndexNote = "";
      if (oneIndexedIndex === 0) {
        zeroIndexNote = " - list indices start at 1 (not zero!)"
      }
      throw new OutOfBoundsError(`Index ${oneIndexedIndex} is out of bounds${zeroIndexNote}`);
    }
    return listV.list[oneIndexedIndex - 1] as Value<R>;
  }
}


// ===========
// Project AST
// ===========

abstract class ProjectAST<A extends AST>
    implements AST<ASTNodeType.PROJECT> {
  public readonly nodeType = ASTNodeType.PROJECT;

  protected readonly dict: A;

  constructor(dict: A) {
    this.dict = dict;
  }

  public abstract toText(namespace: Namespace): string;
}

export class ProjectUnres extends ProjectAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.PROJECT> {
  private readonly name: string;
    
  constructor(dict: UnresolvedAST, name: string) {
    super(dict);
    this.name = name;
  }

  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const dictR = this.dict.resolve(namespace, env);
    if (!ResolvedASTUtils.resolvesToDict(dictR)) {
      throw new TypeError("Can only project values from grids and rows");
    }
    const innerNamespace = namespace.getInstanceNamespace(dictR.type);
    const refR = innerNamespace.getValueReferenceByName(this.name);
    if (!refR) {
      throw new NameResolutionError(`No projection exists with name '${this.name}'`);
    }
    return new ProjectRes(dictR, refR);
  }

  public toText = (namespace: Namespace): string => {
    return `${this.dict.toText(namespace)}.${this.name}`;
  }
}

export class ProjectRes<R extends Type = Type> extends ProjectAST<ResolvedAST<DictType>>
    implements ResolvedAST<R, ASTNodeType.PROJECT> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;
  private readonly ref: ValueReference<R>;

  constructor(dict: ResolvedAST<DictType>, ref: ValueReference<R>) {
    super(dict);
    this.type = ref.type;
    this.externalDependencies = dict.externalDependencies;
    this.ref = ref;
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    const dictV = this.dict.eval(resolver);
    if (!ValueUtils.isDict(dictV)) {
      throw new TypeError("Can only project values from grids and rows");
    }
    const dictResolver = new DictReferenceResolver(resolver, dictV);
    const refV = ReferenceResolverUtils.resolveValueOrThrow(this.ref, dictResolver);
    return refV;
  }

  public toText = (namespace: Namespace): string => {
    const refName = NamespaceUtils.getReferenceNameOrThrow(this.ref, namespace);
    return `${this.dict.toText(namespace)}.${Parser.identToText(refName)}`;
  }
}


// ========
// Call AST
// ========

abstract class CallAST<A extends AST<ASTNodeType.ASSIGNMENTS>> implements AST<ASTNodeType.CALL> {
  public readonly nodeType = ASTNodeType.CALL;

  protected readonly asmts: A;
  protected readonly isConstructor: boolean;

  constructor(asmts: A, isConstructor: boolean) {
    this.asmts = asmts;
    this.isConstructor = isConstructor;
  }

  public abstract toText(namespace: Namespace): string;
}

export class CallUnres extends CallAST<AssignmentsUnres> implements UnresolvedAST<ASTNodeType.CALL> {
  private readonly name: string;

  constructor(name: string, asmts: AssignmentsUnres, isConstructor: boolean) {
    super(asmts, isConstructor);
    this.name = name;
  }

  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const procedureR = this.isConstructor ?
      namespace.getConstructorReferenceByName(this.name) :
      namespace.getFormulaReferenceByName(this.name);
    if (!procedureR) {
      const refType = this.isConstructor ? "grid" : "formula";
      throw new NameResolutionError(`No ${refType} exists with name '${this.name}'`);
    }
    const {returnType} = procedureR;
    const resolutionTimeTypeHelper = env.getResolutionTimeTypeHelper(procedureR);
    if (resolutionTimeTypeHelper) {
      const {asmtsR, asmtTypesByName} = this.isLambdaHelper(resolutionTimeTypeHelper) ?
        this.asmts.resolveForProcedureWithResolutionTimeTypes(procedureR, resolutionTimeTypeHelper, namespace, env) :
        this.asmts.resolveForProcedure(procedureR, namespace, env);
      const returnTypeR = resolutionTimeTypeHelper.resolveCallReturnType(asmtTypesByName, env);
      return new CallRes(procedureR, asmtsR, this.isConstructor, returnTypeR);
    } else {
      const {asmtsR} = this.asmts.resolveForProcedure(procedureR, namespace, env);
      return new CallRes(procedureR, asmtsR, this.isConstructor, returnType);
    }
  }

  private isLambdaHelper = (helper: ResolutionTimeTypeHelper): helper is LambdaResolutionTimeTypeHelper => {
    return helper.variant === ResolutionTimeTypeHelperVariant.LAMBDA;
  }

  public toText = (namespace: Namespace): string => {
    const asmts = this.asmts.toText(namespace);
    return this.isConstructor ? `${this.name}{${asmts}}` : `${this.name}(${asmts})`;
  }
}

export class CallRes<R extends Type = Type, I extends Identifier = Identifier> extends CallAST<AssignmentsRes<I>>
    implements ResolvedAST<R, ASTNodeType.CALL> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly procedureRef: ProcedureReference<R, I>;

  constructor(procedureRef: ProcedureReference<R, I>, asmts: AssignmentsRes<I>,
      isConstructor: boolean, type: R) {
    super(asmts, isConstructor);
    this.type = type;
    this.externalDependencies = asmts.externalDependencies.concat([procedureRef]);
    this.procedureRef = procedureRef;
  }

  public get isLiteral() {
    return this.isConstructor && this.asmts.isLiteral;
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    const asmtsV = this.asmts.eval(resolver);
    const procedure = ReferenceResolverUtils.resolveProcedureOrThrow(this.procedureRef, resolver);
    return procedure.eval(asmtsV, this.type) as Value<R>;
  }

  public toText = (namespace: Namespace): string => {
    const rawName = NamespaceUtils.getReferenceNameOrThrow(this.procedureRef, namespace);
    const name = Parser.identToText(rawName);
    const asmts = this.asmts.toText(namespace);
    return this.isConstructor ? `${name}{${asmts}}` : `${name}(${asmts})`;
  }

  public getAssignments = (): AssignmentsRes<I> => {
    return this.asmts;
  }

  public withAssignments = (asmts: RODictionary<ResolvedAST>): CallRes<R, I>  => {
    const {procedureRef: procedure, type, isConstructor} = this;
    const mergedAsmts = this.asmts.withAssignments(asmts);
    return new CallRes(procedure, mergedAsmts, isConstructor, type);
  }

  public static buildDefaultConstructorCall = <I extends Identifier> (
    constructor: Constructor<I>,
  ): CallRes<RowType<I>, I> => {
    const constructorRef = new ConstructorReference(constructor.id as I); // FIXME need grid id
    const {assignmentsType, returnType} = constructor;
    const asmts = new AssignmentsRes({}, [], assignmentsType);
    return new CallRes(constructorRef, asmts, true, returnType);
  }
}


// ===============
// Assignments AST
// ===============

abstract class AssignmentsAST<A extends AST, I> implements AST<ASTNodeType.ASSIGNMENTS> {
  public readonly nodeType = ASTNodeType.ASSIGNMENTS;

  protected readonly asmts: RODictionary<A>;
  protected readonly asmtOrder: ROArray<I>;

  constructor(asmts: RODictionary<A>, asmtOrder: ROArray<I>) {
    this.asmts = asmts;
    this.asmtOrder = asmtOrder;
  }

  public toText = (namespace: Namespace): string => {
    return this.asmtOrder.map(id =>
      `${this.asmtIdentifierToText(id, namespace)} = ${this.getAsmt(id).toText(namespace)}`).join(", ");
  }

  protected abstract asmtIdentifierToText(asmtIdent: I, namespace: Namespace): string;

  protected abstract getAsmt(asmtIdent: I): A;
}

export class AssignmentsUnres extends AssignmentsAST<UnresolvedAST, string> implements UnresolvedAST<ASTNodeType.ASSIGNMENTS> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    throw new Error("Calling resolve is not supported. Call resolveForProcedure instead.");
  }

  public resolveForProcedure = (
    procedureRef: ProcedureReference,
    outerNamespace: Namespace,
    env: TypeEnvironmentWithProcedures,
  ): {asmtsR: AssignmentsRes, asmtTypesByName: RODictionary<Type>} => {
    const assignmentsType = TypeEnvironmentWithProceduresUtils.getAssignmentsTypeOrThrow(procedureRef, env);
    const innerNamespace = outerNamespace.getInstanceNamespace(assignmentsType);
    const referencesByName = _.mapValues(this.asmts,
        (_e, name) => NamespaceUtils.getValueReferenceByNameOrThrow(name, innerNamespace));
    const asmtsRByName = _.mapValues(this.asmts,
        (e, name) => AssignmentsUnres.resolveAsmt(e, referencesByName[name].type, outerNamespace, env));
    AssignmentsUnres.validateAssignmentTypes(asmtsRByName, referencesByName, env);
    const asmtsR = this.resolveFromResolvedAsmtsByName(asmtsRByName, referencesByName, assignmentsType);
    const asmtTypesByName = _.mapValues(asmtsRByName, e => e.type);
    return {asmtsR, asmtTypesByName};
  }

  public resolveForProcedureWithResolutionTimeTypes = (
    procedureRef: ProcedureReference,
    resolutionTimeTypeHelper: LambdaResolutionTimeTypeHelper,
    outerNamespace: Namespace,
    env: TypeEnvironmentWithProcedures,
  ): {asmtsR: AssignmentsRes, asmtTypesByName: RODictionary<Type>} => {
    // On resolution-time types:
    // A lambda's type is T -> U but T (and usually U) cannot be resolved in isolation
    // For now, a procedure has a resolveLambdaType method exactly if it uses a lambda
    // For now, a procedure can use at most one lambda
    // For now, this is the only place a lambda can be used:
    //     a lambda value is not first-class; it can't be returned or put in a list
    // Therefore, neither T nor U is a lambda type
    // Therefore, can resolve lambda input type T by resolving the column(s) specifying T
    // Therefore, can resolve all non-lambda columns first and from them get lambda input type
    const assignmentsType = TypeEnvironmentWithProceduresUtils.getAssignmentsTypeOrThrow(procedureRef, env);
    const innerNamespace = outerNamespace.getInstanceNamespace(assignmentsType);
    const asmts = _.defaults({}, this.asmts, resolutionTimeTypeHelper.resolutionTimeAsmtDefaultValues);
    const referencesByName = _.mapValues(asmts,
        (_e, name) => NamespaceUtils.getValueReferenceByNameOrThrow(name, innerNamespace));
    const asmtsRByName = AssignmentsUnres.resolveForResolutionTimeTypes(
        asmts, referencesByName, resolutionTimeTypeHelper, outerNamespace, env);
    AssignmentsUnres.validateAssignmentTypes(asmtsRByName, referencesByName, env);
    const asmtsR = this.resolveFromResolvedAsmtsByName(asmtsRByName, referencesByName, assignmentsType);
    const asmtTypesByName = _.mapValues(asmtsRByName, e => e.type);
    return {asmtsR, asmtTypesByName};
  }

  private static validateAssignmentTypes(
    asmtsRByName: RODictionary<ResolvedAST>,
    referencesByName: RODictionary<ValueReference>,
    env: TypeEnvironmentWithProcedures,
  ) {
    _.forIn(asmtsRByName, (asmtR, name) => {
      const {type} = asmtR;
      const expectedType = referencesByName[name].type;
      TypeUtils.validateIsAssignableTo(type, expectedType, env,
        `Expected value \`${name}\` to be assignable to type \`${env.typeToString(expectedType)}\``);
    });
  }

  private resolveFromResolvedAsmtsByName = (
    asmtsRByName: RODictionary<ResolvedAST>,
    referencesByName: RODictionary<ValueReference>,
    assignmentsType: PartialRowType,
  ): AssignmentsRes => {
    const asmtsR = _.mapKeys(asmtsRByName, (_e, name) => referencesByName[name].id);
    const asmtOrderR = this.asmtOrder.map(name => referencesByName[name]);
    return new AssignmentsRes(asmtsR, asmtOrderR, assignmentsType);
  }

  private static resolveForResolutionTimeTypes(
    asmts: RODictionary<UnresolvedAST>,
    referencesByName: RODictionary<ValueReference>,
    {lambdaAsmtName, resolveLambdaType}: LambdaResolutionTimeTypeHelper,
    outerNamespace: Namespace,
    env: TypeEnvironmentWithProcedures,
  ): RODictionary<ResolvedAST> {
    const nonLambdaAsmtsR: Dictionary<ResolvedAST> = {};
    _.forEach(asmts, (e, name) => {
      if (name !== lambdaAsmtName) {
        nonLambdaAsmtsR[name] = AssignmentsUnres.resolveAsmt(e, referencesByName[name].type, outerNamespace, env);
      }
    });
    const nonLambdaTypes = _.mapValues(nonLambdaAsmtsR, (e: ResolvedAST, name) => e.type);
    const lambdaType = resolveLambdaType(nonLambdaTypes);
    const lambdaAsmt = asmts[lambdaAsmtName];
    const lambdaAsmtR = lambdaAsmt === undefined ? {} : {
      [lambdaAsmtName]: AssignmentsUnres.resolveAsmt(lambdaAsmt, lambdaType, outerNamespace, env),
    };
    return _.extend(nonLambdaAsmtsR, lambdaAsmtR);
  }

  private static resolveAsmt = (
    e: UnresolvedAST,
    type: Type,
    outerNamespace: Namespace,
    env: TypeEnvironmentWithProcedures,
  ): ResolvedAST => {
    // FIXME remove this hack, should resolve types in a typechecking pass that passes
    // expected type down from the top
    const namespaceR = TypeUtils.isLambda(type) ?
      outerNamespace.extendWithIteratorType_DEPRECATED(type.inputType) :
      outerNamespace;

    return e.resolve(namespaceR, env);
  }

  protected asmtIdentifierToText(asmtIdent: string, namespace: Namespace): string {
    return Parser.identToText(asmtIdent);
  }

  protected getAsmt(asmtIdent: string): UnresolvedAST {
    return this.asmts[asmtIdent];
  }
}

export class AssignmentsRes<I extends Identifier = Identifier>
    extends AssignmentsAST<ResolvedAST, ValueReference>
    implements ResolvedAST<PartialRowType<I>, ASTNodeType.ASSIGNMENTS> {
  public readonly type: PartialRowType<I>;
  public readonly externalDependencies: ROArray<Reference>;

  constructor(asmts: RODictionary<ResolvedAST>, asmtOrder: ROArray<ValueReference>, type: PartialRowType<I>) {
    super(asmts, asmtOrder);
    this.type = type;
    this.externalDependencies = ResolvedASTUtils.mergeDeps(...Object.values(asmts));
  }

  public get isLiteral() {
    return _.every(this.asmts, a => a.isLiteral);
  }

  public eval = (resolver: ReferenceResolver): PartialRowValue<I> => {
    const asmtsV = _.mapValues(this.asmts, e => e.eval(resolver));
    return ValueUtils.partialRowOf(asmtsV, this.type.schemaId.gridId);
  }

  protected get procedureId() {
    return this.type.schemaId.gridId;
  }

  protected asmtIdentifierToText(asmtIdent: ValueReference, namespace: Namespace): string {
    const namespaceR = namespace.getInstanceNamespace(this.type);
    const name = NamespaceUtils.getReferenceNameOrThrow(asmtIdent, namespaceR);
    return Parser.identToText(name);
  }

  protected getAsmt(asmtIdent: ValueReference): ResolvedAST {
    return this.asmts[asmtIdent.id];
  }

  public getAsmtTypes = (): RODictionary<Type> => {
    return _.mapValues(this.asmts, e => e.type);
  }

  public getAssignments = (): RODictionary<ResolvedAST> => {
    return this.asmts;
  }

  public withAssignments = (asmts: RODictionary<ResolvedAST>): AssignmentsRes<I>  => {
    const {asmts: originalAsmts, asmtOrder, type} = this;
    const asmtsMerged = _.extend({}, originalAsmts, asmts);
    const newAsmts = Object.keys(asmts)
      .filter(id => !(id in originalAsmts))
      .map(id => new ValueReference(id, asmts[id].type))
    const asmtOrderMerged = asmtOrder.concat(newAsmts);
    return new AssignmentsRes(asmtsMerged, asmtOrderMerged, type);
  }
}


// ==============
// Identifier AST
// ==============

abstract class IdentifierAST implements AST<ASTNodeType.IDENTIFIER> {
  public readonly nodeType = ASTNodeType.IDENTIFIER;

  public abstract toText(namespace: Namespace): string;
}

export class IdentifierUnres extends IdentifierAST implements UnresolvedAST<ASTNodeType.IDENTIFIER> {
  private readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const refR = NamespaceUtils.getValueReferenceByNameOrThrow(this.name, namespace);
    return new IdentifierRes(refR);
  }

  public getName = (): string => {
    return this.name;
  }

  public toText = (namespace: Namespace): string => {
    return Parser.identToText(this.name);
  }
}

export class IdentifierRes<R extends Type = Type> extends IdentifierAST
    implements ResolvedAST<R, ASTNodeType.IDENTIFIER> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;
  private readonly ref: ValueReference<R>;

  constructor(ref: ValueReference<R>) {
    super();
    this.type = ref.type;
    this.externalDependencies = [ref];
    this.ref = ref;
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    const refV = ReferenceResolverUtils.resolveValueOrThrow(this.ref, resolver);
    return refV;
  }

  public getRef = (): ValueReference<R> => {
    return this.ref;
  }

  public toText = (namespace: Namespace): string => {
    const name = NamespaceUtils.getReferenceNameOrThrow(this.ref, namespace);
    return Parser.identToText(name);
  }
}


// ===============
// Parentheses AST
// ===============

// This is formally not an AST, it's a CST - shrug.
// Parentheses are explicitly tracked in the AST in order to recover parentheses when
// converting back to text.
abstract class ParenthesesAST<A extends AST> implements AST<ASTNodeType.PARENTHESES> {
  public readonly nodeType = ASTNodeType.PARENTHESES;

  protected readonly e: A;

  constructor(e: A) {
    this.e = e;
  }

  public toText = (namespace: Namespace): string => {
    return `(${this.e.toText(namespace)})`;
  }
}

export class ParenthesesUnres extends ParenthesesAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.PARENTHESES> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const eR = this.e.resolve(namespace, env);
    return new ParenthesesRes(eR, eR.type);
  }
}

export class ParenthesesRes<R extends Type = Type> extends ParenthesesAST<ResolvedAST<R>> implements ResolvedAST<R, ASTNodeType.PARENTHESES> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;

  constructor(e: ResolvedAST<R>, type: R) {
    super(e);
    this.type = type;
    this.externalDependencies = e.externalDependencies;
  }

  public eval = (resolver: ReferenceResolver): Value<R> => {
    return this.e.eval(resolver);
  }
}


// ========
// List AST
// ========

abstract class ListAST<A extends AST> implements AST<ASTNodeType.LIST> {
  public readonly nodeType = ASTNodeType.LIST;

  protected readonly es: A[];

  constructor(es: A[]) {
    this.es = es;
  }

  public toText = (namespace: Namespace): string => {
    return `[${this.es.map(e => e.toText(namespace)).join(", ")}]`;
  }
}

export class ListUnres extends ListAST<UnresolvedAST>
    implements UnresolvedAST<ASTNodeType.LIST> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    const esR = this.es.map(e => e.resolve(namespace, env));
    const itemType = TypeUtils.unionAll(esR.map(eR => eR.type), env);
    return new ListRes(esR, itemType);
  }
}

export class ListRes<T extends Type = Type> extends ListAST<ResolvedAST<T>>
    implements ResolvedAST<ListType<T>, ASTNodeType.LIST> {
  public readonly type: ListType<T>;
  public readonly externalDependencies: ROArray<Reference>;

  constructor(es: Array<ResolvedAST<T>>, itemType: T) {
    super(es);
    this.type = TypeUtils.ListOf(itemType);
    this.externalDependencies = ResolvedASTUtils.mergeDeps(...es);
  }

  public get isLiteral() {
    return _.every(this.es, e => e.isLiteral);
  }

  public eval = (resolver: ReferenceResolver): ListValue<T> => {
    const esV = this.es.map(e => e.eval(resolver));
    return ValueUtils.listOf(esV, this.type.itemType);
  }
}


// =============
// Primitive AST
// =============

type primitiveValue = number | boolean | string;

abstract class Primitive<T extends PrimitiveType> implements AST<ASTNodeType.PRIMITIVE> {
  public readonly nodeType = ASTNodeType.PRIMITIVE;
  public readonly type: T;

  protected readonly value: primitiveValue;

  constructor(value: primitiveValue, type: T) {
    this.value = value;
    this.type = type;
  }

  public toText = (namespace: Namespace): string => {
    if (TypeUtils.isString(this.type)) {
      return Parser.stringToText(this.value as string);
    }
    return `${this.value}`;
  }
}

export class PrimitiveUnres<T extends PrimitiveType> extends Primitive<T>
    implements UnresolvedAST<ASTNodeType.PRIMITIVE> {
  public resolve = (namespace: Namespace, env: TypeEnvironmentWithProcedures) => {
    return new PrimitiveRes(this.value, this.type);
  }
}

export class PrimitiveRes<T extends PrimitiveType = PrimitiveType> extends Primitive<T>
    implements ResolvedAST<T, ASTNodeType.PRIMITIVE> {
  public readonly externalDependencies: ROArray<Reference> = [];
  public readonly isLiteral = true;

  public eval = (resolver: ReferenceResolver): Value<T> => {
    return ValueUtils.primitiveOf(this.value, this.type);
  }

  public static numberOf = (value: number): NumberRes => new PrimitiveRes(value, PrimitiveType.NUMBER);
  public static booleanOf = (value: boolean): BooleanRes => new PrimitiveRes(value, PrimitiveType.BOOLEAN);
  public static stringOf = (value: string): StringRes => new PrimitiveRes(value, PrimitiveType.STRING);
}

export type NumberRes = PrimitiveRes<PrimitiveType.NUMBER>;
export type BooleanRes = PrimitiveRes<PrimitiveType.BOOLEAN>;
export type StringRes = PrimitiveRes<PrimitiveType.STRING>;
