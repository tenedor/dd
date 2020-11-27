import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid'; // Only a type dependency
import {BuiltInFormula, Constructor, Formula, Procedure} from '@models/domain_specific/procedure'; // Only a type dependency
import {RODictionary} from '@utils/types';
import {FormulaEnvironment} from './formula_environment';
import {ObjectResolutionError, TypeError, ValueResolutionError} from './language_errors';
import {ConstructorReference, FormulaReference, ProcedureReference, Reference, ReferenceUtils, ValueReference} from './reference';
import {BoundingType, DictType, Identifier, RowType, Type, TypeUtils} from './types';

export interface Namespace {
  getReferenceName(ref: Reference): string | undefined;
  getGridNameById(gridId: Identifier): string | undefined;
  typeToString(t: Type, opts?: {eraseBoundingTypes?: boolean}): string;

  getGridIdByName(name: string): Identifier | undefined;
  getValueReferenceByName(name: string): ValueReference | undefined;
  getConstructorReferenceByName(name: string): ConstructorReference | undefined;
  getFormulaReferenceByName(name: string): FormulaReference | undefined;
}

export type ValueNamespace = Namespace<ValueReference>;


export class ProcedureNamespaceImpl {
  private readonly nameToReferenceMap: {[name: string]: ProcedureReference};
  private readonly idToNameMap: {[id: string]: string};
  private readonly grids: {[id: string]: Grid};

  constructor() {
    this.nameToReferenceMap = {};
    this.idToNameMap = {};
    this.grids = {};
  }

  public getReferenceForName = (name: string): ProcedureReference | undefined => {
    const grid = Object.values(this.grids).find(g => g.name === name);
    return grid ?
      ReferenceUtils.buildReferenceForProcedure(grid.gridConstructor) :
      this.nameToReferenceMap[name];
  }

  // TODO - in the case of grids, this is using the grid id not the reference id
  public getNameForReference = (ref: Reference): string | undefined => {
    const grid = this.grids[ref.id];
    return grid ? grid.name : this.idToNameMap[ref.id];
  }

  public getReferenceForGridId = <I extends Identifier> (gridId: I): ProcedureReference<RowType<I>, I> | undefined => {
    const grid = this.grids[gridId as string] as Grid<I>;
    return grid ?
      ReferenceUtils.buildReferenceForProcedure(grid.gridConstructor) :
      undefined;
  }

  public addBuiltInFormula = (name: string, ref: ProcedureReference) => {
    this.nameToReferenceMap[name] = ref;
    this.idToNameMap[ref.id] = name;
  }

  public addGrid = (grid: Grid) => {
    this.grids[grid.id] = grid;
  }

  public removeGrid = (gridId: string) => {
    delete this.grids[gridId];
  }
}


export const buildNamespace = <R extends Reference> (nameToReferenceMap: {[name: string]: R}): Namespace<R> => {
  const nameToIdMap = _.mapValues(nameToReferenceMap, ref => ref.id);
  const idToNameMap = _.invert(nameToIdMap);

  return {
    getReferenceForName: (name: string) => nameToReferenceMap[name],
    getNameForReference: (ref: Reference) => idToNameMap[ref.id],
  }
}


class NameResolutionError extends ObjectResolutionError {
  constructor(message: string = "", errorClass: typeof NameResolutionError = NameResolutionError) {
    super(message, errorClass);
  }
}

export interface NamespaceResolver {
  resolveNamespace(id: Identifier): ValueNamespace | undefined;
}

export class NameResolverDeprecated {
  private readonly namespaceResolver: NamespaceResolver;
  private readonly procedureNamespace: ProcedureNamespaceImpl;
  private readonly valueNamespace: ValueNamespace;
  // TODO clarify the role of NameResolver vs FormulaEnvironment
  public readonly environment: FormulaEnvironment;
  private readonly iteratorType: Type;
  private static MISSING_NAME_PLACEHOLDER = "missing_name";

  constructor(
    namespaceResolver: NamespaceResolver,
    procedureNamespace: ProcedureNamespaceImpl,
    valueNamespace: ValueNamespace,
    environment: FormulaEnvironment,
    iteratorType: Type = BoundingType.BOTTOM,
  ) {
    this.namespaceResolver = namespaceResolver;
    this.procedureNamespace = procedureNamespace;
    this.valueNamespace = valueNamespace;
    this.environment = environment;
    this.iteratorType = iteratorType;
  }

