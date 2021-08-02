import {Identifier} from '@core/language/types';
import {keysEqual} from '@utils/utils';
import * as _ from 'lodash';
import {FunctionalDictionaryM} from '../collections/functional_dictionary';
import {UpdateManager} from '../core/update_manager';
import {Cell} from './cell';
import {GridColumns} from './grid';
import {Cells, ManualValues, Row} from './row';
import {RowContext} from './row_context';
import {SerializedCell} from './serialization';


interface CellsDataBase {
  columns: GridColumns,
  gridId: Identifier,
  defaultValues?: Row,
  rowContext: RowContext,
}

interface CellsDataWithManualValues extends CellsDataBase {
  manualValues: ManualValues,
}

interface SerializedCellsData extends CellsDataBase {
  serializedCells: SerializedCell[],
}

export function constructCells(updateManager: UpdateManager, cellsData: CellsDataWithManualValues): Cells {
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

export function hydrateCells(updateManager: UpdateManager, cellsData: SerializedCellsData): Cells {
  const {columns, gridId, defaultValues, serializedCells, rowContext} = cellsData;

  const cellsMap = _.keyBy(serializedCells, "columnId");
  if (!keysEqual(cellsMap, columns.d)) {
    const cellIds = serializedCells.map(c => c.columnId).join(", ");
    const columnIds = columns.a.map(c => c.columnId).join(", ");
    throw new Error(`Serialized cells must match provided columns. Cell ids: ${cellIds}. Column ids: ${columnIds}`);
  }

  const cellsDict = _.mapValues(columns.d, column => {
    const {columnId} = column;
    const serializedCell = cellsMap[columnId];
    const defaultValue = defaultValues ? defaultValues.cells.get(columnId) : undefined;
    return Cell.hydrate(serializedCell, updateManager, {
      column,
      defaultValue,
      rowContext,
      gridId,
    });
  });
  return new FunctionalDictionaryM(updateManager, cellsDict, {});
}