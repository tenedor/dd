import * as _ from 'lodash';

import {Identifier} from '@language/types';
import {RowValue, ValueOrAST, ValueUtils} from '@language/values';
import {Dictionary, RODictionary} from '@utils/types';
import {keysDiff} from '@utils/utils';
import {ArrayUpdateDescriptor as ArrayUD} from '../collections/functional_array';
import {DictionaryUpdateDescriptor as DictionaryUD, FunctionalDictionaryM}
        from '../collections/functional_dictionary';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {RowUpdateType} from '../core/update_types';
import {Cell, CellUpdateDescriptor} from './cell';
import {GridColumns} from './grid';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';

export type CellRO = Readonly<Cell>;
export type Cells = FunctionalDictionaryM<Cell, CellUpdateDescriptor>;

interface ManualValues {
  [columnId: string]: ValueOrAST,
}

interface RowData<I extends Identifier = Identifier> {
  gridId: I,
  columns: GridColumns,
  manualValues: ManualValues,
  defaultValues?: Row,
}

export type RowContext = RODictionary<Cell>;

export interface RowUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  columnIds: string[];
}

export class Row<I extends Identifier = Identifier> extends Mutable<RowUpdateDescriptor> {
  private readonly gridId: I;
  private readonly columns: GridColumns;
  private readonly defaultValues?: Row;
  public readonly cells: Cells;

  constructor(updateManager: UpdateManager, {columns, defaultValues, gridId, manualValues}: RowData<I>, modelType: ModelType = ModelType.ROW) {
    super(updateManager, modelType);
    this.gridId = gridId;
    this.columns = columns;
    this.defaultValues = defaultValues;
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
    const sortedColumns: GridColumn[] = [];
    let remainingColumnIds = Object.keys(columns.d);
    const hasOutstandingDependency = (id: string) => {
      const deps = dependenciesMap[id];
      return _.some(deps, depId => remainingColumnIds.includes(depId));
    };
    while (remainingColumnIds.length) {
      const freeId = _.find(remainingColumnIds, id => !hasOutstandingDependency(id));
      if (freeId === undefined) {
        throw new Error("Dependency cycle encountered in row construction");
      }
      sortedColumns.push(columns.getByKey(freeId)!);
      remainingColumnIds = _.without(remainingColumnIds, freeId);
    }
    return sortedColumns;
  }

  private constructCells = (manualValues: ManualValues) => {
    const cellsToConstruct = Row.getColumnsOrderedByDependency(this.columns);
    cellsToConstruct.forEach(column => {
      const {defaultValues, getRowContext, gridId, updateManager} = this;
      const {columnId} = column;
      const manualValue = manualValues[columnId];
      const defaultValue = defaultValues ? defaultValues.cells.get(columnId) : undefined;
      this.cells.set(columnId, new Cell(updateManager, {
        column,
        defaultValue,
        getRowContext,
        gridId,
        manualValue,
      }));
    });
  }

  private updateCellMembership(): RowUpdateDescriptor[] {
    const {defaultValues, getRowContext, gridId, updateManager} = this;
    const {addedIds, removedIds} = keysDiff(this.cells.d, this.columns.d);
    removedIds.forEach(id => this.cells.remove(id));
    addedIds.forEach(id => {
      const column = this.columns.d[id];
      const defaultValue = defaultValues ? defaultValues.cells.get(id) : undefined;
      this.cells.set(id, new Cell(updateManager, {
        column,
        defaultValue,
        getRowContext,
        gridId,
      }));
    });
    const updatedIds = addedIds.concat(removedIds);
    const descriptor = {type: RowUpdateType.CELLS_UPDATED, columnIds: updatedIds};
    return [descriptor];
  }

  private getRowContext = (): RowContext => {
    return this.cells.d;
  }

  public asValue = (): RowValue<I> => {
    return ValueUtils.rowOf(this, this.gridId);
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
