import {ExpressionRes} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {NameResolver} from '@language/name_resolver';
import {Reference} from '@language/reference';
import {Type, TypeUtils} from '@language/types';
import {ValueResolver} from '@language/value_resolver';
import {Value} from '@language/values';
import {ROArray} from '@utils/types';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {DependencyGraphPartitionIndex, UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {FormulaExpressionUpdateType} from '../core/update_types';

interface FormulaExpressionData<T extends Type, P extends Type> {
  type: T;
  nameResolver: NameResolver;
  parent?: FormulaExpression<P>;
}

export interface FormulaExpressionUpdateDescriptor extends UpdateDescriptor<FormulaExpressionUpdateType> {}

export class FormulaExpression<T extends Type = Type, P extends Type = Type> extends Mutable<FormulaExpressionUpdateDescriptor> {
  public readonly dependencyGraphPartitionIndex = DependencyGraphPartitionIndex.SCHEMA;
  private readonly type: T;
  private readonly nameResolver: NameResolver;
  private _expression?: ExpressionRes<T>;
  private readonly parent?: FormulaExpression<P>;

  constructor(
    updateManager: UpdateManager,
    {type, nameResolver, parent}: FormulaExpressionData<T, P>,
    modelType: ModelType = ModelType.FORMULA_EXPRESSION,
  ) {
    super(updateManager, modelType);
    this.type = type;
    this.nameResolver = nameResolver;
    this.parent = parent;

    if (this.parent) {
      this.parent.listenForUpdate(this, this.onParentUpdated);
    }
  }

  private get environment(): FormulaEnvironment {
    return this.nameResolver.environment;
  }

  private get expression(): ExpressionRes<T> | undefined {
    if (this._expression) {
      return this._expression;
    } else if (this.parent && this.parent.expression) {
      TypeUtils.validateIsAssignableTo(this.parent.expression.type, this.type, this.environment,
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

  public eval = (valueResolver: ValueResolver): Value<T> => {
    const expr = this.expression;
    if (expr) {
      return expr.eval(valueResolver);
    }
    throw new Error("Tried to evaluate a formula expression that was not set.");
  }

  public setExpression = (expression: ExpressionRes<T> | undefined) => {
    if (expression && !TypeUtils.isAssignableTo(expression.type, this.type, this.environment)) {
      throw new Error("A formula expression must be assignable to its column's type");
    }
    this._expression = expression;
    const descriptor = {type: FormulaExpressionUpdateType.FORMULA_EXPRESSION_UPDATED};
    this.onSelfMutated([descriptor]);
  }

  public toText = (): string => {
    const expression = this.expression;
    if (expression) {
      return expression.toText(this.nameResolver);
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