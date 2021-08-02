import * as _ from 'lodash';

import {CoordinateSystem, GeometryUtils, Vector} from '@core/geometry';
import {CallRes, ResolvedAST, ResolvedASTUtils, TypeEnvironmentWithProcedures}
        from '@language/ast';
import {ObjectResolutionError, TypeError, ValueResolutionError} from '@language/language_errors';
import {Parser} from '@language/parser';
import {DictReferenceResolver} from '@language/reference/dict_reference_resolver';
import {Namespace} from '@language/reference/namespace';
import {ProcedureReference, Reference, ReferenceUtils, ValueDependency, ValueReference}
        from '@language/reference/reference';
import {ReferenceResolver, ReferenceResolverUtils}
        from '@language/reference/reference_resolver';
import {Identifier, RowType, Type, TypeUtils} from '@language/types';
import {Value, ValueOrAST, ValueUtils} from '@language/values';
import {Address} from '@paths/address';
import {COORDINATE_SYSTEM_COLUMN_ID} from '@standard_library/geometry_utils';
import {Dictionary, RODictionary} from '@utils/types';
import {assert, ifDefined, keysDiff} from '@utils/utils';
import {DependencyNode, DependencySetUpdateDescriptor, UpdateDescriptor, UpdateListener}
        from '../core/dependency_node';
import {ModelType} from '../core/model';
import {Mutable, MutableOptions} from '../core/mutable';
import {UpdateManager} from '../core/update_manager';
import {CellUpdateType, DependencySetUpdateType, FormulaExpressionUpdateType}
        from '../core/update_types';
import {FormulaExpression, FormulaExpressionUpdateDescriptor} from './formula_expression';
import {GridColumn, GridColumnUpdateDescriptor} from './grid_column';
import {Procedure} from './procedure';
import {RowContext} from './row_context';
import {SerializedCell} from './serialization';

function isAST<T extends Type>(value: ValueOrAST<T> | undefined): value is ResolvedAST<T> {
  return value !== undefined && 'nodeType' in value;
}

function isCallAST<T extends Type>(value: ValueOrAST<T> | undefined): value is CallRes<T> {
  return isAST(value) && value instanceof CallRes;
}

interface CellData<T extends Type> {
  column: GridColumn<T>,
  defaultValue?: Cell<T>,
  rowContext: RowContext,
  gridId: Identifier,
  manualValue?: ValueOrAST<T>, // a manualValue implies T extends SupportsLiteralsType
}

interface CellHydrationAuxiliaryData<T extends Type> {
  column: GridColumn<T>,
  defaultValue?: Cell<T>,
  rowContext: RowContext,
  gridId: Identifier,
}

export interface CellUpdateDescriptor extends UpdateDescriptor<CellUpdateType> {}

export class Cell<T extends Type = Type> extends Mutable<CellUpdateDescriptor> {
  private readonly column: GridColumn<T>;
  private readonly defaultValue?: Cell<T>;
  private readonly rowContext: RowContext;
  private readonly gridId: Identifier;
  private formulaDependencies: RODictionary<DependencyNode>;
  private rowValueFormulaDependencies: RODictionary<ValueDependency>;
  private manualValue?: ValueOrAST<T>;
  private _value: Value<T>;
  private readonly permanentDependencies: DependencyNode[] = [];

  constructor(
    updateManager: UpdateManager,
    {column, defaultValue, rowContext, gridId, manualValue}: CellData<T>,
    opts: MutableOptions,
    modelType: ModelType = ModelType.CELL,
  ) {
    super(updateManager, opts, modelType);
    this.column = column;
    this.defaultValue = defaultValue;
    this.rowContext = rowContext;
    this.gridId = gridId;
    this.manualValue = manualValue;
  }

