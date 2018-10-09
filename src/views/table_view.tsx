import * as _ from 'lodash';
import * as React from 'react';
import {
  Column,
  Columns,
  Formula,
  Grid,
  Row,
} from '../core/grid';
import {assert} from '../utils/utils';
import {BaseComponent} from './base_component';
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

export class TableView extends BaseComponent<Props, object> {
  public render() {
    const {columns, rows} = this.props.grid;

    const columnWidths = columns.map(c => c.width);
    const tableStyles = {
      gridTemplateColumns: columnWidths.map(w => w + "px").join(" "),
      width: columnWidths.reduce((sum, w) => sum + w, 0),
    };

    const columnHeaders = this.renderColumnHeaders(columns);
    const renderedRows = rows.map((r, i) => this.renderRow(r, columns, i));
    const selectedRanges = this.getSelectedRanges();
    const selections = selectedRanges.map((s, i) => this.renderSelection(s, i));

    return (
      <div className="table-view" style={tableStyles}>
        {columnHeaders}
        {renderedRows}
        {selections}
      </div>
    );
  }

  // example selection
  private getSelectedRanges(): TableRange[] {
    return [
      {start: {row: 1, column: 0}, end: {row: 3, column: 0}},
    ];
  }

  private renderColumnHeaders(columns: Columns) {
    return columns.map(column=> {
      const {id, name} = column;
      const key = `column-header-${id}`;
      return <CellView key={key} value={name} isHeader={true} />;
    });
  }

  private getColumnById(columnId: string, columns: Columns): Column {
    const column = _.find(columns, c => c.id === columnId);
    assert(column, 'invalid column id');
    return column!;
  }

  private getFormulaAsString(formula: Formula, columns: Columns): string {
    const args = formula.args.map(arg => this.getColumnById(arg, columns).name);
    return `${formula.name}(${args.join(", ")})`
  }

  private renderRow(row: Row, columns: Columns, rowIndex: number) {
    return columns.map(({id: columnId, formula}) => {
      const key = `cell-${rowIndex}-${columnId}`;
      const value = formula ?
        `=${this.getFormulaAsString(formula, columns)}` :
        row[columnId].value;
      return <CellView key={key} value={value} />;
    });
  }

  private getGridArea({start, end}: TableRange): string {
    // increment all indices by 1 since grid-area uses 1-indexing
    // increment row indices by 1 to account for headers
    // increment end indices by 1 since grid-area is exclusive on end indices
    return `${start.row + 2}/${start.column + 1}/${end.row + 3}/${end.column + 2}`;
  }

  private renderSelection(selection: TableRange, index: number) {
    const gridArea = this.getGridArea(selection);
    const selectionStyles = {gridArea};
    const key = `selection-${index}`;
    return <div key={key} className="selection" style={selectionStyles} />
  }
}
