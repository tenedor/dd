import * as _ from 'lodash';
import * as React from 'react';
import {Cell} from 'src/core/cell';
import {Grid} from 'src/core/grid'; // only a type dependency
import {GridColumn} from 'src/core/grid_column';
import {Parser} from 'src/core/language/parser';
import {TypeUtils} from 'src/core/language/types';
import {PrimitiveValue, ValueUtils} from 'src/core/language/values';
import {KeyCode} from 'src/utils/keycode';
import {assert, assertUnreachable, classNames} from 'src/utils/utils';
import {BaseComponent, BaseProps} from './base_component';

enum EditState {
  NOT_EDITING = 'NOT_EDITING',
  EDITING_VALUE = 'EDITING_VALUE',
  EDITING_FORMULA = 'EDITING_FORMULA',
}

interface Props extends BaseProps {
  // not passing a cell model signals that this is a header cell
  cell?: Cell,
  column: GridColumn,
  // pass a grid as context until context can be retrieved from a formula
  grid: Grid,
}

interface State {
  editState: EditState,
}

export class CellEditorView extends BaseComponent<Props, State> {
  private textAreaRef?: HTMLTextAreaElement;

  constructor(props: Props) {
    super(props);

    this.state = {
      editState: EditState.NOT_EDITING,
    };
  }

  // may be overridden in subclass so can't use arrow method
  public componentDidUpdate() {
    if (!this.isEditing) {
      this.setDisplayValue(this.makeDisplayValue({isEditing: this.isEditing}));
    }
  }

  public render = () => {
    const value = this.makeDisplayValue({isEditing: this.isEditing});
    const className = classNames("cell-editor-view", {
      editing: this.isEditing,
      header: this.isHeaderCell,
    });
    return (
      <div className={className} tabIndex={0} onKeyDown={this.onKeyDown} onMouseDown={this.onMouseDown} >
        <textarea autoFocus={true} ref={r => this.textAreaRef = r || undefined} defaultValue={value} />
      </div>
    );
  }

  private get isHeaderCell(): boolean {
    return !this.props.cell;
  }

  private get isEditing(): boolean {
    return this.state.editState !== EditState.NOT_EDITING;
  }

  private mustEditFormula = (): boolean => {
    return !this.isHeaderCell && this.props.cell!.formulaExpression.isSet;
  }

  // This returns the value that should be displayed for the model state and the given options.
  private makeDisplayValue = ({isEditing, editFormula, overwrite}: {isEditing: boolean, editFormula?: boolean, overwrite?: boolean}): string => {
    const {cell, column} = this.props;
    const getFormulaValue = isEditing && (editFormula || this.mustEditFormula());
    if (overwrite) {
      return getFormulaValue ? "=" : "";
    } else if (getFormulaValue) {
      return `=${column.formulaExpression.toText()}`;
    } else if (cell) {
      return ValueUtils.toString(cell.value);
    } else {
      return column.name;
    }
  }

  private setDisplayValue = (value: string) => {
    this.textAreaRef!.value = value;
  }

  private resetDisplayValue = () => {
    this.setDisplayValue(this.makeDisplayValue({isEditing: false}));
  }

  private startEditing = ({editFormula, overwrite}: {editFormula?: boolean, overwrite?: boolean} = {}) => {
    // Could short-circuit return instead of erroring if it becomes important to
    // allow redundant calls.
    assert(this.state.editState === EditState.NOT_EDITING);

    this.setDisplayValue(this.makeDisplayValue({isEditing: true, editFormula, overwrite}));
    const editState = editFormula || this.mustEditFormula() ?
      EditState.EDITING_FORMULA :
      EditState.EDITING_VALUE;
    this.setState({editState});
  }

  private stopEditing = () => {
    this.setState({editState: EditState.NOT_EDITING});
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

  private setManualValue = (value: string): boolean => {
    const {cell, column} = this.props;
    if (cell) {
      cell.setManualValue(this.parseInputValue(value));
    } else {
      if (value) {
        column.setName(value);
      } else {
        return false;
      }
    }
    return true;
  }

  private setFormulaExpression = (value: string): boolean => {
    const {column} = this.props;
    if (value) {
      // ignore a leading '='
      const unparsedExpression = value[0] === '=' ? value.substr(1) : value;
      const parseResult = Parser.parse(unparsedExpression);
      if (parseResult.succeeded) {
        const ast = parseResult.ast.resolve(column.resolver);
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

  // Edit the model. This always shifts the editor to not-editing.
  private setValue(value: string) {
    const {editState} = this.state;
    let mutated = false;
    switch (editState) {
      case EditState.NOT_EDITING:
        mutated = this.mustEditFormula() ? this.setFormulaExpression(value) : this.setManualValue(value);
        break;
      case EditState.EDITING_VALUE:
        mutated = this.setManualValue(value);
        break;
      case EditState.EDITING_FORMULA:
        mutated = this.setFormulaExpression(value);
        break;
      default:
        assertUnreachable(editState);
    }

    // If the mutation did not succeed make sure to reset the displayed value.
    if (!mutated) {
      this.resetDisplayValue();
    }

    // Always stop editing.
    this.stopEditing();
  }

  private persistValue() {
    this.setValue(this.textAreaRef!.value);
  }

  private clearValue() {
    this.setValue("");
  }

  private onMouseDown = (e: React.MouseEvent) => {
    if (!this.isEditing) {
      this.startEditing();
      e.preventDefault();
    }
    e.stopPropagation();
  }

  private onKeyDown = (e: React.KeyboardEvent) => {
    const {keyCode} = e;

    switch (keyCode) {
      case KeyCode.ENTER:
      case KeyCode.TAB:
        if (this.isEditing) {
          this.persistValue();
        }
        e.preventDefault();
        return;

      case KeyCode.ESCAPE:
        if (this.isEditing) {
          this.stopEditing();
          this.resetDisplayValue();
          e.stopPropagation();
        }
        e.preventDefault();
        return;

      case KeyCode.SPACE:
        if (!this.isEditing) {
          this.startEditing();
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      case KeyCode.BACKSPACE:
      case KeyCode.DELETE:
        if (!this.isEditing) {
          this.clearValue();
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      case KeyCode.ARROW_DOWN:
      case KeyCode.ARROW_UP:
      case KeyCode.ARROW_LEFT:
      case KeyCode.ARROW_RIGHT:
        if (this.isEditing) {
          // let textarea handle it, don't bubble
          e.stopPropagation();
        } else {
          // bubble, don't let textarea handle it
          e.preventDefault();
        }
        return;

      // TODO: fix a bug where typing `+` (i.e. SHIFT-EQUALS) behaves like `=`
      case KeyCode.EQUAL_SIGN:
        if (!this.isEditing) {
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
          if (!this.isEditing) {
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