import * as _ from 'lodash';

import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {BuiltInFormula, Constructor, Formula, Procedure, Signature}
        from '@models/domain_specific/procedure'; // only a type dependency
import {Dictionary, ROArray} from '@utils/types';
import {assert} from '@utils/utils';
import {ObjectResolutionError} from './language_errors';
import {Namespace} from './name_resolver';
import {ConstructorReference, FormulaReference, Reference, ReferenceUtils,
        ValueReference} from './reference';
import {GridType, Identifier, ListOfAnyType, PartialRowType, Type, TypeUtils}
        from './types';
import {PartialRowValue, Value} from './values';

export interface ReferenceResolver {
  getGridById<I extends Identifier>(gridId: I): Grid<I> | undefined;
  resolveValue<T extends Type>(ref: ValueReference<T>): Value<T> | undefined;
  resolveConstructor<I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined;
  resolveFormula<R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined;
}


export interface FormulaEnvironment {
  getGlobalNamespace(): Namespace;
  getInstanceNamespace(type: PartialRowType): Namespace | undefined;

  getGlobalResolver(): ReferenceResolver;
  getInstanceResolver(instance: PartialRowValue): ReferenceResolver | undefined;

  isAssignableTo(t1: GridType, t2: GridType): boolean;
  getUnionType(t1: GridType, t2: GridType): GridType | ListOfAnyType;

  getAllExtensibleGrids(): ROArray<Grid>;
  getAllowedColumnTypes(): Type[];
  getSignatures(): Signature[];
}


export interface MutableFormulaEnvironment extends FormulaEnvironment {
  addBuiltInFormula(formula: BuiltInFormula): void;
  addGrid(grid: Grid): void;
  removeGrid(gridId: string): void;
}


class LanguageEnvironmentRegistry implements Namespace, ReferenceResolver {
  protected readonly builtInFormulasByGridId: Dictionary<BuiltInFormula>;
  protected readonly grids: Dictionary<Grid>;

  constructor() {
    this.builtInFormulasByGridId = {};
    this.grids = {};
  }

  public addBuiltInFormula = (formula: BuiltInFormula) => {
    this.builtInFormulasByGridId[formula.id] = formula;
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
  }

  public removeGrid = (gridId: string): void => {
    delete this.grids[gridId];
  }

  public getReferenceName = (ref: Reference): string | undefined => {
    if (ReferenceUtils.isProcedureReference(ref)) {
      const procedure = this.getProcedureById(ref.id);
      return procedure && procedure.name;
    } else {
      return undefined;
    }
  }

  public getGridNameById = (gridId: Identifier): string | undefined => {
    const grid = this.getGridById(gridId);
    return grid && grid.name;
  }

  public typeToString = (t: Type, opts: {eraseBoundingTypes?: boolean} = {}): string => {
    if (TypeUtils.isLambda(t)) {
      const inType = this.typeToString(t.inputType, opts);
      const outType = this.typeToString(t.outputType, opts);
      return `${inType} -> ${outType}`;
    } else if (TypeUtils.isDict(t)) {
      const name = this.getReferenceName(new ConstructorReference(t.schemaId.gridId));
      if (name !== undefined) {
        return name;
      }
    } else if (TypeUtils.isList(t)) {
      return TypeUtils.listToString(t, tt => this.typeToString(tt, opts));
    }
    return TypeUtils.toString(t, opts);
  }

  public getGridIdByName = (name: string): Identifier | undefined => {
    const {grids} = this;
    for (const id in grids) {
      if (grids[id].name === name) {
        return id;
      }
    }
    return undefined;
  }

  public getValueReferenceByName = (name: string): ValueReference | undefined => {
    // no global values for now
    return undefined;
  }

  public getConstructorReferenceByName = (name: string): ConstructorReference | undefined => {
    const gridId = this.getGridIdByName(name);
    return gridId === undefined ? undefined : new ConstructorReference(gridId);
  }

  public getFormulaReferenceByName = (name: string): FormulaReference | undefined => {
    const {builtInFormulasByGridId} = this;
    for (const id in builtInFormulasByGridId) {
      if (builtInFormulasByGridId[id].name === name) {
        return builtInFormulasByGridId[id].getReference();
      }
    }
    return undefined;
  }

  public getGridById = <I extends Identifier>(gridId: I): Grid<I> | undefined => {
    return this.grids[gridId] as Grid<I> | undefined;
  }

  protected getConstructorById = <I extends Identifier>(gridId: I): Constructor<I> | undefined => {
    const grid = this.getGridById(gridId);
    return (grid && grid.gridConstructor) || undefined;
  }

  protected getFormulaById = <I extends Identifier>(gridId: I): Formula<Type, I> | undefined => {
    return this.builtInFormulasByGridId[gridId] as BuiltInFormula<Type, I> | undefined;
  }

  protected getProcedureById = <I extends Identifier>(id: I): Procedure<Type, I> | undefined => {
    return this.getConstructorById(id) || this.getFormulaById(id) || undefined;
  }

  public resolveValue = <T extends Type>(ref: ValueReference<T>): Value<T> | undefined => {
    // no global values for now
    return undefined;
  }

  public resolveConstructor = <I extends Identifier>(ref: ConstructorReference<I>): Constructor<I> | undefined => {
    return this.getConstructorById(ref.id);
  }

  public resolveFormula = <R extends Type, I extends Identifier>(ref: FormulaReference<R, I>): Formula<R, I> | undefined => {
    return this.builtInFormulasByGridId[ref.id] as BuiltInFormula<R, I> | undefined;
  }
}


export class LanguageEnvironmentImpl extends LanguageEnvironmentRegistry implements MutableFormulaEnvironment {

  public getGlobalNamespace = (): Namespace => {
    return this;
  }

  public getInstanceNamespace = (type: PartialRowType): Namespace | undefined => {
    // TODO
  }

  public getGlobalResolver = (): ReferenceResolver => {
    return this;
  }

  public getInstanceResolver = (instance: PartialRowValue): ReferenceResolver | undefined => {
    // TODO
  }

  private getGridForType = <I extends Identifier>(gridType: GridType<I>): Grid<I> => {
    const grid = this.grids[gridType.schemaId.gridId] as Grid<I> | undefined;
    assert(grid !== undefined, `Unrecognized grid type ${TypeUtils.toString(gridType)}.`, ObjectResolutionError);
    return grid!;
  }

  public isAssignableTo = (t1: GridType, t2: GridType): boolean => {
    const g1 = this.getGridForType(t1);
    const g2 = this.getGridForType(t2);
    return g1.isOrExtends(g2);
  }

  public getUnionType = (t1: GridType, t2: GridType): GridType | ListOfAnyType => {
    const g1 = this.getGridForType(t1);
    const g2 = this.getGridForType(t2);
    const commonAncestor = g1.getCommonAncestor(g2);
    return commonAncestor ? TypeUtils.GridOf(commonAncestor.id) : TypeUtils.ListOfAny;
  }

  public getAllExtensibleGrids = (): ROArray<Grid> => {
    return Object.values(this.grids);
  }

  public getAllowedColumnTypes = (): Type[] => {
    const constructableRowTypes = Object.values(this.grids).map(g => TypeUtils.RowOf(g.id));
    return TypeUtils.atomicTypes.concat(constructableRowTypes);
  }

  public getSignatures = (): Signature[] => {
    const formulaSignatures = Object.values(this.builtInFormulasByGridId).map(f => f.getSignature());
    const gridSignatures = Object.values(this.grids).map(g => g.gridConstructor.getSignature());
    return formulaSignatures.concat(gridSignatures);
  }
}