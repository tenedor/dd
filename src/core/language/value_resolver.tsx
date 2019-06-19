import * as _ from 'lodash';

import {RODictionary} from '@utils/types';
import {ValueReference} from './reference';
import {Type, TypeUtils} from './types';
import {Value} from './values';

export class ValueResolver {
  private readonly valueLookupTable: RODictionary<Value>;

  constructor(valueLookupTable: RODictionary<Value>) {
    this.valueLookupTable = valueLookupTable;
  }

  public evalValueReference = <T extends Type>(ref: ValueReference<T>): Value<T> => {
    const value = this.valueLookupTable[ref.id];
    if (!value) {
      throw new Error(`No value found for reference ${ref.id}`);
    }
    TypeUtils.validateIsAssignableTo(value.type, ref.type,
      `Reference of type ${ref.type} resolved to a value with incompatible type ${value.type}`);
    return value as Value<T>;
  }

  public contextOf = (dict: RODictionary<Value>): ValueResolver => {
    return new ValueResolver(dict);
  }
}