import * as _ from 'lodash';

import {CoordinateSystem, GeometryUtils, Vector} from '@core/geometry';
import {CallRes, ResolvedAST, ResolvedASTUtils} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {TypeError} from '@language/language_errors';
import {NameResolver} from '@language/name_resolver';
import {Parser} from '@language/parser';
import {AbsoluteValueReference, Reference, ReferenceUtils, ValueDependency,
        ValueReference} from '@language/reference';
import {Identifier, RowType, Type, TypeUtils} from '@language/types';
import {ValueResolver} from '@language/value_resolver';
import {Value, ValueOrAST, ValueUtils} from '@language/values';
import {Address} from '@paths/address';
import {COORDINATE_SYSTEM_COLUMN_ID} from '@standard_library/geometry_utils';
import {RODictionary} from '@utils/types';
import {assert, keysDiff} from '@utils/utils';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {DependencyNode, DependencySetUpdateDescriptor, UpdateDescriptor, UpdateListener,
        UpdateManager} from '../core/update_manager';
import {CellUpdateType, DependencySetUpdateType, FormulaExpressionUpdateType}
        from '../core/update_types';
import {FormulaExpression, FormulaExpressionUpdateDescriptor} from './formula_expression';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {RowContext} from './row';

function isAST<T extends Type>(value: ValueOrAST<T> | undefined): value is ResolvedAST<T> {
  return value !== undefined && 'nodeType' in value;
}

function isCallAST<T extends Type>(value: ValueOrAST<T> | undefined): value is CallRes<T> {
  return isAST(value) && value instanceof CallRes;
}

interface CellData<T extends Type> {
  column: GridColumn<T>,
  defaultValue?: Cell<T>,
  getRowContext: () => RowContext,
  gridId: Identifier,
  manualValue?: ValueOrAST<T>, // a manualValue implies T extends SupportsLiteralsType
}

export interface CellUpdateDescriptor extends UpdateDescriptor<CellUpdateType> {}

export class Cell<T extends Type = Type> extends Mutable<CellUpdateDescriptor> {
  private readonly column: GridColumn<T>;
  private readonly defaultValue?: Cell<T>;
  private readonly getRowContext: () => RowContext;
  private readonly gridId: Identifier;
  private dependencies: RODictionary<DependencyNode>;
  private valueDependencies: RODictionary<ValueDependency>;
  private manualValue?: ValueOrAST<T>;
  private _value: Value<T>;
  private readonly permanentDependencies: DependencyNode[] = [];

  constructor(
    updateManager: UpdateManager,
    {column, defaultValue, getRowContext, gridId, manualValue}: CellData<T>,
    modelType: ModelType = ModelType.CELL,
  ) {
    super(updateManager, modelType);
    this.column = column;
    this.defaultValue = defaultValue;
    this.getRowContext = getRowContext;
    this.gridId = gridId;
    this.manualValue = manualValue;

    // updateDependencies expects a preexisting dependencies object to compare to
    this.dependencies = {};
    this.updateDependencies();

    this._value = this.computeValue();

    this.addPermanentListener(this.column, this.onColumnUpdated);

    const {type, nameResolver} = this.column;
    if (this.defaultValue) {
      this.addPermanentListener(this.defaultValue, this.onDefaultValueUpdated);
    } else if (TypeUtils.supportsLiterals(type)) {
      const builtInDefault = ValueUtils.getDefaultValue(type, nameResolver);
      if (isCallAST(builtInDefault)) {
      this.addPermanentListener(builtInDefault.procedure, this.onRootDefaultValueUpdated);
      }
    }

    // Need to listen to the formula container for dependency updates but this
    // is not enough: the formula might change without changing dependencies.
    this.formulaExpression.listenForDependencyUpdate(this, this.onFormulaExpressionUpdatedDependencies);
    this.addPermanentListener(this.formulaExpression, this.onFormulaExpressionUpdated);
  }

  private hasPermanentListener = (node: DependencyNode): boolean => {
    return this.permanentDependencies.includes(node);
  }

  private addPermanentListener = <D extends UpdateDescriptor, N extends DependencyNode<D>> (
    node: N, listener: UpdateListener<N, D, UpdateDescriptor>,
  ) => {
    if (!this.hasPermanentListener(node)) {
      node.listenForUpdate(this, listener);
      this.permanentDependencies.push(node);
    }
  }

  private addDynamicListener = <D extends UpdateDescriptor, N extends DependencyNode<D>> (
    node: N, listener: UpdateListener<N, D, UpdateDescriptor>,
  ) => {
    if (!this.hasPermanentListener(node)) {
      node.listenForUpdate(this, listener);
    }
  }

  private removeDynamicListener = (node: DependencyNode) => {
    if (!this.hasPermanentListener(node)) {
      node.removeUpdateListener(this);
    }
  }

  public get value(): Value<T> {
    return this._value;
  }

  public get rawValue(): ValueOrAST<T> {
    return this.isCalculated() ? this.value : this.getManualValueOrDefault();
  }

