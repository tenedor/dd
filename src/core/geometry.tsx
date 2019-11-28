import {assert} from '@utils/utils';

export type Scalar = number;

export interface Rotation {
  readonly ccw: number; // fraction of a full counterclockwise rotation
}

export interface Vector {
  readonly x: Scalar;
  readonly y: Scalar;
}

export type Position = Vector;
export type Displacement = Vector;

// The rotational reference direction is straight to the right.
export interface PolarVector {
  readonly scalar: Scalar;
  readonly rotationFromRight: Rotation;
}

export interface CoordinateSystem {
  center: Vector,
  scale: Scalar,
  rotation: Rotation,
}


export class GeometryUtils {

  // ==============
  // Default Values
  // ==============

  public static readonly defaultScalar: Scalar = 1;
  public static readonly defaultRotation: Rotation = {ccw: 0};
  public static readonly defaultVector: Vector = {x: 0, y: 0};

  public static readonly defaultCoordinateSystem: CoordinateSystem = {
    center: GeometryUtils.defaultVector,
    scale: GeometryUtils.defaultScalar,
    rotation: GeometryUtils.defaultRotation,
  };


  // ============
  // Constructors
  // ============

  public static rotationOf = (ccw: number): Rotation => ({ccw})
  public static vectorOf = (x: Scalar, y: Scalar): Vector => ({x, y})
  public static polarVectorOf = (scalar: Scalar, rotationFromRight: Rotation): PolarVector =>
      ({scalar, rotationFromRight})
  public static coordinateSystemOf = (center: Vector, scale: Scalar, rotation: Rotation): CoordinateSystem =>
      ({center, scale, rotation})

  public static vectorFromPolarVector = (pv: PolarVector): Vector => {
    const angle = 2 * Math.PI * pv.rotationFromRight.ccw;
    const x = pv.scalar * Math.cos(angle);
    const y = pv.scalar * Math.sin(angle);
    return {x, y};
  }

  public static polarVectorFromVector = (v: Vector): PolarVector => {
    const scalar = Math.sqrt(v.x * v.x + v.y * v.y);
    const rotationFromRight = {ccw: Math.atan2(v.y, v.x) / (2 * Math.PI)};
    return {scalar, rotationFromRight};
  }


  // ===========
  // Type Guards
  // ===========

  public static isScalar = (value: any): value is Scalar => typeof value === "number"
  public static isRotation = (value: any): value is Rotation => value && typeof value.ccw === "number"
  public static isVector = (value: any): value is Vector =>
    value && GeometryUtils.isScalar(value.x) && GeometryUtils.isScalar(value.y)
  public static isPolarVector = (value: any): value is PolarVector =>
    value && GeometryUtils.isScalar(value.scalar) && GeometryUtils.isRotation(value.rotationFromRight)


  // =================
  // Composition Logic
  // =================

  public static multiplyScalars = (s1: Scalar, s2: Scalar): Scalar => {
    return s1 * s2;
  }

  public static addRotations = (r1: Rotation, r2: Rotation): Rotation => {
    return {ccw: r1.ccw + r2.ccw};
  }

  public static addVectors = (v1: Vector, v2: Vector): Vector => {
    return {x: v1.x + v2.x, y: v1.y + v2.y};
  }

  public static scaleVector = (s: Scalar, v: Vector): Vector => {
    return {x: s * v.x, y: s * v.y};
  }

  public static rotateVector = (r: Rotation, v: Vector): Vector => {
    const {scalar, rotationFromRight} = GeometryUtils.polarVectorFromVector(v);
    const rotated = {scalar, rotationFromRight: GeometryUtils.addRotations(r, rotationFromRight)}
    return GeometryUtils.vectorFromPolarVector(rotated);
  }

  // Apply the transform cs(v) = s * R * v + d, where:
  //   s: scale scalar
  //   R: rotation matrix
  //   d: displacement vector (aka "center")
  public static applyCoordinateTransformToPoint = (cs: CoordinateSystem, v: Vector): Vector => {
    return GeometryUtils.addVectors(cs.center,
      GeometryUtils.scaleVector(cs.scale,
        GeometryUtils.rotateVector(cs.rotation, v)));
  }

  // Apply the transform cs(v) = s * R * v, where:
  //   s: scale scalar
  //   R: rotation matrix
  //
  // This treats the vector as a delta between points in the coordinate system's basis,
  // e.g. a displacement instead of a position. Correspondingly the coordinate system's
  // constant displacement is dropped.
  public static applyCoordinateTransformToDelta = (cs: CoordinateSystem, v: Vector): Vector => {
    return GeometryUtils.scaleVector(cs.scale,
        GeometryUtils.rotateVector(cs.rotation, v));
  }

  public static composeCoordinateSystems = (outer: CoordinateSystem, inner: CoordinateSystem): CoordinateSystem => {
    const center = GeometryUtils.applyCoordinateTransformToPoint(outer, inner.center);
    const scale = GeometryUtils.multiplyScalars(outer.scale, inner.scale);
    const rotation = GeometryUtils.addRotations(outer.rotation, inner.rotation);
    return {center, scale, rotation};
  }

  public static invertCoordinateTransform = (cs: CoordinateSystem): CoordinateSystem => {
    // A coordinate transform has the form:
    //   f_{T, d}(v) = T * v + d
    // Its inverse is therefore:
    //   g_{T, d}(v) = U * (v - d) = U * v - U * d = f_{U, -U * d}  where U = T^-1
    assert(cs.scale !== 0, "Cannot invert a degenerate coordinate system.");
    const scale = 1 / cs.scale;
    const rotation = {ccw: -1 * cs.rotation.ccw};
    const uMatrix = {center: {x: 0, y: 0}, scale: -scale, rotation};
    const center = GeometryUtils.applyCoordinateTransformToDelta(uMatrix, cs.center);
    return {center, scale, rotation};
  }
}