  protected initInner(): void {
    super.initInner();

    this.addPermanentListener(this.column, this.onColumnUpdated);

    const {type} = this.column;
    if (this.defaultValue) {
      this.addPermanentListener(this.defaultValue, this.onDefaultValueUpdated);
    } else if (TypeUtils.supportsLiterals(type)) {
      const resolver = this.column.getGlobalReferenceResolver();
      const builtInDefault = ValueUtils.getDefaultValue(type, resolver);
      if (isCallAST(builtInDefault)) {
        const procedure = ReferenceResolverUtils.resolveProcedureOrThrow(builtInDefault.procedureRef, resolver);
        this.addPermanentListener(procedure, this.onRootDefaultValueUpdated);
      }
    }

    // Need to listen to the formula container for dependency updates but this
    // is not enough: the formula might change without changing dependencies.
    this.addPermanentListener(this.formulaExpression, this.onFormulaExpressionUpdated);
    this.formulaExpression.listenForDependencyUpdate(this, this.onFormulaExpressionUpdatedDependencies);

    this.updateFormulaDependencies();
    this.addManualValueListeners();

    this._value = this.computeValue();
  }

  public serialize = (): SerializedCell => {
    const {id, epoch, column} = this;
    const {columnId} = column;
    const manualValue = ifDefined(this.manualValue, serializeValue);
    return {id, epoch, columnId, manualValue};
  }

  public static hydrate = <T extends Type>(serializedCell: SerializedCell, updateManager: UpdateManager,
      {column, defaultValue, rowContext, gridId}: CellHydrationAuxiliaryData<T>): Cell<T> => {
    const {id, epoch, manualValue: serializedValue} = serializedCell;
    const manualValue = ifDefined(serializedValue, hydrateValue);
    return new Cell(updateManager, {column, defaultValue, rowContext, gridId, manualValue}, {id, epoch});
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
    const {namespace} = this.column;
    const rawValue = this.isCalculated() ? this.value : this.getManualValueOrDefault();
    return isAST(rawValue) ? rawValue.toText(namespace) : ValueUtils.toString(rawValue, namespace);
  }

  public valueIsDefault = (): boolean => {
    return this.manualValue === undefined && !this.isCalculated();
  }

  public get formulaExpression(): FormulaExpression<T> {
    return this.column.formulaExpression;
  }

  private get environment(): TypeEnvironmentWithProcedures {
    return this.column.environment;
  }

  private get globalReferenceResolver(): ReferenceResolver {
    return this.column.getGlobalReferenceResolver();
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
          `${this.environment.typeToString(type)}.`, TypeError);

      if (isAST(value) && ResolvedASTUtils.isConstant(value)) {
        // can concretize early
        value = value.eval(this.getDependenciesResolver());
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
    const {namespace, environment} = this.column;
    const ast = Cell.makeCoordinatesAST(coordinates, namespace, environment);
    const asmtUpdates = {[COORDINATE_SYSTEM_COLUMN_ID]: ast};
    const currentValue = this.getManualValueOrDefault() as CallRes<T>;
    const newValue = currentValue.withAssignments(asmtUpdates);
    this.setManualValue(newValue);
  }

  private static makeCoordinatesAST = (
    coordinates: CoordinateSystem,
    namespace: Namespace,
    environment: TypeEnvironmentWithProcedures,
  ): ResolvedAST<RowType> => {
    const {x, y} = coordinates.center;
    const xx = Parser.sanitizeJSNumberForParsing(x);
    const yy = Parser.sanitizeJSNumberForParsing(y);
    const parsed = Parser.parseLiteral(`'Coordinate System'(Center=Vector(X=${xx},Y=${yy}))`, TypeUtils.RowOf("any"));
    if (parsed.succeeded) {
      return parsed.ast.resolve(namespace, environment) as ResolvedAST<RowType>;
    }
    throw new Error("Failed to construct coordinates AST.");
  }

  private addManualValueListeners = () => {
    if (isCallAST(this.manualValue)) {
      const procedure = this.resolveProcedureRef(this.manualValue.procedureRef);
      this.addDynamicListener(procedure, this.onValueProcedureUpdated);
    }
  }

  private removeManualValueListeners = () => {
    if (isCallAST(this.manualValue)) {
      const procedure = this.resolveProcedureRef(this.manualValue.procedureRef);
      this.removeDynamicListener(procedure);
    }
  }

  private resolveProcedureRef = (procedureRef: ProcedureReference<T>): Procedure<T> => {
      return ReferenceResolverUtils.resolveProcedureOrThrow(procedureRef, this.globalReferenceResolver);
  }

