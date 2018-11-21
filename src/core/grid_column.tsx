import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Column, ColumnUpdateDescriptor, DataType} from './column';
import {Grid} from './grid'; // only a type dependency
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {ColumnUpdateType, GridColumnUpdateType} from './update_types';

// limit to first-order formulas of column values
export interface Formula {
  name: string,
  args: string[],
}

// placeholder until there's a real language
export interface FormulaContext {
  grid: Grid;
}

export function getFormulaAsString(formula: Formula, {grid}: FormulaContext): string {
  const args = formula.args.map(arg => grid.columns.d[arg].name);
  return `${formula.name}(${args.join(", ")})`
}

interface GridColumnData {
  column: Column;
  formula?: Formula;
  parentGridColumn?: GridColumn;
  width: number;
}

export interface GridColumnUpdateDescriptor extends UpdateDescriptor<GridColumnUpdateType> {}

export class GridColumn extends BaseModel<GridColumnUpdateDescriptor> {
  protected readonly namespace = Namespace.COLUMN;
  private readonly column: Column;
  private readonly parentGridColumn?: GridColumn;
  private _formula?: Formula;
  private _width: number;

  constructor(updateManager: UpdateManager, {column, formula, parentGridColumn, width}: GridColumnData) {
    super(updateManager);
    this.column = column;
    this.parentGridColumn = parentGridColumn;
    this._formula = formula;
    this._width = width;

    this.column.listenForUpdate(this, this.onColumnUpdated);
    if (this.parentGridColumn) {
      this.parentGridColumn.listenForUpdate(this, this.onParentGridColumnUpdated);
    }
  }

  public static fromParent(updateManager: UpdateManager, parentColumn: GridColumn): GridColumn {
    const {column, width} = parentColumn;
    return new GridColumn(updateManager, {column, parentGridColumn: parentColumn, width});
  }

  public get columnId(): string {
    return this.column.id;
  }

  public get formula(): Formula | undefined {
    return this._formula || (this.parentGridColumn ? this.parentGridColumn.formula : undefined);
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
    this._formula = formula;
    const descriptor = {type: GridColumnUpdateType.FORMULA_UPDATED};
    this.onSelfMutated([descriptor]);
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

  private onParentGridColumnUpdated = (
    epoch: number,
    updates: GridColumnUpdateDescriptor[],
  ): GridColumnUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === GridColumnUpdateType.FORMULA_UPDATED);
    if (formulaUpdated && !this._formula) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: GridColumnUpdateType.FORMULA_UPDATED};
      return [descriptor];
    }
    return [];
  }
}
