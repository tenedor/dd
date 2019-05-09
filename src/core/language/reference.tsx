import * as _ from 'lodash';

import {RODictionary} from '@utils/types';
import {DictType, GridType, Identifier, Type, TypeUtils} from './types';
import {DictValue, Value} from './values';

export interface Reference {
  readonly id: Identifier;

  toText(resolver: NameResolver): string;
}

export class ValueReference<T extends Type = Type> implements Reference {
  public readonly id: Identifier;
  public readonly toText: (resolver: NameResolver) => string;
  public readonly type: T;

  constructor(id: Identifier, type: T, toText: (resolver: NameResolver) => string) {
    this.id = id;
    this.type = type;
    this.toText = toText;
  }

  public eval = (context: Context): Value<T> => {
    return context.evalValueReference(this);
  }
}

export interface GridReference<I extends Identifier = Identifier> extends ValueReference<GridType<I>> {
  readonly id: I;
}

/*

References

Can reference:

Data:
- A grid's values
- A row column's value
- A grid column's values (syntax looks like projection)

Functions:
- A grid's constructor
- A custom formula's constructor
- A built-in formula's constructor

For each, need an id and a toText
For data, need a type
For functions, need a return type and an arguments schema

Need to be able to add a deps graph dependency on the constituents of the reference
- Data ref: depend on the value's existence, type, and value
- Function ref:
  - Built-in: nothing, it's static
  - Grid/custom: depend on the constructor's existence and the backing grid's schema:
    its columns (existence, type, formula, default value) and optionaly a projection column

Internally for custom formulas, need a grid constructor and a projection column

*/

export interface ConstructorReference<R extends Type = Type, I extends Identifier = Identifier> extends Reference {
  readonly returnType: R;
  readonly gridRef: GridReference<I>;

  eval: (context: Context, asmts: DictValue<I>) => Value<R>;
}

export type GridConstructorReference<I extends Identifier = Identifier> = ConstructorReference<GridType<I>, I>;

export interface CustomFormulaReference<R extends Type = Type, I extends Identifier = Identifier>
    extends ConstructorReference<R, I> {
  readonly projectionRef: ValueReference<R>;
}

export type BuiltInFormulaReference<R extends Type = Type> = ConstructorReference<R>;


interface Namespace<R extends Reference> {
  getReferenceForName(name: string): R | undefined;
  getNameForReference(refId: Identifier): string | undefined;
}

export type ValueNamespace = Namespace<ValueReference>;
export type ConstructorNamespace = Namespace<ConstructorReference>;

export const buildNamespace = <R extends Reference> (nameToReferenceMap: {[name: string]: R}): Namespace<R> => {
  const nameToIdMap = _.mapValues(nameToReferenceMap, ref => ref.id);
  const idToNameMap = _.invert(nameToIdMap);

  return {
    getReferenceForName: (name: string) => nameToReferenceMap[name],
    getNameForReference: (refId: Identifier) => idToNameMap[refId],
  }
}


export interface NamespaceResolver {
  resolveNamespace(id: Identifier): ValueNamespace | undefined;
}

export class NameResolver {
  private namespaceResolver: NamespaceResolver;
  private constructorNamespace: ConstructorNamespace;
  private valueNamespace: ValueNamespace;
  private static MISSING_NAME_PLACEHOLDER = "missing_name";

  constructor(
    namespaceResolver: NamespaceResolver,
    constructorNamespace: ConstructorNamespace,
    valueNamespace: ValueNamespace,
  ) {
    this.namespaceResolver = namespaceResolver;
    this.constructorNamespace = constructorNamespace;
    this.valueNamespace = valueNamespace;
  }

  public resolveValueReference = (name: string): ValueReference => {
    const ref = this.valueNamespace.getReferenceForName(name);
    if (!ref) {
      throw new TypeError(`No value with name '${name}' exists in this scope`);
    }
    return ref;
  }

  public resolveConstructorReference = (name: string): ConstructorReference => {
    const ref = this.constructorNamespace.getReferenceForName(name);
    if (!ref) {
      throw new TypeError(`No formula or grid exists with name '${name}'`);
    }
    return ref;
  }

  private resolveNamespace = (id: Identifier): ValueNamespace => {
    const namespace = this.namespaceResolver.resolveNamespace(id);
    if (!namespace) {
      throw new Error(`No namespace found for id ${id}`);
    }
    return namespace;
  }

  public nameForIdInConstructor = (id: Identifier, constructor: ConstructorReference): string => {
    const namespace = this.resolveNamespace(constructor.gridRef.id);
    const name = namespace.getNameForReference(id);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  public validateConstructorAssignments =
      (constructor: ConstructorReference, asmtTypesById: RODictionary<Type>): void => {
    const namespace = this.resolveNamespace(constructor.gridRef.id);
    Object.keys(asmtTypesById).forEach(id => {
      const name = namespace.getNameForReference(id);
      if (!name) {
        throw new TypeError(`Assignment to \`${id}\` does not match constructor \`${constructor.id}\``);
      }
      const ref = namespace.getReferenceForName(name);
      if (!ref) {
        throw new TypeError(`Assignment to \`${id}\` does not match constructor \`${constructor.id}\``);
      } else {
        const {type} = ref;
        TypeUtils.validateIsAssignableTo(asmtTypesById[id], type,
          `Expected value \`${name}\` to be assignable to type \`${TypeUtils.toString(type)}\``);
      }
    });
  }

  public resolverOf = (dict: DictType): NameResolver => {
    const valueNamespace = this.resolveNamespace(dict.schemaId);
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, valueNamespace);
  }

  public extendWith = (dict: DictType): NameResolver => {
    const localNamespace = this.resolveNamespace(dict.schemaId);
    const stackedNamespace = NameResolver.extendNamespace(this.valueNamespace, localNamespace);
    return new NameResolver(this.namespaceResolver, this.constructorNamespace, stackedNamespace);
  }

  private static extendNamespace = (parentNamespace: ValueNamespace, namespace: ValueNamespace): ValueNamespace => {
    return {
      getReferenceForName: (name: string) => namespace.getReferenceForName(name) || parentNamespace.getReferenceForName(name),
      getNameForReference: (refId: Identifier) => namespace.getNameForReference(refId) || parentNamespace.getNameForReference(refId),
    }
  }
}


export class Context {
  private readonly valueLookupTable: DictValue;

  constructor(valueLookupTable: DictValue) {
    this.valueLookupTable = valueLookupTable;
  }

  public evalValueReference = <T extends Type>(ref: ValueReference<T>): Value<T> => {
    const value = this.valueLookupTable.dict[ref.id];
    if (!value) {
      throw new Error(`No value found for reference ${ref.id}`);
    }
    TypeUtils.validateIsAssignableTo(value.type, ref.type,
      `Reference of type ${ref.type} resolved to a value with incompatible type ${value.type}`);
    return value as Value<T>;
  }

  public evalFormula = <R extends Type>(formulaRef: BuiltInFormulaReference<R>): Value<R> => {
    throw new Error("not implemented");
  }

  public constructRow = <I extends Identifier>(ref: GridReference<I>, asmts: DictValue<I>): DictValue<I> => {
    // validate assignments and construct a row
    throw new Error("not implemented");
  }

  public contextOf = (dict: DictValue): Context => {
    return new Context(dict);
  }
}