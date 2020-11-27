import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid';
import {Constructor, Formula} from '@models/domain_specific/procedure';
import {ConstructorReference, FormulaReference, ValueReference} from './reference';
import {ReferenceResolver} from './reference_resolver';
import {Identifier, Type} from './types';
import {Value} from './values';

export class LambdaReferenceResolver implements ReferenceResolver {
  private readonly baseResolver: ReferenceResolver;
  private readonly id: Identifier;
  private readonly value: Value;

  constructor(baseResolver: ReferenceResolver, id: Identifier, value: Value) {
    this.baseResolver = baseResolver;
    this.id = id;
    this.value = value;
  }

  public resolveValue = <T extends Type>(ref: ValueReference<T>): Value<T> | undefined => {
    return ref.id === this.id ? this.value as Value<T> : this.baseResolver.resolveValue(ref);
  }

  // Pass-throughs to base resolver
  public getGridById = <I extends Identifier>(gridId: I): Grid<I> | undefined =>
      this.baseResolver.getGridById(gridId);
  public resolveConstructor = <I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined =>
      this.baseResolver.resolveConstructor(ref);
  public resolveFormula = <R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined =>
      this.baseResolver.resolveFormula(ref);
}