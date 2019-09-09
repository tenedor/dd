import * as _ from 'lodash';
import * as React from 'react';

import {CoordinateSystem} from '@core/geometry';
import {Drawing, DrawingVariant} from '@language/drawing_value';
import {Grid} from '@models/domain_specific/grid';
import {ROArray} from '@utils/types';
import {assertUnreachable} from '@utils/utils';
import {BaseComponent, BaseProps} from './base_component';
import {DrawingViewModel} from './drawing_view_model';

interface Props extends BaseProps {
  grids: ROArray<Grid>,
}

export class DrawingView extends BaseComponent<Props> {
  private controller: DrawingViewModel;

  constructor(props: Props) {
    super(props);
    this.controller = new DrawingViewModel(props.grids);
  }

  public render = () => {
    const drawings = this.controller.getDrawings();
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

  private getTransformForCoordinateSystem = ({center, scale, rotation}: CoordinateSystem): string => {
    const {x, y} = center;
    const {ccw} = rotation;
    return `translate(${x} ${y}) rotate(${-ccw * 360}) scale(${scale / 100})`;
  }
}