  public getDisplayValue = (): string => {
    const {nameResolver} = this.column;
    const rawValue = this.isCalculated() ? this.value : this.getManualValueOrDefault();
    return isAST(rawValue) ? rawValue.toText(nameResolver) : ValueUtils.toString(rawValue, nameResolver);
  }

  public valueIsDefault = (): boolean => {
    return this.manualValue === undefined && !this.isCalculated();
  }

  public get formulaExpression(): FormulaExpression<T> {
    return this.column.formulaExpression;
  }

  private get environment(): FormulaEnvironment {
    return this.column.environment;
  }

  public setManualValue = (value: ValueOrAST<T> | undefined) => {
    const {type} = this.column;
    if (value === this.manualValue) {
      return;
    }
    if (value !== undefined) {
      assert(!isAST(value) || value.isLiteral, "Manual values must be literals.");
      assert(TypeUtils.isAssignableTo(value.type, type, this.environment),
          `Cannot set manual value of type ${value.type} on cell of type ` +
          `${this.environment.getGlobalNamespace().typeToString(type)}.`, TypeError);

      if (isAST(value) && ResolvedASTUtils.isConstant(value)) {
        // can concretize early
        value = value.eval(this.getValueResolver());
      }
    }
    this.removeManualValueListeners();
    this.manualValue = value;
    this.addManualValueListeners();
    const descriptors = this.refreshValueAndGetUpdateDescriptors();
    if (descriptors.length) {
      this.onSelfMutated(descriptors);
    }
  }

  public writeToAddress = (value: Vector, editor: Address, target: Address) => {
    assert(TypeUtils.isRow(TypeUtils.getBaseType(this.column.type)), "Cannot move a non-shape value.");
    assert(!this.isCalculated(), "Cannot move a calculated value.");

    if (!editor.isEmpty()) {
      throw new Error("Moving shapes inside lists or other shapes is not yet supported.");
    }
    assert(TypeUtils.isRow(this.column.type), "Cell-level address does not match cell type.");

    /*
    const currentAsmts = currentValue.getAssignments().getAssignments();
    const currentCoords = currentAsmts[COORDINATE_SYSTEM_COLUMN_ID] as CallRes<RowType> | undefined;
    */
    const coordinates = GeometryUtils.coordinateSystemOf(value, GeometryUtils.defaultScalar, GeometryUtils.defaultRotation);
    this.setCoordinates(coordinates);
  }

  private setCoordinates = (coordinates: CoordinateSystem) => {
    const ast = Cell.makeCoordinatesAST(coordinates, this.column.nameResolver);
    const asmtUpdates = {[COORDINATE_SYSTEM_COLUMN_ID]: ast};
    const currentValue = this.getManualValueOrDefault() as CallRes<T>;
    const newValue = currentValue.withAssignments(asmtUpdates);
    this.setManualValue(newValue);
  }

  private static makeCoordinatesAST = (coordinates: CoordinateSystem, resolver: NameResolver): ResolvedAST<RowType> => {
    const {x, y} = coordinates.center;
    const xx = Parser.sanitizeJSNumberForParsing(x);
    const yy = Parser.sanitizeJSNumberForParsing(y);
    const parsed = Parser.parseLiteral(`'Coordinate System'(Center=Vector(X=${xx},Y=${yy}))`, TypeUtils.RowOf("any"));
    if (parsed.succeeded) {
      return parsed.ast.resolve(resolver) as ResolvedAST<RowType>;
    }
    throw new Error("Failed to construct coordinates AST.");
  }

  private addManualValueListeners = () => {
    if (isCallAST(this.manualValue)) {
      this.addDynamicListener(this.manualValue.procedure, this.onValueProcedureUpdated);
    }
  }

  private removeManualValueListeners = () => {
    if (isCallAST(this.manualValue)) {
      this.removeDynamicListener(this.manualValue.procedure);
    }
  }

  private resolveDependencies = (dependencyRefs: readonly Reference[]): RODictionary<DependencyNode> => {
    const absoluteReferences = dependencyRefs.filter(ReferenceUtils.isAbsoluteReference);
    const relativeReferences = dependencyRefs.filter(ReferenceUtils.isRelativeReference);
    const absoluteDependenciesList = absoluteReferences.map(r => r.model);
    const absoluteDependencies = _.mapKeys(absoluteDependenciesList, d => d.id);
    const relativeDependencies = _.pick(this.getRowContext(), relativeReferences.map(r => r.id));
    return _.extend({}, absoluteDependencies, relativeDependencies);
  }

  // Duplicate functionality of resolveDependencies in order to get stricter typing
  private resolveValueDependencies = (dependencyRefs: readonly ValueReference[]): RODictionary<ValueDependency> => {
    const absoluteReferences = dependencyRefs.filter(ReferenceUtils.isAbsoluteReference) as AbsoluteValueReference[];
    const relativeReferences = dependencyRefs.filter(ReferenceUtils.isRelativeReference);
    const absoluteDependenciesList = absoluteReferences.map(r => r.model);
    const absoluteDependencies = _.mapKeys(absoluteDependenciesList, d => d.id);
    const relativeDependencies = _.pick(this.getRowContext(), relativeReferences.map(r => r.id));
    return _.extend({}, absoluteDependencies, relativeDependencies);
  }

