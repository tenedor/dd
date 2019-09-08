import * as _ from 'lodash';

import {getDrawingColumnData} from '@core/drawing_grid_utilities';
import {Type} from '@language/types';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ColumnUpdateType} from '../core/update_types';

interface ColumnData<T extends Type> {
  name: string;
  type: T;
  id?: string; // only for internal use
}

export interface ColumnUpdateDescriptor extends UpdateDescriptor<ColumnUpdateType> {}

export class Column<T extends Type = Type> extends Mutable<ColumnUpdateDescriptor> {
  private static drawingColumn?: Column;

  private _name: string;
  private _type: T;

  constructor(updateManager: UpdateManager, {name, type, id}: ColumnData<T>, modelType: ModelType = ModelType.COLUMN) {
    super(updateManager, modelType, id);
    this._name = name;
    this._type = type;
  }

  public static getDrawingColumn(updateManager: UpdateManager): Column {
    if (!this.drawingColumn) {
      this.drawingColumn = new Column(updateManager, getDrawingColumnData());
    }
    return this.drawingColumn;
  }

  public get name(): string {
    return this._name;
  }

  public get type(): Type {
    return this._type;
  }

  public setName = (name: string) => {
    if (!name || name !== name.trim()) {
      throw new Error(name ? "Column name cannot have trailing whitespace" : "Column name cannot be blank");
    }
    if (this._name === name) {
      return;
    }
    this._name = name;
    const descriptor = {type: ColumnUpdateType.NAME_UPDATED};
    this.onSelfMutated([descriptor]);
  }
}
