import * as _ from 'lodash';

import {ResolutionTimeTypeHelper} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {buildNamespace, ValueNamespace} from '@language/name_resolver';
import {RelativeValueReference} from '@language/reference';
import {Identifier, PartialRowType, RowType, Type, TypeUtils} from '@language/types';
import {ValueResolver} from '@language/value_resolver';
import {PartialRowValue, RowValue, Value, ValueUtils} from '@language/values';
import {ROArray, RODictionary} from '@utils/types';
import {ArrayUpdateDescriptor as ArrayUD} from '../collections/functional_array';
import {Constant} from '../core/constant';
import {Model, ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {SimpleUpdateManager, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ArrayUpdateType, ConstructorUpdateType, GridColumnUpdateType} from '../core/update_types';
import {Drawing} from './drawing';
import {GridColumns} from './grid';
import {GridColumnUpdateDescriptor} from './grid_column';
import {Row, RowUpdateDescriptor} from './row';

export interface Signature {
  name: string,
  parameters: ROArray<{name: string, type: Type, defaultValue: Value}>,
  returnType: Type,
}

interface BaseConstructor<R extends Type, I extends Identifier = Identifier> {
  readonly id: string,
  readonly isConstructorLiteral: boolean,
  name: string,
  returnType: R,
  namespace: ValueNamespace,
  assignmentsType: PartialRowType<I>,
  eval: (valueResolver: ValueResolver, asmts: PartialRowValue<I>, runtimeResolvedReturnType?: Type) => Value<R>;
  resolutionTimeTypeHelper?: ResolutionTimeTypeHelper,
  getSignature: () => Signature,
}

export type Constructor<R extends Type = Type, I extends Identifier = Identifier> = BaseConstructor<R, I> & Model;

export interface ConstructorData<I extends Identifier = Identifier> {
  columns: GridColumns,
  defaultValues: Row,
  environment: FormulaEnvironment,
  getPrimitiveDrawing?: (cells: RODictionary<Value>) => Drawing,
  gridId: I,
  getName: () => string,
  namespace: ValueNamespace,
}

export interface ConstructorUpdateDescriptor extends UpdateDescriptor<ConstructorUpdateType> {}

export class GridConstructor<I extends Identifier = Identifier>
    extends Mutable<ConstructorUpdateDescriptor> implements BaseConstructor<RowType<I>, I> {
  private readonly columns: GridColumns;
  private readonly defaultValues: Row;
  private readonly environment: FormulaEnvironment;
  private readonly getPrimitiveDrawing?: (cells: RODictionary<Value>) => Drawing;
  private readonly gridId: I;
  private readonly getName: () => string;
  public readonly isConstructorLiteral = true;
  public readonly namespace: ValueNamespace;
  public readonly returnType: RowType<I>;
  public readonly assignmentsType: PartialRowType<I>;

  constructor(
    updateManager: UpdateManager,
    {columns, defaultValues, environment, getPrimitiveDrawing, gridId, getName, namespace}: ConstructorData<I>,
    modelType: ModelType = ModelType.CONSTRUCTOR,
  ) {
    super(updateManager, modelType);
    this.columns = columns;
    this.defaultValues = defaultValues;
    this.environment = environment;
    this.getPrimitiveDrawing = getPrimitiveDrawing;
    this.gridId = gridId;
    this.getName = getName;
    this.namespace = namespace;
    this.returnType = TypeUtils.RowOf(gridId);
    this.assignmentsType = TypeUtils.PartialRowOf(gridId);

    this.columns.listenForUpdate(this, this.onColumnsUpdated);
    this.defaultValues.listenForUpdate(this, this.onDefaultValuesUpdated);
  }

  public get name(): string {
    return this.getName();
  }

  public eval = (valueResolver: ValueResolver, asmts: PartialRowValue<I>): RowValue<I> => {
    const {columns, defaultValues, environment, getPrimitiveDrawing, gridId} = this;
    const updateManager = new SimpleUpdateManager();
    const manualValues = _.extend({}, asmts.dict);
    const row = new Row(updateManager, {
      columns,
      defaultValues,
      environment,
      getPrimitiveDrawing,
      gridId,
      manualValues,
    });
    return row.asValue();
  }

  private onColumnsUpdated = (
    epoch: number,
    updates: Array<ArrayUD<GridColumnUpdateDescriptor>>,
  ): ConstructorUpdateDescriptor[] => {
    if (this.schemaUpdated(updates)) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: ConstructorUpdateType.SCHEMA_UPDATED};
      return [descriptor];
    }
    return [];
  }

  private onDefaultValuesUpdated = (
    epoch: number,
    updates: RowUpdateDescriptor[],
  ): ConstructorUpdateDescriptor[] => {
      this.onDependencyUpdated(epoch);
      return [{type: ConstructorUpdateType.DEFAULT_VALUES_UPDATED}];
  }

  private schemaUpdated = (updates: Array<ArrayUD<GridColumnUpdateDescriptor>>): boolean => {
    const columnSetChangeDescriptors: ArrayUpdateType[] = [
      ArrayUpdateType.ELEMENT_INSERTED,
      ArrayUpdateType.ELEMENT_DELETED,
    ];
    const columnSchemaChangeDescriptors: GridColumnUpdateType[] = [
      GridColumnUpdateType.FORMULA_EXPRESSION_UPDATED,
    ];
    return updates.some(a => {
      if (columnSetChangeDescriptors.includes(a.type)) {
        return true;
      }
      return a.elementDescriptors.some(c => columnSchemaChangeDescriptors.includes(c.type));
    });
  }

  public getSignature = (): Signature => {
    const {name} = this;
    const parameterIds = this.columns.a.filter(c => !c.hasExpression()).map(c => c.columnId);
    const parameters = parameterIds.map(id => {
      const column = this.columns.getByKey(id)!;
      const defaultValue = this.defaultValues.cells.get(id)!.value;
      return {name: column.name, type: column.type, defaultValue};
    });
    const returnType = TypeUtils.RowOf(this.gridId);
    return {name, parameters, returnType};
  }
}


