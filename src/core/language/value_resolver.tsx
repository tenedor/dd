import * as _ from 'lodash';

import {RODictionary} from '@utils/types';
import {FormulaEnvironment} from './formula_environment';
import {ValueReference} from './reference';
import {Type, TypeUtils} from './types';
import {Value} from './values';

export class ValueResolver {
  private readonly valueLookupTable: RODictionary<Value>;
  private readonly environment: FormulaEnvironment;

  constructor(valueLookupTable: RODictionary<Value>, environment: FormulaEnvironment) {
    this.valueLookupTable = valueLookupTable;
    this.environment = environment;
  }

  public evalValueReference = <T extends Type>(ref: ValueReference<T>): Value<T> => {
    const value = this.valueLookupTable[ref.id];
    if (!value) {
      throw new Error(`No value found for reference ${ref.id}`);
    }
    TypeUtils.validateIsAssignableTo(value.type, ref.type, this.environment,
      `Reference of type ${ref.type} resolved to a value with incompatible type ${value.type}`);
    return value as Value<T>;
  }

  public contextOf = (dict: RODictionary<Value>): ValueResolver => {
    return new ValueResolver(dict, this.environment);
  }
}