  public resolveValueReferenceByName = (name: string): ValueReference => {
    const ref = this.valueNamespace.getReferenceForName(name);
    if (!ref) {
      throw new ValueResolutionError(`No value with name '${name}' exists in this scope`);
    }
    return ref;
  }

  public resolveConstructorByName = (name: string): Constructor => {
    const ref = this.procedureNamespace.getReferenceForName(name);
    if (!ref) {
      throw new NameResolutionError(`No grid exists with name '${name}'`);
    }
    return ref.model;
  }

  public resolveFormulaByName = (name: string): Formula => {
    const ref = this.procedureNamespace.getReferenceForName(name);
    if (!ref) {
      throw new NameResolutionError(`No formula exists with name '${name}'`);
    }
    return ref.model;
  }

  public resolveConstructorById = <I extends Identifier> (gridId: I): Constructor<I> => {
    const ref = this.procedureNamespace.getReferenceForGridId(gridId);
    if (!ref) {
      throw new NameResolutionError(`No procedure exists for grid with id '${gridId}'`);
    }
    return ref.model;
  }

  // FIXME delete this
  public resolveProcedure = <I extends Identifier> (ref: ProcedureReference<I>): Procedure<RowType<I>, I> => {
    if (!ref) {
      throw new NameResolutionError(`No procedure exists for grid with id '${gridId}'`);
    }
    return ref.model;
  }

  private resolveNamespace = (id: Identifier): ValueNamespace => {
    const namespace = this.namespaceResolver.resolveNamespace(id);
    if (!namespace) {
      throw new NameResolutionError(`No namespace found for id ${id}`);
    }
    return namespace;
  }

  public getIteratorType = (): Type => {
    return this.iteratorType;
  }

  public nameForProcedureAssignment = (
    procedureRef: ProcedureReference, assignmentRef: ValueReference,
  ): string => {
    const {namespace} = this.resolveProcedure(procedureRef);
    const name = namespace.getNameForReference(assignmentId);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  public nameForValueId = (ref: ValueReference): string => {
    const name = this.valueNamespace.getNameForReference(ref);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  public nameForConstructorId = (id: Identifier): string => {
    const name = this.procedureNamespace.getNameForReference(id);
    return name === undefined ? NameResolver.MISSING_NAME_PLACEHOLDER : name;
  }

  // FIXME move this to Procedure class
  public validateProcedureAssignments =
      (procedure: Procedure, asmtTypesById: RODictionary<Type>): void => {
    const {namespace} = procedure;
    Object.keys(asmtTypesById).forEach(id => {
      const name = namespace.getNameForReference(id);
      if (!name) {
        throw new TypeError(`Assignment to \`${id}\` does not match procedure \`${procedure.id}\``);
      }
      const ref = namespace.getReferenceForName(name);
      if (!ref) {
        throw new TypeError(`Assignment to \`${id}\` does not match procedure \`${procedure.id}\``);
      } else {
        const {type} = ref;
        TypeUtils.validateIsAssignableTo(asmtTypesById[id], type, this.environment,
          `Expected value \`${name}\` to be assignable to type \`${this.environment.getGlobalNamespace().typeToString(type)}\``);
      }
    });
  }

  public resolverWith = (valueNamespace: ValueNamespace): NameResolver => {
    return new NameResolver(this.namespaceResolver, this.procedureNamespace, valueNamespace, this.environment);
  }

  public resolverFor = (dict: DictType): NameResolver => {
    const valueNamespace = this.resolveNamespace(dict.schemaId.gridId);
    return this.resolverWith(valueNamespace);
  }

  public extendWithDict = (dict: DictType): NameResolver => {
    const namespace = this.resolveNamespace(dict.schemaId.gridId);
    return this.extendWithNamespace(namespace);
  }

  public extendWithNamespace = (namespace: ValueNamespace): NameResolver => {
    const stackedNamespace = NameResolver.extendNamespace(this.valueNamespace, namespace);
    return new NameResolver(this.namespaceResolver, this.procedureNamespace, stackedNamespace, this.environment);
  }

  private static extendNamespace = (parentNamespace: ValueNamespace, namespace: ValueNamespace): ValueNamespace => {
    return {
      getReferenceForName: (name: string) => namespace.getReferenceForName(name) || parentNamespace.getReferenceForName(name),
      getNameForReference: (refId: Identifier) => namespace.getNameForReference(refId) || parentNamespace.getNameForReference(refId),
    }
  }

  public extendWithIteratorType = (iteratorType: Type) => {
    return new NameResolver(this.namespaceResolver, this.procedureNamespace, this.valueNamespace, this.environment, iteratorType);
  }
}