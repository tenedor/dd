import * as _ from 'lodash';

import {FormulaEnvironment} from '@language/formula_environment';
import {Identifier, Type, TypeUtils} from '@language/types';
import {NumberValue, RowValue, Value} from '@language/values';
import {CoordinateSystem} from './geometry';

export const coordinateSystemColumnName = "Transform";
export const COORDINATE_SYSTEM_GRID_NAME = 'Coordinate System';
// This id should match the UID pattern for columns
export const COORDINATE_SYSTEM_COLUMN_ID = 'col-_COORDINATE_SYSTEM_';

export const getCoordinateSystemColumnData = (
  getGridIdByName: (gridName: string) => Identifier,
): {id: string, name: string, type: Type} => {
  const coordinateSystemGridId = getGridIdByName(COORDINATE_SYSTEM_GRID_NAME);
  return {
    id: COORDINATE_SYSTEM_COLUMN_ID,
    name: coordinateSystemColumnName,
    type: TypeUtils.RowOf(coordinateSystemGridId),
  };
}

export const getCoordinateSystemData = (csValue: RowValue, environment: FormulaEnvironment): CoordinateSystem => {
  const centerValue = project(csValue, 'Center', environment) as RowValue;
  const xValue = project(centerValue, 'X', environment) as NumberValue;
  const yValue = project(centerValue, 'Y', environment) as NumberValue;
  const scaleValue = project(csValue, 'Scale', environment) as NumberValue;
  const rotationValue = project(csValue, 'Rotation', environment) as RowValue;
  const ccwValue = project(rotationValue, 'Rotation CCW', environment) as NumberValue;
  const x = xValue.value;
  const y = yValue.value;
  const center = {x, y}
  const scale = scaleValue.value;
  const ccw = ccwValue.value;
  const rotation = {ccw};
  return {center, scale, rotation};
}

const project = (rowValue: RowValue, columnName: string, environment: FormulaEnvironment): Value => {
  const grid = environment.getGridById(rowValue.type.schemaId.gridId);
  const ns = grid.namespace;
  const columnId = ns.getReferenceForName(columnName)!.id;
  return rowValue.dict[columnId];
}