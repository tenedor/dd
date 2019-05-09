import * as _ from 'lodash';

import {FormulaEnvironment} from '@language/formula_environment';
import {NameResolver, ValueNamespace, ValueReference} from '@language/reference';
import {BaseModel, ModelType} from './base_model';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from './functional_array';
import {FunctionalKeyedArray} from './functional_keyed_array';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Row, RowUpdateDescriptor} from './row';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {GridUpdateType} from './update_types';

export type GridColumns = FunctionalKeyedArray<GridColumn, GridColumnUpdateDescriptor, 'columnId'>;
export type Rows = FunctionalArrayM<Row, RowUpdateDescriptor>;

export interface CellIndex {
  columnId: string,
  rowIndex: number,
}

export interface GridData {
  parentGrid?: Grid,
}

export interface GridUpdateDescriptor extends UpdateDescriptor<GridUpdateType> {}

export class Grid extends BaseModel<GridUpdateDescriptor> {
  private readonly formulaEnvironment: FormulaEnvironment;
  // invariant - this grid's persisted data only changes from ancestors if its
  // parent's persisted data changes
  private readonly parent?: Grid;
  public readonly columns: GridColumns;
  public readonly rows: Rows;

  constructor(
    updateManager: UpdateManager,
    formulaEnvironment: FormulaEnvironment,
    {parentGrid}: GridData,
    namespace: ModelType = ModelType.GRID,
  ) {
    super(updateManager, namespace);
    this.formulaEnvironment = formulaEnvironment;
    if (parentGrid) {
      this.parent = parentGrid;
      this.parent.listenForUpdate(this, this.onParentGridUpdated);
    }
    this.columns = new FunctionalKeyedArray(updateManager, [], 'columnId');
    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.rows = new FunctionalArrayM(updateManager, []);
    this.rows.listenForUpdate(this, this.onRowsUpdated);
  }

  public get resolver(): NameResolver {
    return this.formulaEnvironment.resolver;
  }

  public getNamespace = (): ValueNamespace => {
    return {
      getReferenceForName: (name: string) => {
        const column = this.getColumnByName(name);
        if (!column) {
          return undefined;
        }
        const {columnId: id, type} = column;
        return new ValueReference(id, type, (r: NameResolver) => column.name);
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
