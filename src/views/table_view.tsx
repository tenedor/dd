import * as React from 'react';
import {ColumnsData, RowData, RowsData} from '../models/grid';
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
  columnsData: ColumnsData,
  rowsData: RowsData,
}

export class TableView extends React.Component<Props, object> {
  public render() {
    const {columnsData, rowsData} = this.props;
    const columnIds = columnsData.map(c => c.id);
    const columnHeaders = this.renderColumnHeaders(columnsData);
    const rows = rowsData.map((r, i) => this.renderRow(r, columnIds, i));
    const selectedRanges = this.getSelectedRanges();
    const selections = selectedRanges.map((s, i) => this.renderSelection(s, i));
    return (
      <div className="table-view">
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

  private renderRow(rowData: RowData, columnIds: string[], rowIndex: number) {
    return columnIds.map(columnId => {
      const key = `cell-${rowIndex}-${columnId}`;
      return <CellView key={key} value={rowData[columnId].value} />;
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
