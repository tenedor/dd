import {JSPrimitive, ROArray} from '../utils/types';
import {assert} from '../utils/utils';
import {BaseModel} from './base_model';
import {Namespace} from './resolver';
import {UndefinedUpdateDescriptor, UpdateDescriptor, UpdateManager} from './update_manager';
import {ArrayUpdateType} from './update_types';

export interface ArrayUpdateDescriptor<ED extends UpdateDescriptor> extends UpdateDescriptor<ArrayUpdateType> {
  index: number;
  elementDescriptors: ED[];
}

class BaseFunctionalArray<
    T extends JSPrimitive | BaseModel<TD>,
    TD extends UpdateDescriptor,
    > extends BaseModel<ArrayUpdateDescriptor<TD>> {
  protected readonly namespace = Namespace.ARRAY;
  protected array: T[];

  constructor(updateManager: UpdateManager, array: ROArray<T> = []) {
    super(updateManager);
    this.array = array.slice();
  }

  public get a(): ROArray<T> {
    return this.array;
  }

  public get = (index: number): T | undefined => {
    return this.array[index];
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueAdded(value: T) {
    // for overriding
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueRemoved(value: T) {
    // for overriding
  }

  public set = (index: number, value: T): void => {
    assert(index >= 0, "Index out of bounds.");
    const oldValue = this.array[index];
    if (oldValue === value) {
      return;
    }
    const isInsert = index >= this.length;
    this.array = this.array.slice();
    this.array[index] = value;
    if (!isInsert) {
      this.onValueRemoved(oldValue);
    }
    this.onValueAdded(value);
    const descriptor = {
      index,
      type: isInsert ? ArrayUpdateType.ELEMENT_INSERTED : ArrayUpdateType.ELEMENT_UPDATED,
      elementDescriptors: [],
    };
    this.onSelfMutated([descriptor]);
  }

  public updateValue = (oldValue: T, newValue: T): void => {
    const index = this.array.indexOf(oldValue);
    this.set(index, newValue);
  }

  public push = (value: T): void => {
    this.set(this.length, value);
  }

  public pop = (): T | undefined => {
    if (this.length === 0) {
      return undefined;
    }
    this.array = this.array.slice();
    const value = this.array.pop() as T;
    this.onValueRemoved(value);
    const descriptor = {
      index: this.length,
      type: ArrayUpdateType.ELEMENT_DELETED,
      elementDescriptors: [],
    };
    this.onSelfMutated([descriptor]);
    return value;
  }

  public get length(): number {
    return this.array.length;
  }
}

// For arrays of primitives
export class FunctionalArrayP extends BaseFunctionalArray<JSPrimitive, UndefinedUpdateDescriptor> {}

// For arrays of functional models
export class FunctionalArrayM<
    T extends BaseModel<TD>,
    TD extends UpdateDescriptor,
    > extends BaseFunctionalArray<T, TD> {
  constructor(updateManager: UpdateManager, array: ROArray<T> = []) {
    super(updateManager, array);
    this.array.forEach(t => t.listenForUpdate(this, this.onElementUpdated));
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueAdded(value: T) {
    value.listenForUpdate(this, this.onElementUpdated);
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueRemoved(value: T) {
    if (this.array.indexOf(value) < 0) {
      value.removeUpdateListener(this);
    }
  }

  protected onElementUpdated = (
    epoch: number,
    elementDescriptors: TD[],
    element: T,
  ): Array<ArrayUpdateDescriptor<TD>> => {
    const index = this.array.indexOf(element);
    assert(index >= 0, "Bad onElementUpdated listener.");
    this.array = this.array.slice();

    this.onDependencyUpdated(epoch);
    const descriptor = {
      index,
      type: ArrayUpdateType.ELEMENT_UPDATED,
      elementDescriptors,
    };
    return [descriptor];
  }
}