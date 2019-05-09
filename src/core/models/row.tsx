import * as _ from 'lodash';

import {Identifier} from '@language/types';
import {Value} from '@language/values';
import {Dictionary, RODictionary} from '@utils/types';
import {BaseModel, ModelType} from './base_model';
import {Cell, CellUpdateDescriptor} from './cell';
import {DictionaryUpdateDescriptor as DictionaryUD, FunctionalDictionaryM} from './functional_dictionary';
import {GridColumn} from './grid_column';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {RowUpdateType} from './update_types';

export type CellRO = Readonly<Cell>;
export type Cells = FunctionalDictionaryM<Cell, CellUpdateDescriptor>;

interface CellData {
  column: GridColumn,
  manualValue?: Value,
}

interface RowData {
  cells: CellData[],
  gridId: Identifier,
}

type DependenciesMap = Dictionary<{internalDependencies: string[], resolved: boolean}>;

function resolveDependenciesForId(dependenciesMap: DependenciesMap, id: string) {
  const node = dependenciesMap[id];
  if (node.resolved) {
    return;
  }
  node.internalDependencies.forEach(dep => resolveDependenciesForId(dependenciesMap, dep));
  const childDeps = _.flatMap(node.internalDependencies, dep => dependenciesMap[dep].internalDependencies);
  node.internalDependencies = _.uniq(node.internalDependencies.concat(childDeps));
  node.resolved = true;
}

export type RowContext = RODictionary<Cell>;

export interface RowUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  columnIds: string[];
}

export class Row extends BaseModel<RowUpdateDescriptor> {
  private readonly gridId: Identifier;
  public readonly cells: Cells;

  constructor(updateManager: UpdateManager, {cells, gridId}: RowData, namespace: ModelType = ModelType.ROW) {
    super(updateManager, namespace);
    this.cells = new FunctionalDictionaryM(updateManager, {});
    this.gridId = gridId;
    this.constructCells(cells);
    this.cells.listenForUpdate(this, this.onCellsUpdated);
  }

  private getCellsDataDependencyMap = (cellsData: CellData[]): DependenciesMap => {
    const dependenciesMap: DependenciesMap = {};
    const columnIds = cellsData.map(({column}) => column.columnId);
    cellsData.forEach(({column}) => {
      const dependencies = column.formulaExpression.dependencies.map(d => d.id);
      const internalDependencies = dependencies.filter(id => columnIds.includes(id));
      dependenciesMap[column.columnId] = {internalDependencies, resolved: false};
    });
    Object.keys(dependenciesMap).forEach(id => resolveDependenciesForId(dependenciesMap, id));
    return dependenciesMap;
  }

  private constructCells = (cellsData: CellData[]) => {
    // Must order cell construction by formula dependencies
    const dependenciesMap = this.getCellsDataDependencyMap(cellsData);
    const sortedCellsData = cellsData.slice(0);
    sortedCellsData.sort((c1, c2) => {
      const id1 = c1.column.columnId;
      const id2 = c2.column.columnId;
      const cell2DependsOnCell1 = dependenciesMap[id2].internalDependencies.indexOf(id1) > -1;
      return cell2DependsOnCell1 ? -1 : (dependenciesMap[id1].internalDependencies.indexOf(id2) > -1 ? 1 : 0);
    });
    sortedCellsData.forEach(({column, manualValue}) => this.cells.set(column.columnId, new Cell(this.updateManager, {
      column,
      getRowContext: this.getRowContext,
      gridId: this.gridId,
      manualValue,
    })));
  }

  private getRowContext = (): RowContext => {
    return this.cells.d;
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
