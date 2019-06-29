import * as _ from 'lodash';
import * as React from 'react';

import {Parser} from '@language/parser';
import {TypeUtils} from '@language/types';
import {PrimitiveValue, ValueUtils} from '@language/values';
import {Cell} from '@models/domain_specific/cell';
import {GridColumn} from '@models/domain_specific/grid_column';
import {KeyCode} from '@utils/keycode';
import {assert, classNames} from '@utils/utils';
import {BaseComponent, BaseProps} from './base_component';

enum EditState {
  NOT_EDITING = 'NOT_EDITING',
  EDITING_CELL_VALUE = 'EDITING_CELL_VALUE',
  EDITING_COLUMN_NAME = 'EDITING_COLUMN_NAME',
  EDITING_FORMULA = 'EDITING_FORMULA',
}

abstract class CellEditorViewModel {
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

  protected setEditState(editState: EditState) {
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

  public abstract setValue(value: string): boolean;

  protected setFormulaExpression = (value: string): boolean => {
    const {column} = this;
    if (value) {
      // ignore a leading '='
      const unparsedExpression = value[0] === '=' ? value.substr(1) : value;
      const parseResult = Parser.parse(unparsedExpression);
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

class ColumnHeaderEditorViewModel extends CellEditorViewModel {
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
      return this.column.setName(value);
    }
  }
}

class RowCellEditorViewModel extends CellEditorViewModel {
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
      return this.cell.setManualValue(this.parseInputValue(value));
    }
  }

  private parseInputValue = (value: string): PrimitiveValue => {
    // TODO this should use the column type
    if (value === "true" || value === "false") {
      return ValueUtils.booleanOf(value === "true");
    } else if (!isNaN(parseFloat(value))) {
      return ValueUtils.numberOf(parseFloat(value));
    } else {
      return ValueUtils.stringOf(value);
    }
  }
}

interface Props extends BaseProps {
  // not passing a cell model signals that this is a header cell
  cell?: Cell,
  column: GridColumn,
}

interface State {
  isEditing: boolean,
}

export class CellEditorView extends BaseComponent<Props, State> {
  private textAreaRef?: HTMLTextAreaElement;
  private viewModel: CellEditorViewModel;

  constructor(props: Props) {
    super(props);

    this.state = {
      isEditing: false,
    };

    this.updateEditorModel();
  }

  public componentDidUpdate() {
    if (!this.state.isEditing) {
      this.updateDisplayValue();
    }
  }

  private updateEditorModel = () => {
    const {cell, column} = this.props;
    const {setIsEditing} = this;
    this.viewModel = cell ? new RowCellEditorViewModel({column, cell, setIsEditing}) : new ColumnHeaderEditorViewModel({column, setIsEditing});
  }

  private setIsEditing = (isEditing: boolean) => {
    this.setState({isEditing});
  }

  public render = () => {
    const value = this.viewModel.makeDisplayValue();
    const className = classNames("cell-editor-view", {
      editing: this.state.isEditing,
      header: this.viewModel.isHeader,
    });
    return (
      <div className={className} tabIndex={0} onKeyDown={this.onKeyDown} onMouseDown={this.onMouseDown} >
        <textarea autoFocus={true} ref={r => this.textAreaRef = r || undefined} defaultValue={value} />
      </div>
    );
  }

  private mustEditFormula = (): boolean => {
    return this.viewModel.mustEditFormula();
  }

  private getOverwriteDisplayValue = (): string => {
    return this.viewModel.isEditingFormula() ? "=" : "";
  }

  private updateDisplayValue = ({overwrite}: {overwrite?: boolean} = {}) => {
    const displayValue = overwrite ? this.getOverwriteDisplayValue() : this.viewModel.makeDisplayValue();
    this.setDisplayValue(displayValue);
  }

  private setDisplayValue = (value: string) => {
    this.textAreaRef!.value = value;
  }

  private startEditing = ({editFormula, overwrite}: {editFormula?: boolean, overwrite?: boolean} = {}) => {
    assert(!this.state.isEditing);
    const {viewModel: editorModel} = this;
    if (editFormula) {
      editorModel.startEditingFormula();
    } else {
      editorModel.startEditing();
    }
    this.updateDisplayValue({overwrite});
  }

  private stopEditing = () => {
    this.viewModel.stopEditing();
  }

  // Edit the model. This always shifts the editor to not-editing.
  private setValue(value: string) {
    this.viewModel.setValue(value);
    this.stopEditing();
  }

  private persistValue() {
    this.setValue(this.textAreaRef!.value);
  }

  private clearValue() {
    this.setValue("");
  }

  private onMouseDown = (e: React.MouseEvent) => {
    const {isEditing} = this.state;
    if (!isEditing) {
      this.startEditing();
      e.preventDefault();
    }
    e.stopPropagation();
  }

  private onKeyDown = (e: React.KeyboardEvent) => {
    const {isEditing} = this.state;
    const {keyCode} = e;

    switch (keyCode) {
      case KeyCode.ENTER:
      case KeyCode.TAB:
        if (isEditing) {
          this.persistValue();
        }
        e.preventDefault();
        return;

      case KeyCode.ESCAPE:
        if (isEditing) {
          this.stopEditing();
          e.stopPropagation();
        }
        e.preventDefault();
        return;

      case KeyCode.SPACE:
        if (!isEditing) {
          this.startEditing();
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      case KeyCode.BACKSPACE:
      case KeyCode.DELETE:
        if (!isEditing) {
          this.clearValue();
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      case KeyCode.ARROW_DOWN:
      case KeyCode.ARROW_UP:
      case KeyCode.ARROW_LEFT:
      case KeyCode.ARROW_RIGHT:
        if (isEditing) {
          // let textarea handle it, don't bubble
          e.stopPropagation();
        } else {
          // bubble, don't let textarea handle it
          e.preventDefault();
        }
        return;

      // TODO: fix a bug where typing `+` (i.e. SHIFT-EQUALS) behaves like `=`
      case KeyCode.EQUAL_SIGN:
        if (!isEditing) {
          this.startEditing({editFormula: true});
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      default:
        if (
          (KeyCode["0"] <= keyCode && keyCode <= KeyCode.Z) ||
          (KeyCode.NUMPAD_0 <= keyCode && keyCode <= KeyCode.NUMPAD_DIVIDE) ||
          (KeyCode.SEMICOLON <= keyCode && keyCode <= KeyCode.QUOTE)
        ) {
          if (!isEditing) {
            // UI design: Overwrite a manual value with a new value but do not overwrite a formula
            // since the formula will not have been visible. For a formula, either enter edit mode
            // without overwriting or do not enter edit mode at all for non-command characters. For
            // now, choose the first option.
            this.startEditing({overwrite: !this.mustEditFormula()});
          }
          e.stopPropagation();
          return;
        }
    }
  }
}