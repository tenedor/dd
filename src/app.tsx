import * as _ from 'lodash';
import * as React from 'react';
import {Grid} from './models/grid';
import {DrawingView} from './views/drawing_view';
import {TableView} from './views/table_view';

export class App {
  private grid: Grid;

  constructor() {
    this.grid = new Grid();
  }

  public renderApplication() {
    const gridData = {
      columns: this.grid.getColumns(),
      rows: this.grid.getRows(),
    }
    return (
      <div>
        <DrawingView gridsData={[gridData]} />
        <TableView gridData={gridData} />
      </div>
    );
  }
}
