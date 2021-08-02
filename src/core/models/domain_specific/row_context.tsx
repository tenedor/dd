import {Identifier} from '@core/language/types';
import {Cell} from './cell';
import {Cells} from './row';

export interface RowContext {
  getCell(id: Identifier): Cell | undefined,
}

export class RowContextRegistry implements RowContext {

  private rowContext?: Cells = undefined;

  public getCell(id: Identifier): Cell | undefined {
    if (this.rowContext === undefined) {
      throw new Error("Row context must be set before it can be retrieved.");
    }
    return this.rowContext.get(id);
  }

  public setRowContext = (rowContext: Cells) => {
    if (this.rowContext !== undefined) {
      throw new Error("Row context can only be set once.");
    }
    this.rowContext = rowContext;
  }
}