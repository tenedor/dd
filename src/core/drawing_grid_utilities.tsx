import * as _ from 'lodash';

import {OLD_Drawing, OLD_DrawingVariant, OLD_isEmptyDrawing} from '@language/drawing_value';
import {ListValue, OLD_DrawingValue, RowValue, Value, ValueUtils} from '@language/values';
import {assertUnreachable} from '@utils/utils';
import {CoordinateSystem, defaultCoordinateSystem} from './geometry';
import {Identifier, Type, TypeUtils} from './language/types';

const drawingColumnName = "DRAWING_GROUP";
export const coordinateSystemColumnName = "Transform";
export const COORDINATE_SYSTEM_GRID_NAME = 'Coordinate System';
const builtInDrawingColumnName = "BUILT_IN_DRAWING";

// These ids should match the UID pattern for columns. They cannot be calculated since
// they are used to specify TS types.
export const OLD_DRAWING_COLUMN_ID = 'col-_DRAWING_';
export const COORDINATE_SYSTEM_COLUMN_ID = 'col-_COORDINATE_SYSTEM_';
const BUILT_IN_DRAWING_COLUMN_ID = 'col-_BUILT_IN_DRAWING_';

type ValueWithDrawing = OLD_DrawingValue | ListValue | RowValue;

const hasDrawing = (v: Value): v is ValueWithDrawing => {
  const baseType = TypeUtils.getBaseType(v.type);
  return TypeUtils.OLD_isDrawing(baseType) || TypeUtils.isRow(baseType);
}

const getDrawingValue = (v: ValueWithDrawing): OLD_DrawingValue => {
  if (ValueUtils.OLD_isDrawing(v)) {
    return v;
  } else if (ValueUtils.isRow(v)) {
    return v.dict[OLD_DRAWING_COLUMN_ID] as OLD_DrawingValue;
  } else if (ValueUtils.isList(v)) {
    const flattenedList = ValueUtils.deepFlattenList(v);
    const valuesWithDrawings = flattenedList.list as ValueWithDrawing[];
    const drawingValues = valuesWithDrawings.map(getDrawingValue);
    const drawings = drawingValues.map(d => d.drawing);
    return OLD_makeDrawingGroupValue(drawings);
  }
  return assertUnreachable(v);
}

export const OLD_getDrawing = (v: ValueWithDrawing): OLD_Drawing => getDrawingValue(v).drawing; // tslint:disable-line

export const OLD_hasNonEmptyDrawing = (v: Value): v is ValueWithDrawing => hasDrawing(v) && !OLD_isEmptyDrawing(OLD_getDrawing(v)); // tslint:disable-line

export const OLD_getDrawingColumnData = (): {id: string, name: string, type: Type} => { // tslint:disable-line
  return {id: OLD_DRAWING_COLUMN_ID, name: drawingColumnName, type: TypeUtils.OLD_Drawing};
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

export const OLD_getBuiltInDrawingColumnData = (): {id: string, name: string, type: Type} => { // tslint:disable-line
  return {id: BUILT_IN_DRAWING_COLUMN_ID, name: builtInDrawingColumnName, type: TypeUtils.OLD_Drawing};
}

export const OLD_makeDrawingGroup = (drawings: OLD_Drawing[], coordinateSystem?: CoordinateSystem): OLD_Drawing => { // tslint:disable-line
  const drawingType = OLD_DrawingVariant.GROUP;
  const _coordinateSystem = coordinateSystem || defaultCoordinateSystem;
  return {drawingType, drawings, coordinateSystem: _coordinateSystem};
}

export const OLD_makeDrawingGroupValue = (drawings: OLD_Drawing[], coordinateSystem?: CoordinateSystem): OLD_DrawingValue => { // tslint:disable-line
  return ValueUtils.OLD_drawingOf(OLD_makeDrawingGroup(drawings, coordinateSystem));
}