import * as _ from 'lodash';
import * as React from 'react';
import {DrawingController} from '../controllers/drawing_controller';
import {Grid} from '../core/grid';
import {BaseComponent} from './base_component';

interface Props {
  grids: Grid[],
}

export class DrawingView extends BaseComponent<Props, object> {
  private controller: DrawingController;

  constructor(props: Props) {
    super(props);
    this.controller = new DrawingController(props.grids);
  }

  public render() {
    const drawings = this.controller.getDrawings();
    const renderedDrawings = drawings.map((drawing, i) => {
      const {x, y, radius, fill} = drawing;
      return <circle key={`d-${i}`} cx={x} cy={y} r={radius} fill={fill} />;
    })

    return (
      <svg height="300" width="300" style={{backgroundColor: "#888888"}}>
        {renderedDrawings}
      </svg>
    );
  }
}
