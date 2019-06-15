import * as _ from 'lodash';

import {Dictionary, JSPrimitive, RODictionary} from '@utils/types';
import {assert} from '@utils/utils';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UndefinedUpdateDescriptor, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {DictionaryUpdateType} from '../core/update_types';

export interface DictionaryUpdateDescriptor<ED extends UpdateDescriptor>
    extends UpdateDescriptor<DictionaryUpdateType> {
  key: string;
  elementDescriptors: ED[];
}

class BaseFunctionalDictionary<
    T extends JSPrimitive | Mutable<TD>,
    TD extends UpdateDescriptor,
    > extends Mutable<DictionaryUpdateDescriptor<TD>> {
  protected dictionary: Dictionary<T>;

  constructor(
    updateManager: UpdateManager,
    dictionary: RODictionary<T> = {},
    modelType: ModelType = ModelType.DICTIONARY,
  ) {
    super(updateManager, modelType);
    this.dictionary = Object.assign({}, dictionary);
  }

  public get d(): RODictionary<T> {
    return this.dictionary;
  }

  public get = (key: string): T | undefined => {
    return this.dictionary[key];
  }

  // may be overridden in subclass so can't use arrow method
  protected getKeyForValue(value: T): string | undefined {
    return Object.keys(this.dictionary).find(k => this.dictionary[k] === value);
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueAdded(key: string, value: T) {
    // for overriding
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueRemoved(key: string, value: T) {
    // for overriding
  }

  // may be overridden in subclass so can't use arrow method
  public set(key: string, value: T): void {
    const oldValue = this.dictionary[key];
    if (oldValue === value) {
      return;
    }
    const isOverwrite = key in this.dictionary;
    this.dictionary = Object.assign({}, this.dictionary);
    this.dictionary[key] = value;
    if (isOverwrite) {
      this.onValueRemoved(key, oldValue);
    }
    this.onValueAdded(key, value);
    const descriptor = {
      key,
      type: isOverwrite ? DictionaryUpdateType.KEY_UPDATED : DictionaryUpdateType.KEY_SET,
      elementDescriptors: [],
    };
    this.onSelfMutated([descriptor]);
  }

  // may be overridden in subclass so can't use arrow method
  public remove(key: string): T | undefined {
    if (!(key in this.dictionary)) {
      return undefined;
    }
    const value = this.dictionary[key] as T;
    this.dictionary = Object.assign({}, this.dictionary);
    delete this.dictionary[key];
    this.onValueRemoved(key, value);
    const descriptor = {
      key,
      type: DictionaryUpdateType.KEY_DELETED,
      elementDescriptors: [],
    };
    this.onSelfMutated([descriptor]);
    return value;
  }

  public get size(): number {
    return Object.keys(this.dictionary).length;
  }
}

// For dictionaries of primitives
export class FunctionalDictionaryP extends BaseFunctionalDictionary<JSPrimitive, UndefinedUpdateDescriptor> {}

// For dictionaries of functional models
export class FunctionalDictionaryM<
    T extends Mutable<TD>,
    TD extends UpdateDescriptor,
    > extends BaseFunctionalDictionary<T, TD> {
  constructor(updateManager: UpdateManager, dictionary: RODictionary<T> = {}) {
    super(updateManager, dictionary);
    Object.keys(this.dictionary).forEach(k => this.dictionary[k].listenForUpdate(this, this.onElementUpdated));
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueAdded(key: string, value: T) {
    value.listenForUpdate(this, this.onElementUpdated);
  }

  // may be overridden in subclass so can't use arrow method
  protected onValueRemoved(key: string, value: T) {
    if (!(key in this.dictionary)) {
      value.removeUpdateListener(this);
    }
  }

  protected onElementUpdated = (
    epoch: number,
    elementDescriptors: TD[],
    element: T,
  ): Array<DictionaryUpdateDescriptor<TD>> => {
    const key = this.getKeyForValue(element);
    assert(key !== undefined, "Bad onElementUpdated listener.");
    this.dictionary = Object.assign({}, this.dictionary);

    this.onDependencyUpdated(epoch);
    const descriptor = {
      key: key!,
      type: DictionaryUpdateType.KEY_UPDATED,
      elementDescriptors,
    };
    return [descriptor];
  }
}