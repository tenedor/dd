import * as React from 'react';
import {RowData, RowsData} from '../models/grid';
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
  rowsData: RowsData,
}

export class TableView extends React.Component<Props, object> {
  public render() {
    const {rowsData} = this.props;
    const rows = rowsData.map(this.renderRow);
    const selectedRanges = this.getSelectedRanges();
    const selections = selectedRanges.map(this.renderSelection);
    return (
      <div className="table-view">
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

  private renderRow(data: RowData, rowIndex: number) {
    return data.map((cell, columnIndex) => {
      const key = `cell-${rowIndex}-${columnIndex}`;
      return <CellView key={key} value={cell.value} />;
    });
  }

  private renderSelection({start, end}: TableRange, index: number) {
    // grid-area uses 1-indexing and is exclusive on the end indices
    const gridArea =
        `${start.row + 1}/${start.column + 1}/${end.row + 2}/${end.column + 2}`;
    const selectionStyles = {gridArea};
    const key = `selection-${index}`;
    return <div key={key} className="selection" style={selectionStyles} />
  }
}
