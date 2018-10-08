import * as _ from 'lodash';
import * as React from 'react';
import {
  ColumnData,
  ColumnsData,
  DataType,
  Formula,
  GridData,
  MaterializedFormula,
  RowData,
} from '../models/grid';
import {assert} from '../utils/utils';

enum DrawingPrimitive {
  DRAW_CIRCLE = "DRAW_CIRCLE",
}

interface BaseDrawing {
  type: DrawingPrimitive,
  x: number,
  y: number,
  rotation: number,
  fill: string,
  children: Drawing[],
}

interface Circle extends BaseDrawing {
  type: DrawingPrimitive.DRAW_CIRCLE,
  radius: number,
}

type Drawing = Circle;

interface Props {
  gridsData: GridData[],
}

export class DrawingView extends React.Component<Props, object> {
  public render() {
    return this.props.gridsData.map(g => this.renderGrid(g));
  }

  private isDrawingFormula(formula: Formula): boolean {
    return formula.name === 'DrawCircle';
  }

  private getColumnById(columnId: string, columnsData: ColumnsData): ColumnData {
    const column = _.find(columnsData, c => c.id === columnId);
    assert(column, 'invalid column id');
    return column!;
  }

  private materializeFormula(formula: Formula, row: RowData, columnsData: ColumnsData): MaterializedFormula {
    const {name, args} = formula;
    return {
      name,
      args,
      materializedArgs: args.map(c => ({
        value: row[c].value,
        type: this.getColumnById(c, columnsData).type,
      })),
    }
  }

  private resolveDrawingFormula(formula: Formula, row: RowData, columnsData: ColumnsData): Drawing {
    const materializedFormula = this.materializeFormula(formula, row, columnsData);
    assert(this.isDrawingFormula(materializedFormula), 'expected drawing formula');
    const args = materializedFormula.materializedArgs;
    assert(args.length === 4, 'invalid arg count');
    const radius = assert(args[0].type === DataType.NUMBER) && parseFloat(args[0].value);
    const x = assert(args[1].type === DataType.NUMBER) && parseFloat(args[1].value);
    const y = assert(args[2].type === DataType.NUMBER) && parseFloat(args[2].value);
    const fill = assert(args[3].type === DataType.STRING) && args[3].value;
    return {
      type: DrawingPrimitive.DRAW_CIRCLE,
      radius,
      x,
      y,
      rotation: 0,
      fill,
      children: [],
    };
  }

  private renderGrid(gridData: GridData) {
    const {columns: columnsData, rows: rowsData} = gridData;

    const drawingFormulas = columnsData
      .map(c => {
          return (c.formula && this.isDrawingFormula(c.formula)) ?
              c.formula :
              undefined;
      })
      .filter(f => !!f) as Formula[];

    const rowDrawings =
      rowsData.map(rowData =>
        drawingFormulas.map(formula =>
          this.resolveDrawingFormula(formula, rowData, columnsData)));
    const drawings = _.flatten(rowDrawings);

    const renderedDrawings = drawings.map((d, i) => {
      return <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.radius} fill={d.fill} />;
    })

    return (
      <svg height="300" width="300" style={{backgroundColor: "#888888"}}>
        {renderedDrawings}
      </svg>
    );
  }
}
