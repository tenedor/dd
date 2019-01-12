import * as _ from 'lodash';
import {Column, DataType} from './column';
import {Formula, FormulaName} from './formula';
import {FormulaContainer} from './formula_container';
import {Grid} from './grid';
import {GridColumn} from './grid_column';
import {Row} from './row';
import {UpdateManager} from './update_manager';

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

interface ColumnData {name: string, type: DataType};
function generateColumns(
  updateManager: UpdateManager,
  columnsDataMap: {[name: string]: ColumnData},
): {[name: string]: Column} {
  const columnsMap = {};
  Object.keys(columnsDataMap).forEach(name =>
      columnsMap[name] = new Column(updateManager, columnsDataMap[name]));
  return columnsMap;
}

interface GridColumnData {column: Column, width: number, formula?: Formula};
interface ChildGridColumnData {parentGridColumn: GridColumn, formula?: Formula};
function generateGridColumns(
  updateManager: UpdateManager,
  gridColumnsData: Array<GridColumnData | ChildGridColumnData>,
): GridColumn[] {
  return gridColumnsData.map(gridColumnData => {
    if ('parentGridColumn' in gridColumnData) {
      const {parentGridColumn, formula} = gridColumnData;
      return GridColumn.fromParent(updateManager, parentGridColumn, {formula});
    } else {
      const {column, width, formula} = gridColumnData;
      return new GridColumn(updateManager, {
        column,
        formulaContainer: new FormulaContainer(updateManager, {formula}),
        width,
      });
    }
  });
}

function generateRows(
  updateManager: UpdateManager,
  columns: GridColumn[],
  hasParent: boolean,
): Row[] {
  const rowCount = hasParent ? 3 : 6;
  const colors = ["black", "blue", "cyan", "white", "yellow", "orange"];
  const sideLength = (i: number) => 50 * (0.5 + i / 4);
  return _.range(rowCount).map(i => new Row(updateManager, [
    {column: columns[0], manualValue: `${hasParent ? 300 - i * 60 : i * 20}`},
    {column: columns[1], manualValue: `${i * i * 10}`},
    {column: columns[2], manualValue: `${(i + 1) * (i + 1) * 2}`},
    {column: columns[3], manualValue: colors[i + (hasParent ? 2 : 0)]},
    {column: columns[4], manualValue: getStarPath(5 + 2*i, 2+2*i, sideLength(i))},
    {column: columns[5]},
  ]));
}

function generateGrids(updateManager: UpdateManager): Grid[] {
  const columnsDataMap = {
    X: {name: 'X', type: DataType.NUMBER},
    Y: {name: 'Y', type: DataType.NUMBER},
    Radius: {name: 'Radius', type: DataType.NUMBER},
    Fill: {name: 'Fill', type: DataType.STRING},
    Path: {name: 'Path', type: DataType.STRING},
    DrawShape: {name: 'Draw Shape', type: DataType.STRING},
  };
  const columns = generateColumns(updateManager, columnsDataMap);

  const pathFormula = {
    name: FormulaName.DRAW_PATH,
    args: [columns.Path.id, columns.X.id, columns.Y.id, columns.Fill.id],
  };
  const grid1ColumnsData = [
    {column: columns.X, width: 100},
    {column: columns.Y, width: 100},
    {column: columns.Radius, width: 100},
    {column: columns.Fill, width: 100},
    {column: columns.Path, width: 100},
    {column: columns.DrawShape, width: 150, formula: pathFormula},
  ];
  const grid1Columns = generateGridColumns(updateManager, grid1ColumnsData);
  const grid1Rows = generateRows(updateManager, grid1Columns, false);
  const grid1 = new Grid(updateManager, {columns: grid1Columns, rows: grid1Rows});

  const circleFormula = {
    name: FormulaName.DRAW_CIRCLE,
    args: [columns.Radius.id, columns.X.id, columns.Y.id, columns.Fill.id],
  };
  const grid2ColumnsData = grid1Columns.map(parentGridColumn => {
    if (parentGridColumn.columnId === columns.DrawShape.id) {
      return {parentGridColumn, formula: circleFormula}
    }
    return {parentGridColumn}
  });
  const grid2Columns = generateGridColumns(updateManager, grid2ColumnsData);
  const grid2Rows = generateRows(updateManager, grid2Columns, true);
  const grid2 = new Grid(updateManager, {columns: grid2Columns, rows: grid2Rows, parentGrid: grid1});

  return [grid1, grid2];
}

export function getBuildInGrids(updateManager: UpdateManager): Grid[] {
  return generateGrids(updateManager);
}
