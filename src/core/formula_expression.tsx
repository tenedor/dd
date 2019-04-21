import {ROArray} from 'src/utils/types';
import {BaseModel, ModelType} from './base_model';
import {FormulaEnvironment} from './formula_environment';
import {ExpressionRes} from './language/ast';
import {Context, Reference} from './language/reference';
import {Type, TypeUtils} from './language/types';
import {DictValue, Value} from './language/values';
import {DependencyGraphPartitionIndex, UpdateDescriptor, UpdateManager} from './update_manager';
import {FormulaExpressionUpdateType} from './update_types';

interface FormulaExpressionData<T extends Type, P extends Type> {
  type: T;
  formulaEnvironment: FormulaEnvironment;
  parent?: FormulaExpression<P>;
}

export interface FormulaExpressionUpdateDescriptor extends UpdateDescriptor<FormulaExpressionUpdateType> {}

export class FormulaExpression<T extends Type = Type, P extends Type = Type> extends BaseModel<FormulaExpressionUpdateDescriptor> {
  public readonly dependencyGraphPartitionIndex = DependencyGraphPartitionIndex.FORMULA;
  private readonly type: T;
  private readonly formulaEnvironment: FormulaEnvironment;
  private _expression?: ExpressionRes<T>;
  private readonly parent?: FormulaExpression<P>;

  constructor(
    updateManager: UpdateManager,
    {type, formulaEnvironment, parent}: FormulaExpressionData<T, P>,
    namespace: ModelType = ModelType.FORMULA_EXPRESSION,
  ) {
    super(updateManager, namespace);
    this.type = type;
    this.formulaEnvironment = formulaEnvironment;
    this.parent = parent;

    if (this.parent) {
      this.parent.listenForUpdate(this, this.onParentUpdated);
    }
  }

  private get expression(): ExpressionRes<T> | undefined {
    if (this._expression) {
      return this._expression;
    } else if (this.parent && this.parent.expression) {
      TypeUtils.validateIsAssignableTo(this.parent.expression.type, this.type,
        "Column narrows its parent's type more narrowly than its parent's formula " +
        "but does not override that formula.");
      return this.parent.expression as unknown as ExpressionRes<T>;
    } else {
      return undefined;
    }
  }

  public get isSet(): boolean {
    return this.expression !== undefined;
  }

  public get dependencies(): ROArray<Reference> {
    return this.expression === undefined ? [] : this.expression.externalDependencies;
  }

  public eval = (rowContextValues: DictValue): Value<T> => {
    const expr = this.expression;
    if (expr) {
      const context = this.getContext(rowContextValues);
      return expr.eval(context);
    }
    throw new Error("Tried to evaluate a formula expression that was not set.");
  }

  private getContext = (rowContextValues: DictValue): Context => {
    return new Context(rowContextValues);
  }

  public setExpression = (expression: ExpressionRes<T> | undefined) => {
    if (expression && !TypeUtils.isAssignableTo(expression.type, this.type)) {
      throw new Error("A formula expression must be assignable to its column's type");
    }
    this._expression = expression;
    const descriptor = {type: FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED};
    this.onSelfMutated([descriptor]);
  }

  public toText = (): string => {
    const expression = this.expression;
    if (expression) {
      return expression.toText(this.formulaEnvironment.resolver);
    } else {
      return "";
    }
  }

  private onParentUpdated = (
    epoch: number,
    updates: FormulaExpressionUpdateDescriptor[],
  ): FormulaExpressionUpdateDescriptor[] => {
    const expressionUpdated = updates.some(u => u.type === FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED);
    if (expressionUpdated && !this._expression) {
      this.onDependencyUpdated(epoch);
      const descriptor = {type: FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED};
      return [descriptor];
    }
    return [];
  }
}