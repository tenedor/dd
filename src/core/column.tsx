import * as _ from 'lodash';
import {BaseModel, UpdateDescriptor} from './base_model';
import {EpochManager} from './epoch_manager';
import {ColumnUpdateType} from './update_types';

export enum DataType {
  DRAWING = 'DRAWING',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
}

// limit to first-order formulas of column values
export interface Formula {
  name: string,
  args: string[],
}

interface ColumnData {
  formula?: Formula;
  id: string;
  name: string;
  type: DataType;
  width: number;
}

export interface ColumnUpdateDescriptor extends UpdateDescriptor<ColumnUpdateType> {}

export class Column extends BaseModel<ColumnUpdateDescriptor> {
  private _formula?: Formula;
  public readonly id: string;
  private _name: string;
  private _type: DataType;
  private _width: number;

  constructor(epochManager: EpochManager, {formula, id, name, type, width}: ColumnData) {
    super(epochManager);
    this._formula = formula;
    this.id = id;
    this._name = name;
    this._type = type;
    this._width = width;
  }

  public get formula(): Formula | undefined {
    return this._formula;
  }

  public get name(): string {
    return this._name;
  }

  public get type(): DataType {
    return this._type;
  }

  public get width(): number {
    return this._width;
  }

  public setName = (name: string): void => {
    this._name = name;
    const descriptor = {type: ColumnUpdateType.NAME_UPDATED};
    this.onSelfMutated([descriptor]);
  }
}
