import * as _ from 'lodash';
import {Dictionary} from '../utils/types';
import {assert} from '../utils/utils';
import {Cell} from './cell'; // only a type dependency
import {Grid} from './grid'; // only a type dependency
import {Drawing, DrawingPrimitive, Value} from './value';

// limit to first-order formulas of column values
export interface Formula {
  name: string,
  args: string[],
}

export interface MaterializedFormula extends Formula {
  materializedArgs: Value[],
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
  const materializedFormula = materializeFormula(formula, context);
  // for now, all formulas are drawing formulas
  return computeDrawingFormula(materializedFormula);
}

export function isDrawingFormula(formula: Formula): boolean {
  return formula.name === 'DrawCircle';
}

function computeDrawingFormula(formula: MaterializedFormula): Drawing {
  assert(isDrawingFormula(formula), 'expected drawing formula');
  const args = formula.materializedArgs;
  assert(args.length === 4, 'invalid arg count');
  // TODO: return an error value if args are erroring or incorrectly typed
  const radius = parseFloat(args[0] as string || "");
  const x = parseFloat(args[1] as string || "");
  const y = parseFloat(args[2] as string || "");
  const fill = args[3] as string || "";
  return {
    type: DrawingPrimitive.CIRCLE,
    radius,
    x,
    y,
    rotation: 0,
    fill,
    children: [],
  };
}

