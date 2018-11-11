import * as _ from 'lodash';
import {deleteObjectKeyFunctionally, setObjectValueFunctionally} from '../utils/utils';
import {BaseModel} from './base_model';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {RowUpdateType} from './update_types';

interface Cell {
  value: string;
}

export type CellRO = Readonly<Cell>;

interface RowData {
  [columnId: string]: CellRO,
}

export interface RowUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  columnId: string;
}

export class Row extends BaseModel<RowUpdateDescriptor> {
  protected readonly namespace = Namespace.ROW;
  private _cells: RowData;

  constructor(updateManager: UpdateManager, rowData: RowData) {
    super(updateManager);
    this._cells = Object.assign({}, rowData);
  }

  public get cells(): RowData {
    return this._cells;
  }

  public setCell = (columnId: string, cell?: CellRO): void => {
    if (cell) {
      this._cells = setObjectValueFunctionally(this._cells, columnId, cell);
    } else {
      this._cells = deleteObjectKeyFunctionally(this._cells, columnId);
    }
    const descriptor = {type: RowUpdateType.CELL_UPDATED, columnId};
    this.onSelfMutated([descriptor]);
  }

  public clearCell = (columnId: string): void => {
    this.setCell(columnId);
  }
}
