import {ROArray} from '../utils/types';
import {assert} from '../utils/utils';
import {EpochManager} from './epoch_manager';
import {FunctionalArray} from './functional_array';

interface Indexable {
  id: string;
}

export class IndexedFunctionalArray<T extends Indexable> extends FunctionalArray<T> {
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

  public set = (index: number, value: T): void => {
    const oldValue = this.array[index];
    delete this.index[oldValue.id];
    this.assertUniqueId(value.id);
    this.index[value.id] = value;
    return super.set(index, value);
  }

  public push = (value: T): void => {
    this.assertUniqueId(value.id);
    this.index[value.id] = value;
    super.push(value);
  }

  public pop = (): T | undefined => {
    const value = super.pop();
    if (value) {
      delete this.index[value.id];
    }
    return value;
  }
}