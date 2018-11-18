import {Formula, GridColumn} from '../core/grid_column';

export interface ParseContext {
  columns: ReadonlyArray<GridColumn>,
}

export interface SuccessfulParseResult {
  parseSucceeded: true,
  unparsedFormula: string,
  formula: Formula,
}

export interface FailedParseResult {
  parseSucceeded: false,
  unparsedFormula: string,
}

export type ParseResult = SuccessfulParseResult | FailedParseResult;

// this will only recognize a formula whose arguments are identifiers or integers
const simpleFormulaRegex = /(\w+)\((\w*(, *\w*)*)\)/;

export function parseFormula(unparsedFormula: string, {columns}: ParseContext): ParseResult {
  const match = unparsedFormula.match(simpleFormulaRegex);
  if (!match) {
    return {parseSucceeded: false, unparsedFormula};
  }
  const columnIdsByName: {[name: string]: string} = {};
  columns.forEach(c => columnIdsByName[c.name] = c.columnId);
  const name = match[1];
  const argsString = match[2];
  const args = argsString.split(',').map(argName => columnIdsByName[argName.trim()]);
  const formula = {name, args};
  return {parseSucceeded: true, unparsedFormula, formula};
}
