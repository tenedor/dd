import * as _ from 'lodash';

import {CoordinateSystem, Scalar} from '@core/geometry';

// for now, use these stand-in types
type Color = string;
type SVGPathString = string;

enum DrawingType {
  CIRCLE = "CIRCLE",
  ELLIPSE = "ELLIPSE",
  // LINE = "LINE",
  PATH = "PATH",
  // POLYGON = "POLYGON",
  // POLYLINE = "POLYLINE",
  // RECT = "RECT",
  GROUP = "GROUP",
  LIST = "LIST",
}

interface BaseDrawing {
  drawingType: DrawingType,
}

interface BasePrimitiveDrawing extends BaseDrawing {
  drawingType: Exclude<DrawingType, DrawingType.GROUP>;
  fill: Color,
  // stroke: number,
  // stroke-color: Color,
}

interface Circle extends BasePrimitiveDrawing {
  drawingType: DrawingType.CIRCLE,
  radius: Scalar,
}

interface Ellipse extends BasePrimitiveDrawing {
  drawingType: DrawingType.ELLIPSE,
  radius1: Scalar,
  radius2: Scalar,
}

interface Path extends BasePrimitiveDrawing {
  drawingType: DrawingType.PATH,
  path: SVGPathString,
}

interface DrawingGroup extends BaseDrawing {
  drawingType: DrawingType.GROUP,
  drawings: {[columnId: string]: Drawing},
  transform: CoordinateSystem,
}

interface DrawingList extends BaseDrawing {
  drawingType: DrawingType.LIST,
  drawings: Drawing[],
}

export type PrimitiveDrawing = Circle | Ellipse | Path;
export type Drawing = PrimitiveDrawing | DrawingGroup | DrawingList;


type BasePrimitiveParameters = Omit<BasePrimitiveDrawing, "drawingType">

export class DrawingUtils {

  // ============
  // Constructors
  // ============

  public static circleOf = ({radius, fill}: {radius: number} & BasePrimitiveParameters): Circle => ({
    drawingType: DrawingType.CIRCLE, radius, fill,
  })

  public static ellipseOf = ({radius1, radius2, fill}: {radius1: number, radius2: number} & BasePrimitiveParameters): Ellipse => ({
    drawingType: DrawingType.ELLIPSE, radius1, radius2, fill,
  })

  public static pathOf = ({path, fill}: {path: string} & BasePrimitiveParameters): Path => ({
    drawingType: DrawingType.PATH, path, fill,
  })

  public static groupOf = (drawings: {[columnId: string]: Drawing}, transform: CoordinateSystem): DrawingGroup => ({
    drawingType: DrawingType.GROUP, drawings, transform,
  })

  public static listOf = (drawings: Drawing[]): DrawingList => ({
    drawingType: DrawingType.LIST, drawings,
  })


  // ===========
  // Type Guards
  // ===========

  public static isPrimitive = (v: Drawing): v is PrimitiveDrawing =>
      !DrawingUtils.isGroup(v) && !DrawingUtils.isList(v)
  public static isGroup = (v: Drawing): v is DrawingGroup => v.drawingType === DrawingType.GROUP
  public static isList = (v: Drawing): v is DrawingList => v.drawingType === DrawingType.LIST
}