import * as _ from 'lodash';

import {FormulaEnvironment} from '@language/formula_environment';
import {Parser} from '@language/parser';
import {NameResolver} from '@language/reference';
import {Type, TypeUtils} from '@language/types';
import {ValueUtils} from '@language/values';
import {Column} from '@models/column';
import {Document} from '@models/document';
import {Grid} from '@models/grid';
import {GridColumn} from '@models/grid_column';
import {Row} from '@models/row';
import {UpdateManager} from '@models/update_manager';

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
      const parseResult = Parser.parse(expressionString);
      if (!parseResult.succeeded) {
        throw new Error("Bad built-in grid formula");
      }
      const ast = parseResult.ast.resolve(resolver);
      columns[i].setExpression(ast);
    }
  });
}

function generateRows(
  updateManager: UpdateManager,
  grid: Grid,
  columns: GridColumn[],
  hasParent: boolean,
): Row[] {
  const gridId = grid.id;
  const rowCount = hasParent ? 3 : 6;
  const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
  const sideLength = (i: number) => 15 * (0.5 + i / 4);
  return _.range(rowCount).map(i => new Row(updateManager, {gridId, cells: [
    {column: columns[0], manualValue: ValueUtils.numberOf(hasParent ? 100 - i * 20 : i * 10)},
    {column: columns[1], manualValue: ValueUtils.numberOf(i * i * 3)},
    {column: columns[2], manualValue: ValueUtils.numberOf((i + 1) * (i + 1) * 2)},
    {column: columns[3], manualValue: ValueUtils.stringOf(colors[i + (hasParent ? 2 : 0)])},
    {column: columns[4], manualValue: ValueUtils.stringOf(getStarPath(5 + 2*i, 2+2*i, sideLength(i)))},
    {column: columns[5]},
  ]}));
}

export function addArithmeticGrid(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {resolver} = formulaEnvironment;

  const grid = document.createGrid({name: "Radius Calculator"});

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
  setColumnExpressions(grid, gridColumnsData, resolver.resolverFor(TypeUtils.GridOf(grid.id)));

  const gridRows = [
    new Row(updateManager, {
      gridId: grid.id,
      cells: [
        {column: gridColumns[0], manualValue: ValueUtils.numberOf(5)},
        {column: gridColumns[1]},
      ],
    }),
  ];
  grid.addRows(gridRows);
}

export function addShapeGrids(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {resolver} = formulaEnvironment;

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
  const grid1 = document.createGrid({name: "Shapes"});
  const grid1Columns = generateGridColumns(updateManager, formulaEnvironment, grid1, grid1ColumnsData);
  grid1.addColumns(grid1Columns);
  setColumnExpressions(grid1, grid1ColumnsData, resolver.resolverFor(TypeUtils.GridOf(grid1.id)));
  const grid1Rows = generateRows(updateManager, grid1, grid1Columns, false);
  grid1.addRows(grid1Rows);

  const grid2ColumnsData: ChildGridColumnData[] = grid1Columns.map(parentGridColumn => {
    if (parentGridColumn.columnId === columns.DrawShape.id) {
      return {parentGridColumn}
    }
    return {parentGridColumn}
  });
  const grid2 = document.createGrid({name: "More Shapes", parentGrid: grid1});
  const grid2Columns = generateGridColumns(updateManager, formulaEnvironment, grid2, grid2ColumnsData);
  grid2.addColumns(grid2Columns);
  setColumnExpressions(grid2, grid2ColumnsData, resolver.resolverFor(TypeUtils.GridOf(grid2.id)));
  const grid2Rows = generateRows(updateManager, grid2, grid2Columns, true);
  grid2.addRows(grid2Rows);
}

export function addBuiltInGrids(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  addArithmeticGrid(document, updateManager, formulaEnvironment);
  addShapeGrids(document, updateManager, formulaEnvironment);
}