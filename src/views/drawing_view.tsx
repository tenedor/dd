import * as _ from 'lodash';
import * as React from 'react';

import {getDrawing} from '@core/drawing_grid_utilities';
import {CoordinateSystem} from '@core/geometry';
import {Drawing, DrawingVariant} from '@language/drawing_value';
import {Grid} from '@models/domain_specific/grid';
import {ROArray} from '@utils/types';
import {assertUnreachable} from '@utils/utils';
import {BaseComponent, BaseProps} from './base_component';

interface Props extends BaseProps {
  grids: ROArray<Grid>,
  size?: number,
}

export class DrawingView extends BaseComponent<Props> {

  public render = () => {
    const {grids, size} = this.props;
    const drawings = DrawingView.getDrawings(grids);
    const renderedDrawings = DrawingView.renderDrawings(drawings);

    return (
      <div className="drawing-view" style={{height: size, width: size}}>
        <svg viewBox="0 0 100 100" style={{backgroundColor: "#888888"}}>
          {renderedDrawings}
        </svg>
      </div>
    );
  }

  private static renderDrawings = (drawings: Drawing[]) => {
    return drawings.map((d, i) => {
      switch (d.drawingType) {
        case DrawingVariant.CIRCLE:
          return <circle key={`d-${i}`} r={d.radius} fill={d.fill} />;
        case DrawingVariant.ELLIPSE:
          return <ellipse key={`d-${i}`} rx={d.radius1} ry={d.radius2} fill={d.fill} />;
        case DrawingVariant.PATH:
          return <path key={`d-${i}`} d={d.path} fill={d.fill} />;
        case DrawingVariant.GROUP:
          const transform = DrawingView.getTransformForCoordinateSystem(d.coordinateSystem);
          return (
            <g key={`d-${i}`} transform={transform}>
              {DrawingView.renderDrawings(d.drawings)}
            </g>
          );
        default:
          return assertUnreachable(d);
      }
    });
  }

  public static getDrawings = (grids: ROArray<Grid>): Drawing[] => {
    return _.flatten(grids.map(DrawingView.getDrawingsForGrid));
  }

  private static getDrawingsForGrid = (grid: Grid): Drawing[] => {
    return grid.rows.a.map(row => getDrawing(row.asValue()));
  }

  private static getTransformForCoordinateSystem = ({center, scale, rotation}: CoordinateSystem): string => {
    const {x, y} = center;
    const {ccw} = rotation;
    return `translate(${x} ${y}) rotate(${-ccw * 360}) scale(${scale / 100})`;
  }
}
