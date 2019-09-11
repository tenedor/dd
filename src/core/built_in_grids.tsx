import * as _ from 'lodash';

import {AssignmentsUnres, CallUnres} from '@language/ast';
import {FormulaEnvironment} from '@language/formula_environment';
import {NameResolver} from '@language/name_resolver';
import {Parser} from '@language/parser';
import {Type, TypeUtils} from '@language/types';
import {ValueOrAST, ValueUtils} from '@language/values';
import {UpdateManager} from '@models/core/update_manager';
import {Column, ColumnData} from '@models/domain_specific/column';
import {Document} from '@models/domain_specific/document';
import {Grid} from '@models/domain_specific/grid';
import {GridColumn} from '@models/domain_specific/grid_column';
import {Row} from '@models/domain_specific/row';
import {COORDINATE_SYSTEM_GRID_NAME, getBuiltInDrawingColumnData} from './drawing_grid_utilities';

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

interface GridColumnData<T extends Type = Type> {
  column: Column<T>,
  width?: number,
  expressionString?: string,
  defaultValue?: ValueOrAST<T>,
};

interface ChildGridColumnData<T extends Type = Type> {
  parentGridColumn: GridColumn<T>,
  expressionString?: string,
  defaultValue?: ValueOrAST<T>,
};

type MixedGridColumnData = GridColumnData | ChildGridColumnData;

function isChildData(columnData: MixedGridColumnData): columnData is ChildGridColumnData {
  return 'parentGridColumn' in columnData;
}

function generateColumns(
  updateManager: UpdateManager,
  columnsData: ColumnData[],
): {[name: string]: Column} {
  const columnsMap = {};
  columnsData.forEach(columnData => {
    columnsMap[columnData.name] = new Column(updateManager, columnData);
  });
  return columnsMap;
}

function generateGridColumns(
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
  grid: Grid,
  gridColumnsData: MixedGridColumnData[],
): GridColumn[] {
  const newColumns = gridColumnsData.filter((c): c is GridColumnData  => !isChildData(c));
  return newColumns.map(gridColumnData => {
    const {column, width} = gridColumnData;
    const {type} = column;
    return new GridColumn(updateManager, {
      column,
      formulaEnvironment,
      grid,
      type,
      width: width || 100,
    });
  });
}

function getGridColumnsByName(grid: Grid): {[name: string]: GridColumn} {
  return _.mapKeys(grid.columns.d, c => c.name);
}

function setColumnExpressions(grid: Grid, gridColumnsData: MixedGridColumnData[], resolver: NameResolver) {
  const columns = grid.columns;
  gridColumnsData.map((data) => {
    const {expressionString} = data;
    const columnId = getColumnId(data);
    if (expressionString) {
      const parseResult = Parser.parseExpression(expressionString);
      if (!parseResult.succeeded) {
        throw new Error("Bad built-in grid formula");
      }
      const ast = parseResult.ast.resolve(resolver);
      columns.getByKey(columnId)!.setExpression(ast);
    }
  });
}

function getColumnId(columnData: MixedGridColumnData): string {
  return isChildData(columnData) ? columnData.parentGridColumn.columnId : columnData.column.id;
}

function setDefaultValues(grid: Grid, columns: MixedGridColumnData[]) {
  const {cells} = grid.rows.get(0)!;
  columns.filter(c => c.expressionString === undefined && c.defaultValue !== undefined)
         .forEach(c => cells.get(getColumnId(c))!.setManualValue(c.defaultValue));
}

function addBuiltInGrid({
  name, updateManager, environment, gridColumnsData, parentGrid, disableDrawingColumn,
}: {
  name: string,
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
  gridColumnsData: MixedGridColumnData[],
  parentGrid?: Grid,
  disableDrawingColumn?: boolean,
}) {
  const {nameResolver} = environment;
  const grid = new Grid(updateManager, {name, formulaEnvironment: environment, parentGrid, disableDrawingColumn});

  const gridColumns = generateGridColumns(updateManager, environment, grid, gridColumnsData);
  grid.addColumns(gridColumns);
  setColumnExpressions(grid, gridColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid.id)));
  setDefaultValues(grid, gridColumnsData);
}

function getTypeForInstanceOf(
  formulaEnvironment: FormulaEnvironment,
  gridName: string,
): Type {
  return formulaEnvironment.nameResolver.resolveConstructorReference(gridName).model.returnType;
}

function makeLiteralInstance(
  formulaEnvironment: FormulaEnvironment,
  gridName: string,
): ValueOrAST {
  const astUnres = new CallUnres(gridName, new AssignmentsUnres({}, []));
  return astUnres.resolve(formulaEnvironment.nameResolver);
}

