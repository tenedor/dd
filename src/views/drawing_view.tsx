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
}

export class DrawingView extends BaseComponent<Props> {

  public render = () => {
    const drawings = this.getDrawings();
    const renderedDrawings = this.renderDrawings(drawings);

    return (
      <svg viewBox="0 0 100 100" height="300" width="300" style={{backgroundColor: "#888888"}}>
        {renderedDrawings}
      </svg>
    );
  }

  private renderDrawings = (drawings: Drawing[]) => {
    return drawings.map((d, i) => {
      switch (d.drawingType) {
        case DrawingVariant.CIRCLE:
          return <circle key={`d-${i}`} r={d.radius} fill={d.fill} />;
        case DrawingVariant.ELLIPSE:
          return <ellipse key={`d-${i}`} rx={d.radius1} ry={d.radius2} fill={d.fill} />;
        case DrawingVariant.PATH:
          return <path key={`d-${i}`} d={d.path} fill={d.fill} />;
        case DrawingVariant.GROUP:
          const transform = this.getTransformForCoordinateSystem(d.coordinateSystem);
          return (
            <g key={`d-${i}`} transform={transform}>
              {this.renderDrawings(d.drawings)}
            </g>
          );
        default:
          return assertUnreachable(d);
      }
    });
  }

  public getDrawings = (): Drawing[] => {
    return _.flatten(this.props.grids.map(this.getDrawingsForGrid));
  }

  private getDrawingsForGrid = (grid: Grid): Drawing[] => {
    return grid.rows.a.map(row => getDrawing(row.asValue()));
  }

  private getTransformForCoordinateSystem = ({center, scale, rotation}: CoordinateSystem): string => {
    const {x, y} = center;
    const {ccw} = rotation;
    return `translate(${x} ${y}) rotate(${-ccw * 360}) scale(${scale / 100})`;
  }
}
