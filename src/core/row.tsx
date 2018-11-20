import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Cell, CellUpdateDescriptor} from './cell';
import {DictionaryUpdateDescriptor as DictionaryUD, FunctionalDictionaryM} from './functional_dictionary';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {RowUpdateType} from './update_types';

export type CellRO = Readonly<Cell>;
export type Cells = FunctionalDictionaryM<Cell, CellUpdateDescriptor>;

interface RowData {
  [columnId: string]: Cell,
}

export interface RowUpdateDescriptor extends UpdateDescriptor<RowUpdateType> {
  columnIds: string[];
}

export class Row extends BaseModel<RowUpdateDescriptor> {
  protected readonly namespace = Namespace.ROW;
  public readonly cells: Cells;

  constructor(updateManager: UpdateManager, rowData: RowData) {
    super(updateManager);
    this.cells = new FunctionalDictionaryM(updateManager, rowData);
    this.cells.listenForUpdate(this, this.onCellsUpdated);
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
