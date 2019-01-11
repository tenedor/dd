import * as _ from 'lodash';
import {assertUnreachable} from '../utils/utils';
import {isRotation, isScalar, isVector, Rotation, Scalar, Vector} from './geometry';

// for now, use these stand-in types
type Color = string;
function isColor(value: any): value is Color {
  return typeof value === "string";
}
type SVGPathString = string;
function isSVGPathString(value: any): value is SVGPathString {
  return typeof value === "string";
}

export enum DrawingPrimitive {
  CIRCLE = "CIRCLE",
  ELLIPSE = "ELLIPSE",
  LINE = "LINE",
  PATH = "PATH",
  POLYGON = "POLYGON",
  POLYLINE = "POLYLINE",
  RECT = "RECT",
}

export interface BaseDrawing {
  type: DrawingPrimitive,
  center: Vector,
  rotation: Rotation,
  fill: Color,
  // stroke: number,
  // stroke-color: Color,
  children: Drawing[],
}

export function isBaseDrawing(value: any): value is BaseDrawing {
  return value &&
    Object.keys(DrawingPrimitive).indexOf(value.type) > -1 &&
    isVector(value.center) &&
    isRotation(value.rotation) &&
    isColor(value.fill) &&
    Array.isArray(value.children);
}

export interface Circle extends BaseDrawing {
  type: DrawingPrimitive.CIRCLE,
  radius: Scalar,
}

export function isCircle(value: BaseDrawing): value is Circle {
  const tryCircle = value as Circle;
  return tryCircle.type === DrawingPrimitive.CIRCLE &&
    isScalar(tryCircle.radius);
}

export interface Ellipse extends BaseDrawing {
  type: DrawingPrimitive.ELLIPSE,
  radius1: Scalar,
  radius2: Scalar,
}

export function isEllipse(value: BaseDrawing): value is Ellipse {
  const tryEllipse = value as Ellipse;
  return tryEllipse.type === DrawingPrimitive.ELLIPSE &&
    isScalar(tryEllipse.radius1) &&
    isScalar(tryEllipse.radius2);
}

export interface Path extends BaseDrawing {
  type: DrawingPrimitive.PATH,
  path: SVGPathString,
}

export function isPath(value: BaseDrawing): value is Path {
  const tryPath = value as Path;
  return tryPath.type === DrawingPrimitive.PATH &&
    isSVGPathString(tryPath.path);
}

export type Drawing = Circle | Ellipse | Path;

export function isDrawing(value: any): value is Drawing {
  if (!isBaseDrawing(value)) {
    return false;
  }
  switch (value.type) {
    case DrawingPrimitive.CIRCLE:
      return isCircle(value);
    case DrawingPrimitive.ELLIPSE:
      return isEllipse(value);
    case DrawingPrimitive.PATH:
      return isPath(value);
    case DrawingPrimitive.LINE:
    case DrawingPrimitive.POLYGON:
    case DrawingPrimitive.POLYLINE:
    case DrawingPrimitive.RECT:
      return false;
    default:
      return assertUnreachable(value.type);
  }
}

export function drawingsAreEqual(d1: Drawing, d2: Drawing): boolean {
  return _.isEqual(d1, d2);
}