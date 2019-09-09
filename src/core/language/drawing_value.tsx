import * as _ from 'lodash';

import {CoordinateSystem, Scalar} from '@core/geometry';

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
  GROUP = "GROUP",
}

interface BaseDrawing {
  drawingType: DrawingVariant,
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

interface Group extends BaseDrawing {
  drawingType: DrawingVariant.GROUP,
  drawings: Drawing[],
  coordinateSystem: CoordinateSystem,
}

export type Drawing = Circle | Ellipse | Path | Group;

export function drawingsAreEqual(d1: Drawing, d2: Drawing): boolean {
  return _.isEqual(d1, d2);
}

export function isGroup(v: Drawing): v is Group {
  return v.drawingType === DrawingVariant.GROUP;
}

export function isEmptyDrawing(v: Drawing): boolean {
  return isGroup(v) && v.drawings.length === 0;
}