function setFirstRowValues(grid: Grid, values: {[columnId: string]: ValueOrAST}) {
  const {cells} = grid.rows.get(0)!;
  Object.keys(values).map(id => cells.get(id)!.setManualValue(values[id]));
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
    [columns.get(2)!.columnId]: ValueUtils.numberOf(hasParent ? 100 - i * 20 : i * 10),
    [columns.get(3)!.columnId]: ValueUtils.numberOf(i * i * 3),
    [columns.get(4)!.columnId]: ValueUtils.numberOf((i + 1) * (i + 1) * 2),
    [columns.get(5)!.columnId]: ValueUtils.stringOf(colors[i + (hasParent ? 2 : 0)]),
    [columns.get(6)!.columnId]: ValueUtils.stringOf(getStarPath(5 + 2 * i, 2 + 2 * i, sideLength(i))),
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

function addRotationGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = "Rotation";
  const columns = generateColumns(updateManager, [
    {name: 'Rotation CW', type: TypeUtils.Number},
    {name: 'Rotation CCW', type: TypeUtils.Number},
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns['Rotation CW']},
    {column: columns['Rotation CCW'], expressionString: "-'Rotation CW'"},
  ];
  const disableDrawingColumn = true;
  addBuiltInGrid({name, updateManager, environment, gridColumnsData, disableDrawingColumn});
}

function addDirectionGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = "Direction";
  const rotationType = getTypeForInstanceOf(environment, "Rotation");
  const columns = generateColumns(updateManager, [
    {name: 'Rotation From Up', type: rotationType},
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns['Rotation From Up']},
  ];
  const disableDrawingColumn = true;
  addBuiltInGrid({name, updateManager, environment, gridColumnsData, disableDrawingColumn});
}

function addVectorGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = "Vector";
  const directionType = getTypeForInstanceOf(environment, "Direction");
  const columns = generateColumns(updateManager, [
    {name: 'X', type: TypeUtils.Number},
    {name: 'Y', type: TypeUtils.Number},
    {name: 'R', type: TypeUtils.Number},
    {name: 'Theta', type: directionType},
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.X},
    {column: columns.Y},
    {column: columns.R, expressionString: "Sqrt(Value = X * X + Y * Y)"},
    {column: columns.Theta, expressionString: "Direction('Rotation From Up' = Rotation('Rotation CW' = Atan2(X = Y, Y = X) / (2 * Pi())))"},
  ];
  const disableDrawingColumn = true;
  addBuiltInGrid({name, updateManager, environment, gridColumnsData, disableDrawingColumn});
}

function addCoordinateSystemGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = COORDINATE_SYSTEM_GRID_NAME;
  const vectorType = getTypeForInstanceOf(environment, "Vector");
  const rotationType = getTypeForInstanceOf(environment, "Rotation");
  const columns = generateColumns(updateManager, [
    {name: 'Center', type: vectorType},
    {name: 'Scale', type: TypeUtils.Number}, // TODO generalize to Scalar(Number, Units)
    {name: 'Rotation', type: rotationType}, // TODO generalize to Orientation(Rotation, Reflection)
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.Center},
    {column: columns.Scale, defaultValue: ValueUtils.numberOf(100)},
    {column: columns.Rotation},
  ];
  const disableDrawingColumn = true;
  addBuiltInGrid({name, updateManager, environment, gridColumnsData, disableDrawingColumn});
}

function addTrigonometryGrids(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  addRotationGrid(updateManager, environment);
  addDirectionGrid(updateManager, environment);
  addVectorGrid(updateManager, environment);
  addCoordinateSystemGrid(updateManager, environment);
}

function addShapeGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = "Shape";
  const drawingColumn = getBuiltInDrawingColumnData();
  const columns = generateColumns(updateManager, [
    {name: 'Fill', type: TypeUtils.String},
    drawingColumn,
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.Fill},
    {column: columns[drawingColumn.name], expressionString: "DrawCircle(Radius=10, Fill=Fill)"},
  ];
  addBuiltInGrid({name, updateManager, environment, gridColumnsData});
}

function addPathShapeGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = "Path Shape";
  const drawingColumn = getBuiltInDrawingColumnData();
  const columns = generateColumns(updateManager, [
    {name: 'Path', type: TypeUtils.String},
  ]);
  const parentGrid = environment.getGridByName("Shape");
  const parentColumns = getGridColumnsByName(parentGrid);
  const gridColumnsData: MixedGridColumnData[] = [
    {column: columns.Path, defaultValue: ValueUtils.stringOf("m0 0 l20 0 l0 20 l-20 0 z")},
    {parentGridColumn: parentColumns[drawingColumn.name], expressionString: "DrawPath(Path=Path, Fill=Fill)"},
  ];
  addBuiltInGrid({name, updateManager, environment, gridColumnsData, parentGrid});
}

