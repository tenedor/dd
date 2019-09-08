import * as _ from 'lodash';

import {Scalar, Vector} from '@core/geometry';

// for now, use these stand-in types
type Color = string;
type SVGPathString = string;

export enum DrawingVariant {
  CIRCLE = "CIRCLE",
  ELLIPSE = "ELLIPSE",
  // LINE = "LINE",
  PATH = "PATH",
  // POLYGON = "POLYGON",
  // POLYLINE = "POLYLINE",
  // RECT = "RECT",
  COLLECTION = "COLLECTION",
}

interface BaseDrawing {
  drawingType: DrawingVariant,
  center: Vector,
  // rotation: Rotation,
}

interface BaseShapeDrawing extends BaseDrawing {
  fill: Color,
  // stroke: number,
  // stroke-color: Color,
}

interface Circle extends BaseShapeDrawing {
  drawingType: DrawingVariant.CIRCLE,
  radius: Scalar,
}

interface Ellipse extends BaseShapeDrawing {
  drawingType: DrawingVariant.ELLIPSE,
  radius1: Scalar,
  radius2: Scalar,
}

interface Path extends BaseShapeDrawing {
  drawingType: DrawingVariant.PATH,
  path: SVGPathString,
}

interface Collection extends BaseDrawing {
  drawingType: DrawingVariant.COLLECTION,
  drawings: Drawing[],
}

export type Drawing = Circle | Ellipse | Path | Collection;

export function drawingsAreEqual(d1: Drawing, d2: Drawing): boolean {
  return _.isEqual(d1, d2);
}

export function isCollection(v: Drawing): v is Collection {
  return v.drawingType === DrawingVariant.COLLECTION;
}

export function isEmptyDrawing(v: Drawing): boolean {
  return isCollection(v) && v.drawings.length === 0;
}