export type BuiltInEval<R extends Type = Type, I extends Identifier = Identifier> =
  (parameters: PartialRowValue<I>, runtimeResolvedReturnType?: Type) => Value<R>;

export interface Parameter<T extends Type = Type> {
  readonly id: Identifier,
  readonly name: string,
  readonly type: T,
  readonly defaultValue: Value<T>,
}

export interface BuiltInFormulaSpec<R extends Type = Type, I extends Identifier = Identifier> {
  readonly id: I,
  readonly name: string,
  readonly returnType: R,
  readonly parameters: Readonly<{[id: string]: Parameter}>,
  readonly eval: BuiltInEval<R, I>,
  readonly resolutionTimeTypeHelper?: ResolutionTimeTypeHelper,
}

export class BuiltInFormula<R extends Type = Type, I extends Identifier = Identifier>
    extends Constant implements BaseConstructor<R, I> {
  public readonly name: string;
  public readonly isConstructorLiteral = false;
  public readonly returnType: R;
  public readonly namespace: ValueNamespace;
  public readonly assignmentsType: PartialRowType<I>;
  public readonly eval: (valueResolver: ValueResolver, asmts: PartialRowValue<I>, runtimeResolvedReturnType?: Type) => Value<R>;
  public readonly resolutionTimeTypeHelper?: ResolutionTimeTypeHelper;
  private readonly signature: Signature;

  constructor(formula: BuiltInFormulaSpec<R, I>) {
    super(formula.id);
    this.name = formula.name;
    this.returnType = formula.returnType;
    this.namespace = BuiltInFormula.buildNamespace(formula.parameters);
    this.assignmentsType = TypeUtils.PartialRowOf(formula.id);
    this.eval = (valueResolver: ValueResolver, asmts: PartialRowValue<I>, runtimeResolvedReturnType?: Type) =>
        formula.eval(asmts, runtimeResolvedReturnType);
    this.resolutionTimeTypeHelper = formula.resolutionTimeTypeHelper;
    this.signature = BuiltInFormula.buildSignature(formula);
  }

  private static buildNamespace = (parameters: {[id: string]: Parameter}): ValueNamespace => {
    const nameToParameterMap = _.mapKeys(parameters, 'name');
    const nameToReferenceMap = _.mapValues(nameToParameterMap, p => {
      return new RelativeValueReference(p.id, p.type, () => p.name);
    });
    return buildNamespace(nameToReferenceMap);
  }

  private static buildSignature = (formula: BuiltInFormulaSpec): Signature => {
    const {name, returnType} = formula;
    const parameters = Object.values(formula.parameters);
    return {name, parameters, returnType};
  }

  public getSignature = (): Signature => {
    return this.signature;
  }
}