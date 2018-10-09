import {Grid} from './grid';

export class Resolver {
  private grids: {[gridId: string]: Grid};

  constructor() {
    this.grids = {};
  }

  public generateUID = (prefix?: string): string => {
    // c/o https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
    const uid = (Math.random().toString(36)+'00000000000000000').slice(2, 12);
    return prefix ? `${prefix}-${uid}` : uid;
  }

  public addGrid = (grid: Grid): void => {
    this.grids[grid.id] = grid;
  }

  public removeGrid = (gridId: string): void => {
    delete this.grids[gridId];
  }

  public getGrid = (gridId: string): Grid | undefined => {
    return this.grids[gridId];
  }
}
