import * as _ from 'lodash';

import {Type} from '@language/types';
import {BaseModel, ModelType} from './base_model';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {ColumnUpdateType} from './update_types';

interface ColumnData<T extends Type> {
  name: string;
  type: T;
}

export interface ColumnUpdateDescriptor extends UpdateDescriptor<ColumnUpdateType> {}

export class Column<T extends Type = Type> extends BaseModel<ColumnUpdateDescriptor> {
  private _name: string;
  private _type: T;

  constructor(updateManager: UpdateManager, {name, type}: ColumnData<T>, namespace: ModelType = ModelType.COLUMN) {
    super(updateManager, namespace);
    this._name = name;
    this._type = type;
  }

  public get name(): string {
    return this._name;
  }

  public get type(): Type {
    return this._type;
  }

  public setName = (name: string): void => {
    this._name = name;
    const descriptor = {type: ColumnUpdateType.NAME_UPDATED};
    this.onSelfMutated([descriptor]);
  }
}
