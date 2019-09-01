import * as _ from 'lodash';

import {BuiltInFormula, Constructor} from '@models/domain_specific/constructor'; // only a type dependency
import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {Dictionary, RODictionary} from '@utils/types';
import {buildNamespace, ConstructorNamespace, NameResolver, ValueNamespace} from './name_resolver';
import {ReferenceUtils} from './reference';
import {getBuiltInFormulas} from './standard_library';
import {GridType, Identifier, ListOfAnyType, Type, TypeUtils} from './types';

export class FormulaEnvironment {
  private readonly builtInFormulasByGridId: Dictionary<BuiltInFormula>;
  private readonly grids: Dictionary<Grid>;
  private readonly valueNamespace: ValueNamespace;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly _nameResolver: NameResolver;

  constructor() {
    const builtInFormulas = getBuiltInFormulas();
    this.builtInFormulasByGridId = _.mapKeys(builtInFormulas, g => g.id);
    this.grids = {};
    this.valueNamespace = buildNamespace({});
    this.constructorNamespace = FormulaEnvironment.buildConstructorNamespace(builtInFormulas);
    this._nameResolver = this.buildNameResolver();
  }

  private static buildConstructorNamespace = (constructors: RODictionary<Constructor>): ConstructorNamespace => {
    const builtInFormulaReferences = _.mapValues(constructors, ReferenceUtils.buildReferenceForConstructor);
    return new ConstructorNamespace(builtInFormulaReferences);
  }

  private buildNameResolver = (): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    // TODO clarify the role of NameResolver vs FormulaEnvironment
    return new NameResolver(namespaceResolver, this.constructorNamespace, this.valueNamespace, this);
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = (this.builtInFormulasByGridId[objectId] || this.grids[objectId]) as BuiltInFormula | Grid | undefined;
    return object && object.namespace;
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
    this.constructorNamespace.addGrid(grid);
  }

  public removeGrid = (gridId: string): void => {
    delete this.grids[gridId];
    this.constructorNamespace.removeGrid(gridId);
  }

  public get nameResolver(): NameResolver {
    return this._nameResolver;
  }

  public getAllowedColumnTypes = (): Type[] => {
    const constructableRowTypes = _.values(this.grids).map(g => TypeUtils.RowOf(g.id));
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

  public isAssignableTo = (t1: GridType, t2: GridType): boolean => {
    return this.isOrExtends(t1, t2);
  }

  private isOrExtends = (t1: GridType, t2: GridType): boolean => {
    const g1 = this.grids[t1.schemaId.gridId];
    const g2 = this.grids[t2.schemaId.gridId];
    return g1.isOrExtends(g2);
  }

  public getUnionType = (t1: GridType, t2: GridType): GridType | ListOfAnyType => {
    const g1 = this.grids[t1.schemaId.gridId];
    const g2 = this.grids[t2.schemaId.gridId];
    const commonAncestor = g1.getCommonAncestor(g2);
    return commonAncestor ? TypeUtils.GridOf(commonAncestor.id) : TypeUtils.ListOfAny;
  }
}