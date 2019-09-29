import * as _ from 'lodash';

import {BuiltInFormula, Signature} from '@models/domain_specific/constructor'; // only a type dependency
import {Grid} from '@models/domain_specific/grid'; // only a type dependency
import {Dictionary, ROArray} from '@utils/types';
import {assert} from '@utils/utils';
import {ObjectResolutionError} from './language_errors';
import {buildNamespace, ConstructorNamespace, NameResolver, ValueNamespace} from './name_resolver';
import {ReferenceUtils} from './reference';
import {GridType, Identifier, ListOfAnyType, Type, TypeUtils} from './types';
import {Value, ValueUtils} from './values';

export class FormulaEnvironment {
  private readonly builtInFormulasByGridId: Dictionary<BuiltInFormula>;
  private readonly grids: Dictionary<Grid>;
  private readonly valueNamespace: ValueNamespace;
  private readonly constructorNamespace: ConstructorNamespace;
  private readonly _nameResolver: NameResolver;

  constructor() {
    this.builtInFormulasByGridId = {};
    this.grids = {};
    this.valueNamespace = buildNamespace({});
    this.constructorNamespace = new ConstructorNamespace();
    this._nameResolver = this.buildNameResolver();
  }

  private buildNameResolver = (): NameResolver => {
    const namespaceResolver = {resolveNamespace: this.resolveNamespace};
    // TODO clarify the role of NameResolver vs FormulaEnvironment
    return new NameResolver(namespaceResolver, this.constructorNamespace, this.valueNamespace, this);
  }

  private resolveNamespace = (objectId: Identifier): ValueNamespace | undefined => {
    const object = (this.grids[objectId] || this.builtInFormulasByGridId[objectId]) as Grid | BuiltInFormula | undefined;
    const namespace = object && object.namespace;
    return namespace;
  }

  private get allGrids(): Dictionary<Grid> {
    return this.grids;
  }

  public addBuiltInFormula = (formula: BuiltInFormula) => {
    this.builtInFormulasByGridId[formula.id] = formula;
    const formulaRef = ReferenceUtils.buildReferenceForConstructor(formula);
    this.constructorNamespace.addBuiltInFormula(formula.name, formulaRef);
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
    this.constructorNamespace.addGrid(grid);
  }

  public removeGrid = (gridId: string): void => {
    delete this.grids[gridId];
    this.constructorNamespace.removeGrid(gridId);
  }

  public get nameResolver(): NameResolver {
    return this._nameResolver;
  }

  public getAllowedColumnTypes = (): Type[] => {
    const constructableRowTypes = Object.values(this.allGrids).map(g => TypeUtils.RowOf(g.id));
    return TypeUtils.atomicTypes.concat(constructableRowTypes);
  }

  public getNameForType = (t: Type, opts: {eraseBoundingTypes?: boolean} = {}): string => {
    if (TypeUtils.isDict(t)) {
      const name = this.constructorNamespace.getNameForReference(t.schemaId.gridId);
      if (name !== undefined) {
        return name;
      }
    } else if (TypeUtils.isList(t)) {
      return TypeUtils.listToString(t, tt => this.getNameForType(tt, opts));
    }
    return TypeUtils.toString(t, opts);
  }

  public existsGridWithName = (gridName: string): boolean => {
    const grid = Object.values(this.allGrids).find(g => g.name === gridName);
    return !!grid;
  }

  public getGridByName = (gridName: string): Grid => {
    const grid = Object.values(this.allGrids).find(g => g.name === gridName);
    assert(grid !== undefined, new ObjectResolutionError(`Unrecognized grid ${gridName}.`));
    return grid!;
  }

  public getGridForType = (gridType: GridType): Grid => {
    const grid = this.allGrids[gridType.schemaId.gridId];
    assert(grid !== undefined, new ObjectResolutionError(`Unrecognized grid type ${TypeUtils.toString(gridType)}.`));
    return grid!;
  }

  public getGridById(gridId: Identifier) {
    const grid = this.allGrids[gridId];
    assert(grid !== undefined, new ObjectResolutionError(`Unrecognized grid id ${gridId}.`));
    return grid!;
  }

  public getAllExtensibleGrids = (): ROArray<Grid> => {
    return Object.values(this.allGrids);
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

  private getSignatures = (): Signature[] => {
    const formulaSignatures = Object.values(this.builtInFormulasByGridId).map(f => f.getSignature());
    const gridSignatures = Object.values(this.grids).map(g => g.gridConstructor.getSignature());
    return formulaSignatures.concat(gridSignatures);
  }

  public getSignatureStrings = (): string[] => {
    const signatures = this.getSignatures();
    return signatures.map(this.signatureToString);
  }

  private signatureToString = (signature: Signature): string => {
    const typeToString = (t: Type) => this.getNameForType(t, {eraseBoundingTypes: true});
    const valueToString = (v: Value) => ValueUtils.toString(v, this.nameResolver);
    const params = signature.parameters.map(p => `${p.name}: ${typeToString(p.type)} = ${valueToString(p.defaultValue)}`);
    return `${signature.name}(${params.join(", ")}): ${typeToString(signature.returnType)}`;
  }

  public printSignatures = (short: number = 0) => {
    const signatures = this.getSignatures();
    signatures.forEach(s => this.printSignatureWithColors(s, short));
  }

  private printSignatureWithColors = (signature: Signature, short: number) => {
    const typeToString = (t: Type) => this.getNameForType(t, {eraseBoundingTypes: true});
    const valueToString = (v: Value) => ValueUtils.toString(v, this.nameResolver);
    const color = (c: string) => `color: ${c};`;
    const params = signature.parameters.map(p => {
      if (short < 1) {
        return `%c${p.name}%c = ${valueToString(p.defaultValue)}%c: ${typeToString(p.type)}`;
      } else if (short < 2) {
        return `%c${p.name}%c = ${valueToString(p.defaultValue)}`;
      } else if (short < 3) {
        return `%c${p.name}%c: ${typeToString(p.type)}`;
      } else {
        return `%c${p.name}`;
      }
    });

    const paramColors = _.flatten(signature.parameters.map(p => {
      if (short < 1) {
        return [color("blue"), color("#666"), color("#999")];
      } else if (short < 2) {
        return [color("blue"), color("#999")];
      } else if (short < 3) {
        return [color("blue"), color("#999")];
      } else {
        return [color("blue")];
      }
    }));
    console.log(`%c${signature.name}(${params.join(", ")}): %c${typeToString(signature.returnType)}`, color("orange"), ...paramColors, color("green"));
  }
}