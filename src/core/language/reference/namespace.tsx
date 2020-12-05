import {NameResolutionError} from '../language_errors';
import {DictType, Identifier, Type} from '../types';
import {LambdaWrapperNamespace} from './lambda_wrapper_namespace';
import {ConstructorReference, FormulaReference, Reference, ReferenceUtils, ValueReference}
        from './reference';

export interface ValueNamespace {
  getValueReferenceByName(name: string): ValueReference | undefined;
  getReferenceName(ref: ValueReference): string | undefined;
}


export interface SingleNamespace extends ValueNamespace {
  getReferenceName(ref: Reference): string | undefined;
  getGridNameById(gridId: Identifier): string | undefined;
  typeToString(t: Type, opts?: {eraseBoundingTypes?: boolean}): string;

  getGridIdByName(name: string): Identifier | undefined;
  getValueReferenceByName(name: string): ValueReference | undefined;
  getConstructorReferenceByName(name: string): ConstructorReference | undefined;
  getFormulaReferenceByName(name: string): FormulaReference | undefined;

  // FIXME
  extendWithIteratorType_DEPRECATED(iteratorType: Type): SingleNamespace;
  getIteratorType_DEPRECATED(): Type;
}


// TODO clean-up overuse of Namespace in favor of SingleNamespace
export interface Namespace extends SingleNamespace {
  getInstanceNamespace(type: DictType): Namespace;

  // FIXME
  extendWithIteratorType_DEPRECATED(iteratorType: Type): Namespace;
}


export class NamespaceUtils {

  public static getValueReferenceByNameOrThrow = (name: string, namespace: Namespace): ValueReference => {
      const ref = namespace.getValueReferenceByName(name);
      if (!ref) {
        throw new NameResolutionError(`No value with name '${name}' exists in this scope.`);
      }
      return ref;
  }

  public static getConstructorReferenceByNameOrThrow = (name: string, namespace: Namespace): ConstructorReference => {
      const ref = namespace.getConstructorReferenceByName(name);
      if (!ref) {
        throw new NameResolutionError(`No constructor with name '${name}' exists in this scope.`);
      }
      return ref;
  }

  public static getFormulaReferenceByNameOrThrow = (name: string, namespace: Namespace): FormulaReference => {
      const ref = namespace.getFormulaReferenceByName(name);
      if (!ref) {
        throw new NameResolutionError(`No formula with name '${name}' exists in this scope.`);
      }
      return ref;
  }

  public static getReferenceNameOrThrow = (ref: Reference, namespace: Namespace): string => {
      const name = namespace.getReferenceName(ref);
      if (!name) {
        const refType = ReferenceUtils.referenceTypeToString(ref.referenceType);
        throw new NameResolutionError(`No name exists in this scope for ${refType} reference '${ref.id}'.`);
      }
      return name;
  }

  // tslint:disable-next-line:variable-name
  public static extendWithIteratorType_DEPRECATED = (namespace: Namespace, iteratorType: Type): Namespace => {
    return new LambdaWrapperNamespace(namespace, iteratorType);
  }

}