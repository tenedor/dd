import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {Namespace} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {ColumnUpdateType} from './update_types';

export enum DataType {
  DRAWING = 'DRAWING',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
}

interface ColumnData {
  name: string;
  type: DataType;
}

export interface ColumnUpdateDescriptor extends UpdateDescriptor<ColumnUpdateType> {}

export class Column extends BaseModel<ColumnUpdateDescriptor> {
  protected readonly namespace = Namespace.COLUMN;
  private _name: string;
  private _type: DataType;

  constructor(updateManager: UpdateManager, {name, type}: ColumnData) {
    super(updateManager);
    this._name = name;
    this._type = type;
  }

  public get name(): string {
    return this._name;
  }

  public get type(): DataType {
    return this._type;
  }

  public setName = (name: string): void => {
    this._name = name;
    const descriptor = {type: ColumnUpdateType.NAME_UPDATED};
    this.onSelfMutated([descriptor]);
  }
}
