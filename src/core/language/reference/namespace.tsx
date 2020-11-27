import {Identifier, Type} from '../types';
import {ConstructorReference, FormulaReference, Reference, ValueReference}
        from './reference';

export interface Namespace {
  getReferenceName(ref: Reference): string | undefined;
  getGridNameById(gridId: Identifier): string | undefined;
  typeToString(t: Type, opts?: {eraseBoundingTypes?: boolean;}): string;

  getGridIdByName(name: string): Identifier | undefined;
  getValueReferenceByName(name: string): ValueReference | undefined;
  getConstructorReferenceByName(name: string): ConstructorReference | undefined;
  getFormulaReferenceByName(name: string): FormulaReference | undefined;
}
