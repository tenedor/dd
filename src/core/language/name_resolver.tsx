import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid'; // Only a type dependency
import {RODictionary} from '@utils/types';
import {FormulaEnvironment} from './formula_environment';
import {ObjectResolutionError, TypeError, ValueResolutionError} from './language_errors';
import {ConstructorReference, Reference, ReferenceUtils, ValueReference} from './reference';
import {BoundingType, DictType, Identifier, RowType, Type, TypeUtils} from './types';

interface Namespace<R extends Reference> {
  getReferenceForName(name: string): R | undefined;
  getNameForReference(refId: Identifier): string | undefined;
}

export type ValueNamespace = Namespace<ValueReference>;


export class ConstructorNamespace implements Namespace<ConstructorReference> {
  private readonly nameToReferenceMap: {[name: string]: ConstructorReference};
  private readonly idToNameMap: {[id: string]: string};
  private readonly grids: {[id: string]: Grid};

  constructor() {
    this.nameToReferenceMap = {};
    this.idToNameMap = {};
    this.grids = {};
  }

  public getReferenceForName = (name: string): ConstructorReference | undefined => {
    const grid = Object.values(this.grids).find(g => g.name === name);
    return grid ?
      ReferenceUtils.buildReferenceForConstructor(grid.gridConstructor) :
      this.nameToReferenceMap[name];
  }

  // TODO - in the case of grids, this is using the grid id not the reference id
  public getNameForReference = (refId: Identifier): string | undefined => {
    const grid = this.grids[refId];
    return grid ? grid.name : this.idToNameMap[refId];
  }

  public getReferenceForGridId = <I extends Identifier> (gridId: I): ConstructorReference<RowType<I>, I> | undefined => {
    const grid = this.grids[gridId as string] as Grid<I>;
    return grid ?
      ReferenceUtils.buildReferenceForConstructor(grid.gridConstructor) :
      undefined;
  }

  public addBuiltInFormula = (name: string, ref: ConstructorReference) => {
    this.nameToReferenceMap[name] = ref;
    this.idToNameMap[ref.id] = name;
  }

  public addGrid = (grid: Grid) => {
    this.grids[grid.id] = grid;
  }

  public removeGrid = (gridId: string) => {
    delete this.grids[gridId];
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


class NameResolutionError extends ObjectResolutionError {
  constructor(message: string = "", errorClass: typeof NameResolutionError = NameResolutionError) {
    super(message, errorClass);
  }
}

export interface NamespaceResolver {
  resolveNamespace(id: Identifier): ValueNamespace | undefined;
}

export class NameResolver {
  private readonly namespaceResolver: NamespaceResolver;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly valueNamespace: ValueNamespace;
  // TODO clarify the role of NameResolver vs FormulaEnvironment
  public readonly environment: FormulaEnvironment;
  private readonly iteratorType: Type;
  private static MISSING_NAME_PLACEHOLDER = "missing_name";

  constructor(
    namespaceResolver: NamespaceResolver,
    constructorNamespace: ConstructorNamespace,
    valueNamespace: ValueNamespace,
    environment: FormulaEnvironment,
    iteratorType: Type = BoundingType.BOTTOM,
  ) {
    this.namespaceResolver = namespaceResolver;
    this.constructorNamespace = constructorNamespace;
    this.valueNamespace = valueNamespace;
    this.environment = environment;
    this.iteratorType = iteratorType;
  }

  public resolveValueReference = (name: string): ValueReference => {
    const ref = this.valueNamespace.getReferenceForName(name);
    if (!ref) {
      throw new ValueResolutionError(`No value with name '${name}' exists in this scope`);
    }
    return ref;
  }

  public resolveConstructorReference = (name: string): ConstructorReference => {
    const ref = this.constructorNamespace.getReferenceForName(name);
    if (!ref) {
      throw new NameResolutionError(`No formula or grid exists with name '${name}'`);
    }
    return ref;
  }

  public resolveGridConstructorFromId = <I extends Identifier> (gridId: I): ConstructorReference<RowType<I>, I> => {
    const ref = this.constructorNamespace.getReferenceForGridId(gridId);
    if (!ref) {
      throw new NameResolutionError(`No constructor exists for grid with id '${gridId}'`);
    }
    return ref;
  }

  public resolveNamespaceForConstructor = <I extends Identifier> (gridId: I): ValueNamespace => {
    return this.resolveGridConstructorFromId(gridId).model.namespace;
  }

  private resolveNamespace = (id: Identifier): ValueNamespace => {
    const namespace = this.namespaceResolver.resolveNamespace(id);
    if (!namespace) {
      throw new NameResolutionError(`No namespace found for id ${id}`);
    }
    return namespace;
  }

  public getIteratorType = (): Type => {
    return this.iteratorType;
  }

  public nameForConstructorAssignment = (constructorId: Identifier, assignmentId: Identifier): string => {
    const namespace = this.resolveNamespaceForConstructor(constructorId);
    const name = namespace.getNameForReference(assignmentId);
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
    const {namespace} = constructor.model;
    Object.keys(asmtTypesById).forEach(id => {
      const name = namespace.getNameForReference(id);
      if (!name) {
        throw new TypeError(`Assignment to \`${id}\` does not match constructor \`${constructor.id}\``);
      }
      const ref = namespace.getReferenceForName(name);
      if (!ref) {
        throw new TypeError(`Assignment to \`${id}\` does not match constructor \`${constructor.id}\``);
      } else {
        const {type} = ref;
        TypeUtils.validateIsAssignableTo(asmtTypesById[id], type, this.environment,
          `Expected value \`${name}\` to be assignable to type \`${this.environment.getNameForType(type)}\``);
      }
    });
  }

  public resolverWith = (valueNamespace: ValueNamespace): NameResolver => {
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, valueNamespace, this.environment);
  }

  public resolverFor = (dict: DictType): NameResolver => {
    const valueNamespace = this.resolveNamespace(dict.schemaId.gridId);
    return this.resolverWith(valueNamespace);
  }

  public extendWithDict = (dict: DictType): NameResolver => {
    const namespace = this.resolveNamespace(dict.schemaId.gridId);
    return this.extendWithNamespace(namespace);
  }

  public extendWithNamespace = (namespace: ValueNamespace): NameResolver => {
    const stackedNamespace = NameResolver.extendNamespace(this.valueNamespace, namespace);
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, stackedNamespace, this.environment);
  }

  private static extendNamespace = (parentNamespace: ValueNamespace, namespace: ValueNamespace): ValueNamespace => {
    return {
      getReferenceForName: (name: string) => namespace.getReferenceForName(name) || parentNamespace.getReferenceForName(name),
      getNameForReference: (refId: Identifier) => namespace.getNameForReference(refId) || parentNamespace.getNameForReference(refId),
    }
  }

  public extendWithIteratorType = (iteratorType: Type) => {
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, this.valueNamespace, this.environment, iteratorType);
  }
}