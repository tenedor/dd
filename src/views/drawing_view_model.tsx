import * as _ from 'lodash';

import {getDrawing} from '@core/drawing_grid_utilities';
import {Drawing} from '@language/drawing_value';
import {Grid} from '@models/domain_specific/grid';
import {ROArray} from '@utils/types';

export class DrawingViewModel {
  private grids: ROArray<Grid>;

  constructor(grids: ROArray<Grid>) {
    this.grids = grids;
  }

  public getDrawings = (): Drawing[] => {
    return _.flatten(this.grids.map(this.getDrawingsForGrid));
  }

  private getDrawingsForGrid = (grid: Grid): Drawing[] => {
    return grid.rows.a.map(row => getDrawing(row.asValue()));
  }
}
