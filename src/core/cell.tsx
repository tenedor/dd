import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Formula, GridColumn} from './grid_column';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {CellUpdateType} from './update_types';

interface CellData {
  column: GridColumn,
  manualValue?: string,
}

// TODO - generalize this definition
type Value = string;

export interface CellUpdateDescriptor extends UpdateDescriptor<CellUpdateType> {}

export class Cell extends BaseModel<CellUpdateDescriptor> {
  protected readonly namespace = Namespace.CELL;
  private readonly _column: GridColumn;
  private _manualValue?: Value;

  constructor(updateManager: UpdateManager, cellData: CellData) {
    super(updateManager);
    this._column = cellData.column;
    this._manualValue = cellData.manualValue;
  }

  // TODO - Implement value locally. Depend on GridColumn's formula and default value.
  public get value(): Value {
    // but for now...
    return this._manualValue!;
  }

  public get manualValue(): Value | undefined {
    return this._manualValue;
  }

  public get formula(): Formula | undefined {
    return this._column.formula;
  }

  public setManualValue(manualValue: Value | undefined) {
    this._manualValue = manualValue;
    const descriptor = {type: CellUpdateType.VALUE_UPDATED};
    this.onSelfMutated([descriptor]);
  }

  public setFormula(formula: Formula | undefined) {
    this._column.setFormula(formula);
  }
}
