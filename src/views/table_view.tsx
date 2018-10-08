import * as _ from 'lodash';
import * as React from 'react';
import {
  ColumnData,
  ColumnsData,
  Formula,
  GridData,
  RowData,
} from '../models/grid';
import {assert} from '../utils/utils';
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
  gridData: GridData,
}

export class TableView extends React.Component<Props, object> {
  public render() {
    const {columns: columnsData, rows: rowsData} = this.props.gridData;

    const columnWidths = columnsData.map(c => c.width);
    const tableStyles = {
      gridTemplateColumns: columnWidths.map(w => w + "px").join(" "),
      width: columnWidths.reduce((sum, w) => sum + w, 0),
    };

    const columnHeaders = this.renderColumnHeaders(columnsData);
    const rows = rowsData.map((r, i) => this.renderRow(r, columnsData, i));
    const selectedRanges = this.getSelectedRanges();
    const selections = selectedRanges.map((s, i) => this.renderSelection(s, i));

    return (
      <div className="table-view" style={tableStyles}>
        {columnHeaders}
        {rows}
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

  private renderColumnHeaders(columnsData: ColumnsData) {
    return columnsData.map(columnData => {
      const {id, name} = columnData;
      const key = `column-header-${id}`;
      return <CellView key={key} value={name} isHeader={true} />;
    });
  }

  private getColumnById(columnId: string, columnsData: ColumnsData): ColumnData {
    const column = _.find(columnsData, c => c.id === columnId);
    assert(column, 'invalid column id');
    return column!;
  }

  private getFormulaAsString(formula: Formula, columnsData: ColumnsData): string {
    const args = formula.args.map(arg => this.getColumnById(arg, columnsData).name);
    return `${formula.name}(${args.join(", ")})`
  }

  private renderRow(rowData: RowData, columnsData: ColumnsData, rowIndex: number) {
    return columnsData.map(({id: columnId, formula}) => {
      const key = `cell-${rowIndex}-${columnId}`;
      const value = formula ?
        `=${this.getFormulaAsString(formula, columnsData)}` :
        rowData[columnId].value;
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
