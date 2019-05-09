import * as _ from 'lodash';

import {Drawing} from '@language/drawing_value';
import {TypeUtils} from '@language/types';
import {DrawingValue} from '@language/values';
import {Grid} from '@models/grid';
import {ROArray} from '@utils/types';

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
