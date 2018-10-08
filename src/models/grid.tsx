import * as _ from 'lodash';

export interface CellData {
  value: string;
}

export interface RowData {
  [columnId: string]: CellData;
}

export type RowsData = RowData[]

export interface ColumnData {
  id: string;
  name: string;
}

export type ColumnsData = ColumnData[];

export class Grid {
  public getColumns(): ColumnsData {
    return this.generateColumnsData();
  }

  public getRows(): RowsData {
    return this.generateRowsData();
  }

  // example rows and columns
  private generateColumnsData(): ColumnsData {
    return [
      {id: 'A', name: 'A'},
      {id: 'B', name: 'B'},
    ];
  }

  private generateRowsData(): RowsData {
    const rowCount = 5;
    return _.range(rowCount).map(i => ({
      'A': {value: 'A'},
      'B': {value: i % 2 ? 'Long verylongvalue' : 'short'},
    }));
  }
}
