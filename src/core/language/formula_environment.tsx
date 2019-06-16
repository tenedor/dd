import * as _ from 'lodash';

import {BuiltInFormulaGrid} from '@models/domain_specific/built_in_formula_grid';
import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {Dictionary, RODictionary} from '@utils/types';
import {buildNamespace, BuiltInFormulaReference, ConstructorNamespace, Context,
        NameResolver, ReferenceType, RelativeValueReference, ValueNamespace}
        from './reference';
import {BuiltInFormula, getBuiltInFormulas} from './standard_library';
import {Identifier, Type, TypeUtils} from './types';
import {DictValue, Value} from './values';

interface ObjectWithNamespace {
  id: string,
  namespace: ValueNamespace,
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
    return object && object.namespace;
  }

  private getReferenceForFormula = <R extends Type> (
    formula: BuiltInFormula<R>,
    formulaGrid: BuiltInFormulaGrid,
  ): BuiltInFormulaReference<R> => {
    const {id, returnType, name} = formula;
    const {id: gridId, namespace} = formulaGrid;
    return {
      id,
      referenceType: ReferenceType.ABSOLUTE_CONSTRUCTOR,
      model: formulaGrid,
      returnType,
      namespace,
      assignmentsType: TypeUtils.DictOf(gridId),
      getName: () => name,
      eval: (context: Context, asmts: DictValue): Value<R> => {
        return formula.eval(asmts);
      },
    }
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