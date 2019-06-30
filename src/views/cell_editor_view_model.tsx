import * as _ from 'lodash';

import {Parser} from '@language/parser';
import {TypeUtils} from '@language/types';
import {PrimitiveValue, ValueUtils} from '@language/values';
import {Cell} from '@models/domain_specific/cell';
import {GridColumn} from '@models/domain_specific/grid_column';

enum EditState {
  NOT_EDITING = 'NOT_EDITING',
  EDITING_CELL_VALUE = 'EDITING_CELL_VALUE',
  EDITING_COLUMN_NAME = 'EDITING_COLUMN_NAME',
  EDITING_FORMULA = 'EDITING_FORMULA',
}

export abstract class CellEditorViewModel {
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
  public abstract setValue(value: string): boolean;

  protected setFormulaExpression = (value: string): boolean => {
    const {column} = this;
    if (value) {
      // ignore a leading '='
      const unparsedExpression = value[0] === '=' ? value.substr(1) : value;
      const parseResult = Parser.parseExpression(unparsedExpression);
      if (parseResult.succeeded) {
        const ast = parseResult.ast.resolve(column.nameResolver);
        if (!TypeUtils.isAssignableTo(ast.type, column.type)) {
          // TODO: inform the user of the type issue
          return false;
        }
        column.setExpression(ast);
      } else {
        // TODO: persist broken formulas
        return false;
      }
    } else {
      column.setExpression(undefined);
    }
    return true;
  }
}

export class ColumnHeaderEditorViewModel extends CellEditorViewModel {
  public readonly isHeader = true;

  public startEditing() {
    this.setEditState(EditState.EDITING_COLUMN_NAME);
  }

  protected makeDisplayValueNonFormula(): string {
    return this.column.name;
  }

  public setValue(value: string): boolean {
    if (this.isEditingFormula()) {
      return this.setFormulaExpression(value);
    } else {
      const name = value.trim();
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

  public startEditing() {
    const editState = this.mustEditFormula() ? EditState.EDITING_FORMULA : EditState.EDITING_CELL_VALUE;
    this.setEditState(editState);
  }

  public mustEditFormula(): boolean {
    return this.cell.formulaExpression.isSet;
  }

  protected makeDisplayValueNonFormula(): string {
    return ValueUtils.toString(this.cell.value);
  }

  public setValue(value: string): boolean {
    if (this.isEditingFormula() || this.mustEditFormula()) {
      return this.setFormulaExpression(value);
    } else {
      if (!value) {
        this.cell.setManualValue(undefined);
        return true;
      } else {
        const parseResult = Parser.parseValue(value, this.column.type);
        if (parseResult.succeeded) {
          this.cell.setManualValue(parseResult.value);
          return true;
        }
        return false;
      }
    }
  }
}