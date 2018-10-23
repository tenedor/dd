import * as _ from 'lodash';
import {
  DataType,
  Formula,
  Grid,
  MaterializedFormula,
  RowRO,
} from '../core/grid';
import {assert} from '../utils/utils';

export enum DrawingPrimitive {
  CIRCLE = "CIRCLE",
}

export interface BaseDrawing {
  type: DrawingPrimitive,
  x: number,
  y: number,
  rotation: number,
  fill: string,
  // stroke: number
  // stroke-color: string
  children: Drawing[],
}

export interface Circle extends BaseDrawing {
  type: DrawingPrimitive.CIRCLE,
  radius: number,
}

export type Drawing = Circle;

export class DrawingController {
  private grids: Grid[];

  constructor(grids: Grid[]) {
    this.grids = grids;
  }

  public getDrawings = (): Drawing[] => {
    return _.flatten(this.grids.map(this.getDrawingsForGrid));
  }

  private materializeFormula = (formula: Formula, row: RowRO, grid: Grid): MaterializedFormula => {
    const {name, args} = formula;
    return {
      name,
      args,
      materializedArgs: args.map(c => ({
        value: row[c].value,
        type: grid.getColumnById(c)!.type,
      })),
    }
  }

  private isDrawingFormula = (formula: Formula): boolean => {
    return formula.name === 'DrawCircle';
  }

  private resolveDrawingFormula = (formula: Formula, row: RowRO, grid: Grid): Drawing => {
    const materializedFormula = this.materializeFormula(formula, row, grid);
    assert(this.isDrawingFormula(materializedFormula), 'expected drawing formula');
    const args = materializedFormula.materializedArgs;
    assert(args.length === 4, 'invalid arg count');
    const radius = assert(args[0].type === DataType.NUMBER) && parseFloat(args[0].value);
    const x = assert(args[1].type === DataType.NUMBER) && parseFloat(args[1].value);
    const y = assert(args[2].type === DataType.NUMBER) && parseFloat(args[2].value);
    const fill = assert(args[3].type === DataType.STRING) && args[3].value;
    return {
      type: DrawingPrimitive.CIRCLE,
      radius,
      x,
      y,
      rotation: 0,
      fill,
      children: [],
    };
  }

  private getDrawingsForGrid = (grid: Grid): Drawing[] => {
    const {columns, rows} = grid;

    const drawingFormulas = columns
      .map(c => {
          return (c.formula && this.isDrawingFormula(c.formula)) ? c.formula : undefined;
      })
      .filter(f => !!f) as Formula[];

    const rowDrawings =
      rows.map(row =>
        drawingFormulas.map(formula =>
          this.resolveDrawingFormula(formula, row, grid)));
    return _.flatten(rowDrawings);
  }
}
