import {Identifier} from '@core/language/types';
import * as _ from 'lodash';
import {FunctionalDictionaryM} from '../collections/functional_dictionary';
import {UpdateManager} from '../core/update_manager';
import {Cell} from './cell';
import {GridColumns} from './grid';
import {Cells, ManualValues, Row} from './row';
import {RowContext} from './row_context';


interface CellsData {
  columns: GridColumns,
  gridId: Identifier,
  defaultValues?: Row,
  manualValues: ManualValues,
  rowContext: RowContext,
}

export function constructCells(updateManager: UpdateManager, cellsData: CellsData): Cells {
  const {columns, gridId, defaultValues, manualValues, rowContext} = cellsData;
  const cellsDict = _.mapValues(columns.d, column => {
    const {columnId} = column;
    const manualValue = manualValues[columnId];
    const defaultValue = defaultValues ? defaultValues.cells.get(columnId) : undefined;
    return new Cell(updateManager, {
      column,
      defaultValue,
      rowContext,
      gridId,
      manualValue,
    }, {});
  });
  return new FunctionalDictionaryM(updateManager, cellsDict, {});
}