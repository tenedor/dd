import * as _ from 'lodash';

import {Identifier, Type} from '@language/types';
import {DictValue, Value, ValueUtils} from '@language/values';
import {RODictionary} from '@utils/types';
import {BaseModel, ModelType} from './base_model';
import {FormulaExpression, FormulaExpressionUpdateDescriptor} from './formula_expression';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {RowContext} from './row';
import {DependencySetUpdateDescriptor, UpdateDescriptor, UpdateManager} from './update_manager';
import {CellUpdateType, DependencySetUpdateType, FormulaExpressionUpdateType} from './update_types';

interface CellData<T extends Type> {
  column: GridColumn<T>,
  getRowContext: () => RowContext,
  gridId: Identifier,
  manualValue?: Value<T>,
}

export interface CellUpdateDescriptor extends UpdateDescriptor<CellUpdateType> {}

export class Cell<T extends Type = Type> extends BaseModel<CellUpdateDescriptor> {
  private readonly column: GridColumn<T>;
  private readonly getRowContext: () => RowContext;
  private readonly gridId: Identifier;
  private dependencies: RODictionary<Cell>;
  private manualValue?: Value<T>;
  private _value: Value<T>;

  constructor(
    updateManager: UpdateManager,
    {column, getRowContext, gridId, manualValue}: CellData<T>,
    namespace: ModelType = ModelType.CELL,
  ) {
    super(updateManager, namespace);
    this.column = column;
    this.getRowContext = getRowContext;
    this.gridId = gridId;
    this.manualValue = manualValue;

    // updateDependencies expects a preexisting dependencies object to compare to
    this.dependencies = {};
    this.updateDependencies();

    this._value = this.computeValue();

    this.column.listenForUpdate(this, this.onColumnUpdated);

    // Need to listen to the formula container for dependency updates but this
    // is not enough: the formula might change without changing dependencies.
    this.formulaExpression.listenForDependencyUpdate(this, this.onFormulaExpressionUpdatedDependencies);
    this.formulaExpression.listenForUpdate(this, this.onFormulaExpressionUpdated);
  }

  public get value(): Value {
    return this._value;
  }

  public get formulaExpression(): FormulaExpression<T> {
    return this.column.formulaExpression;
  }

  private getDefaultValue(): Value<T> {
    if (ValueUtils.supportsDefaultValue(this.column.type)) {
      return ValueUtils.getDefaultValue(this.column.type);
    }
    throw new Error(`Default value is not supported for type ${this.column.type}`);
  }

  public setManualValue(manualValue: Value<T>) {
    this.manualValue = manualValue;
    const descriptors = this.refreshValueAndGetUpdateDescriptors();
    if (descriptors.length) {
      this.onSelfMutated(descriptors);
    }
  }

  private getDependenciesDiff(oldDependencies: RODictionary<Cell>, newDependencies: RODictionary<Cell>): {removedIds: string[], addedIds: string[]} {
    const oldKeys = Object.keys(oldDependencies);
    const newKeys = Object.keys(newDependencies);
    const removedIds = _.difference(oldKeys, newKeys);
    const addedIds = _.difference(newKeys, oldKeys);
    return {removedIds, addedIds};
  }

  private resolveDependencies = (): RODictionary<Cell> => {
    const rowContext = this.getRowContext();
    const allDependencies = this.formulaExpression.dependencies.map(d => d.id);
    const cellDependencyIds = _.intersection(allDependencies, Object.keys(rowContext));
    const dependenciesDict= {};
    cellDependencyIds.forEach(id => dependenciesDict[id] = rowContext[id]);
    return dependenciesDict;
  }

  private updateDependencies = (): DependencySetUpdateDescriptor[] => {
    const oldDependencies = this.dependencies;
    this.dependencies = this.resolveDependencies();
    const {removedIds, addedIds} = this.getDependenciesDiff(oldDependencies, this.dependencies);
    if (removedIds.length || addedIds.length) {
      removedIds.forEach(id => oldDependencies[id].removeUpdateListener(this));
      addedIds.forEach(id => this.dependencies[id].listenForUpdate(this, this.onContextDependencyUpdated));
      return [{type: DependencySetUpdateType.DEPENDENCY_SET_UPDATED}];
    }
    return [];
  }

  private onColumnUpdated = (epoch: number, updates: GridColumnUpdateDescriptor[]): CellUpdateDescriptor[] => {
    // for now do nothing
    return [];
  }

  private onFormulaExpressionUpdatedDependencies = (
    updates: FormulaExpressionUpdateDescriptor[],
  ): DependencySetUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED);
    return formulaUpdated ? this.updateDependencies() : [];
  }

  private onFormulaExpressionUpdated = (
    epoch: number,
    updates: FormulaExpressionUpdateDescriptor[],
  ): CellUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED);
    if (formulaUpdated) {
      const descriptors = this.refreshValueAndGetUpdateDescriptors();
      if (descriptors.length) {
        this.onDependencyUpdated(epoch);
        return descriptors;
      }
    }
    return [];
  }

  public onDependencySetUpdated = (
    epoch: number,
    updates: DependencySetUpdateDescriptor[],
  ): CellUpdateDescriptor[] => {
    // For now all dependency set updates are formula container updates. These
    // are already handled by the update-cycle listener on formula container so
    // no need to handle them here.
    return [];
  }

  private onContextDependencyUpdated = (epoch: number, updates: CellUpdateDescriptor[]): CellUpdateDescriptor[] => {
    const valueUpdated = updates.some(u => u.type === CellUpdateType.VALUE_UPDATED);
    if (valueUpdated) {
      const descriptors = this.refreshValueAndGetUpdateDescriptors();
      if (descriptors.length) {
        this.onDependencyUpdated(epoch);
        return descriptors;
      }
    }
    return [];
  }

  private refreshValueAndGetUpdateDescriptors = (): CellUpdateDescriptor[]  => {
    const newValue = this.computeValue();
    if (ValueUtils.areEqual(this._value, newValue)) {
      return [];
    }
    this._value = newValue;
    return [{type: CellUpdateType.VALUE_UPDATED}];
  }

  private getDependencyValues = (): DictValue => {
    const cellValues = _.mapValues(this.dependencies, c => c.value);
    return ValueUtils.dictOf(cellValues, this.gridId);
  }

  private computeValue = (): Value<T> => {
    if (this.formulaExpression.isSet) {
      return this.formulaExpression.eval(this.getDependencyValues());
    } else if (this.manualValue !== undefined) {
      return this.manualValue;
    } else {
      return this.getDefaultValue();
    }
  }
}
