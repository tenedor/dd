import * as _ from 'lodash';

import {BuiltInFormulaGrid} from '@core/models/built_in_formula_grid';
import {Grid} from '@core/models/grid'; // only a type dependency
import {Dictionary, RODictionary} from '@utils/types';
import {AbsoluteValueReference, buildNamespace, BuiltInFormulaReference,
        ConstructorNamespace, Context, GridShimReference, NameResolver, ReferenceType,
        RelativeValueReference, ValueNamespace} from './reference';
import {BuiltInFormula, getBuiltInFormulas} from './standard_library';
import {Identifier, Type, TypeUtils} from './types';
import {DictValue, Value} from './values';

interface ObjectWithNamespace {
  id: string,
  getNamespace: () => ValueNamespace,
}

export class FormulaEnvironment {
  private readonly documentScopedObjects: Dictionary<ObjectWithNamespace>;
  private readonly valueNamespace: ValueNamespace;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly _resolver: NameResolver;

  constructor() {
    const builtInFormulas = getBuiltInFormulas();
    const formulaGrids = this.constructBuiltInFormulaGrids(builtInFormulas);
    this.valueNamespace = buildNamespace({});
    this.constructorNamespace = this.buildConstructorNamespace(builtInFormulas, formulaGrids);
    this._resolver = this.constructResolver();
    this.documentScopedObjects = _.mapKeys(formulaGrids, g => g.id);
  }

  private buildConstructorNamespace = (
    builtInFormulas: RODictionary<BuiltInFormula>,
    formulaGrids: RODictionary<BuiltInFormulaGrid>,
  ): ConstructorNamespace => {
    const builtInFormulaReferences = _.mapValues(builtInFormulas, (formula, name) => {
      return this.getReferenceForFormula(formula, formulaGrids[name]);
    });
    return new ConstructorNamespace(builtInFormulaReferences);
  }

  private constructResolver = (): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    return new NameResolver(namespaceResolver, this.constructorNamespace, this.valueNamespace);
  }

  private constructBuiltInFormulaGrids = (builtInFormulas: RODictionary<BuiltInFormula>):
      RODictionary<BuiltInFormulaGrid> => {
    return _.mapValues(builtInFormulas, formula => {
      const nameToParameterMap = _.mapKeys(formula.parameters, 'name');
      const nameToReferenceMap = _.mapValues(nameToParameterMap, p => {
        return new RelativeValueReference(p.id, p.type, () => p.name);
      });
      const namespace = buildNamespace(nameToReferenceMap);
      return new BuiltInFormulaGrid(formula.name, namespace);
    });
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = this.getObject(objectId);
    return object && object.getNamespace();
  }

  private getReferenceForFormula = <R extends Type> (
    formula: BuiltInFormula<R>,
    formulaGrid: BuiltInFormulaGrid,
  ): BuiltInFormulaReference<R> => {
    const {id, returnType, name} = formula;
    const gridRef = this.getReferenceForBuiltInFormulaGrid(formulaGrid);
    return {
      id,
      referenceType: ReferenceType.ABSOLUTE,
      returnType,
      gridRef,
      model: gridRef.model,
      getName: () => name,
      eval: (context: Context, asmts: DictValue): Value<R> => {
        return formula.eval(asmts);
      },
    }
  }

  private getReferenceForBuiltInFormulaGrid = (grid: BuiltInFormulaGrid): GridShimReference => {
    const {id} = grid;
    const getName = (r: NameResolver) => {
      throw new Error("A formula grid should never be displayed to the user");
    };
    return new AbsoluteValueReference(id, TypeUtils.GridOf(id), getName, grid);
  }

  private getFormulaGridId = (formulaId: Identifier): Identifier => {
    return `grid-${formulaId}`;
  }

  public addGrid = (grid: Grid): void => {
    this.addObjectWithNamespace(grid);
    this.constructorNamespace.addGrid(grid);
  }

  public removeGrid = (gridId: string): void => {
    this.removeObjectWithNamespace(gridId);
    this.constructorNamespace.removeGrid(gridId);
  }

  public addObjectWithNamespace = (object: ObjectWithNamespace): void => {
    this.documentScopedObjects[object.id] = object;
  }

  public removeObjectWithNamespace = (objectId: string): void => {
    delete this.documentScopedObjects[objectId];
  }

  public get resolver(): NameResolver {
    return this._resolver;
  }

  private getObject = (objectId: Identifier): ObjectWithNamespace | undefined => {
    return this.documentScopedObjects[objectId];
  }
}