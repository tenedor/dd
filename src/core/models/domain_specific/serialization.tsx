import {Identifier, Type} from '@language/types';

export type SerializedValue = string;

export type SerializedAST = string;

export type SerializedType = Type;

interface SerializedModel {
  readonly id: Identifier;
  readonly epoch: number;
}

export interface SerializedCell extends SerializedModel {
  readonly columnId: Identifier;
  readonly manualValue?: SerializedValue;
}

export interface SerializedColumn extends SerializedModel {
  readonly name: string;
  readonly type: SerializedType;
}

export interface SerializedDocument extends SerializedModel {
  readonly grids: SerializedGrid[];
  readonly drawingSurfaces: string[][]; // list of list of grid ids
}

export interface SerializedFormulaExpression extends SerializedModel {
  readonly expression?: SerializedAST;
}

export interface SerializedGridColumn extends SerializedModel {
  readonly columnId: Identifier;
  readonly formulaExpression: SerializedFormulaExpression;
  readonly width: number;
}

export interface SerializedGrid extends SerializedModel {
  readonly name: string;
  readonly parentId?: Identifier;
  readonly columns: SerializedGridColumn[];
  readonly rows: SerializedRow[];
}

export interface SerializedRow extends SerializedModel {
  readonly cells: SerializedCell[];
}