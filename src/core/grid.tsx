import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Column, DataType} from './column';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from './functional_array';
import {FunctionalKeyedArray} from './functional_keyed_array';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Namespace} from './resolver';
import {Row, RowUpdateDescriptor} from './row';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {GridUpdateType} from './update_types';

export type Columns = FunctionalKeyedArray<GridColumn, GridColumnUpdateDescriptor, 'columnId'>;
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

  constructor(updateManager: UpdateManager, parentGrid?: Grid) {
    super(updateManager);
    let columns: GridColumn[];
    let rows: Row[];
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
      columns = this.parent.columns.a.map(c => GridColumn.fromParent(updateManager, c));
      rows = this.generateRows(columns.map(c => c.columnId), true);
    } else {
      columns = this.generateColumns();
      rows = this.generateRows(columns.map(c => c.columnId), false);
    }
    this.columns = new FunctionalKeyedArray(updateManager, columns, 'columnId');
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.rows = new FunctionalArrayM(updateManager, rows);
    this.rows.listenForUpdate(this, this.onRowsUpdated);
  }

  private onColumnsUpdated = (
    epoch: number,
    updates?: Array<ArrayUD<GridColumnUpdateDescriptor>>,
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

  // example rows and columns
  private generateColumns = (): GridColumn[] => {
    const columns = [
      {name: 'X', type: DataType.NUMBER},
      {name: 'Y', type: DataType.NUMBER},
      {name: 'Radius', type: DataType.NUMBER},
      {name: 'Fill', type: DataType.STRING},
    ].map(columnData => new Column(this.updateManager, columnData));
    const gridColumns = columns.map(column => new GridColumn(this.updateManager, {column, width: 100}));
    const cIds = gridColumns.map(c => c.columnId);

    const circleColumn = new Column(this.updateManager, {
      name: 'Draw Circle',
      type: DataType.DRAWING,
    });
    const circleFormula = {name: "DrawCircle", args: [cIds[2], cIds[0], cIds[1], cIds[3]]};
    columns.push(circleColumn);
    gridColumns.push(new GridColumn(this.updateManager, {column: circleColumn, formula: circleFormula, width: 150}));

    return gridColumns;
  }

  private generateRows = (columnIds: string[], hasParent: boolean): Row[] => {
    const rowCount = hasParent ? 3 : 6;
    const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
    return _.range(rowCount).map(i => new Row(this.updateManager, {
      [columnIds[0]]: {value: `${hasParent ? 300 - i * 60 : i * 20}`},
      [columnIds[1]]: {value: `${i * i * 10}`},
      [columnIds[2]]: {value: `${(i + 1) * (i + 1) * 2}`},
      [columnIds[3]]: {value: colors[i + (hasParent ? 2 : 0)]},
      [columnIds[4]]: {value: ""},
    }));
  }
}
