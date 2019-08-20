import * as _ from 'lodash';

import {AssignmentsUnres, CallUnres} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {NameResolver} from '@language/name_resolver';
import {Parser} from '@language/parser';
import {Type, TypeUtils} from '@language/types';
import {ValueOrAST, ValueUtils} from '@language/values';
import {UpdateManager} from '@models/core/update_manager';
import {Column} from '@models/domain_specific/column';
import {Document} from '@models/domain_specific/document';
import {Grid} from '@models/domain_specific/grid';
import {GridColumn} from '@models/domain_specific/grid_column';
import {Row} from '@models/domain_specific/row';

// Draw a regular n-pointed star with density m and the specified side length.
// See https://en.wikipedia.org/wiki/Regular_polygon#Regular_star_polygons.
function getStarPath(n: number, m: number, sideLength: number) {
  // In a regular {n/m} star each acute angle is:
  const angle = Math.PI * (n - 2 * m) / n;

  // Calculate the absolute angles of the star edges. Begin at the top point
  // and work clockwise.
  const angles: number[] = [];
  angles[0] = (3 / 2 * Math.PI) + angle / 2;
  _.range(n - 1).forEach(i => angles.push(angles[i] + Math.PI + angle));

  // Calculate lines of unit length.
  const lines = _.range(n - 1).map(i => [Math.cos(angles[i]), Math.sin(angles[i])]);

  // Calculate top point's offset from center in the same units.
  const point = [0, 0.5 / Math.cos(angle / 2)];

  const scaledPoint = point.map(s => (s * sideLength).toFixed(1));
  const scaledLines = lines.map(l => l.map(s => (s * sideLength).toFixed(1)));

  const lineCommands = scaledLines.map(l => `l${l[0]} ${-l[1]}`).join(" ");
  return `m${scaledPoint[0]} ${-scaledPoint[1]} ${lineCommands} z`
}

interface ColumnData {name: string, type: Type};
function generateColumns(
  updateManager: UpdateManager,
  columnsDataMap: {[name: string]: ColumnData},
): {[name: string]: Column} {
  const columnsMap = {};
  Object.keys(columnsDataMap).forEach(name =>
      columnsMap[name] = new Column(updateManager, columnsDataMap[name]));
  return columnsMap;
}

interface GridColumnData<T extends Type = Type> {column: Column<T>, width: number, expressionString?: string};
interface ChildGridColumnData {parentGridColumn: GridColumn, expressionString?: string};
function generateGridColumns(
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
  grid: Grid,
  gridColumnsData: Array<GridColumnData | ChildGridColumnData>,
): GridColumn[] {
  return gridColumnsData.map(gridColumnData => {
    if ('parentGridColumn' in gridColumnData) {
      const {parentGridColumn} = gridColumnData;
      const {type} = parentGridColumn;
      return GridColumn.fromParent(parentGridColumn, {grid, type});
    } else {
      const {column, width} = gridColumnData;
      const {type} = column;
      return new GridColumn(updateManager, {
        column,
        formulaEnvironment,
        grid,
        type,
        width,
      });
    }
  });
}

function setColumnExpressions(grid: Grid, gridColumnsData: Array<GridColumnData | ChildGridColumnData>, resolver: NameResolver) {
  const columns = grid.columns.a;
  gridColumnsData.map(({expressionString}, i) => {
    if (expressionString) {
      const parseResult = Parser.parseExpression(expressionString);
      if (!parseResult.succeeded) {
        throw new Error("Bad built-in grid formula");
      }
      const ast = parseResult.ast.resolve(resolver);
      columns[i].setExpression(ast);
    }
  });
}

function addRows(
  updateManager: UpdateManager,
  grid: Grid,
  hasParent: boolean,
) {
  const {columns, defaultValues, id: gridId} = grid;
  const rowCount = hasParent ? 3 : 6;
  const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
  const sideLength = (i: number) => 15 * (0.5 + i / 4);
  const rowsValues = _.range(rowCount).map(i => ({
    [columns.get(0)!.columnId]: ValueUtils.numberOf(hasParent ? 100 - i * 20 : i * 10),
    [columns.get(1)!.columnId]: ValueUtils.numberOf(i * i * 3),
    [columns.get(2)!.columnId]: ValueUtils.numberOf((i + 1) * (i + 1) * 2),
    [columns.get(3)!.columnId]: ValueUtils.stringOf(colors[i + (hasParent ? 2 : 0)]),
    [columns.get(4)!.columnId]: ValueUtils.stringOf(getStarPath(5 + 2 * i, 2 + 2 * i, sideLength(i))),
  }));
  setFirstRowValues(grid, rowsValues[0]);
  const laterRowsValues = rowsValues.slice(1);
  const laterRows = laterRowsValues.map(manualValues => new Row(updateManager, {
    columns,
    defaultValues,
    gridId,
    manualValues,
  }));
  grid.addRows(laterRows);
}

