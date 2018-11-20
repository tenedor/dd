import * as _ from 'lodash';
import * as React from 'react';
import {Value} from '../controllers/drawing_controller';
import {parseFormula} from '../controllers/formula_parser';
import {CellIndex, Columns, Grid} from '../core/grid';
import {Formula} from '../core/grid_column';
import {Row} from '../core/row';
import {KeyCode} from '../utils/keycode';
import {BaseComponent, BaseProps} from './base_component';
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

interface Props extends BaseProps {
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

    const columnWidths = columns.a.map(c => c.width);
    const tableStyles = {
      gridTemplateColumns: columnWidths.map(w => w + "px").join(" "),
      width: columnWidths.reduce((sum, w) => sum + w, 0),
    };

    const columnHeaders = this.renderColumnHeaders();
    const renderedRows = rows.a.map(this.renderRow);
    const cellEditor = this.renderCellEditor(selectedCell);

    return (
      <div className="table-view" style={tableStyles} tabIndex={0} onKeyDown={this.onKeyDown}
          onMouseDown={this.onMouseDown}>
        {columnHeaders}
        {renderedRows}
        {cellEditor}
      </div>
    );
  }

  private getCellIndexFromTableIndex = (tableIndex: TableIndex): CellIndex => {
    const {columns} = this.props.grid;
    return {
      columnId: columns.a[tableIndex.column].columnId,
      rowIndex: tableIndex.row,
    };
  }

  private setSelection = (selection: TableIndex) => {
    this.setState({selectedCell: selection});
  }

  private setSelectionFromCellIndex = ({columnId, rowIndex}: CellIndex) => {
    const {columns} = this.props.grid;
    const columnIndex = columns.getIndexByKey(columnId);
    this.setSelection({row: rowIndex, column: columnIndex});
  }

  private moveSelection = ({right, down}: {right: number, down: number}) => {
    const {rows, columns} = this.props.grid;
    const {row, column} = this.state.selectedCell;
    const newRow = Math.max(-1, Math.min(rows.length - 1, row + down));
    const newColumn = Math.max(0, Math.min(columns.length - 1, column + right));
    this.setSelection({row: newRow, column: newColumn});
  }

  private onMouseDown = (e: React.MouseEvent) => {
    // React's typing on e.target is dumb
    const cellNode = (e.target as Element).closest('[data-cell-id]');
    if (cellNode) {
      const cellIndexString = cellNode.getAttribute('data-cell-id');
      const cellIndex = cellIndexString ? this.parseCellIndex(cellIndexString) : undefined;
      if (cellIndex) {
        this.setSelectionFromCellIndex(cellIndex);
        e.preventDefault();
      }
    }
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

  private stringEncodeCellIndex = ({columnId, rowIndex}: CellIndex): string => {
    return `cell-${columnId}-${rowIndex >= 0 ? rowIndex : 'H'}`;
  }

  private parseCellIndex = (cellIndexString: string): CellIndex | undefined => {
    const match = cellIndexString.match(/cell-(.*)-(\d+|H)/);
    if (!match) {
      return undefined;
    }
    const columnId = match[1];
    const rowIndex = match[2] === 'H' ? -1 : parseInt(match[2], 10);
    return {columnId, rowIndex};
  }

  private renderColumnHeaders = () => {
    const {columns} = this.props.grid;
    return columns.a.map(column => {
      const {columnId, name} = column;
      const key = `column-header-${columnId}`;
      const cellIndexString = this.stringEncodeCellIndex({columnId, rowIndex: -1});
      return <CellView key={key} dataCellId={cellIndexString} value={name} isHeader={true} />;
    });
  }

  private getFormulaAsString = (formula: Formula, columns: Columns): string => {
    const args = formula.args.map(arg => columns.getByKey(arg)!.name);
    return `${formula.name}(${args.join(", ")})`
  }

  private renderRow = (row: Row, rowIndex: number) => {
    const {columns} = this.props.grid;
    const {cells} = row;
    return columns.a.map(({columnId, formula}) => {
      const cellIndexString = this.stringEncodeCellIndex({columnId, rowIndex});
      const value = formula ?
        `=${this.getFormulaAsString(formula, columns)}` :
        cells.d[columnId].value;
      return <CellView key={cellIndexString} dataCellId={cellIndexString} value={value} />;
    });
  }

  private getValue = ({column: columnIndex, row: rowIndex}: TableIndex): Value => {
    const {columns, rows} = this.props.grid;
    const {columnId, name, type} = columns.a[columnIndex];
    const isHeaderCell = rowIndex < 0;
    const value = isHeaderCell ? name : rows.a[rowIndex].cells.d[columnId].value;
    return {type, value};
  }

  private getGridArea = ({start, end}: TableRange): string => {
    // increment all indices by 1 since grid-area uses 1-indexing
    // increment row indices by 1 to account for headers
    // increment end indices by 1 since grid-area is exclusive on end indices
    return `${start.row + 2}/${start.column + 1}/${end.row + 3}/${end.column + 2}`;
  }

  private onCellValueChange = (value: string) => {
    const {grid} = this.props;
    const {selectedCell} = this.state;
    const {columnId, rowIndex} = this.getCellIndexFromTableIndex(selectedCell);
    if (rowIndex === -1) {
      const column = grid.columns.getByKey(columnId)!;
      column.setName(value);
    } else {
      const row = grid.rows.a[rowIndex];
      row.cells.d[columnId].setManualValue(value);
    }
  }

  private onFormulaChange = (value: string) => {
    const {grid} = this.props;
    const {selectedCell} = this.state;
    const {columnId} = this.getCellIndexFromTableIndex(selectedCell);
    const column = grid.columns.getByKey(columnId)!;

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

  private renderCellEditor = (editorIndex: TableIndex) => {
    const {epoch, grid} = this.props;
    const {formula, type} = grid.columns.a[editorIndex.column];
    const key = `editor-${editorIndex.column}:r-${editorIndex.row}`;
    const isHeaderCell = editorIndex.row < 0;
    const editFormula = !!formula && !isHeaderCell;
    const value = editFormula ?
      {type, value:`=${this.getFormulaAsString(formula!, grid.columns)}`} :
      this.getValue(editorIndex);

    const gridArea = this.getGridArea({start: editorIndex, end: editorIndex});
    return <div key="cell-editor" className="cell-editor" style={{gridArea}}>
      <CellEditorView epoch={epoch} key={key} value={value} isHeader={isHeaderCell}
        onChangeValue={editFormula ? this.onFormulaChange : this.onCellValueChange} />
    </div>
  }
}
