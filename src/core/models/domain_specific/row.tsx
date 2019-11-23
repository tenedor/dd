import * as _ from 'lodash';

import {CoordinateSystem, defaultCoordinateSystem} from '@core/geometry';
import {Drawing, DRAWING_PRIMITIVE_PATH_ID, DrawingUtils} from '@drawing/drawing';
import {FormulaEnvironment} from '@language/formula_environment';
import {Identifier, TypeUtils} from '@language/types';
import {ListValue, RowValue, Value, ValueOrAST, ValueUtils} from '@language/values';
import {COORDINATE_SYSTEM_COLUMN_ID, getCoordinateSystemFromValue}
        from '@standard_library/geometry_utils';
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

type ValueWithRows = RowValue | ListValue;

interface ManualValues {
  [columnId: string]: ValueOrAST,
}

interface RowData<I extends Identifier = Identifier> {
  gridId: I,
  columns: GridColumns,
  environment: FormulaEnvironment,
  manualValues: ManualValues,
  defaultValues?: Row,
  getPrimitiveDrawing?: (cells: RODictionary<Value>) => Drawing,
}

export type RowContext = RODictionary<Cell>;

interface CellsUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  type: "CELLS_UPDATED",
  columnIds: string[];
}

interface DrawingUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  type: "DRAWING_UPDATED",
}

export type RowUpdateDescriptor = CellsUpdateDescriptor | DrawingUpdateDescriptor;

export class Row<I extends Identifier = Identifier> extends Mutable<RowUpdateDescriptor> {
  private readonly gridId: I;
  private readonly columns: GridColumns;
  private readonly environment: FormulaEnvironment;
  private readonly defaultValues?: Row;
  private readonly getPrimitiveDrawingIfAny: (cells: RODictionary<Value>) => Drawing | undefined;
  public readonly cells: Cells;
  private drawing: Drawing;

  constructor(updateManager: UpdateManager, {
    columns, defaultValues, environment, gridId, manualValues, getPrimitiveDrawing,
  }: RowData<I>, modelType: ModelType = ModelType.ROW) {
    super(updateManager, modelType);
    this.gridId = gridId;
    this.columns = columns;
    this.environment = environment;
    this.defaultValues = defaultValues;
    this.getPrimitiveDrawingIfAny = getPrimitiveDrawing || (() => undefined);
    this.cells = new FunctionalDictionaryM(updateManager, {});
    this.constructCells(manualValues);
    this.updateDrawing();
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

  private updateDrawing = (): void => {
    const drawingColumns = Object.values(this.columns.d).filter(c => TypeUtils.isRow(TypeUtils.getBaseType(c.type)));
    const drawings: {[pathId: string]: Drawing} = {};
    drawingColumns.forEach(c => {
      drawings[c.columnId] = Row.makeDrawing(this.cells.get(c.columnId)!.value as ValueWithRows);
    });
    const primitiveDrawing = this.getPrimitiveDrawingIfAny(this.getCellValues());
    if (primitiveDrawing !== undefined) {
      drawings[DRAWING_PRIMITIVE_PATH_ID] = primitiveDrawing;
    }
    const transform: CoordinateSystem = this.getCoordinateSystem();
    this.drawing = DrawingUtils.groupOf({drawings, transform});
  }

  private static makeDrawing = (valueWithRows: ValueWithRows): Drawing => {
    if (ValueUtils.isRow(valueWithRows)) {
      return valueWithRows.drawing;
    }
    const nestedValues = valueWithRows.list as ValueWithRows[];
    const nestedDrawings = nestedValues.map(Row.makeDrawing);
    return DrawingUtils.listOf(nestedDrawings);
  }

  private getCoordinateSystemValue = (): RowValue | undefined => {
    const cell = this.cells.get(COORDINATE_SYSTEM_COLUMN_ID);
    return cell && (cell.value as RowValue);
  }

  private getCoordinateSystem = (): CoordinateSystem => {
    const coords = this.getCoordinateSystemValue();
    return coords ? getCoordinateSystemFromValue(coords, this.environment) : defaultCoordinateSystem;
  }

  public getCellValues = (): RODictionary<Value> => {
    return _.mapValues(this.cells.d, c => c.value);
  }

  public getDrawing = (): Drawing => {
    return this.drawing;
  }

  public asValue = (): RowValue<I> => {
    return ValueUtils.rowOf(this, this.gridId);
  }

  private updatesMayChangeDrawing = (updates: Array<DictionaryUD<CellUpdateDescriptor>>): boolean => {
    // Drawing can only update when a cell with drawings is added or removed or changes
    // its drawings, or when the transform cell value changes. But for now...
    return true;
  }

  private onCellsUpdated = (
    epoch: number,
    updates: Array<DictionaryUD<CellUpdateDescriptor>>,
  ): RowUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const columnIds = updates ? _.uniq(updates.map(d => d.key)) : [];
    const cellsUpdatedDescriptor = {type: RowUpdateType.CELLS_UPDATED, columnIds};
    if (!this.updatesMayChangeDrawing(updates)) {
      return [cellsUpdatedDescriptor];
    }
    this.updateDrawing();
    const drawingUpdatedDescriptor = {type: RowUpdateType.DRAWING_UPDATED};
    return [cellsUpdatedDescriptor, drawingUpdatedDescriptor];
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
