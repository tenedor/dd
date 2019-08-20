import * as _ from 'lodash';

import {Constructor} from '@models/domain_specific/constructor'; // Only a type dependency
import {ROArray, RODictionary} from '@utils/types';
import {BinaryOp, BinaryOpUtils} from './binary_op';
import {NameResolver} from './name_resolver';
import {Parser} from './parser';
import {ConstructorReference, Reference, ReferenceUtils, ValueReference}
        from './reference';
import {DictType, GridType, Identifier, LambdaType, ListType, PartialRowType,
        PrimitiveType, RowType, Type, TypeUtils} from './types';
import {UnaryOp, UnaryOpUtils} from './unary_op';
import {ValueResolver} from './value_resolver';
import {ListValue, PartialRowValue, Value, ValueUtils} from './values';

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
  toText: (resolver: NameResolver) => string;
}

export interface UnresolvedAST<N extends ASTNodeType = ASTNodeType> extends AST<N> {
  resolve: (resolver: NameResolver) => ResolvedAST<Type, N>;
}

export interface ResolvedAST<R extends Type = Type, N extends ASTNodeType = ASTNodeType> extends AST<N> {
  readonly type: R;
  readonly externalDependencies: ROArray<Reference>;
  readonly isLiteral: boolean;
  eval: (valueResolver: ValueResolver) => Value<R>;
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

  public toText = (resolver: NameResolver): string => {
    return this.e.toText(resolver);
  }
}

