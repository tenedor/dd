import {BaseModel} from './base_model';
import {Formula} from './formula';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {FormulaContainerUpdateType} from './update_types';

interface FormulaContainerData {
  formula?: Formula;
  parentContainer?: FormulaContainer;
}

export interface FormulaContainerUpdateDescriptor extends UpdateDescriptor<FormulaContainerUpdateType> {}

export class FormulaContainer extends BaseModel<FormulaContainerUpdateDescriptor> {
  private _formula?: Formula;
  private readonly parentContainer?: FormulaContainer;

  constructor(
    updateManager: UpdateManager,
    {formula, parentContainer}: FormulaContainerData,
    namespace: Namespace = Namespace.FORMULA_CONTAINER,
  ) {
    super(updateManager, namespace);
    this._formula = formula;
    this.parentContainer = parentContainer;

    if (this.parentContainer) {
      this.parentContainer.listenForUpdate(this, this.onParentContainerUpdated);
    }
  }

  public get formula(): Formula | undefined {
    return this._formula || (this.parentContainer ? this.parentContainer.formula : undefined);
  }

  public setFormula = (formula: Formula | undefined) => {
    this._formula = formula;
    const descriptor = {type: FormulaContainerUpdateType.FORMULA_UPDATED};
    this.onSelfMutated([descriptor]);
  }

  private onParentContainerUpdated = (
    epoch: number,
    updates: FormulaContainerUpdateDescriptor[],
  ): FormulaContainerUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaContainerUpdateType.FORMULA_UPDATED);
    if (formulaUpdated && !this._formula) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: FormulaContainerUpdateType.FORMULA_UPDATED};
      return [descriptor];
    }
    return [];
  }
}