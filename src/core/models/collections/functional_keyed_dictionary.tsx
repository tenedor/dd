import {ROArray, RODictionary} from '@utils/types';
import {assert} from '@utils/utils';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {FunctionalDictionaryM} from './functional_dictionary';

type InitialValues<T> = ROArray<T> | RODictionary<T>;

function getDictionaryFromInitialValues<T>(initialValues: InitialValues<T>, key: string): RODictionary<T> {
  if (Array.isArray(initialValues)) {
    const dictionary = {};
    (initialValues as ROArray<T>).forEach(value => {
      assert(!(value[key] in dictionary),
        `Initial values in FunctionalKeyedDictionary constructor must be unique by key '${key}'.`);
      dictionary[value[key]] = value;
    });
    return dictionary;
  } else {
    return initialValues as RODictionary<T>;
  }
}

export class FunctionalKeyedDictionary<
  T extends Mutable<TD> & {[KK in K]: string},
  TD extends UpdateDescriptor,
  K extends string = 'id'
> extends FunctionalDictionaryM<T, TD> {
  private readonly key: K;

  constructor(updateManager: UpdateManager, initialValues: InitialValues<T>, key: K) {
    super(updateManager, getDictionaryFromInitialValues(initialValues, key));
    this.key = key;
  }

  protected getKeyForValue(value: T): string | undefined {
    return value[this.key];
  }

  // may be overridden in subclass so can't use arrow method
  public set(key: string, value: T): void {
    assert(value[this.key] === key, "Forbidden attempt to set a value with a mismatched key.");
    super.set(key, value);
  }

  public setValue = (value: T): void => {
    super.set(value[this.key], value);
  }

  public removeValue = (value: T): T | undefined => {
    return super.remove(value[this.key]);
  }
}