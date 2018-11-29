import * as _ from 'lodash';
import {Dictionary} from '../utils/types';
import {BaseModel} from './base_model';
import {Cell, CellUpdateDescriptor} from './cell';
import {Formula} from './formula';
import {DictionaryUpdateDescriptor as DictionaryUD, FunctionalDictionaryM} from './functional_dictionary';
import {GridColumn} from './grid_column';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {RowUpdateType} from './update_types';
import {Value} from './value';

export type CellRO = Readonly<Cell>;
export type Cells = FunctionalDictionaryM<Cell, CellUpdateDescriptor>;

interface CellData {
  column: GridColumn,
  manualValue?: Value,
}

type DependenciesMap = Dictionary<{dependencies: string[], resolved: boolean}>;

function resolveDependenciesForId(dependenciesMap: DependenciesMap, id: string) {
  const node = dependenciesMap[id];
  if (node.resolved) {
    return;
  }
  node.dependencies.forEach(dep => resolveDependenciesForId(dependenciesMap, dep));
  const childDeps = _.flatMap(node.dependencies, dep => dependenciesMap[dep].dependencies);
  node.dependencies = _.uniq(node.dependencies.concat(childDeps));
  node.resolved = true;
}

export interface RowUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  columnIds: string[];
}

export class Row extends BaseModel<RowUpdateDescriptor> {
  protected readonly namespace = Namespace.ROW;
  public readonly cells: Cells;

  constructor(updateManager: UpdateManager, cellsData: CellData[]) {
    super(updateManager);
    this.cells = new FunctionalDictionaryM(updateManager, {});
    this.constructCells(cellsData);
    this.cells.listenForUpdate(this, this.onCellsUpdated);
  }

  private getCellsDataDependencyMap = (cellsData: CellData[]): DependenciesMap => {
    const dependenciesMap: DependenciesMap = {};
    cellsData.forEach(({column}) => {
      const dependencies = column.formula ? column.formula.args.slice(0) : [];
      dependenciesMap[column.columnId] = {dependencies, resolved: false};
    });
    Object.keys(dependenciesMap).forEach(id => resolveDependenciesForId(dependenciesMap, id));
    return dependenciesMap;
  }

  private constructCells = (cellsData: CellData[]) => {
    // Must order cell construction by formula dependencies
    const dependenciesMap = this.getCellsDataDependencyMap(cellsData);
    cellsData.sort((c1, c2) => {
      const id1 = c1.column.columnId;
      const id2 = c2.column.columnId;
      const cell2DependsOnCell1 = dependenciesMap[id2].dependencies.indexOf(id1) > -1;
      return cell2DependsOnCell1 ? -1 : (dependenciesMap[id1].dependencies.indexOf(id2) > -1 ? 1 : 0);
    });
    cellsData.forEach(({column, manualValue}) => this.cells.set(column.columnId, new Cell(this.updateManager, {
      column,
      getContextForFormula: this.getContextForFormula,
      manualValue,
    })));
  }

  private getContextForFormula = (formula: Formula): Dictionary<Cell> => {
    const context: Dictionary<Cell> = {};
    formula.args.forEach(c => context[c] = this.cells.d[c]);
    return context;
  }

  private onCellsUpdated = (
    epoch: number,
    updates?: Array<DictionaryUD<CellUpdateDescriptor>>,
  ): RowUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const columnIds = updates ? _.uniq(updates.map(d => d.key)) : [];
    const descriptor = {type: RowUpdateType.CELLS_UPDATED, columnIds};
    return [descriptor];
  }
}
