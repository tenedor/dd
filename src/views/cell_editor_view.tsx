import * as _ from 'lodash';
import * as React from 'react';
import {parseFormula} from '../controllers/formula_parser';
import {Cell} from '../core/cell';
import {Grid} from '../core/grid'; // only a type dependency
import {getFormulaAsString, GridColumn} from '../core/grid_column';
import {KeyCode} from '../utils/keycode';
import {classNames} from '../utils/utils';
import {BaseComponent, BaseProps} from './base_component';

interface Props extends BaseProps {
  // not passing a cell model signals that this is a header cell
  cell?: Cell,
  column: GridColumn,
  // pass a grid as context until context can be retrieved from a formula
  grid: Grid,
}

interface State {
  isEditing: boolean,
}

export class CellEditorView extends BaseComponent<Props, State> {
  private textAreaRef?: HTMLTextAreaElement;

  constructor(props: Props) {
    super(props);

    this.state = {
      isEditing: false,
    };
  }

  public render = () => {
    const value = this.getEditValue();
    const {isEditing} = this.state;
    const className = classNames("cell-editor-view", {
      editing: isEditing,
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

  private getEditValue = (): string => {
    const {cell, column, grid} = this.props;
    if (!cell) {
      return column.name;
    } else {
      return cell.formula ? `=${getFormulaAsString(cell.formula, {grid})}` : cell.value;
    }
  }

  private submitValue = () => {
    const {cell, column} = this.props;
    const {value} = this.textAreaRef!;
    if (!cell) {
      column.setName(value);
    } else if (cell.formula) {
      this.setFormula(value);
    } else {
      cell.setManualValue(value);
    }
  }

  private setFormula = (value: string) => {
    const {column, grid} = this.props;
    if (value) {
      // ignore a leading '='
      const unparsedFormula = value[0] === '=' ? value.substr(1) : value;
      const parseResult = parseFormula(unparsedFormula, {columns: grid.columns.a});
      if (parseResult.parseSucceeded) {
        column.setFormula(parseResult.formula);
      } else {
        // TODO: persist broken formulas
      }
    } else {
      column.setFormula(undefined);
    }
  }

  private onMouseDown = (e: React.MouseEvent) => {
    if (!this.state.isEditing) {
      this.setState({isEditing: true});
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
          this.setState({isEditing: false});
          this.submitValue();
        }
        e.preventDefault();
        return;

      case KeyCode.ESCAPE:
        if (isEditing) {
          this.setState({isEditing: false});
          this.textAreaRef!.value = this.getEditValue();
          e.stopPropagation();
        }
        e.preventDefault();
        return;

      case KeyCode.SPACE:
        if (!isEditing) {
          this.setState({isEditing: true});
          e.preventDefault();
        }
        e.stopPropagation();
        return;

      case KeyCode.BACKSPACE:
      case KeyCode.DELETE:
        if (!isEditing) {
          e.preventDefault();
          this.textAreaRef!.value = "";
          this.submitValue();
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

      case KeyCode.EQUAL_SIGN:
        if (!isEditing) {
          e.preventDefault();
          // TODO - initiate formula builder
          console.log("begin formula editing");
        }
        e.stopPropagation();
        return;

      default:
        if (
          (KeyCode["0"] <= keyCode && keyCode <= KeyCode.Z) ||
          (KeyCode.NUMPAD_MULTIPLY <= keyCode && keyCode <= KeyCode.NUMPAD_DIVIDE) ||
          (KeyCode.SEMICOLON <= keyCode && keyCode <= KeyCode.QUOTE)
        ) {
          if (!isEditing) {
            this.textAreaRef!.value = "";
            this.setState({isEditing: true});
          }
          e.stopPropagation();
          return;
        }
    }
  }
}