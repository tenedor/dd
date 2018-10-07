import * as _ from 'lodash';

export interface CellData {
  value: string;
}

export type RowData = CellData[]
export type RowsData = RowData[]

export class Grid {
  public getRowsData(): RowsData {
    return this.generateRowsData();
  }

  // example rows
  private generateRowsData(): RowsData {
    const rowCount = 5;
    return _.range(rowCount).map(i => [
      {value: 'A'},
      {value: i % 2 ? 'Long verylongvalue' : 'short'},
    ]);
  }
}
