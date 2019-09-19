import * as _ from 'lodash';

import {Drawing, DrawingVariant, isEmptyDrawing} from '@language/drawing_value';
import {DrawingValue, ListValue, RowValue, Value, ValueUtils} from '@language/values';
import {assertUnreachable} from '@utils/utils';
import {CoordinateSystem, defaultCoordinateSystem} from './geometry';
import {Identifier, Type, TypeUtils} from './language/types';

const drawingColumnName = "DRAWING_GROUP";
export const coordinateSystemColumnName = "Transform";
export const COORDINATE_SYSTEM_GRID_NAME = 'Coordinate System';
const builtInDrawingColumnName = "BUILT_IN_DRAWING";

// These ids should match the UID pattern for columns. They cannot be calculated since
// they are used to specify TS types.
export const DRAWING_COLUMN_ID = 'col-_DRAWING_';
export const COORDINATE_SYSTEM_COLUMN_ID = 'col-_COORDINATE_SYSTEM_';
const BUILT_IN_DRAWING_COLUMN_ID = 'col-_BUILT_IN_DRAWING_';

type ValueWithDrawing = DrawingValue | ListValue | RowValue;

const hasDrawing = (v: Value): v is ValueWithDrawing => {
  const baseType = TypeUtils.getBaseType(v.type);
  return TypeUtils.isDrawing(baseType) || TypeUtils.isRow(baseType);
}

const getDrawingValue = (v: ValueWithDrawing): DrawingValue => {
  if (ValueUtils.isDrawing(v)) {
    return v;
  } else if (ValueUtils.isRow(v)) {
    return v.dict[DRAWING_COLUMN_ID] as DrawingValue;
  } else if (ValueUtils.isList(v)) {
    const flattenedList = ValueUtils.deepFlattenList(v);
    const valuesWithDrawings = flattenedList.list as ValueWithDrawing[];
    const drawingValues = valuesWithDrawings.map(getDrawingValue);
    const drawings = drawingValues.map(d => d.drawing);
    return makeDrawingGroupValue(drawings);
  }
  return assertUnreachable(v);
}

export const getDrawing = (v: ValueWithDrawing): Drawing => getDrawingValue(v).drawing;

export const hasNonEmptyDrawing = (v: Value): v is ValueWithDrawing => hasDrawing(v) && !isEmptyDrawing(getDrawing(v));

export const getDrawingColumnData = (): {id: string, name: string, type: Type} => {
  return {id: DRAWING_COLUMN_ID, name: drawingColumnName, type: TypeUtils.Drawing};
}

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

export const getBuiltInDrawingColumnData = (): {id: string, name: string, type: Type} => {
  return {id: BUILT_IN_DRAWING_COLUMN_ID, name: builtInDrawingColumnName, type: TypeUtils.Drawing};
}

export const makeDrawingGroup = (drawings: Drawing[], coordinateSystem?: CoordinateSystem): Drawing => {
  const drawingType = DrawingVariant.GROUP;
  const _coordinateSystem = coordinateSystem || defaultCoordinateSystem;
  return {drawingType, drawings, coordinateSystem: _coordinateSystem};
}

export const makeDrawingGroupValue = (drawings: Drawing[], coordinateSystem?: CoordinateSystem): DrawingValue => {
  return ValueUtils.drawingOf(makeDrawingGroup(drawings, coordinateSystem));
}