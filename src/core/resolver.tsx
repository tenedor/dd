import * as _ from 'lodash';
import {Grid} from './grid';

export class Resolver {
  private grids: {[gridId: string]: Grid};
  private gridsFunctionalArray: Grid[]; // must be pointer-different whenever contents-different

  constructor() {
    this.grids = {};
    this.gridsFunctionalArray = [];
  }

  public generateUID = (prefix?: string): string => {
    // c/o https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
    const uid = (Math.random().toString(36)+'00000000000000000').slice(2, 12);
    return prefix ? `${prefix}-${uid}` : uid;
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
    this.gridsFunctionalArray = this.gridsFunctionalArray.slice();
    this.gridsFunctionalArray.push(grid);
    grid.listenForEpochUpdate(this.onGridEpochUpdated);
  }

  public removeGrid = (gridId: string): void => {
    const grid = this.grids[gridId];
    this.gridsFunctionalArray = _.without(this.gridsFunctionalArray, grid);
    delete this.grids[gridId];
  }

  private onGridEpochUpdated = (epoch: number): void => {
    this.gridsFunctionalArray = this.gridsFunctionalArray.slice();
  }

  public getGrid = (gridId: string): Grid | undefined => {
    return this.grids[gridId];
  }

  public getAllGridsFunctionally = (): Grid[] => {
    return this.gridsFunctionalArray;
  }
}
