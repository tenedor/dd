import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from './functional_array';
import {FunctionalKeyedArray} from './functional_keyed_array';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Namespace} from './resolver';
import {Row, RowUpdateDescriptor} from './row';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {GridUpdateType} from './update_types';

export type GridColumns = FunctionalKeyedArray<GridColumn, GridColumnUpdateDescriptor, 'columnId'>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

interface GridData {
  columns: GridColumn[],
  rows: Row[],
  parentGrid?: Grid,
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid extends BaseModel<GridUpdateDescriptor> {
  // invariant - this grid's persisted data only changes from ancestors if its
  // parent's persisted data changes
  private readonly parent?: Grid;
  public readonly columns: GridColumns;
  public readonly rows: Rows;

  constructor(updateManager: UpdateManager, {columns, rows, parentGrid}: GridData, namespace: Namespace = Namespace.GRID) {
    super(updateManager, namespace);
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
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

  private onParentGridUpdated = (epoch: number, updates: GridUpdateDescriptor[]): GridUpdateDescriptor[] => {
    // for now do nothing
    return [];
  }
}
