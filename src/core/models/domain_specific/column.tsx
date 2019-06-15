import * as _ from 'lodash';

import {Type} from '@language/types';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ColumnUpdateType} from '../core/update_types';

interface ColumnData<T extends Type> {
  name: string;
  type: T;
}

export interface ColumnUpdateDescriptor extends UpdateDescriptor<ColumnUpdateType> {}

export class Column<T extends Type = Type> extends Mutable<ColumnUpdateDescriptor> {
  private _name: string;
  private _type: T;

  constructor(updateManager: UpdateManager, {name, type}: ColumnData<T>, modelType: ModelType = ModelType.COLUMN) {
    super(updateManager, modelType);
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
