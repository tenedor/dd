import * as _ from 'lodash';
import {Drawing} from 'src/core/drawing_value';
import {Grid} from 'src/core/grid';
import {TypeUtils} from 'src/core/language/types';
import {DrawingValue} from 'src/core/language/values';
import {ROArray} from 'src/utils/types';

export class DrawingController {
  private grids: ROArray<Grid>;

  constructor(grids: ROArray<Grid>) {
    this.grids = grids;
  }

  public getDrawings = (): Drawing[] => {
    return _.flatten(this.grids.map(this.getDrawingsForGrid));
  }

  private getDrawingsForGrid = (grid: Grid): Drawing[] => {
    const {columns, rows} = grid;
    const drawingColumns = columns.a.filter(c => TypeUtils.isDrawing(c.type));
    const rowDrawings = rows.a.map(row => drawingColumns.map(c => (row.cells.d[c.columnId].value as DrawingValue).drawing));
    return _.flatten(rowDrawings);
  }
}
