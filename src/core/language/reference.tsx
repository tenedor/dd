import * as _ from 'lodash';

import {Model} from '@models/core/model'; // Only a type dependency
import {Grid} from '@models/domain_specific/grid'; // Only a type dependency
import {RODictionary} from '@utils/types';
import {DictType, GridType, Identifier, RowType, Type, TypeUtils} from './types';
import {DictValue, RowValue, Value} from './values';

export type ModelWithValue = Model & {value: Value};

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
  readonly model: Model,
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

  public eval = (context: Context): Value<T> => {
    // Apologies to R. Milner...
    return context.evalValueReference(this as ValueReference<T>);
  }
}

export class RelativeValueReference<T extends Type = Type>
    extends BaseValueReference<T, ReferenceType.RELATIVE_VALUE>
    implements RelativeReference {

  constructor(id: Identifier, type: T, getName: (resolver: NameResolver) => string) {
    super(id, type, getName, ReferenceType.RELATIVE_VALUE);
  }
}

export class AbsoluteValueReference<T extends Type = Type>
    extends BaseValueReference<T, ReferenceType.ABSOLUTE_VALUE>
    implements AbsoluteReference<ReferenceType.ABSOLUTE_VALUE> {

  public readonly model: ModelWithValue;

  constructor(id: Identifier, type: T, getName: (resolver: NameResolver) => string, model: ModelWithValue) {
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
  readonly returnType: R;
  readonly namespace: ValueNamespace;
  readonly assignmentsType: DictType;

  eval: (context: Context, asmts: DictValue<I>) => Value<R>;
}

export type GridConstructorReference<I extends Identifier = Identifier> = ConstructorReference<RowType<I>, I>;

export interface CustomFormulaReference<R extends Type = Type, I extends Identifier = Identifier>
    extends ConstructorReference<R, I> {
  readonly projectionRef: ValueReference<R>;
}

export type BuiltInFormulaReference<R extends Type = Type> = ConstructorReference<R>;

export class ReferenceUtils {

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

}


interface Namespace<R extends Reference> {
  getReferenceForName(name: string): R | undefined;
  getNameForReference(refId: Identifier): string | undefined;
}

export type ValueNamespace = Namespace<ValueReference>;


export class ConstructorNamespace implements Namespace<ConstructorReference> {
  private readonly nameToReferenceMap: {[name: string]: ConstructorReference};
  private readonly idToNameMap: {[id: string]: string};
  private readonly grids: {[id: string]: Grid};

  constructor(nameToReferenceMap: {[name: string]: ConstructorReference}) {
    this.nameToReferenceMap = nameToReferenceMap;
    const nameToIdMap = _.mapValues(nameToReferenceMap, ref => ref.id);
    this.idToNameMap = _.invert(nameToIdMap);
    this.grids = {};
  }

  public getReferenceForName = (name: string): ConstructorReference => {
    const grid = Object.values(this.grids).find(g => g.name === name);
    return grid ? this.getConstructorForGrid(grid) : this.nameToReferenceMap[name];
  }

  public getNameForReference = (refId: Identifier): string => {
    const grid = this.grids[refId];
    return grid ? grid.name : this.idToNameMap[refId];
  }

  public addGrid = (grid: Grid) => {
    this.grids[grid.id] = grid;
  }

  public removeGrid = (gridId: string) => {
    delete this.grids[gridId];
  }

  private getConstructorForGrid = (grid: Grid): ConstructorReference<RowType> => {
    const {id, namespace} = grid;
    return {
      id,
      referenceType: ReferenceType.ABSOLUTE_CONSTRUCTOR,
      model: grid,
      returnType: TypeUtils.RowOf(id),
      namespace,
      assignmentsType: TypeUtils.DictOf(id),
      getName: (r: NameResolver) => r.nameForConstructorId(id),
      eval: grid.evalConstructor,
    }
  }
}


export const buildNamespace = <R extends Reference> (nameToReferenceMap: {[name: string]: R}): Namespace<R> => {
  const nameToIdMap = _.mapValues(nameToReferenceMap, ref => ref.id);
  const idToNameMap = _.invert(nameToIdMap);

  return {
    getReferenceForName: (name: string) => nameToReferenceMap[name],
    getNameForReference: (refId: Identifier) => idToNameMap[refId],
  }
}


export interface NamespaceResolver {
  resolveNamespace(id: Identifier): ValueNamespace | undefined;
}

export class NameResolver {
  private namespaceResolver: NamespaceResolver;
  private constructorNamespace: ConstructorNamespace;
  private valueNamespace: ValueNamespace;
  private static MISSING_NAME_PLACEHOLDER = "missing_name";

  constructor(
    namespaceResolver: NamespaceResolver,
    constructorNamespace: ConstructorNamespace,
    valueNamespace: ValueNamespace,
  ) {
    this.namespaceResolver = namespaceResolver;
    this.constructorNamespace = constructorNamespace;
    this.valueNamespace = valueNamespace;
  }

  public resolveValueReference = (name: string): ValueReference => {
    const ref = this.valueNamespace.getReferenceForName(name);
    if (!ref) {
      throw new TypeError(`No value with name '${name}' exists in this scope`);
    }
    return ref;
  }

  public resolveConstructorReference = (name: string): ConstructorReference => {
    const ref = this.constructorNamespace.getReferenceForName(name);
    if (!ref) {
      throw new TypeError(`No formula or grid exists with name '${name}'`);
    }
    return ref;
  }

  private resolveNamespace = (id: Identifier): ValueNamespace => {
    const namespace = this.namespaceResolver.resolveNamespace(id);
    if (!namespace) {
      throw new Error(`No namespace found for id ${id}`);
    }
    return namespace;
  }

  public nameForIdInConstructor = (id: Identifier, constructor: ConstructorReference): string => {
    const name = constructor.namespace.getNameForReference(id);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  public nameForValueId = (id: Identifier): string => {
    const name = this.valueNamespace.getNameForReference(id);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  public nameForConstructorId = (id: Identifier): string => {
    const name = this.constructorNamespace.getNameForReference(id);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  public validateConstructorAssignments =
      (constructor: ConstructorReference, asmtTypesById: RODictionary<Type>): void => {
    Object.keys(asmtTypesById).forEach(id => {
      const name = constructor.namespace.getNameForReference(id);
      if (!name) {
        throw new TypeError(`Assignment to \`${id}\` does not match constructor \`${constructor.id}\``);
      }
      const ref = constructor.namespace.getReferenceForName(name);
      if (!ref) {
        throw new TypeError(`Assignment to \`${id}\` does not match constructor \`${constructor.id}\``);
      } else {
        const {type} = ref;
        TypeUtils.validateIsAssignableTo(asmtTypesById[id], type,
          `Expected value \`${name}\` to be assignable to type \`${TypeUtils.toString(type)}\``);
      }
    });
  }

  public resolverFor = (dict: DictType): NameResolver => {
    const valueNamespace = this.resolveNamespace(dict.schemaId);
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, valueNamespace);
  }

  public extendWith = (dict: DictType): NameResolver => {
    const localNamespace = this.resolveNamespace(dict.schemaId);
    const stackedNamespace = NameResolver.extendNamespace(this.valueNamespace, localNamespace);
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, stackedNamespace);
  }

  private static extendNamespace = (parentNamespace: ValueNamespace, namespace: ValueNamespace): ValueNamespace => {
    return {
      getReferenceForName: (name: string) => namespace.getReferenceForName(name) || parentNamespace.getReferenceForName(name),
      getNameForReference: (refId: Identifier) => namespace.getNameForReference(refId) || parentNamespace.getNameForReference(refId),
    }
  }
}


export class Context {
  private readonly valueLookupTable: RODictionary<Value>;

  constructor(valueLookupTable: RODictionary<Value>) {
    this.valueLookupTable = valueLookupTable;
  }

  public evalValueReference = <T extends Type>(ref: ValueReference<T>): Value<T> => {
    const value = this.valueLookupTable[ref.id];
    if (!value) {
      throw new Error(`No value found for reference ${ref.id}`);
    }
    TypeUtils.validateIsAssignableTo(value.type, ref.type,
      `Reference of type ${ref.type} resolved to a value with incompatible type ${value.type}`);
    return value as Value<T>;
  }

  public evalFormula = <R extends Type>(formulaRef: BuiltInFormulaReference<R>): Value<R> => {
    throw new Error("not implemented");
  }

  public constructRow = <I extends Identifier>(ref: GridReference<I>, asmts: DictValue<I>): RowValue<I> => {
    // validate assignments and construct a row
    throw new Error("not implemented");
  }

  public contextOf = (dict: RODictionary<Value>): Context => {
    return new Context(dict);
  }
}