import * as _ from 'lodash';
import {Drawing, drawingsAreEqual, isDrawing} from './drawing_value';

// TODO - generalize this definition
export type Value = string | Drawing | undefined;

export function valuesAreEqual(v1: Value, v2: Value): boolean {
  return isDrawing(v1) && isDrawing(v2) ? drawingsAreEqual(v1, v2) : v1 === v2;
}