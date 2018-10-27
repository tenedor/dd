import * as _ from 'lodash';
import {BaseModel, UpdateDescriptor} from './base_model';
import {Column, ColumnUpdateDescriptor, DataType} from './column';
import {EpochManager} from './epoch_manager';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from './functional_array';
import {IndexedFunctionalArray} from './indexed_functional_array';
import {CellRO, Row, RowUpdateDescriptor} from './row';
import {GridUpdateType} from './update_types';

export type Columns = IndexedFunctionalArray<Column, ColumnUpdateDescriptor>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid extends BaseModel<GridUpdateDescriptor> {
  public readonly id: string;
  // invariant - this grid's persisted data only changes from ancestors if its
  // parent's persisted data changes
  private readonly parent?: Grid;
  public readonly columns: Columns;
  public readonly rows: Rows;
  // private _visibleColumns: FunctionalArray<string>;

  constructor(epochManager: EpochManager, id: string, parentGrid?: Grid) {
    super(epochManager);
    this.id = id;
    let columns: Column[] = [];
    let rows: Row[] = [];
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForEpochUpdate(this.onParentGridEpochUpdated);
      rows = this.generateRows(true);
    } else {
      columns = this.generateColumns();
      rows = this.generateRows(false);
    }
    this.columns = new IndexedFunctionalArray(epochManager, columns);
    this.columns.listenForEpochUpdate(this.onColumnsEpochUpdated);
    this.rows = new FunctionalArrayM(epochManager, rows);
    this.rows.listenForEpochUpdate(this.onRowsEpochUpdated);
  }

  private onColumnsEpochUpdated = (epoch: number, updates?: Array<ArrayUD<ColumnUpdateDescriptor>>) => {
    const descriptor = {type: GridUpdateType.COLUMN_UPDATED};
    this.onDependencyEpochUpdated(epoch, [descriptor]);
  }

  private onRowsEpochUpdated = (epoch: number, updates: Array<ArrayUD<RowUpdateDescriptor>>) => {
    const descriptors: GridUpdateDescriptor[] = [{type: GridUpdateType.ROW_UPDATED}];
    const firstRowUpdated = updates.some(u => u.index === 0);
    if (firstRowUpdated) {
      descriptors.push({type: GridUpdateType.FIRST_ROW_UPDATED});
    }
    this.onDependencyEpochUpdated(epoch, descriptors);
  }

  private onParentGridEpochUpdated = (epoch: number, updates?: GridUpdateDescriptor[]) => {
    // for now do nothing
  }

  public modifyCell = ({columnId, rowIndex}: CellIndex, cell: CellRO): void => {
    const row = this.rows.a[rowIndex];
    row.setCell(columnId, cell);
  }

  public setColumnName = (columnId: string, name: string): void => {
    const column = this.columns.getById(columnId)!;
    column.setName(name);
  }

  // example rows and columns
  private generateColumns = (): Column[] => {
    return [
      {id: 'c_1', name: 'X', width: 100, type: DataType.NUMBER},
      {id: 'c_2', name: 'Y', width: 100, type: DataType.NUMBER},
      {id: 'c_3', name: 'Radius', width: 100, type: DataType.NUMBER},
      {id: 'c_4', name: 'Fill', width: 100, type: DataType.STRING},
      {id: 'c_5', name: 'Draw Circle', width: 150, type: DataType.DRAWING,
          formula: {name: "DrawCircle", args: ["c_3", "c_1", "c_2", "c_4"]}},
    ].map(columnData => new Column(this.epochManager, columnData));
  }

  private generateRows = (hasParent: boolean): Row[] => {
    if (hasParent) {
      return [0, 1, 2].map(i => new Row(this.epochManager, {}));
    }
    const rowCount = 6;
    const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
    return _.range(rowCount).map(i => new Row(this.epochManager, {
      'c_1': {value: `${i * 20}`},
      'c_2': {value: `${i * i * 10}`},
      'c_3': {value: `${(i + 1) * (i + 1) * 2}`},
      'c_4': {value: colors[i]},
      'c_5': {value: ""},
    }));
  }
}