function setFirstRowValues(grid: Grid, values: {[columnId: string]: ValueOrAST}) {
  const {cells} = grid.rows.get(0)!;
  Object.keys(values).map(id => cells.get(id)!.setManualValue(values[id]));
}

export function addArithmeticGrid(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {nameResolver} = formulaEnvironment;

  const grid = document.createGrid({name: "Radius Calculator", formulaEnvironment});

  const columnsDataMap = {
    In: {name: 'In', type: TypeUtils.Number},
    Out: {name: 'Out', type: TypeUtils.Number},
  };
  const columns = generateColumns(updateManager, columnsDataMap);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.In, width: 100},
    {column: columns.Out, width: 100, expressionString: 'Square(Value = In / 10 + 1) * 2'},
  ];
  const gridColumns = generateGridColumns(updateManager, formulaEnvironment, grid, gridColumnsData);
  grid.addColumns(gridColumns);
  setColumnExpressions(grid, gridColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid.id)));

  const manualValues = {[gridColumns[0].columnId]: ValueUtils.numberOf(5)};
  setFirstRowValues(grid, manualValues);
}

export function addDerivativeGrid(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {nameResolver} = formulaEnvironment;

  const grid = document.createGrid({name: "Derivative", formulaEnvironment});

  const instanceType = formulaEnvironment.nameResolver.resolveConstructorReference("Radius Calculator").model.returnType;
  const columnsDataMap = {
    In: {name: 'In', type: TypeUtils.Number},
    Mid: {name: 'Mid', type: instanceType},
    Out: {name: 'Out', type: TypeUtils.Number},
  };
  const columns = generateColumns(updateManager, columnsDataMap);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.In, width: 100},
    {column: columns.Mid, width: 200},
    {column: columns.Out, width: 100, expressionString: 'Mid.Out'},
  ];
  const gridColumns = generateGridColumns(updateManager, formulaEnvironment, grid, gridColumnsData);
  grid.addColumns(gridColumns);
  setColumnExpressions(grid, gridColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid.id)));

  const astUnres = new CallUnres("Radius Calculator", new AssignmentsUnres({}, []));
  const astLiteral = astUnres.resolve(nameResolver);
  const manualValues = {
    [gridColumns[0].columnId]: ValueUtils.numberOf(5),
    [gridColumns[1].columnId]: astLiteral,
  };
  setFirstRowValues(grid, manualValues);
}

export function addShapeGrids(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {nameResolver} = formulaEnvironment;

  const columnsDataMap = {
    X: {name: 'X', type: TypeUtils.Number},
    Y: {name: 'Y', type: TypeUtils.Number},
    Radius: {name: 'Radius', type: TypeUtils.Number},
    Fill: {name: 'Fill', type: TypeUtils.String},
    Path: {name: 'Path', type: TypeUtils.String},
    DrawShape: {name: 'Draw Shape', type: TypeUtils.Drawing},
  };
  const columns = generateColumns(updateManager, columnsDataMap);

  const grid1ColumnsData: GridColumnData[] = [
    {column: columns.X, width: 100},
    {column: columns.Y, width: 100},
    {column: columns.Radius, width: 100, expressionString: "'Radius Calculator'(In=X).Out"},
    {column: columns.Fill, width: 100},
    {column: columns.Path, width: 100},
    {column: columns.DrawShape, width: 150, expressionString: 'DrawPath(Path=Path,X=X,Y=Y,Fill=Fill)'},
  ];
  const grid1 = document.createGrid({name: "Shapes", formulaEnvironment});
  const grid1Columns = generateGridColumns(updateManager, formulaEnvironment, grid1, grid1ColumnsData);
  grid1.addColumns(grid1Columns);
  setColumnExpressions(grid1, grid1ColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid1.id)));
  addRows(updateManager, grid1, false);

  const grid2ColumnsData: ChildGridColumnData[] = grid1Columns.map(parentGridColumn => {
    if (parentGridColumn.columnId === columns.DrawShape.id) {
      return {parentGridColumn}
    }
    return {parentGridColumn}
  });
  const grid2 = document.createGrid({name: "More Shapes", parentGrid: grid1, formulaEnvironment});
  const grid2Columns = generateGridColumns(updateManager, formulaEnvironment, grid2, grid2ColumnsData);
  grid2.addColumns(grid2Columns);
  setColumnExpressions(grid2, grid2ColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid2.id)));
  addRows(updateManager, grid2, true);
}

export function addBuiltInGrids(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  addArithmeticGrid(document, updateManager, formulaEnvironment);
  addDerivativeGrid(document, updateManager, formulaEnvironment);
  addShapeGrids(document, updateManager, formulaEnvironment);
}