export type Scalar = number;

export interface Rotation {
  readonly ccw: number; // fraction of a full counterclockwise rotation
}

export interface Vector {
  readonly x: Scalar;
  readonly y: Scalar;
}

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

  public static readonly defaultScalar: Scalar = 100;
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
  public static polarVectorOf = (scalar: Scalar, rotationFromRight: Rotation): PolarVector => ({scalar, rotationFromRight})

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
}