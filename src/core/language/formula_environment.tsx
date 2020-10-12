import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {BuiltInFormula, Procedure, Signature} from '@models/domain_specific/procedure'; // only a type dependency
import {Dictionary, ROArray} from '@utils/types';
import {assert} from '@utils/utils';
import {ObjectResolutionError} from './language_errors';
import {buildNamespace, NameResolver, ProcedureNamespace, ValueNamespace}
        from './name_resolver';
import {ReferenceUtils} from './reference';
import {GridType, Identifier, ListOfAnyType, Type, TypeUtils} from './types';

export class FormulaEnvironment {
  private readonly builtInFormulasByGridId: Dictionary<Procedure>;
  private readonly grids: Dictionary<Grid>;
  private readonly valueNamespace: ValueNamespace;
  private readonly procedureNamespace: ProcedureNamespace;
  private readonly _nameResolver: NameResolver;

  constructor() {
    this.builtInFormulasByGridId = {};
    this.grids = {};
    this.valueNamespace = buildNamespace({});
    this.procedureNamespace = new ProcedureNamespace();
    this._nameResolver = this.buildNameResolver();
  }

  private buildNameResolver = (): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    // TODO clarify the role of NameResolver vs FormulaEnvironment
    return new NameResolver(namespaceResolver, this.procedureNamespace, this.valueNamespace, this);
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = (this.grids[objectId] || this.builtInFormulasByGridId[objectId]) as Grid | Procedure | undefined;
    const namespace = object && object.namespace;
    return namespace;
  }

  private get allGrids(): Dictionary<Grid> {
    return this.grids;
  }

  public addBuiltInFormula = (formula: BuiltInFormula) => {
    this.builtInFormulasByGridId[formula.id] = formula;
    const formulaRef = ReferenceUtils.buildReferenceForProcedure(formula);
    this.procedureNamespace.addBuiltInFormula(formula.name, formulaRef);
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
    this.procedureNamespace.addGrid(grid);
  }

  public removeGrid = (gridId: string): void => {
    delete this.grids[gridId];
    this.procedureNamespace.removeGrid(gridId);
  }

  public get nameResolver(): NameResolver {
    return this._nameResolver;
  }

  public getAllowedColumnTypes = (): Type[] => {
    const constructableRowTypes = Object.values(this.allGrids).map(g => TypeUtils.RowOf(g.id));
    return TypeUtils.atomicTypes.concat(constructableRowTypes);
  }

  public getNameForType = (t: Type, opts: {eraseBoundingTypes?: boolean} = {}): string => {
    if (TypeUtils.isLambda(t)) {
      const inType = this.getNameForType(t.inputType, opts);
      const outType = this.getNameForType(t.outputType, opts);
      return `${inType} -> ${outType}`;
    } else if (TypeUtils.isDict(t)) {
      const name = this.procedureNamespace.getNameForReference(t.schemaId.gridId);
      if (name !== undefined) {
        return name;
      }
    } else if (TypeUtils.isList(t)) {
      return TypeUtils.listToString(t, tt => this.getNameForType(tt, opts));
    }
    return TypeUtils.toString(t, opts);
  }

  public existsGridWithName = (gridName: string): boolean => {
    const grid = Object.values(this.allGrids).find(g => g.name === gridName);
    return !!grid;
  }

  public getGridByName = (gridName: string): Grid => {
    const grid = Object.values(this.allGrids).find(g => g.name === gridName);
    assert(grid !== undefined, `Unrecognized grid ${gridName}.`, ObjectResolutionError);
    return grid!;
  }

  public getGridForType = (gridType: GridType): Grid => {
    const grid = this.allGrids[gridType.schemaId.gridId];
    assert(grid !== undefined, `Unrecognized grid type ${TypeUtils.toString(gridType)}.`, ObjectResolutionError);
    return grid!;
  }

  public getGridById(gridId: Identifier) {
    const grid = this.allGrids[gridId];
    assert(grid !== undefined, `Unrecognized grid id ${gridId}.`, ObjectResolutionError);
    return grid!;
  }

  public getAllExtensibleGrids = (): ROArray<Grid> => {
    return Object.values(this.allGrids);
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

  public getSignatures = (): Signature[] => {
    const formulaSignatures = Object.values(this.builtInFormulasByGridId).map(f => f.getSignature());
    const gridSignatures = Object.values(this.grids).map(g => g.gridConstructor.getSignature());
    return formulaSignatures.concat(gridSignatures);
  }
}