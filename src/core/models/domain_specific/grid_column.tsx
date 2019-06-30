import * as _ from 'lodash';

import {ExpressionRes} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {NameResolver} from '@language/name_resolver';
import {Type, TypeUtils} from '@language/types';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ColumnUpdateType, FormulaExpressionUpdateType, GridColumnUpdateType} from '../core/update_types';
import {Column, ColumnUpdateDescriptor} from './column';
import {FormulaExpression, FormulaExpressionUpdateDescriptor} from './formula_expression';
import {Grid} from './grid';

export const DEFAULT_COLUMN_WIDTH = 100;

interface GridColumnData<T extends Type, C extends Type, P extends Type = Type> {
  column: Column<C>;
  formulaEnvironment: FormulaEnvironment;
  grid: Grid;
  parentGridColumn?: GridColumn<P, C>;
  type: T;
  // TODO: defaultValue
  // TODO: visible
  width: number;
}

export interface GridColumnUpdateDescriptor extends UpdateDescriptor<GridColumnUpdateType> {}

export class GridColumn<T extends Type = Type, C extends Type = Type, P extends Type = Type>
    extends Mutable<GridColumnUpdateDescriptor> {
  private readonly column: Column<C>;
  private readonly grid: Grid;
  private readonly parentGridColumn?: GridColumn<P, C>;
  private readonly _type: T;
  private readonly formulaEnvironment: FormulaEnvironment;
  private readonly _formulaExpression: FormulaExpression<T>;
  private _width: number;

  constructor(
    updateManager: UpdateManager,
    {column, formulaEnvironment, grid, parentGridColumn, type, width}: GridColumnData<T, C, P>,
    modelType: ModelType = ModelType.GRID_COLUMN,
  ) {
    super(updateManager, modelType);
    this.column = column;
    this.grid = grid;
    this.parentGridColumn = parentGridColumn;
    this._type = type;
    this.formulaEnvironment = formulaEnvironment;
    const {nameResolver} = formulaEnvironment;
    const parentExpression = parentGridColumn ? parentGridColumn.formulaExpression : undefined;
    this._formulaExpression = new FormulaExpression(updateManager,
        {type, nameResolver, parent: parentExpression});
    this._width = width;

    this.column.listenForUpdate(this, this.onColumnUpdated);
    this._formulaExpression.listenForUpdate(this, this.onFormulaExpressionUpdated);
    if (this.parentGridColumn) {
      this.parentGridColumn.listenForUpdate(this, this.onParentGridColumnUpdated);
    }
  }

  public static fromParent<T extends Type, C extends Type, P extends Type>(
    parentGridColumn: GridColumn<P, C>,
    {grid, type, width}: {grid: Grid, type: T, width?: number},
  ): GridColumn<T, C, P> {
    const {column, formulaEnvironment, updateManager, width: parentWidth} = parentGridColumn;
    return new GridColumn(updateManager, {
      column,
      formulaEnvironment,
      grid,
      parentGridColumn,
      type,
      width: width || parentWidth,
    });
  }

  public get columnId(): string {
    return this.column.id;
  }

  public get type(): T {
    return this._type;
  }

  public get formulaExpression(): FormulaExpression<T> {
    return this._formulaExpression;
  }

  public get nameResolver(): NameResolver {
    return this.formulaEnvironment.nameResolver.resolverFor(TypeUtils.GridOf(this.grid.id));
  }

  public get name(): string {
    return this.column.name;
  }

  public get width(): number {
    return this._width;
  }

  public hasExpression = (): boolean => {
    return this._formulaExpression.isSet;
  }

  public setExpression = (expression: ExpressionRes<T> | undefined) => {
    this._formulaExpression.setExpression(expression);
  }

  public setName = (name: string) => {
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

  private onFormulaExpressionUpdated = (epoch: number, updates: FormulaExpressionUpdateDescriptor[]): GridColumnUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED);
    if (formulaUpdated) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: GridColumnUpdateType.FORMULA_EXPRESSION_UPDATED};
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