  // TODO - Clean up dependency management! Need to guarantee that fixed dependencies
  // never get lost during dynamic dependency updating.
  private updateDependencies = (): DependencySetUpdateDescriptor[] => {
    const oldDependencies = this.dependencies;
    const dependencyRefs = this.formulaExpression.dependencies;
    const valueDependencyRefs = dependencyRefs.filter(ReferenceUtils.isValueReference);
    this.dependencies = this.resolveDependencies(dependencyRefs);
    this.valueDependencies = this.resolveValueDependencies(valueDependencyRefs);
    const {removedIds, addedIds} = keysDiff(oldDependencies, this.dependencies);
    if (removedIds.length || addedIds.length) {
      removedIds.forEach(id => this.removeDynamicListener(oldDependencies[id]));
      addedIds.forEach(id => this.addDynamicListener(this.dependencies[id], this.onValueDependencyUpdated));
      return [{type: DependencySetUpdateType.DEPENDENCY_SET_UPDATED}];
    }
    return [];
  }

  private onColumnUpdated = (epoch: number, updates: GridColumnUpdateDescriptor[]): CellUpdateDescriptor[] => {
    // for now do nothing
    return [];
  }

  private onValueProcedureUpdated = (epoch: number, updates: UpdateDescriptor[]): CellUpdateDescriptor[] => {
    return this.onDependencyUpdatedHelper(epoch);
  }

  private onDefaultValueUpdated = (epoch: number, updates: CellUpdateDescriptor[]): CellUpdateDescriptor[] => {
    return this.onDependencyUpdatedHelper(epoch);
  }

  private onRootDefaultValueUpdated = (epoch: number, updates: UpdateDescriptor[]): CellUpdateDescriptor[] => {
    return this.onDependencyUpdatedHelper(epoch);
  }

  private onFormulaExpressionUpdatedDependencies = (
    updates: FormulaExpressionUpdateDescriptor[],
  ): DependencySetUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED);
    return formulaUpdated ? this.updateDependencies() : [];
  }

  private onFormulaExpressionUpdated = (
    epoch: number,
    updates: FormulaExpressionUpdateDescriptor[],
  ): CellUpdateDescriptor[] => {
    const formulaUpdated = updates.some(u => u.type === FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED);
    return formulaUpdated ? this.onDependencyUpdatedHelper(epoch) : [];
  }

  public onDependencySetUpdated = (
    epoch: number,
    updates: DependencySetUpdateDescriptor[],
  ): CellUpdateDescriptor[] => {
    // For now all dependency set updates are formula container updates. These
    // are already handled by the update-cycle listener on formula container so
    // no need to handle them here.
    return [];
  }

  private onValueDependencyUpdated = (epoch: number, updates: UpdateDescriptor[]): CellUpdateDescriptor[] => {
      return this.onDependencyUpdatedHelper(epoch);
  }

  private onDependencyUpdatedHelper = (epoch: number): CellUpdateDescriptor[] => {
    const descriptors = this.refreshValueAndGetUpdateDescriptors();
    if (descriptors.length) {
      this.onDependencyUpdated(epoch);
      return descriptors;
    }
    return [];
  }

  private refreshValueAndGetUpdateDescriptors = (): CellUpdateDescriptor[]  => {
    const newValue = this.computeValue();
    if (ValueUtils.areEqual(this._value, newValue)) {
      return [];
    }
    this._value = newValue;
    return [{type: CellUpdateType.VALUE_UPDATED}];
  }

  private getValueResolver = (): ValueResolver => {
    const dependencyValues = _.mapValues(this.valueDependencies, r => r.value);
    return new ValueResolver(dependencyValues, this.environment);
  }

  private isCalculated = (): boolean => {
    return this.formulaExpression.isSet;
  }

  private getManualValueOrDefault = (): ValueOrAST<T> => {
    return this.manualValue === undefined ? this.getDefaultValue() : this.manualValue;
  }

  private getDefaultValue = (): ValueOrAST<T> => {
    const {type, nameResolver} = this.column;
    if (this.defaultValue) {
      return this.defaultValue.rawValue;
    } else if (TypeUtils.supportsLiterals(type)) {
      // Unclear why TS can't figure this one out in some environments...
      return ValueUtils.getDefaultValue(type, nameResolver) as ValueOrAST<T>;
    }
    throw new Error(`Default value is not supported for type ${type}`);
  }

  private computeValue = (): Value<T> => {
    const {formulaExpression} = this;
    if (this.isCalculated()) {
      return formulaExpression.eval(this.getValueResolver());
    }
    const localValue = this.getManualValueOrDefault();
    return isAST(localValue) ? localValue.eval(this.getValueResolver()) : localValue;
  }
}
