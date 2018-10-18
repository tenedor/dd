import * as _ from 'lodash';
import * as React from 'react';
import {
  Column,
  Columns,
  Formula,
  Grid,
  Row,
  Value,
} from '../core/grid';
import {KeyCode} from '../utils/keycode';
import {assert} from '../utils/utils';
import {BaseComponent} from './base_component';
import {CellEditorView} from './cell_editor_view';
import {CellView} from './cell_view';

interface TableIndex {
  row: number,
  column: number,
}

interface TableRange {
  start: TableIndex,
  end: TableIndex,
}

interface Props {
  grid: Grid,
}

interface State {
  selectedCell: TableIndex,
}

export class TableView extends BaseComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {selectedCell: {row: 0, column: 0}};
  }

  public render = () => {
    const {columns, rows} = this.props.grid;
    const {selectedCell} = this.state;

    const columnWidths = columns.map(c => c.width);
    const tableStyles = {
      gridTemplateColumns: columnWidths.map(w => w + "px").join(" "),
      width: columnWidths.reduce((sum, w) => sum + w, 0),
    };

    const columnHeaders = this.renderColumnHeaders(columns);
    const renderedRows = rows.map(this.renderRow);
    const cellEditor = this.renderCellEditor(selectedCell);

    return (
      <div className="table-view" style={tableStyles} tabIndex={0} onKeyDown={this.onKeyDown}>
        {columnHeaders}
        {renderedRows}
        {cellEditor}
      </div>
    );
  }

  private moveSelection = ({right, down}: {right: number, down: number}) => {
    const {rows, columns} = this.props.grid;
    const {row, column} = this.state.selectedCell;
    const newRow = Math.max(0, Math.min(rows.length - 1, row + down));
    const newColumn = Math.max(0, Math.min(columns.length - 1, column + right));
    this.setState({selectedCell: {row: newRow, column: newColumn}});
  }

  private onKeyDown = (e: React.KeyboardEvent) => {
    switch(e.keyCode) {
      case KeyCode.ARROW_DOWN:
        this.moveSelection({right: 0, down: 1});
        break;
      case KeyCode.ARROW_UP:
        this.moveSelection({right: 0, down: -1});
        break;
      case KeyCode.ARROW_RIGHT:
        this.moveSelection({right: 1, down: 0});
        break;
      case KeyCode.ARROW_LEFT:
        this.moveSelection({right: -1, down: 0});
        break;
      case KeyCode.ENTER:
        this.moveSelection({right: 0, down: e.shiftKey ? -1 : 1});
        break;
      case KeyCode.TAB:
        this.moveSelection({right: e.shiftKey ? -1 : 1, down: 0});
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  private renderColumnHeaders = (columns: Columns) => {
    return columns.map(column=> {
      const {id, name} = column;
      const key = `column-header-${id}`;
      return <CellView key={key} value={name} isHeader={true} />;
    });
  }

  private getColumnById = (columnId: string, columns: Columns): Column => {
    const column = _.find(columns, c => c.id === columnId);
    assert(column, 'invalid column id');
    return column!;
  }

  private getFormulaAsString = (formula: Formula, columns: Columns): string => {
    const args = formula.args.map(arg => this.getColumnById(arg, columns).name);
    return `${formula.name}(${args.join(", ")})`
  }

  private renderRow = (row: Row, rowIndex: number) => {
    const {columns} = this.props.grid;
    return columns.map(({id: columnId, formula}) => {
      const key = `cell-${rowIndex}-${columnId}`;
      const value = formula ?
        `=${this.getFormulaAsString(formula, columns)}` :
        row[columnId].value;
      return <CellView key={key} value={value} />;
    });
  }

  private getValue = (cellIndex: TableIndex): Value => {
    const {columns, rows} = this.props.grid;
    const {id: columnId, type} = columns[cellIndex.column];
    const {value} = rows[cellIndex.row][columnId];
    return {type, value};
  }

  private getGridArea = ({start, end}: TableRange): string => {
    // increment all indices by 1 since grid-area uses 1-indexing
    // increment row indices by 1 to account for headers
    // increment end indices by 1 since grid-area is exclusive on end indices
    return `${start.row + 2}/${start.column + 1}/${end.row + 3}/${end.column + 2}`;
  }

  private onCellValueChange = (value: string) => {
    console.log(value);
  }

  private renderCellEditor = (cellIndex: TableIndex) => {
    const {columns} = this.props.grid;
    const {formula} = columns[cellIndex.column];
    const key = `c-${cellIndex.column}:r-${cellIndex.row}`;
    const value = this.getValue(cellIndex);
    const gridArea = this.getGridArea({start: cellIndex, end: cellIndex});
    return <div key="cell-editor" className="cell-editor" style={{gridArea}}>
      <CellEditorView key={key} value={value} editable={!formula} onChangeValue={this.onCellValueChange} />
    </div>
  }
}
