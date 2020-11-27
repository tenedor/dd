import * as _ from 'lodash';

import {DependencyNode} from '@models/core/update_manager'; // Only a type dependency
import {Procedure} from '@models/domain_specific/procedure'; // Only a type dependency
import {Identifier, RowType, Type, TypeUtils} from './types';
import {ValueResolver} from './value_resolver';
import {Value} from './values';

export type ValueDependency = DependencyNode & {readonly value: Value};

enum ReferenceType {
  VALUE_REFERENCE,
  CONSTRUCTOR_REFERENCE,
  FORMULA_REFERENCE,
}

type ProcedureReferenceType = ReferenceType.CONSTRUCTOR_REFERENCE | ReferenceType.FORMULA_REFERENCE;

interface BaseReference<T extends ReferenceType> {
  readonly id: Identifier;
  readonly referenceType: T;
}

export class ValueReference<T extends Type = Type> implements BaseReference<ReferenceType.VALUE_REFERENCE> {
  public readonly id: Identifier;
  public readonly type: T;
  public readonly referenceType = ReferenceType.VALUE_REFERENCE;

  constructor(id: Identifier, type: T) {
    this.id = id;
    this.type = type;
  }

  public eval = (valueResolver: ValueResolver): Value<T> => {
    return valueResolver.evalValueReference(this);
  }

  /*
  public static buildForIteratorVariable = <T extends Type> (type: T, name: string): ValueReference<T> => {
    const id = `${IdentifierPrefix.ITERATOR}-${Parser.identToText(name)}`;
    return new ValueReference(id, type, () => name);
  }
  */
}

export interface ProcedureReference<R extends Type = Type, I extends Identifier = Identifier,
    T extends ProcedureReferenceType = ProcedureReferenceType>
    extends BaseReference<T> {
  readonly id: I;
  readonly returnType: R;
  readonly referenceType: T;
}

export class ConstructorReference<I extends Identifier = Identifier>
    implements ProcedureReference<RowType<I>, I, ReferenceType.CONSTRUCTOR_REFERENCE> {
  public readonly id: I;
  public readonly returnType: RowType<I>;
  public readonly referenceType = ReferenceType.CONSTRUCTOR_REFERENCE;

  public constructor(gridId: I) {
    this.id = gridId;
    this.returnType = TypeUtils.RowOf(gridId);
  }
}

export class FormulaReference<R extends Type = Type, I extends Identifier = Identifier>
    implements ProcedureReference<R, I, ReferenceType.FORMULA_REFERENCE> {
  public readonly id: I;
  public readonly returnType: R;
  public readonly referenceType = ReferenceType.FORMULA_REFERENCE;

  public constructor(id: I, returnType: R) {
    this.id = id;
    this.returnType = returnType;
  }
}

export type Reference = ValueReference | ProcedureReference;

export class ReferenceUtils {

  // ============
  // Constructors
  // ============

  public static buildReferenceForProcedure = <R extends Type, I extends Identifier> (
    procedure: Procedure,
  ): ProcedureReference => {
    const {isConstructorLiteral, id, returnType} = procedure;
    return isConstructorLiteral ? new ConstructorReference(id) : new FormulaReference(id, returnType);
  }


  // ===========
  // Type Guards
  // ===========

  public static isValueReference = (ref: Reference): ref is ValueReference =>
      ref.referenceType === ReferenceType.VALUE_REFERENCE
  public static isConstructorReference = (ref: Reference): ref is ConstructorReference =>
      ref.referenceType === ReferenceType.CONSTRUCTOR_REFERENCE
  public static isFormulaReference = (ref: Reference): ref is FormulaReference =>
      ref.referenceType === ReferenceType.FORMULA_REFERENCE
  public static isProcedureReference = (ref: Reference): ref is ProcedureReference =>
      ReferenceUtils.isConstructorReference(ref) || ReferenceUtils.isFormulaReference(ref)
}