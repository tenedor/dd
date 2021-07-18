import * as _ from 'lodash';

import {CoordinateSystem, GeometryUtils, Vector} from '@core/geometry';
import {Affordance, AffordanceUtils} from '@drawing/affordance';
import {Drawing, DRAWING_PRIMITIVE_PATH_ID, DrawingGroup, DrawingUtils}
        from '@drawing/drawing';
import {FormulaEnvironment} from '@language/formula_environment';
import {Identifier, TypeUtils} from '@language/types';
import {ListValue, RowValue, Value, ValueOrAST, ValueUtils} from '@language/values';
import {Address, AddressUtils} from '@paths/address';
import {COORDINATE_SYSTEM_CENTER_COLUMN_ID, COORDINATE_SYSTEM_COLUMN_ID,
        getCoordinateSystemFromValue} from '@standard_library/geometry_utils';
import {ROArray, RODictionary} from '@utils/types';
import {keysDiff} from '@utils/utils';
import {ArrayUpdateDescriptor as ArrayUD} from '../collections/functional_array';
import {DictionaryUpdateDescriptor as DictionaryUD, FunctionalDictionaryM}
        from '../collections/functional_dictionary';
import {UpdateDescriptor} from '../core/dependency_node';
import {ModelType} from '../core/model';
import {Mutable, MutableOptions} from '../core/mutable';
import {UpdateManager} from '../core/update_manager';
import {RowUpdateType} from '../core/update_types';
import {Cell, CellUpdateDescriptor} from './cell';
import {GridColumns} from './grid';
import {GridColumnUpdateDescriptor} from './grid_column';

export type CellRO = Readonly<Cell>;
export type Cells = FunctionalDictionaryM<Cell, CellUpdateDescriptor>;

type ValueWithRows = RowValue | ListValue;

export interface ManualValues {
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
  private drawing: DrawingGroup;

  constructor(
    updateManager: UpdateManager,
    {columns, defaultValues, environment, gridId, manualValues, getPrimitiveDrawing}: RowData<I>,
    opts: MutableOptions,
    modelType: ModelType = ModelType.ROW,
  ) {
    super(updateManager, opts, modelType);
    this.gridId = gridId;
    this.columns = columns;
    this.environment = environment;
    this.defaultValues = defaultValues;
    this.getPrimitiveDrawingIfAny = getPrimitiveDrawing || (() => undefined);
    this.cells = this.constructCells(manualValues);
  }

  protected initInner(): void {
    super.initInner();
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.cells.listenForUpdate(this, this.onCellsUpdated);
    this.updateDrawing();
  }

  private constructCells = (manualValues: ManualValues): Cells => {
    const {defaultValues, getRowContext, gridId, updateManager} = this;
    const cellsDict = _.mapValues(this.columns.d, column => {
      const {columnId} = column;
      const manualValue = manualValues[columnId];
      const defaultValue = defaultValues ? defaultValues.cells.get(columnId) : undefined;
      return new Cell(updateManager, {
        column,
        defaultValue,
        getRowContext,
        gridId,
        manualValue,
      }, {});
    });
    return new FunctionalDictionaryM(updateManager, cellsDict, {});
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
      }, {}));
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
    const ancestry = new Address([]);
    const drawings: {[pathId: string]: Drawing} = {};
    let affordances: ROArray<Affordance> = [];
    drawingColumns.forEach(c => {
      const value = this.cells.get(c.columnId)!.value as ValueWithRows;
      const d = Row.getDrawingAndAffordances(value, ancestry.addGroup(c.columnId));
      drawings[c.columnId] = d.drawing;
      affordances = affordances.concat(d.affordances);
    });
    const primitiveDrawing = this.getPrimitiveDrawingIfAny(this.getCellValues());
    if (primitiveDrawing !== undefined) {
      drawings[DRAWING_PRIMITIVE_PATH_ID] = primitiveDrawing;
    }
    const transform: CoordinateSystem = this.getCoordinateSystem();
    this.drawing = DrawingUtils.groupOf({drawings, transform, affordances});
  }

  private static getWrappingAffordances = (drawing: DrawingGroup, ancestry: Address): Affordance[] => {
    if (DrawingUtils.isEmpty(drawing)) {
      return [];
    }
    const addr = ancestry
      .addGroup(COORDINATE_SYSTEM_COLUMN_ID)
      .addGroup(COORDINATE_SYSTEM_CENTER_COLUMN_ID);
    const centerDragPoint = AffordanceUtils.dragPointOf(addr, drawing.transform.center, "center");
    return [centerDragPoint];
  }

  private static getDrawingAndAffordances = (valueWithRows: ValueWithRows, ancestry: Address):
      {drawing: Drawing, affordances: Affordance[]} => {
    if (ValueUtils.isRow(valueWithRows)) {
      const {drawing} = valueWithRows;
      return {drawing, affordances: Row.getWrappingAffordances(drawing, ancestry)};
    }
    const nestedValues = valueWithRows.list as ValueWithRows[];
    const nesteds = nestedValues.map((v, i) => Row.getDrawingAndAffordances(v, ancestry.addList(i)));
    const nestedDrawings = nesteds.map(d => d.drawing);
    const affordances = _.flatMap(nesteds, d => d.affordances);
    return {drawing: DrawingUtils.listOf(nestedDrawings), affordances};
  }

  private getCoordinateSystemValue = (): RowValue | undefined => {
    const cell = this.cells.get(COORDINATE_SYSTEM_COLUMN_ID);
    return cell && (cell.value as RowValue);
  }

  private getCoordinateSystem = (): CoordinateSystem => {
    const coords = this.getCoordinateSystemValue();
    return coords ?
      getCoordinateSystemFromValue(coords, this.environment) :
      GeometryUtils.defaultCoordinateSystem;
  }

  public getCellValues = (): RODictionary<Value> => {
    return _.mapValues(this.cells.d, c => c.value);
  }

  public getDrawing = (): DrawingGroup => {
    return this.drawing;
  }

  public writeToAddress = (value: Vector, editor: Address, target: Address) => {
    // TODO: the editor address should always specify a cell. This hack is a holdover
    // until getViableEditorsForAddress is implemented.
    if (editor.isEmpty()) {
      const [cellNode, relativeTarget] = target.unwrapNode();
      this.writeToAddress(value, new Address([cellNode]), relativeTarget);
      return;
    }

    const [node, address] = editor.unwrapNode();
    if (!AddressUtils.isGroup(node)) {
      throw new Error("Row-level address node should always specify a cell.");
    }
    this.cells.d[node.id].writeToAddress(value, address, target);
  }

  public asValue = (): RowValue<I> => {
    this.init();
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
