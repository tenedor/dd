import * as _ from 'lodash';

import {DictType, Identifier, Type} from '../types';
import {Namespace, NamespaceUtils} from './namespace';
import {ConstructorReference, FormulaReference, Reference, ValueReference} from './reference';

// FIXME delete this class it is a hack
export class LambdaWrapperNamespace implements Namespace {
  private readonly baseNamespace: Namespace;
  private readonly iteratorType: Type;

  constructor(baseNamespace: Namespace, iteratorType: Type) {
    this.baseNamespace = baseNamespace;
    this.iteratorType = iteratorType;
  }

  // tslint:disable-next-line:variable-name
  public getIteratorType_DEPRECATED = (): Type => {
    return this.iteratorType;
  }

  // Pass-throughs to base resolver
  public getReferenceName = (ref: Reference): string | undefined =>
      this.baseNamespace.getReferenceName(ref)
  public getGridNameById = (gridId: Identifier): string | undefined =>
      this.baseNamespace.getGridNameById(gridId)
  public typeToString = (t: Type, opts?: {eraseBoundingTypes?: boolean}): string =>
      this.baseNamespace.typeToString(t, opts)
  public getGridIdByName = (name: string): Identifier | undefined =>
      this.baseNamespace.getGridIdByName(name)
  public getValueReferenceByName = (name: string): ValueReference | undefined =>
      this.baseNamespace.getValueReferenceByName(name)
  public getConstructorReferenceByName = (name: string): ConstructorReference | undefined =>
      this.baseNamespace.getConstructorReferenceByName(name)
  public getFormulaReferenceByName = (name: string): FormulaReference | undefined =>
      this.baseNamespace.getFormulaReferenceByName(name)
  public getInstanceNamespace = (type: DictType): Namespace =>
      this.baseNamespace.getInstanceNamespace(type)

  // tslint:disable-next-line:variable-name
  public extendWithIteratorType_DEPRECATED = (iteratorType: Type): Namespace =>
      NamespaceUtils.extendWithIteratorType_DEPRECATED(this, iteratorType);
}