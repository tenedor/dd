import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Column, ColumnUpdateDescriptor, DataType} from './column';
import {Formula} from './formula';
import {FormulaContainer, FormulaContainerUpdateDescriptor} from './formula_container';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {ColumnUpdateType, FormulaContainerUpdateType, GridColumnUpdateType} from './update_types';

interface GridColumnData {
  column: Column;
  // TODO: defaultValue
  formulaContainer: FormulaContainer;
  parentGridColumn?: GridColumn;
  // TODO: visible
  width: number;
}

export interface GridColumnUpdateDescriptor extends UpdateDescriptor<GridColumnUpdateType> {}

export class GridColumn extends BaseModel<GridColumnUpdateDescriptor> {
  private readonly column: Column;
  private readonly parentGridColumn?: GridColumn;
  private _formulaContainer: FormulaContainer;
  private _width: number;

  constructor(
    updateManager: UpdateManager,
    {column, formulaContainer, parentGridColumn, width}: GridColumnData,
    namespace: Namespace = Namespace.GRID_COLUMN,
  ) {
    super(updateManager, namespace);
    this.column = column;
    this.parentGridColumn = parentGridColumn;
    this._formulaContainer = formulaContainer;
    this._width = width;

    this.column.listenForUpdate(this, this.onColumnUpdated);
    this._formulaContainer.listenForUpdate(this, this.onFormulaContainerUpdated);
    if (this.parentGridColumn) {
      this.parentGridColumn.listenForUpdate(this, this.onParentGridColumnUpdated);
    }
  }

  public static fromParent(updateManager: UpdateManager, parentColumn: GridColumn): GridColumn {
    const {column, _formulaContainer: formulaContainer, width} = parentColumn;
    return new GridColumn(updateManager, {column, formulaContainer, parentGridColumn: parentColumn, width});
  }

  public get columnId(): string {
    return this.column.id;
  }

  public get formula(): Formula | undefined {
    return this._formulaContainer.formula;
  }

  public get name(): string {
    return this.column.name;
  }

  public get type(): DataType {
    return this.column.type;
  }

  public get width(): number {
    return this._width;
  }

  public setFormula = (formula: Formula | undefined) => {
    this._formulaContainer.setFormula(formula);
  }

  public setName = (name: string): void => {
    this.column.setName(name);
  }

  private onColumnUpdated = (epoch: number, updates: ColumnUpdateDescriptor[]): GridColumnUpdateDescriptor[] => {
    const nameUpdated = updates.some(u => u.type === ColumnUpdateType.NAME_UPDATED);
    if (nameUpdated) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: GridColumnUpdateType.NAME_UPDATED};
      return [descriptor];
    }
    return [];
  }

  private onFormulaContainerUpdated = (epoch: number, updates: FormulaContainerUpdateDescriptor[]): GridColumnUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaContainerUpdateType.FORMULA_UPDATED);
    if (formulaUpdated) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: GridColumnUpdateType.FORMULA_UPDATED};
      return [descriptor];
    }
    return [];
  }

  private onParentGridColumnUpdated = (
    epoch: number,
    updates: GridColumnUpdateDescriptor[],
  ): GridColumnUpdateDescriptor[] => {
    // no direct dependencies for now
    return [];
  }
}
