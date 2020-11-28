import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid';
import {Constructor, Formula} from '@models/domain_specific/procedure';
import {Identifier, Type} from '../types';
import {DictValue, Value} from '../values';
import {ConstructorReference, FormulaReference, ValueReference} from './reference';
import {ReferenceResolver} from './reference_resolver';

export class DictReferenceResolver implements ReferenceResolver {
  private readonly globalResolver: ReferenceResolver;
  private readonly instance: DictValue;

  constructor(globalResolver: ReferenceResolver, instance: DictValue) {
    this.globalResolver = globalResolver;
    this.instance = instance;
  }

  public resolveValue = <T extends Type>(ref: ValueReference<T>): Value<T> | undefined => {
    return this.instance.dict[ref.id] as Value<T> | undefined;
  }

  // Pass-throughs to global resolver
  public getGridById = <I extends Identifier>(gridId: I): Grid<I> | undefined =>
      this.globalResolver.getGridById(gridId);
  public resolveConstructor = <I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined =>
      this.globalResolver.resolveConstructor(ref);
  public resolveFormula = <R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined =>
      this.globalResolver.resolveFormula(ref);
}