  private resolveDependencies = (dependencyRefs: readonly Reference[]): RODictionary<DependencyNode> => {
    const procedureReferences = dependencyRefs.filter(ReferenceUtils.isProcedureReference);
    const valueReferences = dependencyRefs.filter(ReferenceUtils.isValueReference);
    if (procedureReferences.length + valueReferences.length !== dependencyRefs.length) {
      throw new ObjectResolutionError(`Cell dependency resolution error: reference counts ` +
        `for procedures (${procedureReferences.length}) and values (${valueReferences.length}) ` +
        `do not add up to total (${dependencyRefs.length})`);
    }

    const procedureDependencies = procedureReferences.map(r =>
        ReferenceResolverUtils.resolveProcedureOrThrow(r, this.globalReferenceResolver));
    const valueDependencies = this.resolveRowValueDependencies(valueReferences);
    return _.extend({}, procedureDependencies, valueDependencies);
  }

  private resolveRowValueDependencies = (valueDependencyRefs: readonly ValueReference[]): RODictionary<ValueDependency> => {
    const {rowContext} = this;

    // for now all value dependencies should be row-value references, so error if any don't match
    const rowValueDependencyReferences = valueDependencyRefs;

    const dependencies: Dictionary<ValueDependency> = {};
    for (const r of rowValueDependencyReferences) {
      const cell = rowContext.getCell(r.id);
      if (cell === undefined) {
        throw new ValueResolutionError(`Could not resolve value reference ${r.id} in row context.`);
      }
      dependencies[r.id] = cell;
    }

    return dependencies;
  }

  // FIXME
  //
  // Clean up dependency management! Need to guarantee that no problems arise
  // from binding a dependency twice among dynamic dependencies (e.g. formula,
  // manual value) and fixed dependencies. Must avoid removing a dependency
  // that is still referenced elsewhere. Also, Mutable currently only allows
  // one callback per listener - should it?
  private updateFormulaDependencies = (): DependencySetUpdateDescriptor[] => {
    const oldDependencies = this.formulaDependencies || {};
    const dependencyRefs = this.formulaExpression.dependencies;
    const valueDependencyRefs = dependencyRefs.filter(ReferenceUtils.isValueReference);
    this.formulaDependencies = this.resolveDependencies(dependencyRefs);
    this.rowValueFormulaDependencies = this.resolveRowValueDependencies(valueDependencyRefs);
    const {removedIds, addedIds} = keysDiff(oldDependencies, this.formulaDependencies);
    if (removedIds.length || addedIds.length) {
      removedIds.forEach(id => this.removeDynamicListener(oldDependencies[id]));
      addedIds.forEach(id => this.addDynamicListener(this.formulaDependencies[id], this.onValueDependencyUpdated));
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
    return formulaUpdated ? this.updateFormulaDependencies() : [];
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

  private getDependenciesResolver = (): DictReferenceResolver => {
    const rowDependencyValues = _.mapValues(this.rowValueFormulaDependencies, r => r.value);
    const rowDependencies = ValueUtils.partialRowOf(rowDependencyValues, this.gridId);
    return new DictReferenceResolver(this.globalReferenceResolver, rowDependencies);
  }

  private isCalculated = (): boolean => {
    return this.formulaExpression.isSet;
  }

  private getManualValueOrDefault = (): ValueOrAST<T> => {
    return this.manualValue === undefined ? this.getDefaultValue() : this.manualValue;
  }

  private getDefaultValue = (): ValueOrAST<T> => {
    const {type} = this.column;
    if (this.defaultValue) {
      return this.defaultValue.rawValue;
    } else if (TypeUtils.supportsLiterals(type)) {
      // Unclear why TS can't figure this one out in some environments...
      return ValueUtils.getDefaultValue(type, this.globalReferenceResolver) as ValueOrAST<T>;
    }
    throw new Error(`Default value is not supported for type ${type}`);
  }

  private computeValue = (): Value<T> => {
    const {formulaExpression} = this;
    if (this.isCalculated()) {
      return formulaExpression.eval(this.getDependenciesResolver());
    }
    const localValue = this.getManualValueOrDefault();
    return isAST(localValue) ? localValue.eval(this.getDependenciesResolver()) : localValue;
  }
}
