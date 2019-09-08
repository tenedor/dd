import * as _ from 'lodash';

import {BuiltInFormula} from '@models/domain_specific/constructor'; // only a type dependency
import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {Dictionary} from '@utils/types';
import {assert} from '@utils/utils';
import {buildNamespace, ConstructorNamespace, NameResolver, ValueNamespace} from './name_resolver';
import {ReferenceUtils} from './reference';
import {GridType, Identifier, ListOfAnyType, Type, TypeUtils} from './types';

export class FormulaEnvironment {
  private readonly parent?: FormulaEnvironment;
  private readonly builtInFormulasByGridId: Dictionary<BuiltInFormula>;
  private readonly grids: Dictionary<Grid>;
  private readonly valueNamespace: ValueNamespace;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly _nameResolver: NameResolver;

  constructor(parent?: FormulaEnvironment) {
    this.parent = parent;
    this.builtInFormulasByGridId = {};
    this.grids = {};
    this.valueNamespace = buildNamespace({});
    const parentNamespace = parent && parent.constructorNamespace;
    this.constructorNamespace = new ConstructorNamespace(parentNamespace);
    this._nameResolver = this.buildNameResolver();
  }

  private buildNameResolver = (): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    // TODO clarify the role of NameResolver vs FormulaEnvironment
    return new NameResolver(namespaceResolver, this.constructorNamespace, this.valueNamespace, this);
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = (this.grids[objectId] || this.builtInFormulasByGridId[objectId]) as Grid | BuiltInFormula | undefined;
    const namespace = object && object.namespace;
    return namespace || (this.parent && this.parent.resolveNamespace(objectId));
  }

  public addBuiltInFormula = (formula: BuiltInFormula) => {
    this.builtInFormulasByGridId[formula.id] = formula;
    const formulaRef = ReferenceUtils.buildReferenceForConstructor(formula);
    this.constructorNamespace.addBuiltInFormula(formula.name, formulaRef);
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

  public getGridByName = (gridName: string): Grid => {
    const grid = Object.values(this.grids).find(g => g.name === gridName);
    assert(grid !== undefined, `Unrecognized grid ${gridName}.`);
    return grid!;
  }

  public getGridForType = (gridType: GridType): Grid => {
    const grid = this.grids[gridType.schemaId.gridId];
    assert(grid !== undefined, `Unrecognized grid type ${TypeUtils.toString(gridType)}.`);
    return grid!;
  }

  public isAssignableTo = (t1: GridType, t2: GridType): boolean => {
    const g1 = this.getGridForType(t1);
    const g2 = this.getGridForType(t2);
    return g1.isOrExtends(g2);
  }

  public getUnionType = (t1: GridType, t2: GridType): GridType | ListOfAnyType => {
    const g1 = this.getGridForType(t1);
    const g2 = this.getGridForType(t2);
    const commonAncestor = g1.getCommonAncestor(g2);
    return commonAncestor ? TypeUtils.GridOf(commonAncestor.id) : TypeUtils.ListOfAny;
  }
}