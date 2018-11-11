import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Column, ColumnUpdateDescriptor, DataType} from './column';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from './functional_array';
import {IndexedFunctionalArray} from './indexed_functional_array';
import {Namespace} from './resolver';
import {CellRO, Row, RowUpdateDescriptor} from './row';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {GridUpdateType} from './update_types';

export type Columns = IndexedFunctionalArray<Column, ColumnUpdateDescriptor>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid extends BaseModel<GridUpdateDescriptor> {
  protected readonly namespace = Namespace.GRID;
  // invariant - this grid's persisted data only changes from ancestors if its
  // parent's persisted data changes
  private readonly parent?: Grid;
  public readonly columns: Columns;
  public readonly rows: Rows;
  // private _visibleColumns: FunctionalArray<string>;

  constructor(updateManager: UpdateManager, parentGrid?: Grid) {
    super(updateManager);
    let columns: Column[] = [];
    let rows: Row[] = [];
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
      rows = this.generateRows([], true);
    } else {
      columns = this.generateColumns();
      rows = this.generateRows(columns.map(c => c.id), false);
    }
    this.columns = new IndexedFunctionalArray(updateManager, columns);
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.rows = new FunctionalArrayM(updateManager, rows);
    this.rows.listenForUpdate(this, this.onRowsUpdated);
  }

  private onColumnsUpdated = (
    epoch: number,
    updates?: Array<ArrayUD<ColumnUpdateDescriptor>>,
  ): GridUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const descriptor = {type: GridUpdateType.COLUMN_UPDATED};
    return [descriptor];
  }

  private onRowsUpdated = (epoch: number, updates: Array<ArrayUD<RowUpdateDescriptor>>): GridUpdateDescriptor[] => {
    const descriptors: GridUpdateDescriptor[] = [{type: GridUpdateType.ROW_UPDATED}];
    const firstRowUpdated = updates.some(u => u.index === 0);
    if (firstRowUpdated) {
      descriptors.push({type: GridUpdateType.FIRST_ROW_UPDATED});
    }
    this.onDependencyUpdated(epoch);
    return descriptors;
  }

  private onParentGridUpdated = (epoch: number, updates?: GridUpdateDescriptor[]) => {
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
    const columns = [
      {name: 'X', width: 100, type: DataType.NUMBER},
      {name: 'Y', width: 100, type: DataType.NUMBER},
      {name: 'Radius', width: 100, type: DataType.NUMBER},
      {name: 'Fill', width: 100, type: DataType.STRING},
    ].map(columnData => new Column(this.updateManager, columnData));
    const cIds = columns.map(c => c.id);

    columns.push(new Column(this.updateManager, {
      name: 'Draw Circle',
      width: 150,
      type: DataType.DRAWING,
      formula: {name: "DrawCircle", args: [cIds[2], cIds[0], cIds[1], cIds[3]]},
    }));
    return columns;
  }

  private generateRows = (columnIds: string[], hasParent: boolean): Row[] => {
    if (hasParent) {
      return [0, 1, 2].map(i => new Row(this.updateManager, {}));
    }
    const rowCount = 6;
    const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
    return _.range(rowCount).map(i => new Row(this.updateManager, {
      [columnIds[0]]: {value: `${i * 20}`},
      [columnIds[1]]: {value: `${i * i * 10}`},
      [columnIds[2]]: {value: `${(i + 1) * (i + 1) * 2}`},
      [columnIds[3]]: {value: colors[i]},
      [columnIds[4]]: {value: ""},
    }));
  }
}
