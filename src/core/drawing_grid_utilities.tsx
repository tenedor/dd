import * as _ from 'lodash';

import {Drawing, isEmptyDrawing} from '@language/drawing_value';
import {DrawingValue, RowValue, Value, ValueUtils} from '@language/values';
import {Type, TypeUtils} from './language/types';

// This should match the UID pattern for columns. It cannot be calculated since it is
// used to specify a TS type.
export const DRAWING_COLUMN_ID = 'col-_DRAWING_';

type ValueWithDrawing = DrawingValue | RowValue;

const hasDrawing = (v: Value): v is ValueWithDrawing => ValueUtils.isDrawing(v) || (ValueUtils.isRow(v));

const getDrawingValue = (v: ValueWithDrawing): DrawingValue => ValueUtils.isDrawing(v) ? v : (v.dict[DRAWING_COLUMN_ID] as DrawingValue);

export const getDrawing = (v: ValueWithDrawing): Drawing => getDrawingValue(v).drawing;

export const hasNonEmptyDrawing = (v: Value): v is ValueWithDrawing => hasDrawing(v) && !isEmptyDrawing(getDrawing(v));

export const getDrawingColumnData = (): {id: string, name: string, type: Type} => {
  return {id: DRAWING_COLUMN_ID, name: "DRAWING_COLUMN", type: TypeUtils.Drawing};
}