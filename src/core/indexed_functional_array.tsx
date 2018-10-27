import * as _ from 'lodash';
import {ROArray} from '../utils/types';
import {assert} from '../utils/utils';
import {BaseModel, UpdateDescriptor} from './base_model';
import {EpochManager} from './epoch_manager';
import {FunctionalArrayM} from './functional_array';

interface Indexable {
  // TS does not enforce the readonly on the source but an indexable's id is expected to be immutable
  readonly id: string;
}

export class IndexedFunctionalArray<T extends BaseModel<TD> & Indexable, TD extends UpdateDescriptor>
    extends FunctionalArrayM<T, TD> {
  private index: {[id: string]: T};

  constructor(epochManager: EpochManager, array: ROArray<T> = []) {
    super(epochManager, array);
    this.index = {};
    this.array.forEach(value => {
      this.assertUniqueId(value.id);
      this.index[value.id] = value;
    });
  }

  private assertUniqueId = (id: string): void => {
    assert(!(id in this.index), "Values in IndexedFunctionalArray must be unique by id.");
  }

  public getById = (id: string): T | undefined => {
    return this.index[id];
  }

  public getIndexById = (id: string): number => {
    // not sure why this cast is needed...
    return _.findIndex(this.array as Indexable[], {id});
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueAdded(value: T) {
    this.assertUniqueId(value.id);
    this.index[value.id] = value;
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueRemoved(value: T) {
    delete this.index[value.id];
  }
}