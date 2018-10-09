import * as _ from 'lodash';
import * as React from 'react';
import {Grid} from './core/grid';
import {Resolver} from './core/resolver';
import {DrawingView} from './views/drawing_view';
import {TableView} from './views/table_view';

export class App {
  private grid: Grid;
  private resolver: Resolver;

  constructor() {
    this.resolver = new Resolver();
    this.grid = new Grid(this.resolver);
  }

  public renderApplication() {
    return (
      <div>
        <DrawingView grids={[this.grid]} />
        <TableView grid={this.grid} />
      </div>
    );
  }
}
