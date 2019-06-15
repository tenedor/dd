import * as _ from 'lodash';

import {Dictionary, ROArray, RODictionary} from '@utils/types';
import {assert} from '@utils/utils';
import {FunctionalArrayM} from './functional_array';
import {Mutable} from './mutable';
import {UpdateDescriptor, UpdateManager} from './update_manager';

export class FunctionalKeyedArray<
  T extends Mutable<TD> & {[KK in K]: string},
  TD extends UpdateDescriptor,
  K extends string = 'id'
> extends FunctionalArrayM<T, TD> {
  private dictionary: Dictionary<T>;
  private readonly key: K;

  constructor(updateManager: UpdateManager, array: ROArray<T>, key: K) {
    super(updateManager, array);
    this.key = key;
    this.dictionary = {};
    this.array.forEach(value => {
      this.assertUnusedKey(value[this.key]);
      this.dictionary[value[this.key]] = value;
    });
  }

  private assertUnusedKey = (key: string): void => {
    assert(!(key in this.dictionary), `Values in FunctionalKeyedArray must be unique by key '${this.key}'.`);
  }

  public get d(): RODictionary<T> {
    return this.dictionary;
  }

  public getByKey = (key: string): T | undefined => {
    return this.dictionary[key];
  }

  public getIndexByKey = (key: string): number => {
    return _.findIndex(this.array, {[this.key]: key} as any);
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueAdded(value: T) {
    super.onValueAdded(value);
    this.assertUnusedKey(value[this.key]);
    this.dictionary[value[this.key]] = value;
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueRemoved(value: T) {
    super.onValueRemoved(value);
    delete this.dictionary[value[this.key]];
  }
}