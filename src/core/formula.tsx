import * as _ from 'lodash';
import {Dictionary} from '../utils/types';
import {assert, assertUnreachable} from '../utils/utils';
import {Cell} from './cell'; // only a type dependency
import {Circle, DrawingPrimitive, Ellipse, Path} from './drawing_value';
import {Grid} from './grid'; // only a type dependency
import {Value} from './value';

export enum FormulaName {
  DRAW_CIRCLE = "DrawCircle",
  DRAW_ELLIPSE = "DrawEllipse",
  DRAW_PATH = "DrawPath",
}

export const formulaNameSet: {[N in FormulaName]: true} = {
  "DrawCircle": true,
  "DrawEllipse": true,
  "DrawPath": true,
};

export function isFormulaName(formulaName: string): formulaName is FormulaName {
  return !!formulaNameSet[formulaName];
}

export type DrawingFormulaName =
  FormulaName.DRAW_CIRCLE |
  FormulaName.DRAW_ELLIPSE |
  FormulaName.DRAW_PATH;

// limit to first-order formulas of column values
export interface Formula<N extends FormulaName = FormulaName> {
  name: N,
  args: string[],
}

export type DrawingFormula = Formula<DrawingFormulaName>;

export interface MaterializedFormula extends Formula {
  materializedArgs: Value[],
}

export function isDrawingFormula(formula: Formula): formula is DrawingFormula {
  switch (formula.name) {
    case FormulaName.DRAW_CIRCLE:
    case FormulaName.DRAW_ELLIPSE:
    case FormulaName.DRAW_PATH:
      const staticTypeCheck: DrawingFormulaName = formula.name;
      return true || !!staticTypeCheck;
    default:
      return assertUnreachable(formula.name);
  }
}

// TODO - generalize this definition
export type Context = Dictionary<Cell>; // map from column id to cell

interface DisplayContext {
  grid: Grid;
}

export function getFormulaAsString(formula: Formula, {grid}: DisplayContext): string {
  const args = formula.args.map(arg => grid.columns.d[arg].name);
  return `${formula.name}(${args.join(", ")})`;
}

function materializeFormula(formula: Formula, context: Context): MaterializedFormula {
  const {name, args} = formula;
  return {
    name,
    args,
    materializedArgs: args.map(c => context[c].value),
  }
}

export function computeFormula(formula: Formula, context: Context): Value {
  const {name, materializedArgs} = materializeFormula(formula, context);
  switch (name) {
    case FormulaName.DRAW_CIRCLE:
      return computeCircleFormula(materializedArgs);
    case FormulaName.DRAW_ELLIPSE:
      return computeEllipseFormula(materializedArgs);
    case FormulaName.DRAW_PATH:
      return computePathFormula(materializedArgs);
    default:
      return assertUnreachable(name);
  }
}

function computeCircleFormula(args: Value[]): Circle {
  assert(args.length === 4, 'invalid arg count');
  // TODO: return an error value if args are erroring or incorrectly typed
  const radius = parseFloat(args[0] as string || "");
  const x = parseFloat(args[1] as string || "");
  const y = parseFloat(args[2] as string || "");
  const fill = args[3] as string || "";
  return {
    type: DrawingPrimitive.CIRCLE,
    radius,
    center: {x, y},
    rotation: {ccw: 0},
    fill,
    children: [],
  };
}

function computeEllipseFormula(args: Value[]): Ellipse {
  assert(args.length === 5, 'invalid arg count');
  // TODO: return an error value if args are erroring or incorrectly typed
  const radius1 = parseFloat(args[0] as string || "");
  const radius2 = parseFloat(args[1] as string || "");
  const x = parseFloat(args[2] as string || "");
  const y = parseFloat(args[3] as string || "");
  const fill = args[4] as string || "";
  return {
    type: DrawingPrimitive.ELLIPSE,
    radius1,
    radius2,
    center: {x, y},
    rotation: {ccw: 0},
    fill,
    children: [],
  };
}

function computePathFormula(args: Value[]): Path {
  assert(args.length === 4, 'invalid arg count');
  // TODO: return an error value if args are erroring or incorrectly typed
  const path = args[0] as string || "";
  const x = parseFloat(args[1] as string || "");
  const y = parseFloat(args[2] as string || "");
  const fill = args[3] as string || "";
  return {
    type: DrawingPrimitive.PATH,
    path,
    center: {x, y},
    rotation: {ccw: 0},
    fill,
    children: [],
  };
}