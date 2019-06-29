import * as _ from 'lodash';
import * as React from 'react';

import {DrawingVariant} from '@language/drawing_value';
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
      <svg viewBox="0 0 100 100" height="300" width="300" style={{backgroundColor: "#888888"}}>
        {renderedDrawings}
      </svg>
    );
  }
}
