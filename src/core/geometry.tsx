// Scalar
// ------

export type Scalar = number;

export function isScalar(value: any): value is Scalar {
  return typeof value === "number";
}

// Rotation
// --------

export interface Rotation {
  readonly ccw: number; // fraction of a full counterclockwise rotation
}

export function isRotation(value: any): value is Rotation {
  return value && typeof value.ccw === "number";
}

export function rotationFromFraction(fractionalRotation: number, clockwise = false): Rotation {
  return {ccw: (clockwise ? -1 : 1) * fractionalRotation};
}

export function rotationFromDegrees(degrees: number, clockwise = false): Rotation {
  return {ccw: (clockwise ? -1 : 1) * degrees / 360};
}

export function rotationFromRadians(radians: number, clockwise = false): Rotation {
  return {ccw: (clockwise ? -1 : 1) * radians / (2 * Math.PI)};
}

// Vector
// ------

export interface Vector {
  readonly x: Scalar;
  readonly y: Scalar;
}

export function isVector(value: any): value is Vector {
  return value && isScalar(value.x) && isScalar(value.y);
}

export function vectorFromCartesianCoordinates(x: Scalar, y: Scalar): Vector {
  return {x, y};
};

// The rotational reference direction is straight to the right.
export function vectorFromPolarCoordinates(scalar: Scalar, rotationFromRight: Rotation): Vector {
  const angle = 2 * Math.PI * rotationFromRight.ccw;
  return {x: scalar * Math.cos(angle), y: scalar * Math.sin(angle)};
};