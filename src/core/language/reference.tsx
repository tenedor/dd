import * as _ from 'lodash';

import {DependencyNode} from '@models/core/update_manager'; // Only a type dependency
import {Constructor} from '@models/domain_specific/constructor'; // Only a type dependency
import {Grid} from '@models/domain_specific/grid'; // Only a type dependency
import {IdentifierPrefix} from '@utils/identifier_prefixes';
import {NameResolver} from './name_resolver';
import {Parser} from './parser';
import {GridType, Identifier, Type, TypeUtils} from './types';
import {ValueResolver} from './value_resolver';
import {Value} from './values';

export type ValueDependency = DependencyNode & {readonly value: Value};

export enum ReferenceType {
  ABSOLUTE_CONSTRUCTOR = "ABSOLUTE_CONSTRUCTOR",
  ABSOLUTE_VALUE = "ABSOLUTE_VALUE",
  RELATIVE_VALUE = "RELATIVE_VALUE",
}

type AbsoluteReferenceType = ReferenceType.ABSOLUTE_CONSTRUCTOR | ReferenceType.ABSOLUTE_VALUE;
type RelativeReferenceType = ReferenceType.RELATIVE_VALUE;
type ValueReferenceType = ReferenceType.ABSOLUTE_VALUE | ReferenceType.RELATIVE_VALUE;

interface BaseReference<R extends ReferenceType> {
  readonly id: Identifier;
  readonly referenceType: R;

  getName(resolver: NameResolver): string;
}

export interface AbsoluteReference<R extends AbsoluteReferenceType = AbsoluteReferenceType> extends BaseReference<R> {
  readonly model: DependencyNode,
}

export type RelativeReference = BaseReference<RelativeReferenceType>;

export type Reference = AbsoluteReference | RelativeReference;

abstract class BaseValueReference<T extends Type = Type, R extends ValueReferenceType = ValueReferenceType>
    implements BaseReference<R> {
  public readonly id: Identifier;
  public readonly referenceType: R;
  public readonly getName: (resolver: NameResolver) => string;
  public readonly type: T;

  constructor(id: Identifier, type: T, getName: (resolver: NameResolver) => string, referenceType: R) {
    this.id = id;
    this.type = type;
    this.getName = getName;
    this.referenceType = referenceType;
  }

  public eval = (valueResolver: ValueResolver): Value<T> => {
    // Apologies to R. Milner...
    return valueResolver.evalValueReference(this as ValueReference<T>);
  }
}

export class RelativeValueReference<T extends Type = Type>
    extends BaseValueReference<T, ReferenceType.RELATIVE_VALUE>
    implements RelativeReference {

  constructor(id: Identifier, type: T, getName: (resolver: NameResolver) => string) {
    super(id, type, getName, ReferenceType.RELATIVE_VALUE);
  }

  public static buildForIteratorVariable = <T extends Type> (type: T, name: string): RelativeValueReference<T> => {
    const id = `${IdentifierPrefix.ITERATOR}-${Parser.identToText(name)}`;
    return new RelativeValueReference(id, type, () => name);
  }
}

export class AbsoluteValueReference<T extends Type = Type>
    extends BaseValueReference<T, ReferenceType.ABSOLUTE_VALUE>
    implements AbsoluteReference<ReferenceType.ABSOLUTE_VALUE> {

  public readonly model: ValueDependency;

  constructor(id: Identifier, type: T, getName: (resolver: NameResolver) => string, model: ValueDependency) {
    super(id, type, getName, ReferenceType.ABSOLUTE_VALUE);
    this.model = model;
  }
}

export type ValueReference<T extends Type = Type> = RelativeValueReference<T> | AbsoluteValueReference<T>;

export class GridReference<I extends Identifier = Identifier> extends AbsoluteValueReference<GridType<I>> {
  public readonly id: I;

  constructor(grid: Grid) {
    const id = grid.id as I;
    const type = TypeUtils.GridOf(id);
    const getName = (r: NameResolver) => r.nameForValueId(id);
    super(id, type, getName, grid);
  }
}

export interface ConstructorReference<R extends Type = Type, I extends Identifier = Identifier>
    extends AbsoluteReference<ReferenceType.ABSOLUTE_CONSTRUCTOR> {
  readonly model: Constructor<R, I>,
}

export class ReferenceUtils {

  // ============
  // Constructors
  // ============

  public static buildReferenceForConstructor = <R extends Type, I extends Identifier> (
    constructor: Constructor<R, I>,
  ): ConstructorReference<R, I> => {
    const {id} = constructor;
    return {
      id,
      referenceType: ReferenceType.ABSOLUTE_CONSTRUCTOR,
      model: constructor,
      getName: (resolver: NameResolver) => constructor.name,
    }
  }


  // ===========
  // Type Guards
  // ===========

  public static isRelativeReference = (r: Reference): r is RelativeReference => {
    return r.referenceType === ReferenceType.RELATIVE_VALUE;
  }

  public static isAbsoluteReference = (r: Reference): r is AbsoluteReference => {
    return [ReferenceType.ABSOLUTE_CONSTRUCTOR, ReferenceType.ABSOLUTE_VALUE].includes(r.referenceType);
  }

  public static isValueReference = (r: Reference): r is ValueReference => {
    return [ReferenceType.ABSOLUTE_VALUE, ReferenceType.RELATIVE_VALUE].includes(r.referenceType);
  }

  public static isConstructorReference = (r: Reference): r is ConstructorReference => {
    return r.referenceType === ReferenceType.ABSOLUTE_CONSTRUCTOR;
  }
}