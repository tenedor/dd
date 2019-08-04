import * as _ from 'lodash';

import {Constructor} from '@models/domain_specific/constructor'; // only a type dependency
import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {Dictionary, RODictionary} from '@utils/types';
import {buildNamespace, ConstructorNamespace, NameResolver, ValueNamespace} from './name_resolver';
import {ReferenceUtils} from './reference';
import {getBuiltInFormulas} from './standard_library';
import {GridType, Identifier, Type, TypeUtils} from './types';

interface ObjectWithNamespace {
  id: string,
  namespace: ValueNamespace,
}

export class FormulaEnvironment {
  private readonly documentScopedObjects: Dictionary<ObjectWithNamespace>;
  private readonly valueNamespace: ValueNamespace;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly _nameResolver: NameResolver;
  private readonly customTypes: Dictionary<GridType>;

  constructor() {
    const builtInFormulas = getBuiltInFormulas();
    this.valueNamespace = buildNamespace({});
    this.constructorNamespace = FormulaEnvironment.buildConstructorNamespace(builtInFormulas);
    this.documentScopedObjects = _.mapKeys(builtInFormulas, g => g.id);
    this._nameResolver = this.buildNameResolver();
    this.customTypes = {};
  }

  private static buildConstructorNamespace = (constructors: RODictionary<Constructor>): ConstructorNamespace => {
    const builtInFormulaReferences = _.mapValues(constructors, ReferenceUtils.buildReferenceForConstructor);
    return new ConstructorNamespace(builtInFormulaReferences);
  }

  private buildNameResolver = (): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    return new NameResolver(namespaceResolver, this.constructorNamespace, this.valueNamespace);
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = this.getObject(objectId);
    return object && object.namespace;
  }

  public addGrid = (grid: Grid): void => {
    this.addObjectWithNamespace(grid);
    this.constructorNamespace.addGrid(grid);
    this.customTypes[grid.id] = TypeUtils.GridOf(grid.id);
  }

  public removeGrid = (gridId: string): void => {
    this.removeObjectWithNamespace(gridId);
    this.constructorNamespace.removeGrid(gridId);
    delete this.customTypes[gridId];
  }

  public addObjectWithNamespace = (object: ObjectWithNamespace): void => {
    this.documentScopedObjects[object.id] = object;
  }

  public removeObjectWithNamespace = (objectId: string): void => {
    delete this.documentScopedObjects[objectId];
  }

  public get nameResolver(): NameResolver {
    return this._nameResolver;
  }

  private getObject = (objectId: Identifier): ObjectWithNamespace | undefined => {
    return this.documentScopedObjects[objectId];
  }

  public getAllowedColumnTypes = (): Type[] => {
    const constructableRowTypes = _.values(this.customTypes).map(t => t.itemType);
    return TypeUtils.atomicTypes.concat(constructableRowTypes);
  }

  public getNameForType = (t: Type): string => {
    if (TypeUtils.isDict(t)) {
      const name = this.constructorNamespace.getNameForReference(t.schemaId.gridId);
      if (name !== undefined) {
        return name;
      }
    }
    return TypeUtils.toString(t);
  }
}