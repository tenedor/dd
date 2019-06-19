import * as _ from 'lodash';

import {NameResolver, ValueNamespace} from '@language/name_resolver';
import {RelativeValueReference} from '@language/reference';
import {TypeUtils} from '@language/types';
import {ValueResolver} from '@language/value_resolver';
import {DictValue, GridValue, RowValue} from '@language/values';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from '../collections/functional_array';
import {FunctionalKeyedArray} from '../collections/functional_keyed_array';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {SimpleUpdateManager, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {GridUpdateType} from '../core/update_types';
import {ConstructorUpdateDescriptor, GridConstructor} from './constructor';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Row, RowUpdateDescriptor} from './row';

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

export class Grid extends Mutable<GridUpdateDescriptor> {
  private _name: string;
  private readonly parent?: Grid;
  public readonly columns: GridColumns;
  public readonly rows: Rows;
  public readonly namespace: ValueNamespace;
  public readonly gridConstructor: GridConstructor;

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
    this.namespace = Grid.buildNamespace(this.getColumnByName, this.getColumnById);
    this.gridConstructor = this.buildConstructor();
    this.gridConstructor.listenForUpdate(this, this.onGridConstructorUpdated);
  }

  private static buildNamespace = (
    getColumnByName: (name: string) => GridColumn | undefined,
    getColumnById: (columnId: string) => GridColumn | undefined,
  ): ValueNamespace => {
    return {
      getReferenceForName: (name: string): RelativeValueReference | undefined => {
        const column = getColumnByName(name);
        if (!column) {
          return undefined;
        }
        const {columnId: id, type} = column;
        return new RelativeValueReference(id, type, (r: NameResolver) => column.name);
      },
      getNameForReference: (columnId: string): string | undefined => {
        const column = getColumnById(columnId);
        return column && column.name;
      },
    }
  }

  private buildConstructor = (): GridConstructor => {
    const {id: gridId, columns, namespace} = this;
    // TODO create a Primitive mutable model and make this.name a Primitive
    const getName = () => this.name;
    return new GridConstructor(this.updateManager, {gridId, columns, getName, namespace});
  }

  public get name(): string {
    return this._name;
  }

  public get value(): GridValue {
    // TODO fix this
    return {type: TypeUtils.GridOf(this.id), dict: {}, list: []};
  }

  private getColumnByName = (name: string): GridColumn | undefined => {
    return this.columns.a.find(c => c.name === name);
  }

  private getColumnById = (columnId: string): GridColumn | undefined =>  {
      return this.columns.d[columnId];
  }

  public addColumns = (columns: GridColumn[]) => {
    this.columns.pushAll(columns);
  }

  public addRows = (rows: Row[]) => {
    this.rows.pushAll(rows);
  }

  public evalConstructor = (valueResolver: ValueResolver, asmts: DictValue): RowValue => {
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
    updates: Array<ArrayUD<GridColumnUpdateDescriptor>>,
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

  private onGridConstructorUpdated = (
    epoch: number,
    updates: ConstructorUpdateDescriptor[],
  ): GridUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const descriptor = {type: GridUpdateType.CONSTRUCTOR_UPDATED};
    return [descriptor];
  }

  private onParentGridUpdated = (epoch: number, updates: GridUpdateDescriptor[]): GridUpdateDescriptor[] => {
    // for now do nothing
    return [];
  }
}
