import * as _ from 'lodash';

export interface CellData {
  value: string;
}

export interface RowData {
  [columnId: string]: CellData;
}

export type RowsData = RowData[]

export enum DataType {
  DRAWING = 'DRAWING',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
}

export interface Value {
  type: DataType,
  value: string,
}

// limit to first-order formulas of column values
export interface Formula {
  name: string,
  args: string[],
}

export interface MaterializedFormula extends Formula {
  materializedArgs: Value[],
}

export interface ColumnData {
  formula?: Formula;
  id: string;
  name: string;
  type: DataType;
  width: number;
}

export type ColumnsData = ColumnData[];

export interface GridData {
  columns: ColumnsData,
  rows: RowsData,
}

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
      {id: 'c-1', name: 'X', width: 100, type: DataType.NUMBER},
      {id: 'c-2', name: 'Y', width: 100, type: DataType.NUMBER},
      {id: 'c-3', name: 'Radius', width: 100, type: DataType.NUMBER},
      {id: 'c-4', name: 'Fill', width: 100, type: DataType.STRING},
      {id: 'c-5', name: 'Draw Circle', width: 150, type: DataType.DRAWING,
          formula: {name: "DrawCircle", args: ["c-3", "c-1", "c-2", "c-4"]}},
    ];
  }

  private generateRowsData(): RowsData {
    const rowCount = 6;
    const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
    return _.range(rowCount).map(i => ({
      'c-1': {value: `${i * 20}`},
      'c-2': {value: `${i * i * 10}`},
      'c-3': {value: `${(i + 1) * (i + 1) * 2}`},
      'c-4': {value: colors[i]},
      'c-5': {value: ""},
    }));
  }
}
