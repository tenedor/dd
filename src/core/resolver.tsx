import * as _ from 'lodash';
import {Grid} from './grid';

export enum Namespace {
  APP = 'app',
  ARRAY = 'arr',
  CELL = 'cell',
  COLUMN = 'col',
  DICTIONARY = 'dict',
  DOCUMENT = 'doc',
  GRID = 'grid',
  GRID_COLUMN = 'gridcol',
  MODEL = 'model',
  RESOLVER = 'res',
  ROW = 'row',
}

export class Resolver {
  public readonly id: string;
  private grids: {[gridId: string]: Grid};
  private gridsFunctionalArray: Grid[]; // must be pointer-different whenever contents-different

  constructor() {
    this.id = Resolver.generateUID(Namespace.RESOLVER);
    this.grids = {};
    this.gridsFunctionalArray = [];
  }

  public static generateUID = (namespace?: Namespace): string => {
    // c/o https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
    const uid = (Math.random().toString(36)+'00000000000000000').slice(2, 12);
    return namespace ? `${namespace}-${uid}` : uid;
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
    this.gridsFunctionalArray = this.gridsFunctionalArray.slice();
    this.gridsFunctionalArray.push(grid);
    grid.listenForUpdate(this.id, this.onGridUpdated);
  }

  public removeGrid = (gridId: string): void => {
    const grid = this.grids[gridId];
    this.gridsFunctionalArray = _.without(this.gridsFunctionalArray, grid);
    delete this.grids[gridId];
  }

  private onGridUpdated = (epoch: number): void => {
    this.gridsFunctionalArray = this.gridsFunctionalArray.slice();
  }

  public getGrid = (gridId: string): Grid | undefined => {
    return this.grids[gridId];
  }

  public getAllGridsFunctionally = (): Grid[] => {
    return this.gridsFunctionalArray;
  }
}