export class ExpressionUnres extends ExpressionAST<UnresolvedAST>
    implements UnresolvedAST<ASTNodeType.EXPRESSION> {
  public resolve = (resolver: NameResolver) => {
    const eR = this.e.resolve(resolver);
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

  public eval = (valueResolver: ValueResolver): Value<R> => {
    return this.e.eval(valueResolver);
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

  public toText = (resolver: NameResolver): string => {
    return `${this.ident.toText(resolver)} -> ${this.e.toText(resolver)}`;
  }
}

export class LambdaUnres extends LambdaAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.LAMBDA> {
  public resolve = (resolver: NameResolver) => {
    // TODO
    throw new Error("not implemented");
  }
}

// TODO
/*
export class LambdaRes<RI extends Type = Type, RO extends Type = Type>
    extends LambdaAST<ResolvedAST, ResolvedAST<RI>, ResolvedAST<RO>>
    implements ResolvedAST<LambdaTypeT<RI, RO>, ASTNodeType.LAMBDA> {
  public readonly type: LambdaTypeT<RI, RO>;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;

  constructor(ident: ResolvedAST<RI>, e: ResolvedAST<RO>, type: LambdaTypeT<RI, RO>) {
    super(ident, e);
    this.type = type;
    this.externalDependencies = e.externalDependencies;
  }

  public eval = (valueResolver: ValueResolver): LambdaValue<RI, RO> => {
    // TODO
    throw new Error("not implemented");
  }
}
*/


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

  public toText = (resolver: NameResolver): string => {
    return `${this.e1.toText(resolver)} ${this.op} ${this.e2.toText(resolver)}`;
  }
}

export class BinaryOpUnres extends BinaryOpAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.BINARY_OP> {
  public resolve = (resolver: NameResolver) => {
    const eR1 = this.e1.resolve(resolver);
    const eR2 = this.e2.resolve(resolver);
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

  public eval = (valueResolver: ValueResolver): Value<R> => {
    const eV1Thunk = () => this.e1.eval(valueResolver);
    const eV2Thunk = () => this.e2.eval(valueResolver);
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

  public toText = (resolver: NameResolver): string => {
    return `${this.op}${this.e.toText(resolver)}`;
  }
}

export class UnaryOpUnres extends UnaryOpAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.UNARY_OP> {
  public resolve = (resolver: NameResolver) => {
    const eR = this.e.resolve(resolver);
    const type = UnaryOpUtils.validateOperandType(this.op, eR.type);
    return new UnaryOpRes(this.op, eR, type);
  }
}

export class UnaryOpRes<R extends Type = Type> extends UnaryOpAST<ResolvedAST<R>> implements ResolvedAST<R, ASTNodeType.UNARY_OP> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  public readonly isLiteral = false;

  constructor(op: UnaryOp, e: ResolvedAST<R>, type: R) {
    super(op, e);
    this.type = type;
    this.externalDependencies = e.externalDependencies;
  }

  public eval = (valueResolver: ValueResolver): Value<R> => {
    const eV = this.e.eval(valueResolver);
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

  public toText = (resolver: NameResolver): string => {
    return `${this.list.toText(resolver)}[${this.idx.toText(resolver)}]`;
  }
}

export class IndexUnres extends IndexAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.INDEX> {
  public resolve = (resolver: NameResolver) => {
    const listR = this.list.resolve(resolver);
    const idxR = this.idx.resolve(resolver);
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

  public eval = (valueResolver: ValueResolver): Value<R> => {
    const listV = this.list.eval(valueResolver);
    const idxV = this.idx.eval(valueResolver);
    if (!ValueUtils.isList(listV)) {
      throw new TypeError("Can only index into lists and grids");
    } else if (!ValueUtils.isNumber(idxV)) {
      throw new TypeError("Can only index into a list or grid with a number");
    }
    const oneIndexedIndex = idxV.value;
    if (oneIndexedIndex < 1 || oneIndexedIndex > listV.list.length) {
      throw new Error(`Index ${oneIndexedIndex} is out of bounds`);
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

  public abstract toText(resolver: NameResolver): string;
}

export class ProjectUnres extends ProjectAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.PROJECT> {
  private readonly name: string;
    
  constructor(dict: UnresolvedAST, name: string) {
    super(dict);
    this.name = name;
  }

  public resolve = (resolver: NameResolver) => {
    const dictR = this.dict.resolve(resolver);
    if (!ResolvedASTUtils.resolvesToDict(dictR)) {
      throw new TypeError("Can only project values from grids and rows");
    }
    const refR = resolver.resolverFor(dictR.type).resolveValueReference(this.name);
    return new ProjectRes(dictR, refR);
  }

  public toText = (resolver: NameResolver): string => {
    return `${this.dict.toText(resolver)}.${this.name}`;
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

  public eval = (valueResolver: ValueResolver): Value<R> => {
    const dictV = this.dict.eval(valueResolver);
    if (!ValueUtils.isDict(dictV)) {
      throw new TypeError("Can only project values from grids and rows");
    }
    const refV = this.ref.eval(valueResolver.contextOf(dictV.dict));
    return refV;
  }

  public toText = (resolver: NameResolver): string => {
    const refName = this.ref.getName(resolver);
    return `${this.dict.toText(resolver)}.${Parser.identToText(refName)}`;
  }
}


// ========
// Call AST
// ========

abstract class CallAST<A extends AST<ASTNodeType.ASSIGNMENTS>> implements AST<ASTNodeType.CALL> {
  public readonly nodeType = ASTNodeType.CALL;

  protected readonly asmts: A;

  constructor(asmts: A) {
    this.asmts = asmts;
  }

  public abstract toText(resolver: NameResolver): string;
}

export class CallUnres extends CallAST<AssignmentsUnres> implements UnresolvedAST<ASTNodeType.CALL> {
  private readonly name: string;

  constructor(name: string, asmts: AssignmentsUnres) {
    super(asmts);
    this.name = name;
  }

  public resolve = (resolver: NameResolver) => {
    const constructorR = resolver.resolveConstructorReference(this.name);
    const asmtsR = this.asmts.resolveForConstructor(resolver, constructorR);
    return new CallRes(constructorR, asmtsR, constructorR.model.returnType);
  }

  public toText = (resolver: NameResolver): string => {
    return `${this.name}(${this.asmts.toText(resolver)})`;
  }
}

export class CallRes<R extends Type = Type, I extends Identifier = Identifier> extends CallAST<AssignmentsRes<I>>
    implements ResolvedAST<R, ASTNodeType.CALL> {
  public readonly type: R;
  public readonly externalDependencies: ROArray<Reference>;
  private readonly constructorRef: ConstructorReference<R, I>;

  constructor(constructorRef: ConstructorReference<R, I>, asmts: AssignmentsRes<I>, type: R) {
    super(asmts);
    this.type = type;
    this.externalDependencies = asmts.externalDependencies.concat([constructorRef]);
    this.constructorRef = constructorRef;
  }

  public get constructor(): Constructor<R, I> {
    return this.constructorRef.model;
  }

  public get isLiteral() {
    return ReferenceUtils.isConstructorLiteral(this.constructorRef) && this.asmts.isLiteral;
  }

  public eval = (valueResolver: ValueResolver): Value<R> => {
    const asmtsV = this.asmts.eval(valueResolver);
    return this.constructorRef.model.eval(valueResolver, asmtsV);
  }

  public toText = (resolver: NameResolver): string => {
    const constructorName = this.constructorRef.getName(resolver)
    return `${Parser.identToText(constructorName)}(${this.asmts.toText(resolver)})`;
  }

  public static buildDefaultConstructorCall = <R extends Type, I extends Identifier> (
    constructorRef: ConstructorReference<R, I>,
  ): CallRes<R, I> => {
    const {assignmentsType, returnType} = constructorRef.model;
    const asmts = new AssignmentsRes({}, [], constructorRef, assignmentsType);
    return new CallRes(constructorRef, asmts, returnType);
  }
}


// ===============
// Assignments AST
// ===============

abstract class AssignmentsAST<A extends AST> implements AST<ASTNodeType.ASSIGNMENTS> {
  public readonly nodeType = ASTNodeType.ASSIGNMENTS;

  protected readonly asmts: RODictionary<A>;
  protected readonly asmtOrder: ROArray<string>;

  constructor(asmts: RODictionary<A>, asmtOrder: ROArray<string>) {
    this.asmts = asmts;
    this.asmtOrder = asmtOrder;
  }

  public toText = (resolver: NameResolver): string => {
    return this.asmtOrder.map(id =>
      `${this.asmtIdToText(id, resolver)} = ${this.asmts[id].toText(resolver)}`).join(", ");
  }

  protected asmtIdToText(asmtId: string, resolver: NameResolver): string {
    return asmtId;
  }
}

export class AssignmentsUnres extends AssignmentsAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.ASSIGNMENTS> {
  public resolve = (resolver: NameResolver) => {
    throw new Error("Calling resolve is not supported. Call resolveForConstructor instead.");
  }

  public resolveForConstructor = (resolver: NameResolver, constructorRef: ConstructorReference) => {
    const type = constructorRef.model.assignmentsType;
    const nameResolver = resolver.resolverFor(type);
    const namesResolved = _.mapKeys(this.asmts, (_e, name) => nameResolver.resolveValueReference(name).id);
    const asmtsR = _.mapValues(namesResolved, e => e.resolve(resolver));
    const asmtTypes = _.mapValues(asmtsR, asmt => asmt.type);
    resolver.validateConstructorAssignments(constructorRef, asmtTypes);
    const asmtOrderR = this.asmtOrder.map(name => nameResolver.resolveValueReference(name).id);
    return new AssignmentsRes(asmtsR, asmtOrderR, constructorRef, type);
  }
}

export class AssignmentsRes<I extends Identifier = Identifier>
    extends AssignmentsAST<ResolvedAST>
    implements ResolvedAST<PartialRowType<I>, ASTNodeType.ASSIGNMENTS> {
  public readonly type: PartialRowType<I>;
  public readonly externalDependencies: ROArray<Reference>;

  private readonly constructorRef: ConstructorReference;

  constructor(asmts: RODictionary<ResolvedAST>, asmtOrder: ROArray<string>,
      constructorRef: ConstructorReference, type: PartialRowType<I>) {
    super(asmts, asmtOrder);
    this.constructorRef = constructorRef;
    this.type = type;
    this.externalDependencies = ResolvedASTUtils.mergeDeps(...Object.values(asmts));
  }

  public get isLiteral() {
    return _.every(this.asmts, a => a.isLiteral);
  }

  public eval = (valueResolver: ValueResolver): PartialRowValue<I> => {
    const asmtsV = _.mapValues(this.asmts, e => e.eval(valueResolver));
    return ValueUtils.partialRowOf(asmtsV, this.type.schemaId.gridId);
  }

  protected asmtIdToText(asmtId: string, resolver: NameResolver): string {
    const name = resolver.nameForIdInConstructor(asmtId, this.constructorRef);
    return Parser.identToText(name);
  }
}


// ==============
// Identifier AST
// ==============

abstract class IdentifierAST implements AST<ASTNodeType.IDENTIFIER> {
  public readonly nodeType = ASTNodeType.IDENTIFIER;

  public abstract toText(resolver: NameResolver): string;
}

export class IdentifierUnres extends IdentifierAST implements UnresolvedAST<ASTNodeType.IDENTIFIER> {
  private readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  public resolve = (resolver: NameResolver) => {
    const refR = resolver.resolveValueReference(this.name);
    return new IdentifierRes(refR);
  }

  public toText = (resolver: NameResolver): string => {
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

  public eval = (valueResolver: ValueResolver): Value<R> => {
    return this.ref.eval(valueResolver);
  }

  public toText = (resolver: NameResolver): string => {
    const name = this.ref.getName(resolver);
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

  public toText = (resolver: NameResolver): string => {
    return `(${this.e.toText(resolver)})`;
  }
}

export class ParenthesesUnres extends ParenthesesAST<UnresolvedAST> implements UnresolvedAST<ASTNodeType.PARENTHESES> {
  public resolve = (resolver: NameResolver) => {
    const eR = this.e.resolve(resolver);
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

  public eval = (valueResolver: ValueResolver): Value<R> => {
    return this.e.eval(valueResolver);
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

  public toText = (resolver: NameResolver): string => {
    return `[${this.es.map(e => e.toText(resolver)).join(", ")}]`;
  }
}

export class ListUnres extends ListAST<UnresolvedAST>
    implements UnresolvedAST<ASTNodeType.LIST> {
  public resolve = (resolver: NameResolver) => {
    const esR = this.es.map(e => e.resolve(resolver));
    const itemType = TypeUtils.unionAll(esR.map(eR => eR.type));
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

  public eval = (valueResolver: ValueResolver): ListValue<T> => {
    const esV = this.es.map(e => e.eval(valueResolver));
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

  public toText = (resolver: NameResolver): string => {
    if (TypeUtils.isString(this.type)) {
      return Parser.stringToText(this.value as string);
    }
    return `${this.value}`;
  }
}

export class PrimitiveUnres<T extends PrimitiveType> extends Primitive<T>
    implements UnresolvedAST<ASTNodeType.PRIMITIVE> {
  public resolve = (resolver: NameResolver) => {
    return new PrimitiveRes(this.value, this.type);
  }
}

export class PrimitiveRes<T extends PrimitiveType = PrimitiveType> extends Primitive<T>
    implements ResolvedAST<T, ASTNodeType.PRIMITIVE> {
  public readonly externalDependencies: ROArray<Reference> = [];
  public readonly isLiteral = true;

  public eval = (valueResolver: ValueResolver): Value<T> => {
    return ValueUtils.primitiveOf(this.value, this.type);
  }
}