function addTriangleGrid(
  updateManager: UpdateManager,
  environment: FormulaEnvironment,
) {
  const name = "Triangle";
  const parentGrid = environment.getGridByName("Path Shape");
  const parentColumns = getGridColumnsByName(parentGrid);
  const gridColumnsData: MixedGridColumnData[] = [
    {parentGridColumn: parentColumns.Path, expressionString: '"m0 0 l20 0 l-10 17.3 z"'},
  ];
  addBuiltInGrid({name, updateManager, environment, gridColumnsData, parentGrid});
}

function addShapeGrids(
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  addShapeGrid(updateManager, formulaEnvironment);
  addPathShapeGrid(updateManager, formulaEnvironment);
  addTriangleGrid(updateManager, formulaEnvironment);
}

function addDemoArithmeticGrid(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {nameResolver} = formulaEnvironment;

  const grid = document.addGridFromGridData({name: "Radius Calculator", formulaEnvironment});

  const columns = generateColumns(updateManager, [
    {name: 'In', type: TypeUtils.Number},
    {name: 'Out', type: TypeUtils.Number},
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.In},
    {column: columns.Out, expressionString: 'Square(Value = In / 10 + 1) * 2'},
  ];
  const gridColumns = generateGridColumns(updateManager, formulaEnvironment, grid, gridColumnsData);
  grid.addColumns(gridColumns);
  setColumnExpressions(grid, gridColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid.id)));

  const manualValues = {[gridColumns[0].columnId]: ValueUtils.numberOf(5)};
  setFirstRowValues(grid, manualValues);
}

function addDemoDerivativeGrid(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {nameResolver} = formulaEnvironment;

  const grid = document.addGridFromGridData({name: "Derivative", formulaEnvironment});

  const instanceType = formulaEnvironment.nameResolver.resolveConstructorReference("Radius Calculator").model.returnType;
  const columns = generateColumns(updateManager, [
    {name: 'In', type: TypeUtils.Number},
    {name: 'Mid', type: instanceType},
    {name: 'Out', type: TypeUtils.Number},
  ]);
  const gridColumnsData: GridColumnData[] = [
    {column: columns.In},
    {column: columns.Mid, width: 200},
    {column: columns.Out, expressionString: 'Mid.Out'},
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

function addDemoShapeGrids(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  const {nameResolver} = formulaEnvironment;
  const shapeGridId = formulaEnvironment.getGridByName('Shape').id;

  const columns = generateColumns(updateManager, [
    {name: 'X', type: TypeUtils.Number},
    {name: 'Y', type: TypeUtils.Number},
    {name: 'Radius', type: TypeUtils.Number},
    {name: 'Fill', type: TypeUtils.String},
    {name: 'Path', type: TypeUtils.String},
    {name: 'Shape', type: TypeUtils.RowOf(shapeGridId)},
  ]);

  const grid1ColumnsData: GridColumnData[] = [
    {column: columns.X},
    {column: columns.Y},
    {column: columns.Radius, expressionString: "'Radius Calculator'(In=X).Out"},
    {column: columns.Fill},
    {column: columns.Path},
    {column: columns.Shape, width: 150, expressionString: "'Path Shape'(Path=Path,Fill=Fill,Transform='Coordinate System'(Center=Vector(X=X,Y=Y)))"},
  ];
  const grid1 = document.addGridFromGridData({name: "Shapes", formulaEnvironment});
  const grid1Columns = generateGridColumns(updateManager, formulaEnvironment, grid1, grid1ColumnsData);
  grid1.addColumns(grid1Columns);
  setColumnExpressions(grid1, grid1ColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid1.id)));
  addRows(updateManager, grid1, false);

  const grid2ColumnsData: ChildGridColumnData[] = grid1Columns.map(parentGridColumn => {
    if (parentGridColumn.columnId === columns.Shape.id) {
      return {parentGridColumn}
    }
    return {parentGridColumn}
  });
  const grid2 = document.addGridFromGridData({name: "More Shapes", parentGrid: grid1, formulaEnvironment});
  const grid2Columns = generateGridColumns(updateManager, formulaEnvironment, grid2, grid2ColumnsData);
  grid2.addColumns(grid2Columns);
  setColumnExpressions(grid2, grid2ColumnsData, nameResolver.resolverFor(TypeUtils.GridOf(grid2.id)));
  addRows(updateManager, grid2, true);
}

export function loadBuiltInGrids(
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  addTrigonometryGrids(updateManager, formulaEnvironment);
  addShapeGrids(updateManager, formulaEnvironment);
}

export function addDemoGrids(
  document: Document,
  updateManager: UpdateManager,
  formulaEnvironment: FormulaEnvironment,
) {
  addDemoArithmeticGrid(document, updateManager, formulaEnvironment);
  addDemoDerivativeGrid(document, updateManager, formulaEnvironment);
  addDemoShapeGrids(document, updateManager, formulaEnvironment);
}