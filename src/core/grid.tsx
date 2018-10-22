import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {EpochManager} from './epoch_manager';

export interface Cell {
  value: string;
}

export interface Row {
  [columnId: string]: Cell;
}

export type Rows = Row[]

export enum DataType {
  DRAWING = 'DRAWING',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
}

export interface Value {
  type: DataType,
  value: string,
}

export interface TypedValue<T> extends Value {
  typedValue: T,
}

// limit to first-order formulas of column values
export interface Formula {
  name: string,
  args: string[],
}

export interface MaterializedFormula extends Formula {
  materializedArgs: Value[],
}

export interface Column {
  formula?: Formula;
  id: string;
  name: string;
  type: DataType;
  width: number;
}

export type Columns = Column[];

export class Grid extends BaseModel {
  public readonly id: string;
  private readonly parent?: Grid;
  private _rows: Rows;
  private _columns: Columns;
  private columnsMap: {[id: string]: Column};

  constructor(epochManager: EpochManager, id: string, parentGrid?: Grid) {
    super(epochManager);
    this.id = id;
    this.parent = parentGrid;
    this._columns = this.generateColumns();
    this.columnsMap = {};
    this._columns.forEach(c => {this.columnsMap[c.id] = c})
    this._rows = this.generateRows();
  }

  public getColumnById = (columnId: string): Column | undefined => {
    let column: Column | undefined = this.columnsMap[columnId];
    if (!column && this.parent) {
      column = this.parent.getColumnById(columnId);
    }
    return column;
  }

  public get columns(): Columns {
    return this._columns;
  }

  public get rows(): Rows {
    return this._rows;
  }

  // example rows and columns
  private generateColumns = (): Columns => {
    return [
      {id: 'c_1', name: 'X', width: 100, type: DataType.NUMBER},
      {id: 'c_2', name: 'Y', width: 100, type: DataType.NUMBER},
      {id: 'c_3', name: 'Radius', width: 100, type: DataType.NUMBER},
      {id: 'c_4', name: 'Fill', width: 100, type: DataType.STRING},
      {id: 'c_5', name: 'Draw Circle', width: 150, type: DataType.DRAWING,
          formula: {name: "DrawCircle", args: ["c_3", "c_1", "c_2", "c_4"]}},
    ];
  }

  private generateRows = (): Rows => {
    const rowCount = 6;
    const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
    return _.range(rowCount).map(i => ({
      'c_1': {value: `${i * 20}`},
      'c_2': {value: `${i * i * 10}`},
      'c_3': {value: `${(i + 1) * (i + 1) * 2}`},
      'c_4': {value: colors[i]},
      'c_5': {value: ""},
    }));
  }
}
