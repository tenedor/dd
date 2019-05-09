import * as _ from 'lodash';
import {Grid} from 'src/core/models/grid'; // only a type dependency
import {Dictionary, RODictionary} from 'src/utils/types';
import {buildNamespace, BuiltInFormulaReference, ConstructorNamespace, Context,
        GridReference, NameResolver, ValueNamespace, ValueReference}
        from './reference';
import {BuiltInFormula, getBuiltInFormulas} from './standard_library';
import {Identifier, Type, TypeUtils} from './types';
import {DictValue, Value} from './values';

interface FormulaGrid {
  getNamespace: () => ValueNamespace;
}
type DocumentScopedObject = Grid | FormulaGrid;

export class FormulaEnvironment {
  private readonly documentScopedObjects: Dictionary<DocumentScopedObject>;
  private readonly _resolver: NameResolver;

  constructor() {
    const builtInFormulas = getBuiltInFormulas();
    this._resolver = this.constructResolver(builtInFormulas);
    this.documentScopedObjects = this.constructBuiltInGrids(builtInFormulas);
  }

  private constructResolver = (builtInFormulas: RODictionary<BuiltInFormula>): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    const constructorNamespace = this.buildConstructorNamespace(builtInFormulas);
    const valueNamespace: ValueNamespace = buildNamespace({});
    return new NameResolver(namespaceResolver, constructorNamespace, valueNamespace);
  }

  private constructBuiltInGrids = (builtInFormulas: RODictionary<BuiltInFormula>): Dictionary<DocumentScopedObject> => {
    const byGridId = _.mapKeys(builtInFormulas, formula => this.getFormulaGridId(formula.id))
    return _.mapValues(byGridId, formula => {
      const nameToParameterMap = _.mapKeys(formula.parameters, 'name');
      const nameToReferenceMap = _.mapValues(nameToParameterMap, p => {
        return new ValueReference(p.id, p.type, () => p.name);
      });
      const getNamespace = () => buildNamespace(nameToReferenceMap);
      return {getNamespace};
    });
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = this.getObject(objectId);
    return object && object.getNamespace();
  }

  private buildConstructorNamespace = (builtInFormulas: RODictionary<BuiltInFormula>): ConstructorNamespace => {
    const builtInFormulaReferences = _.mapValues(builtInFormulas, this.getReferenceForFormula);
    return buildNamespace(builtInFormulaReferences);
  }

  private getReferenceForFormula = <R extends Type> (formula: BuiltInFormula<R>): BuiltInFormulaReference<R> => {
    const {id, returnType, name} = formula;
    return {
      id,
      returnType,
      gridRef: this.makeGridForBuiltInFormula(id),
      toText: () => name,
      eval: (context: Context, asmts: DictValue): Value<R> => {
        return formula.eval(asmts);
      },
    }
  }

  private makeGridForBuiltInFormula = (formulaId: Identifier): GridReference => {
    const id = this.getFormulaGridId(formulaId);
    const toText = (r: NameResolver) => {
      throw new Error("A formula grid should never be displayed to the user");
    };
    return new ValueReference(id, TypeUtils.GridOf(id), toText);
  }

  private getFormulaGridId = (formulaId: Identifier): Identifier => {
    return `grid-${formulaId}`;
  }

  public addGrid = (grid: Grid): void => {
    this.documentScopedObjects[grid.id] = grid;
  }

  public removeGrid = (gridId: string): void => {
    delete this.documentScopedObjects[gridId];
  }

  public get resolver(): NameResolver {
    return this._resolver;
  }

  private getObject = (objectId: Identifier): DocumentScopedObject | undefined => {
    return this.documentScopedObjects[objectId];
  }
}