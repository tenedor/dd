import * as _ from 'lodash';
import * as React from 'react';
import {Grid} from './models/grid';
import {TableView} from './views/table_view';

export class App {
  private grid: Grid;

  constructor() {
    this.grid = new Grid();
  }

  public renderApplication() {
    const columnsData = this.grid.getColumns();
    const rowsData = this.grid.getRows();
    return <TableView columnsData={columnsData} rowsData={rowsData} />;
  }
}
