import * as _ from 'lodash';

import {DictType, Identifier, Type} from '../types';
import {Namespace, ValueNamespace} from './namespace';
import {ConstructorReference, FormulaReference, Reference, ReferenceUtils, ValueReference}
        from './reference';

export class DictNamespace implements Namespace {
  private readonly baseNamespace: Namespace;
  private readonly valueNamespace: ValueNamespace;

  constructor(baseNamespace: Namespace, valueNamespace: ValueNamespace) {
    this.baseNamespace = baseNamespace;
    this.valueNamespace = valueNamespace;
  }

  public getReferenceName = (ref: Reference): string | undefined => {
    return ReferenceUtils.isValueReference(ref) ?
      this.valueNamespace.getReferenceName(ref) :
      this.baseNamespace.getReferenceName(ref);
  }

  public getValueReferenceByName = (name: string): ValueReference | undefined => {
    return this.valueNamespace.getValueReferenceByName(name);
  }

  // Pass-throughs to base resolver
  public getGridNameById = (gridId: Identifier): string | undefined =>
      this.baseNamespace.getGridNameById(gridId)
  public typeToString = (t: Type, opts?: {eraseBoundingTypes?: boolean}): string =>
      this.baseNamespace.typeToString(t, opts)
  public getGridIdByName = (name: string): Identifier | undefined =>
      this.baseNamespace.getGridIdByName(name)
  public getConstructorReferenceByName = (name: string): ConstructorReference | undefined =>
      this.baseNamespace.getConstructorReferenceByName(name)
  public getFormulaReferenceByName = (name: string): FormulaReference | undefined =>
      this.baseNamespace.getFormulaReferenceByName(name)
  public getInstanceNamespace = (type: DictType): Namespace =>
      this.baseNamespace.getInstanceNamespace(type)
  // tslint:disable-next-line:variable-name
  public extendWithIteratorType_DEPRECATED = (iteratorType: Type): Namespace =>
      this.baseNamespace.extendWithIteratorType_DEPRECATED(iteratorType)
  // tslint:disable-next-line:variable-name
  public getIteratorType_DEPRECATED = (): Type =>
      this.baseNamespace.getIteratorType_DEPRECATED()
}