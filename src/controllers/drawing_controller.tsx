import * as _ from 'lodash';
import {Drawing} from '../core/drawing_value';
import {isDrawingFormula} from '../core/formula';
import {Grid} from '../core/grid';

export class DrawingController {
  private grids: Grid[];

  constructor(grids: Grid[]) {
    this.grids = grids;
  }

  public getDrawings = (): Drawing[] => {
    return _.flatten(this.grids.map(this.getDrawingsForGrid));
  }

  private getDrawingsForGrid = (grid: Grid): Drawing[] => {
    const {columns, rows} = grid;
    const drawingColumns = columns.a.filter(c => c.formula && isDrawingFormula(c.formula));
    const rowDrawings = rows.a.map(row => drawingColumns.map(c => row.cells.d[c.columnId].value as Drawing));
    return _.flatten(rowDrawings);
  }
}
