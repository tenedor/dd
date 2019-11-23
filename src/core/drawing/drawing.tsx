import * as _ from 'lodash';

import {CoordinateSystem, Scalar} from '@core/geometry';
import {ROArray, RODictionary} from '@utils/types';

// for now, use these stand-in types
type Color = string;
type SVGPathString = string;

export enum DrawingType {
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

interface BaseDrawing<T extends DrawingType> {
  readonly drawingType: T,
}

interface BasePrimitiveDrawing<T extends Exclude<DrawingType, DrawingType.GROUP>> extends BaseDrawing<T> {
  readonly fill: Color,
  // stroke: number,
  // stroke-color: Color,
}

interface Circle extends BasePrimitiveDrawing<DrawingType.CIRCLE> {
  readonly radius: Scalar,
}

interface Ellipse extends BasePrimitiveDrawing<DrawingType.ELLIPSE> {
  readonly radius1: Scalar,
  readonly radius2: Scalar,
}

interface Path extends BasePrimitiveDrawing<DrawingType.PATH> {
  readonly path: SVGPathString,
}

interface DrawingGroup extends BaseDrawing<DrawingType.GROUP> {
  readonly drawings: RODictionary<Drawing>,
  readonly transform: CoordinateSystem,
}

interface DrawingList extends BaseDrawing<DrawingType.LIST> {
  readonly drawings: ROArray<Drawing>,
}

export type PrimitiveDrawing = Circle | Ellipse | Path;
export type Drawing = PrimitiveDrawing | DrawingGroup | DrawingList;

export const DRAWING_PRIMITIVE_PATH_ID = "PRIMITIVE";


type BasePrimitiveParameters = Omit<BasePrimitiveDrawing<any>, "drawingType">

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

  public static groupOf = ({drawings, transform}: {drawings: RODictionary<Drawing>, transform: CoordinateSystem}): DrawingGroup => ({
    drawingType: DrawingType.GROUP, drawings, transform,
  })

  public static listOf = (drawings: ROArray<Drawing>): DrawingList => ({
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