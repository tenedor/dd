import * as _ from 'lodash';

import {Context, NameResolver, RelativeValueReference, ValueNamespace} from '@language/reference';
import {TypeUtils} from '@language/types';
import {DictValue, GridValue, RowValue} from '@language/values';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from '../collections/functional_array';
import {FunctionalKeyedArray} from '../collections/functional_keyed_array';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {SimpleUpdateManager, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {GridUpdateType} from '../core/update_types';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Row, RowUpdateDescriptor} from './row';

export interface GridLike {
  readonly id: string,
  readonly name: string,
  readonly value: GridValue,
  getNamespace: () => ValueNamespace,
}

export type GridColumns = FunctionalKeyedArray<GridColumn, GridColumnUpdateDescriptor, 'columnId'>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

export interface GridData {
  name: string,
  parentGrid?: Grid,
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid extends Mutable<GridUpdateDescriptor> implements GridLike {
  private _name: string;
  private readonly parent?: Grid;
  public readonly columns: GridColumns;
  public readonly rows: Rows;

  constructor(
    updateManager: UpdateManager,
    {name, parentGrid}: GridData,
    modelType: ModelType = ModelType.GRID,
  ) {
    super(updateManager, modelType);
    this._name = name;
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
    }
    this.columns = new FunctionalKeyedArray(updateManager, [], 'columnId');
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.rows = new FunctionalArrayM(updateManager, []);
    this.rows.listenForUpdate(this, this.onRowsUpdated);
  }

  public get name(): string {
    return this._name;
  }

  public get value(): GridValue {
    // TODO fix this
    return {type: TypeUtils.GridOf(this.id), dict: {}, list: []};
  }

  public getNamespace = (): ValueNamespace => {
    return {
      getReferenceForName: (name: string) => {
        const column = this.getColumnByName(name);
        if (!column) {
          return undefined;
        }
        const {columnId: id, type} = column;
        return new RelativeValueReference(id, type, (r: NameResolver) => column.name);
      },
      getNameForReference: (columnId: string) => this.columns.d[columnId] && this.columns.d[columnId].name,
    }
  }

  private getColumnByName = (name: string): GridColumn | undefined => {
    return this.columns.a.find(c => c.name === name);
  }

  public addColumns = (columns: GridColumn[]) => {
    this.columns.pushAll(columns);
  }

  public addRows = (rows: Row[]) => {
    this.rows.pushAll(rows);
  }

  public evalConstructor = (context: Context, asmts: DictValue): RowValue => {
    const updateManager = new SimpleUpdateManager();
    const cellConstructionData = this.columns.a.map(column => ({column, manualValue: asmts.dict[column.columnId]}));
    const row = new Row(updateManager, {
      gridId: this.id,
      cells: cellConstructionData,
    });
    return row.asValue();
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
