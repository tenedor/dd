import {Grid} from '@models/domain_specific/grid';
import {Constructor, Formula} from '@models/domain_specific/procedure';
import {ConstructorReference, FormulaReference, ValueReference} from './reference';
import {Identifier, Type} from './types';
import {Value} from './values';

export interface ReferenceResolver {
  getGridById<I extends Identifier>(gridId: I): Grid<I> | undefined;

  resolveValue<T extends Type>(ref: ValueReference<T>): Value<T> | undefined;
  resolveConstructor<I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined;
  resolveFormula<R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined;
}
