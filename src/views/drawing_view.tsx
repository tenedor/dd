import * as _ from 'lodash';
import * as React from 'react';
import {DrawingController} from 'src/controllers/drawing_controller';
import {DrawingVariant} from 'src/core/language/drawing_value';
import {Grid} from 'src/core/models/grid';
import {ROArray} from 'src/utils/types';
import {assertUnreachable} from 'src/utils/utils';
import {BaseComponent, BaseProps} from './base_component';

interface Props extends BaseProps {
  grids: ROArray<Grid>,
}

export class DrawingView extends BaseComponent<Props> {
  private controller: DrawingController;

  constructor(props: Props) {
    super(props);
    this.controller = new DrawingController(props.grids);
  }

  public render = () => {
    const drawings = this.controller.getDrawings();
    const renderedDrawings = drawings.map((d, i) => {
      switch (d.drawingType) {
        case DrawingVariant.CIRCLE:
          return <circle key={`d-${i}`} cx={d.center.x} cy={d.center.y} r={d.radius} fill={d.fill} />;
        case DrawingVariant.ELLIPSE:
          return <ellipse key={`d-${i}`} cx={d.center.x} cy={d.center.y} rx={d.radius1} ry={d.radius2} fill={d.fill} />;
        case DrawingVariant.PATH:
          const path = `M${d.center.x},${d.center.y} ${d.path}`;
          return <path key={`d-${i}`} d={path} fill={d.fill} />;
        default:
          return assertUnreachable(d);
      }
    });

    return (
      <svg height="300" width="300" style={{backgroundColor: "#888888"}}>
        {renderedDrawings}
      </svg>
    );
  }
}
