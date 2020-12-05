import {Grid} from '@models/domain_specific/grid';
import {Constructor, Formula, Procedure} from '@models/domain_specific/procedure';
import {ProcedureResolutionError, ValueResolutionError} from '../language_errors';
import {Identifier, Type} from '../types';
import {Value} from '../values';
import {ConstructorReference, FormulaReference, ProcedureReference, ReferenceUtils, ValueReference} from './reference';

export interface ReferenceResolver {
  getGridById<I extends Identifier>(gridId: I): Grid<I> | undefined;

  resolveValue<T extends Type>(ref: ValueReference<T>): Value<T> | undefined;
  resolveConstructor<I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined;
  resolveFormula<R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined;
}


export class ReferenceResolverUtils {

  public static resolveValueOrThrow = <T extends Type>(ref: ValueReference<T>, resolver: ReferenceResolver): Value<T> => {
    const value = resolver.resolveValue(ref);
    if (!value) {
      throw new ValueResolutionError(`No value found for reference ${ref.id}.`);
    }
    return value;
  }

  public static resolveProcedure = <R extends Type, I extends Identifier>(
    ref: ProcedureReference<R, I>,
    resolver: ReferenceResolver,
  ): Procedure<R, I> | undefined => {
    return ReferenceUtils.isConstructorReference(ref) ?
      resolver.resolveConstructor(ref) as Procedure<any, I> :
      resolver.resolveFormula(ref);
  }

  public static resolveProcedureOrThrow = <R extends Type, I extends Identifier>(
    ref: ProcedureReference<R, I>,
    resolver: ReferenceResolver,
  ): Procedure<R, I> => {
    const procedure = ReferenceResolverUtils.resolveProcedure(ref, resolver);
    if (!procedure) {
      const refType = ReferenceUtils.isConstructorReference(ref) ? "constructor" : "formula";
      throw new ProcedureResolutionError(`No ${refType} exists for reference '${ref.id}'`);
    }
    return procedure;
  }

}