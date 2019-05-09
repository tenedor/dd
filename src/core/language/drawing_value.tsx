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
}

interface BaseDrawing {
  drawingType: DrawingVariant,
  center: Vector,
  // rotation: Rotation,
  fill: Color,
  // stroke: number,
  // stroke-color: Color,
  // children: Drawing[],
}

interface Circle extends BaseDrawing {
  drawingType: DrawingVariant.CIRCLE,
  radius: Scalar,
}

interface Ellipse extends BaseDrawing {
  drawingType: DrawingVariant.ELLIPSE,
  radius1: Scalar,
  radius2: Scalar,
}

interface Path extends BaseDrawing {
  drawingType: DrawingVariant.PATH,
  path: SVGPathString,
}

export type Drawing = Circle | Ellipse | Path;

export function drawingsAreEqual(d1: Drawing, d2: Drawing): boolean {
  return _.isEqual(d1, d2);
}