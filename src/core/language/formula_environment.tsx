import * as _ from 'lodash';

import {Constructor} from '@models/domain_specific/constructor'; // only a type dependency
import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {Dictionary, RODictionary} from '@utils/types';
import {buildNamespace, ConstructorNamespace, NameResolver, ReferenceUtils,
        ValueNamespace} from './reference';
import {getBuiltInFormulas} from './standard_library';
import {Identifier} from './types';

interface ObjectWithNamespace {
  id: string,
  namespace: ValueNamespace,
}

export class FormulaEnvironment {
  private readonly documentScopedObjects: Dictionary<ObjectWithNamespace>;
  private readonly valueNamespace: ValueNamespace;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly _resolver: NameResolver;

  constructor() {
    const builtInFormulas = getBuiltInFormulas();
    this.valueNamespace = buildNamespace({});
    this.constructorNamespace = FormulaEnvironment.buildConstructorNamespace(builtInFormulas);
    this.documentScopedObjects = _.mapKeys(builtInFormulas, g => g.id);
    this._resolver = this.buildResolver();
  }

  private static buildConstructorNamespace = (constructors: RODictionary<Constructor>): ConstructorNamespace => {
    const builtInFormulaReferences = _.mapValues(constructors, ReferenceUtils.buildReferenceForConstructor);
    return new ConstructorNamespace(builtInFormulaReferences);
  }

  private buildResolver = (): NameResolver => {
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
  }

  public removeGrid = (gridId: string): void => {
    this.removeObjectWithNamespace(gridId);
    this.constructorNamespace.removeGrid(gridId);
  }

  public addObjectWithNamespace = (object: ObjectWithNamespace): void => {
    this.documentScopedObjects[object.id] = object;
  }

  public removeObjectWithNamespace = (objectId: string): void => {
    delete this.documentScopedObjects[objectId];
  }

  public get resolver(): NameResolver {
    return this._resolver;
  }

  private getObject = (objectId: Identifier): ObjectWithNamespace | undefined => {
    return this.documentScopedObjects[objectId];
  }
}