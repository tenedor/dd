import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {computeFormula, Context, Formula} from './formula';
import {FormulaContainer, FormulaContainerUpdateDescriptor} from './formula_container';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Namespace} from './resolver';
import {DependencySetUpdateDescriptor, UpdateDescriptor, UpdateManager} from './update_manager';
import {CellUpdateType, DependencySetUpdateType, FormulaContainerUpdateType} from './update_types';
import {Value, valuesAreEqual} from './value';

interface CellData {
  column: GridColumn,
  getContextForFormula: (f: Formula) => Context,
  manualValue?: Value,
}

export interface CellUpdateDescriptor extends UpdateDescriptor<CellUpdateType> {}

export class Cell extends BaseModel<CellUpdateDescriptor> {
  private readonly column: GridColumn;
  private context: Context;
  private readonly formulaContainer: FormulaContainer;
  private readonly getContextFromFormula: (f: Formula) => Context;
  private _manualValue?: Value;
  private _value?: Value;

  constructor(
    updateManager: UpdateManager,
    {column, getContextForFormula, manualValue}: CellData,
    namespace: Namespace = Namespace.CELL,
  ) {
    super(updateManager, namespace);
    this.column = column;
    this.formulaContainer = column.formulaContainer;
    this.getContextFromFormula = getContextForFormula;
    this._manualValue = manualValue;

    // updateContext expects a preexisting context to compare to
    this.context = {};
    this.updateContext();

    // may require context to compute value
    this._value = this.computeValue();

    this.column.listenForUpdate(this, this.onColumnUpdated);
    this.formulaContainer.listenForDependencyUpdate(this, this.onFormulaContainerUpdated);
  }

  public get value(): Value {
    return this._value;
  }

  public get manualValue(): Value {
    return this._manualValue;
  }

  public get formula(): Formula | undefined {
    return this.column.formula;
  }

  public setManualValue(manualValue: Value) {
    this._manualValue = manualValue;
    const descriptors = this.refreshValueAndGetUpdateDescriptors();
    if (descriptors.length) {
      this.onSelfMutated(descriptors);
    }
  }

  public setFormula(formula: Formula | undefined) {
    this.column.setFormula(formula);
  }

  private getContextDiff(oldContext: Context, newContext: Context): {removedIds: string[], addedIds: string[]} {
    const oldKeys = Object.keys(oldContext);
    const newKeys = Object.keys(newContext);
    const removedIds = _.difference(oldKeys, newKeys);
    const addedIds = _.difference(newKeys, oldKeys);
    return {removedIds, addedIds};
  }

  private updateContext = (): DependencySetUpdateDescriptor[] => {
      const oldContext = this.context;
      this.context = this.formula ? this.getContextFromFormula(this.formula) : {};
      const {removedIds, addedIds} = this.getContextDiff(oldContext, this.context);
      if (removedIds.length || addedIds.length) {
        removedIds.forEach(id => oldContext[id].removeUpdateListener(this));
        addedIds.forEach(id => this.context[id].listenForUpdate(this, this.onContextDependencyUpdated));
        return [{type: DependencySetUpdateType.DEPENDENCY_SET_UPDATED}];
      }
      return [];
  }

  private onColumnUpdated = (epoch: number, updates: GridColumnUpdateDescriptor[]): CellUpdateDescriptor[] => {
    // for now do nothing
    return [];
  }

  private onFormulaContainerUpdated = (updates: FormulaContainerUpdateDescriptor[]): DependencySetUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaContainerUpdateType.FORMULA_UPDATED);
    return formulaUpdated ? this.updateContext() : [];
  }

  public onDependencySetUpdated = (
    epoch: number,
    updates: DependencySetUpdateDescriptor[],
  ): CellUpdateDescriptor[] => {
    const descriptors = this.refreshValueAndGetUpdateDescriptors();
    if (descriptors.length) {
      this.onDependencyUpdated(epoch);
      return descriptors;
    }
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
    if (valuesAreEqual(this._value, newValue)) {
      return [];
    }
    this._value = newValue;
    return [{type: CellUpdateType.VALUE_UPDATED}];
  }

  private computeValue = (): Value => {
    if (this.formula) {
      return computeFormula(this.formula, this.context);
    } else {
      return this._manualValue;
    }
  }
}
