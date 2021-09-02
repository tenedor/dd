import * as _ from 'lodash';

import {CoordinateSystem, Scalar} from '@core/geometry';
import {ROArray, RODictionary} from '@utils/types';
import {assertUnreachable} from '@utils/utils';
import {Affordance} from './affordance';

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
  TEXT = "TEXT",
  GROUP = "GROUP",
  LIST = "LIST",
}

interface BaseDrawing<T extends DrawingType> {
  readonly drawingType: T,
}

interface BasePrimitiveDrawing<T extends Exclude<DrawingType, DrawingType.GROUP | DrawingType.LIST>> extends BaseDrawing<T> {
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

interface Text extends BasePrimitiveDrawing<DrawingType.TEXT> {
  readonly text: string,
}

export interface DrawingGroup extends BaseDrawing<DrawingType.GROUP> {
  readonly drawings: RODictionary<Drawing>,
  readonly transform: CoordinateSystem,
  readonly affordances: ROArray<Affordance>,
}

interface DrawingList extends BaseDrawing<DrawingType.LIST> {
  readonly drawings: ROArray<Drawing>,
}

export type PrimitiveDrawing = Circle | Ellipse | Path | Text;
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

  public static textOf = ({text, fill}: {text: string} & BasePrimitiveParameters): Text => ({
    drawingType: DrawingType.TEXT, text, fill,
  })

  public static groupOf = ({drawings, transform, affordances}: {
    drawings: RODictionary<Drawing>, transform: CoordinateSystem, affordances: ROArray<Affordance>,
  }): DrawingGroup => ({
    drawingType: DrawingType.GROUP, drawings, transform, affordances,
  })

  public static listOf = (drawings: ROArray<Drawing>): DrawingList => ({
    drawingType: DrawingType.LIST, drawings,
  })


  // ===========
  // Type Guards
  // ===========

  public static isPrimitive = (d: Drawing): d is PrimitiveDrawing =>
      !DrawingUtils.isGroup(d) && !DrawingUtils.isList(d)
  public static isGroup = (d: Drawing): d is DrawingGroup => d.drawingType === DrawingType.GROUP
  public static isList = (d: Drawing): d is DrawingList => d.drawingType === DrawingType.LIST


  // =========
  // Utilities
  // =========

  public static isEmpty = (d: Drawing): boolean => {
    if (DrawingUtils.isPrimitive(d)) {
      return false;
    } else if (DrawingUtils.isGroup(d)) {
      return d.affordances.length === 0 && _.every(d.drawings, dd => DrawingUtils.isEmpty(dd));
    } else if (DrawingUtils.isList(d)) {
      return _.every(d.drawings, dd => DrawingUtils.isEmpty(dd));
    } else {
      return assertUnreachable(d);
    }
  }
}