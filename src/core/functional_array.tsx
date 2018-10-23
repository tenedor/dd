import * as _ from 'lodash';
import {ROArray} from '../utils/types';
import {assert} from '../utils/utils';
import {BaseModel} from './base_model';
import {EpochManager} from './epoch_manager';

export class FunctionalArray<T> extends BaseModel {
  protected array: T[];
  
  constructor(epochManager: EpochManager, array: ROArray<T> = []) {
    super(epochManager);
    this.array = array.slice();
  }

  public get a(): ROArray<T> {
    return this.array;
  }

  public get = (index: number): T => {
    return this.array[index];
  }

  // may be overridden in subclass so can't use arrow method
  public set(index: number, value: T): void {
    assert(index >= 0, "Index out of bounds.");
    this.array = this.array.slice();
    this.array[index] = value;
    this.onSelfMutated();
  }

  // may be overridden in subclass so can't use arrow method
  public updateValue(oldValue: T, newValue: T): void {
    const index = this.array.indexOf(oldValue);
    this.set(index, newValue);
  }

  // may be overridden in subclass so can't use arrow method
  public push(value: T): void {
    this.array = this.array.slice();
    this.array.push(value);
    this.onSelfMutated();
  }

  // may be overridden in subclass so can't use arrow method
  public pop(): T | undefined {
    this.array = this.array.slice();
    const value = this.array.pop();
    this.onSelfMutated();
    return value;
  }

  public get length(): number {
    return this.array.length;
  }
}
