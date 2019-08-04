import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid'; // Only a type dependency
import {RODictionary} from '@utils/types';
import {ConstructorReference, Reference, ReferenceUtils, ValueReference} from './reference';
import {DictType, Identifier, Type, TypeUtils} from './types';

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
    return grid ? ReferenceUtils.buildReferenceForConstructor(grid.gridConstructor) : this.nameToReferenceMap[name];
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
    const {namespace} = constructor.model;
    const name = namespace.getNameForReference(id);
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
        TypeUtils.validateIsAssignableTo(asmtTypesById[id], type,
          `Expected value \`${name}\` to be assignable to type \`${TypeUtils.toString(type)}\``);
      }
    });
  }

  public resolverFor = (dict: DictType): NameResolver => {
    const valueNamespace = this.resolveNamespace(dict.schemaId.gridId);
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, valueNamespace);
  }

  public extendWith = (dict: DictType): NameResolver => {
    const localNamespace = this.resolveNamespace(dict.schemaId.gridId);
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