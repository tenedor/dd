import * as _ from 'lodash';

import {ResolvedAST, ResolvedASTUtils} from '@language/ast';
import {AbsoluteValueReference, ModelWithValue, Reference, ReferenceUtils,
        ValueReference} from '@language/reference';
import {Identifier, Type, TypeUtils} from '@language/types';
import {ValueResolver} from '@language/value_resolver';
import {Value, ValueOrAST, ValueUtils} from '@language/values';
import {RODictionary} from '@utils/types';
import {assert, keysDiff} from '@utils/utils';
import {Model, ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {DependencySetUpdateDescriptor, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {CellUpdateType, DependencySetUpdateType, FormulaExpressionUpdateType} from '../core/update_types';
import {FormulaExpression, FormulaExpressionUpdateDescriptor} from './formula_expression';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {RowContext} from './row';

function isAST<T extends Type>(value: ValueOrAST<T> | undefined): value is ResolvedAST<T> {
  return value !== undefined && 'nodeType' in value;
}

interface CellData<T extends Type> {
  column: GridColumn<T>,
  defaultValue?: Cell<T>,
  getRowContext: () => RowContext,
  gridId: Identifier,
  manualValue?: ValueOrAST<T>,
}

export interface CellUpdateDescriptor extends UpdateDescriptor<CellUpdateType> {}

export class Cell<T extends Type = Type> extends Mutable<CellUpdateDescriptor> {
  private readonly column: GridColumn<T>;
  private readonly defaultValue?: Cell<T>;
  private readonly getRowContext: () => RowContext;
  private readonly gridId: Identifier;
  private dependencies: RODictionary<Model>;
  private valueDependencies: RODictionary<ModelWithValue>;
  private manualValue?: ValueOrAST<T>;
  private _value: Value<T>;

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

    this.column.listenForUpdate(this, this.onColumnUpdated);

    if (this.defaultValue) {
      this.defaultValue.listenForUpdate(this, this.onDefaultValueUpdated);
    }

    // Need to listen to the formula container for dependency updates but this
    // is not enough: the formula might change without changing dependencies.
    this.formulaExpression.listenForDependencyUpdate(this, this.onFormulaExpressionUpdatedDependencies);
    this.formulaExpression.listenForUpdate(this, this.onFormulaExpressionUpdated);
  }

  public get value(): Value<T> {
    return this._value;
  }

  public getDisplayValue = (): string => {
    const {nameResolver} = this.column;
    const rawValue = this.isCalculated() ? this.value : this.getManualValueOrDefault();
    return isAST(rawValue) ? rawValue.toText(nameResolver) : ValueUtils.toString(rawValue, nameResolver);
  }

  public get formulaExpression(): FormulaExpression<T> {
    return this.column.formulaExpression;
  }

  public setManualValue = (value: ValueOrAST<T> | undefined) => {
    const {type} = this.column;
    if (value !== undefined) {
      assert(!isAST(value) || value.isLiteral, "Manual values must be literals.");
      assert(TypeUtils.isAssignableTo(value.type, type), "Cannot set manual value of " +
          `type ${value.type} on cell of type ${TypeUtils.toString(type)}.`);

      if (isAST(value) && ResolvedASTUtils.isConstant(value)) {
        // can concretize early
        value = value.eval(this.getValueResolver());
      }
    }
    this.manualValue = value;
    const descriptors = this.refreshValueAndGetUpdateDescriptors();
    if (descriptors.length) {
      this.onSelfMutated(descriptors);
    }
  }

  private resolveDependencies = (dependencyRefs: readonly Reference[]): RODictionary<Model> => {
    const absoluteReferences = dependencyRefs.filter(ReferenceUtils.isAbsoluteReference);
    const relativeReferences = dependencyRefs.filter(ReferenceUtils.isRelativeReference);
    const absoluteDependenciesList = absoluteReferences.map(r => r.model);
    const absoluteDependencies = _.mapKeys(absoluteDependenciesList, d => d.id);
    const relativeDependencies = _.pick(this.getRowContext(), relativeReferences.map(r => r.id));
    return _.extend({}, absoluteDependencies, relativeDependencies);
  }

  // Duplicate functionality of resolveDependencies in order to get stricter typing
  private resolveValueDependencies = (dependencyRefs: readonly ValueReference[]): RODictionary<ModelWithValue> => {
    const absoluteReferences = dependencyRefs.filter(ReferenceUtils.isAbsoluteReference) as AbsoluteValueReference[];
    const relativeReferences = dependencyRefs.filter(ReferenceUtils.isRelativeReference);
    const absoluteDependenciesList = absoluteReferences.map(r => r.model);
    const absoluteDependencies = _.mapKeys(absoluteDependenciesList, d => d.id);
    const relativeDependencies = _.pick(this.getRowContext(), relativeReferences.map(r => r.id));
    return _.extend({}, absoluteDependencies, relativeDependencies);
  }

  private updateDependencies = (): DependencySetUpdateDescriptor[] => {
    const oldDependencies = this.dependencies;
    const dependencyRefs = this.formulaExpression.dependencies;
    const valueDependencyRefs = dependencyRefs.filter(ReferenceUtils.isValueReference);
    this.dependencies = this.resolveDependencies(dependencyRefs);
    this.valueDependencies = this.resolveValueDependencies(valueDependencyRefs);
    const {removedIds, addedIds} = keysDiff(oldDependencies, this.dependencies);
    if (removedIds.length || addedIds.length) {
      removedIds.forEach(id => oldDependencies[id].removeUpdateListener(this));
      addedIds.forEach(id => this.dependencies[id].listenForUpdate(this, this.onValueDependencyUpdated));
      return [{type: DependencySetUpdateType.DEPENDENCY_SET_UPDATED}];
    }
    return [];
  }

  private onColumnUpdated = (epoch: number, updates: GridColumnUpdateDescriptor[]): CellUpdateDescriptor[] => {
    // for now do nothing
    return [];
  }

  private onDefaultValueUpdated = (epoch: number, updates: CellUpdateDescriptor[]): CellUpdateDescriptor[] => {
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

  private onValueDependencyUpdated = (epoch: number, updates: CellUpdateDescriptor[]): CellUpdateDescriptor[] => {
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
    return new ValueResolver(dependencyValues);
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
      return this.defaultValue.value;
    } else if (TypeUtils.supportsLiterals(type)) {
      return ValueUtils.getDefaultValue(type, nameResolver);
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
