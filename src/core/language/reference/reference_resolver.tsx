import {Grid} from '@models/domain_specific/grid';
import {Constructor, Formula} from '@models/domain_specific/procedure';
import {ValueResolutionError} from '../language_errors';
import {Identifier, Type} from '../types';
import {Value} from '../values';
import {ConstructorReference, FormulaReference, ValueReference} from './reference';

export interface ReferenceResolver {
  getGridById<I extends Identifier>(gridId: I): Grid<I> | undefined;

  resolveValue<T extends Type>(ref: ValueReference<T>): Value<T> | undefined;
  resolveConstructor<I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined;
  resolveFormula<R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined;
}


export class ReferenceResolverUtils {

  public static resolveValueOrThrow<T extends Type>(ref: ValueReference<T>, resolver: ReferenceResolver): Value<T> {
      const value = resolver.resolveValue(ref);
      if (!value) {
        throw new ValueResolutionError(`No value found for reference ${ref.id}.`);
      }
      return value;
  }

}