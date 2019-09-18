import * as _ from 'lodash';

import {LambdaUnres, UnresolvedAST} from '@language/ast';
import {buildNamespace, ValueNamespace} from '@language/name_resolver';
import {RelativeValueReference} from '@language/reference';
import {Identifier, LambdaType, PartialRowType, RowType, Type, TypeUtils}
        from '@language/types';
import {ValueResolver} from '@language/value_resolver';
import {LambdaValue, PartialRowValue, RowValue, Value} from '@language/values';
import {RODictionary} from '@utils/types';
import {ArrayUpdateDescriptor as ArrayUD} from '../collections/functional_array';
import {Constant} from '../core/constant';
import {Model, ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {SimpleUpdateManager, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ArrayUpdateType, ConstructorUpdateType, GridColumnUpdateType} from '../core/update_types';
import {GridColumns} from './grid';
import {GridColumnUpdateDescriptor} from './grid_column';
import {Row, RowUpdateDescriptor} from './row';

export interface ResolutionTimeTypeHelper {
  lambdaAsmtName: string,
  resolutionTimeAsmtDefaultValues: RODictionary<UnresolvedAST>,
  resolveLambdaType: (nonLambdaAsmtTypesByName: RODictionary<Type>) => LambdaType,
  resolveCallReturnType: (asmtTypesByName: RODictionary<Type>) => Type,
}

interface BaseConstructor<R extends Type, I extends Identifier = Identifier> {
  readonly id: string,
  readonly isConstructorLiteral: boolean,
  name: string,
  returnType: R,
  namespace: ValueNamespace,
  assignmentsType: PartialRowType<I>,
  eval: (valueResolver: ValueResolver, asmts: PartialRowValue<I>) => Value<R>;
  resolutionTimeTypeHelper?: ResolutionTimeTypeHelper,
}

export type Constructor<R extends Type = Type, I extends Identifier = Identifier> = BaseConstructor<R, I> & Model;

export interface ConstructorData<I extends Identifier = Identifier> {
  columns: GridColumns,
  defaultValues: Row,
  gridId: I,
  getName: () => string,
  namespace: ValueNamespace,
}

export interface ConstructorUpdateDescriptor extends UpdateDescriptor<ConstructorUpdateType> {}

export class GridConstructor<I extends Identifier = Identifier>
    extends Mutable<ConstructorUpdateDescriptor> implements BaseConstructor<RowType<I>, I> {
  private readonly columns: GridColumns;
  private readonly defaultValues: Row;
  private readonly gridId: I;
  private readonly getName: () => string;
  public readonly isConstructorLiteral = true;
  public readonly namespace: ValueNamespace;
  public readonly returnType: RowType<I>;
  public readonly assignmentsType: PartialRowType<I>;

  constructor(
    updateManager: UpdateManager,
    {columns, defaultValues, gridId, getName, namespace}: ConstructorData<I>,
    modelType: ModelType = ModelType.CONSTRUCTOR,
  ) {
    super(updateManager, modelType);
    this.columns = columns;
    this.defaultValues = defaultValues;
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
    const {columns, defaultValues, gridId} = this;
    const updateManager = new SimpleUpdateManager();
    const manualValues = _.extend({}, asmts.dict);
    const row = new Row(updateManager, {
      columns,
      defaultValues,
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
}


export type BuiltInEval<R extends Type = Type, I extends Identifier = Identifier> = (parameters: PartialRowValue<I>) => Value<R>;

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
  public readonly eval: (valueResolver: ValueResolver, asmts: PartialRowValue<I>) => Value<R>;
  public readonly resolutionTimeTypeHelper?: ResolutionTimeTypeHelper;

  constructor(formula: BuiltInFormulaSpec<R, I>) {
    super(formula.id);
    this.name = formula.name;
    this.returnType = formula.returnType;
    this.namespace = BuiltInFormula.buildNamespace(formula);
    this.assignmentsType = TypeUtils.PartialRowOf(formula.id);
    this.eval = (valueResolver: ValueResolver, asmts: PartialRowValue<I>) => formula.eval(asmts);
    this.resolutionTimeTypeHelper = formula.resolutionTimeTypeHelper;
  }

  private static buildNamespace = (formula: BuiltInFormulaSpec): ValueNamespace => {
    const nameToParameterMap = _.mapKeys(formula.parameters, 'name');
    const nameToReferenceMap = _.mapValues(nameToParameterMap, p => {
      return new RelativeValueReference(p.id, p.type, () => p.name);
    });
    return buildNamespace(nameToReferenceMap);
  }
}