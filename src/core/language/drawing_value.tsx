import * as _ from 'lodash';

import {CoordinateSystem, Scalar} from '@core/geometry';

// for now, use these stand-in types
type Color = string;
type SVGPathString = string;

export enum OLD_DrawingVariant {
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
  drawingType: OLD_DrawingVariant,
}

interface BaseShapeDrawing extends BaseDrawing {
  fill: Color,
  // stroke: number,
  // stroke-color: Color,
}

interface Circle extends BaseShapeDrawing {
  drawingType: OLD_DrawingVariant.CIRCLE,
  radius: Scalar,
}

interface Ellipse extends BaseShapeDrawing {
  drawingType: OLD_DrawingVariant.ELLIPSE,
  radius1: Scalar,
  radius2: Scalar,
}

interface Path extends BaseShapeDrawing {
  drawingType: OLD_DrawingVariant.PATH,
  path: SVGPathString,
}

interface Group extends BaseDrawing {
  drawingType: OLD_DrawingVariant.GROUP,
  drawings: OLD_Drawing[],
  coordinateSystem: CoordinateSystem,
}

export type OLD_Drawing = Circle | Ellipse | Path | Group;

export function OLD_drawingsAreEqual(d1: OLD_Drawing, d2: OLD_Drawing): boolean {
  return _.isEqual(d1, d2);
}

export function OLD_isGroup(v: OLD_Drawing): v is Group {
  return v.drawingType === OLD_DrawingVariant.GROUP;
}

export function OLD_isEmptyDrawing(v: OLD_Drawing): boolean {
  return OLD_isGroup(v) && v.drawings.length === 0;
}