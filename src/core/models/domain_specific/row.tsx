import * as _ from 'lodash';

import {Identifier} from '@language/types';
import {RowValue, Value, ValueUtils} from '@language/values';
import {Dictionary, RODictionary} from '@utils/types';
import {keysDiff} from '@utils/utils';
import {ArrayUpdateDescriptor as ArrayUD} from '../collections/functional_array';
import {DictionaryUpdateDescriptor as DictionaryUD, FunctionalDictionaryM}
        from '../collections/functional_dictionary';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {RowUpdateType} from '../core/update_types';
import {Cell, CellUpdateDescriptor, ManualValue} from './cell';
import {GridColumns} from './grid';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';

export type CellRO = Readonly<Cell>;
export type Cells = FunctionalDictionaryM<Cell, CellUpdateDescriptor>;

interface ManualValues {
  [columnId: string]: ManualValue,
}

interface RowData {
  columns: GridColumns,
  manualValues: ManualValues,
  gridId: Identifier,
}

export type RowContext = RODictionary<Cell>;

export interface RowUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  columnIds: string[];
}

export class Row extends Mutable<RowUpdateDescriptor> {
  private readonly columns: GridColumns;
  private readonly gridId: Identifier;
  public readonly cells: Cells;

  constructor(updateManager: UpdateManager, {columns, gridId, manualValues}: RowData, modelType: ModelType = ModelType.ROW) {
    super(updateManager, modelType);
    this.columns = columns;
    this.gridId = gridId;
    this.cells = new FunctionalDictionaryM(updateManager, {});
    this.constructCells(manualValues);
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.cells.listenForUpdate(this, this.onCellsUpdated);
  }

  private static getAllDependencies = (id: string, firstOrderDependencies: {[id: string]: string[]}): string[] => {
    const fo = firstOrderDependencies[id];
    const recursive = fo.map(d => Row.getAllDependencies(d, firstOrderDependencies));
    const all = _.flatten(recursive).concat(fo);
    return _.uniq(all);
  }

  private static getColumnDependenciesMap = (columns: GridColumns): Dictionary<string[]> => {
    const firstOrderDependencies = _.mapValues(columns.d,
      c => c.formulaExpression.dependencies
        .map(d => d.id)
        .filter(id => id in columns.d));
    return _.mapValues(columns.d, (c, id) => Row.getAllDependencies(id, firstOrderDependencies));
  }

  private static getColumnsOrderedByDependency = (columns: GridColumns): GridColumn[] => {
    // Must order cell construction by formula dependencies
    const dependenciesMap = Row.getColumnDependenciesMap(columns);
    const sortedColumns = columns.a.slice(0);
    sortedColumns.sort((c1, c2) => {
      const id1 = c1.columnId;
      const id2 = c2.columnId;
      const cell2DependsOnCell1 = dependenciesMap[id2].indexOf(id1) > -1;
      return cell2DependsOnCell1 ? -1 : (dependenciesMap[id1].indexOf(id2) > -1 ? 1 : 0);
    });
    return sortedColumns;
  }

  private constructCells = (manualValues: ManualValues) => {
    const cellsToConstruct = Row.getColumnsOrderedByDependency(this.columns);
    cellsToConstruct.forEach(column => {
      const {getRowContext, gridId, updateManager} = this;
      const {columnId} = column;
      const manualValue = manualValues[columnId];
      this.cells.set(columnId, new Cell(updateManager, {
        column,
        getRowContext,
        gridId,
        manualValue,
      }));
    });
  }

  private updateCellMembership(): RowUpdateDescriptor[] {
    const {getRowContext, gridId, updateManager} = this;
    const {addedIds, removedIds} = keysDiff(this.cells.d, this.columns.d);
    removedIds.forEach(id => this.cells.remove(id));
    addedIds.forEach(id => this.cells.set(id, new Cell(updateManager, {
      column: this.columns.d[id],
      getRowContext,
      gridId,
    })));
    const updatedIds = addedIds.concat(removedIds);
    const descriptor = {type: RowUpdateType.CELLS_UPDATED, columnIds: updatedIds};
    return [descriptor];
  }

  private getRowContext = (): RowContext => {
    return this.cells.d;
  }

  public asValue = (): RowValue => {
    const cellValues = _.mapValues(this.cells.d, c => c.value);
    return ValueUtils.dictOf(cellValues, this.gridId);
  }

  private onCellsUpdated = (
    epoch: number,
    updates: Array<DictionaryUD<CellUpdateDescriptor>>,
  ): RowUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const columnIds = updates ? _.uniq(updates.map(d => d.key)) : [];
    const descriptor = {type: RowUpdateType.CELLS_UPDATED, columnIds};
    return [descriptor];
  }

  private onColumnsUpdated = (
    epoch: number,
    updates: Array<ArrayUD<GridColumnUpdateDescriptor>>,
  ): RowUpdateDescriptor[] => {
    const {addedIds, removedIds} = keysDiff(this.cells.d, this.columns.d);
    const membershipChanged = addedIds.length > 0 || removedIds.length > 0;
    if (membershipChanged) {
      this.onDependencyUpdated(epoch);
      return this.updateCellMembership();
    }
    return [];
  }
}
