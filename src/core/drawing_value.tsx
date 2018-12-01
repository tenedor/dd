import * as _ from 'lodash';
import {assertUnreachable} from '../utils/utils';

export enum DrawingPrimitive {
  CIRCLE = "CIRCLE",
}

export interface BaseDrawing {
  type: DrawingPrimitive,
  x: number,
  y: number,
  rotation: number,
  fill: string,
  // stroke: number
  // stroke-color: string
  children: Drawing[],
}

export function isBaseDrawing(value: any): value is BaseDrawing {
  return value &&
    Object.keys(DrawingPrimitive).indexOf(value.type) > -1 &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.rotation === "number" &&
    typeof value.fill === "string" &&
    Array.isArray(value.children);
}

export interface Circle extends BaseDrawing {
  type: DrawingPrimitive.CIRCLE,
  radius: number,
}

export function isCircle(value: BaseDrawing): value is Circle {
  const tryCircle = value as Circle;
  return tryCircle.type === DrawingPrimitive.CIRCLE && typeof tryCircle.radius === "number";
}

export type Drawing = Circle;

export function isDrawing(value: any): value is Drawing {
  if (!isBaseDrawing(value)) {
    return false;
  }
  switch (value.type) {
    case DrawingPrimitive.CIRCLE:
      return isCircle(value);
    default:
      return assertUnreachable(value.type);
  }
}

export function drawingsAreEqual(d1: Drawing, d2: Drawing): boolean {
  return _.isEqual(d1, d2);
}