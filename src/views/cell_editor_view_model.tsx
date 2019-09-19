import * as _ from 'lodash';

import {ExpressionRes} from '@language/ast';
import {LanguageError} from '@language/language_errors';
import {Parser} from '@language/parser';
import {TypeUtils} from '@language/types';
import {Cell} from '@models/domain_specific/cell';
import {GridColumn} from '@models/domain_specific/grid_column';

enum EditState {
  NOT_EDITING = 'NOT_EDITING',
  EDITING_CELL_VALUE = 'EDITING_CELL_VALUE',
  EDITING_COLUMN_NAME = 'EDITING_COLUMN_NAME',
  EDITING_FORMULA = 'EDITING_FORMULA',
}

export abstract class CellEditorViewModel {
  public abstract readonly isDefaultValue: boolean;
  public abstract readonly isHeader: boolean;
  protected readonly column: GridColumn;
  protected readonly setIsEditing: (isEditing: boolean) => void;
  private _editState: EditState;

  constructor({column, setIsEditing}: {
    column: GridColumn,
    setIsEditing: (isEditing: boolean) => void},
  ) {
    this.column = column;
    this.setIsEditing = setIsEditing;
    this._editState = EditState.NOT_EDITING;
  }

  protected setEditState(editState: EditState): void {
    this._editState = editState;
    this.setIsEditing(editState !== EditState.NOT_EDITING);
  }

  protected getEditState(): EditState {
    return this._editState;
  }

  public abstract startEditing(): void;

  public startEditingFormula(): void {
    this.setEditState(EditState.EDITING_FORMULA);
  }

  public stopEditing(): void {
    this.setEditState(EditState.NOT_EDITING);
  }

  public isEditingFormula(): boolean {
    return this.getEditState() === EditState.EDITING_FORMULA;
  }

  public mustEditFormula(): boolean {
    return false;
  }

  public makeDisplayValue(): string {
    return this.isEditingFormula() ?
      `=${this.column.formulaExpression.toText()}` :
      this.makeDisplayValueNonFormula();
  }

  protected abstract makeDisplayValueNonFormula(): string;

  // Returns true if value is a valid value to set given the column and edit mode
  public abstract setValue(value: string | undefined): boolean;

  private static logSetFormulaError = (message: string, unparsedExpression?: string) => {
    // TODO: inform the user of the error through the GUI
    // TODO: persist broken formulas
    const period = message[message.length - 1] === "." ? "" : ".";
    console.warn(`Formula edit failed due to ${message}${period} ${unparsedExpression || ""}`);
  }

  protected setFormulaExpression = (value: string | undefined): boolean => {
    const {column} = this;
    if (value) {
      // ignore a leading '='
      const unparsedExpression = value[0] === '=' ? value.substr(1) : value;
      const parseResult = Parser.parseExpression(unparsedExpression);
      if (parseResult.succeeded) {
        const {formulaEnvironment, nameResolver} = column;
        let ast: ExpressionRes;
        try {
          ast = parseResult.ast.resolve(nameResolver);
        } catch (e) {
          if (e instanceof LanguageError) {
            CellEditorViewModel.logSetFormulaError(`${e.name}: ${e.message}`, unparsedExpression);
            return false;
          }
          throw e;
        }
        if (!TypeUtils.isAssignableTo(ast.type, column.type, formulaEnvironment)) {
          CellEditorViewModel.logSetFormulaError(`incompatible types: cannot assign ` +
            `${TypeUtils.toString(ast.type)} to ${TypeUtils.toString(column.type)}`, unparsedExpression);
          return false;
        }
        column.setExpression(ast);
      } else {
        CellEditorViewModel.logSetFormulaError(`parse error: ${parseResult.message}`);
        return false;
      }
    } else {
      column.setExpression(undefined);
    }
    return true;
  }
}

export class ColumnHeaderEditorViewModel extends CellEditorViewModel {
  public readonly isDefaultValue = false;
  public readonly isHeader = true;

  public startEditing() {
    this.setEditState(EditState.EDITING_COLUMN_NAME);
  }

  protected makeDisplayValueNonFormula(): string {
    return this.column.name;
  }

  public setValue(value: string | undefined): boolean {
    if (this.isEditingFormula()) {
      return this.setFormulaExpression(value);
    } else {
      const name = value && value.trim();
      if (!name) {
        return false;
      }
      this.column.setName(name);
      return true;
    }
  }
}

export class RowCellEditorViewModel extends CellEditorViewModel {
  public readonly isHeader = false;
  private readonly cell: Cell;

  constructor({cell, column, setIsEditing}: {
    cell: Cell,
    column: GridColumn,
    setIsEditing: (isEditing: boolean) => void},
  ) {
    super({column, setIsEditing});
    this.cell = cell;
  }

  public get isDefaultValue(): boolean {
    return this.cell.valueIsDefault();
  }

  public startEditing() {
    const editState = this.mustEditFormula() ? EditState.EDITING_FORMULA : EditState.EDITING_CELL_VALUE;
    this.setEditState(editState);
  }

  public mustEditFormula(): boolean {
    return this.cell.formulaExpression.isSet;
  }

  protected makeDisplayValueNonFormula(): string {
    return this.cell.getDisplayValue();
  }

  public setValue(value: string | undefined): boolean {
    if (this.isEditingFormula() || this.mustEditFormula()) {
      return this.setFormulaExpression(value);
    } else {
      const {formulaEnvironment, type, nameResolver} = this.column;
      if (value === undefined || (!TypeUtils.isString(type) && value === "")) {
        this.cell.setManualValue(undefined);
        return true;
      } else {
        const parseResult = Parser.parseLiteral(value, type);

        if (parseResult.succeeded) {
          const ast = parseResult.ast.resolve(nameResolver);
          if (!ast.isLiteral) {
            // TODO: inform the user of the restriction to literals
            return false;
          }
          if (!TypeUtils.isAssignableTo(ast.type, type, formulaEnvironment)) {
            // TODO: inform the user of the type issue
            return false;
          }
          this.cell.setManualValue(ast);
          return true;
        }
        // TODO: persist broken expressions
        return false;
      }
    }
  }
}