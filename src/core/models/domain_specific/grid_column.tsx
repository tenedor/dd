import * as _ from 'lodash';

import {ExpressionRes, TypeEnvironmentWithProcedures} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {Namespace} from '@language/reference/namespace';
import {ReferenceResolver} from '@language/reference/reference_resolver';
import {Type} from '@language/types';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ColumnUpdateType, FormulaExpressionUpdateType, GridColumnUpdateType} from '../core/update_types';
import {Column, ColumnUpdateDescriptor} from './column';
import {FormulaExpression, FormulaExpressionUpdateDescriptor} from './formula_expression';

export const DEFAULT_COLUMN_WIDTH = 100;
export const MIN_COLUMN_WIDTH = 20;

interface GridColumnData<T extends Type, C extends Type, P extends Type = Type> {
  column: Column<C>;
  environment: FormulaEnvironment;
  namespace: Namespace;
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
  private readonly parentGridColumn?: GridColumn<P, C>;
  private readonly _type: T;
  private readonly _environment: FormulaEnvironment;
  private readonly _formulaExpression: FormulaExpression<T>;
  private readonly _namespace: Namespace;
  private _width: number;

  constructor(
    updateManager: UpdateManager,
    {column, environment, namespace, parentGridColumn, type, width}: GridColumnData<T, C, P>,
    modelType: ModelType = ModelType.GRID_COLUMN,
  ) {
    super(updateManager, modelType);
    this.column = column;
    this.parentGridColumn = parentGridColumn;
    this._type = type;
    this._environment = environment;
    this._namespace = namespace;
    const parentExpression = parentGridColumn ? parentGridColumn.formulaExpression : undefined;
    this._formulaExpression = new FormulaExpression(updateManager,
        {type, namespace, environment, parent: parentExpression});
    this._width = width;
  }

  protected initInner(): void {
    super.initInner();
    this.column.listenForUpdate(this, this.onColumnUpdated);
    this._formulaExpression.listenForUpdate(this, this.onFormulaExpressionUpdated);
    if (this.parentGridColumn) {
      this.parentGridColumn.listenForUpdate(this, this.onParentGridColumnUpdated);
    }
  }

  public static fromParent<T extends Type, C extends Type, P extends Type>(
    parentGridColumn: GridColumn<P, C>,
    {namespace, type, width}: {namespace: Namespace, type?: T, width?: number},
  ): GridColumn<T, C, P> {
    const {column, _environment: environment, type: parentType, updateManager, width: parentWidth} = parentGridColumn;
    return new GridColumn(updateManager, {
      column,
      environment,
      namespace,
      parentGridColumn,
      type: type || (parentType as Type as T),
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

  public get namespace(): Namespace {
    return this._namespace;
  }

  public get environment(): TypeEnvironmentWithProcedures {
    return this._environment;
  }

  public get name(): string {
    return this.column.name;
  }

  public get width(): number {
    return this._width;
  }

  public getGlobalReferenceResolver(): ReferenceResolver {
    return this._environment.getGlobalResolver();
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

  public setWidth = (width: number) => {
    width = Math.max(MIN_COLUMN_WIDTH, width);
    if (this._width === width) {
      return;
    }
    this._width = width;
    const descriptor = {type: GridColumnUpdateType.WIDTH_UPDATED};
    this.onSelfMutated([descriptor]);
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
