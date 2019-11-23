import * as _ from 'lodash';
import * as React from 'react';

import {CoordinateSystem} from '@core/geometry';
import {OLD_Drawing, OLD_DrawingVariant} from '@language/drawing_value';
import {Drawing, DrawingType} from '@models/domain_specific/drawing';
import {Grid} from '@models/domain_specific/grid';
import {ROArray} from '@utils/types';
import {assertUnreachable} from '@utils/utils';
import {BaseComponent, BaseProps} from './base_component';
import {DragListener} from './mouse_move_manager';
import {UIGlobals} from './ui_globals';

interface XYCoordinate {
  readonly x: number,
  readonly y: number,
}

type Target = XYCoordinate;

interface DragTargetData {
  index: number,
  preDragState: Target,
}

interface Props extends BaseProps {
  grids: ROArray<Grid>,
  size?: number,
  uiGlobals: UIGlobals,
}

interface State {
  fakeTargets: ROArray<Target>,
}

export class DrawingView extends BaseComponent<Props, State> {
  private readonly dragListener: DragListener;
  private dragTargetData?: DragTargetData;
  private ref?: SVGSVGElement;

  constructor(props: Props) {
    super(props);

    this.dragListener = {
      onDragMove: this.onDrag,
      onDragRelease: this.onDragEnd,
      onDragCancel: this.onDragEnd,
    };

    const fakeTargets = _.range(4).map(i => ({x: i * 30 - 100, y: i * i * 10 - 100}));
    this.state = {fakeTargets};
  }

  public render = (): JSX.Element => {
    const {grids, size} = this.props;
    const drawings = DrawingView.getDrawings(grids);
    const renderedDrawings = DrawingView.renderDrawings(drawings);
    const fakeTargets = this.renderFakeTargets();

    return (
      <div className="drawing-view" style={{height: size, width: size}}>
        <svg ref={r => this.ref = r || undefined} viewBox={"-100 -100 200 200"}
            style={{backgroundColor: "#888888"}}>
          {renderedDrawings}
          {fakeTargets}
        </svg>
      </div>
    );
  }

  private static renderDrawings = (drawings: ROArray<Drawing>): JSX.Element[] => {
    return drawings.map((d, i) => {
      switch (d.drawingType) {
        case DrawingType.CIRCLE:
          return <circle key={`d-${i}`} r={d.radius} fill={d.fill} />;
        case DrawingType.ELLIPSE:
          return <ellipse key={`d-${i}`} rx={d.radius1} ry={d.radius2} fill={d.fill} />;
        case DrawingType.PATH:
          return <path key={`d-${i}`} d={d.path} fill={d.fill} />;
        case DrawingType.GROUP:
          const transform = DrawingView.getTransformForCoordinateSystem(d.transform);
          return (
            <g key={`d-${i}`} transform={transform}>
              {DrawingView.renderDrawings(Object.values(d.drawings))}
            </g>
          );
        case DrawingType.LIST:
          return (
            <g key={`d-${i}`}>
              {DrawingView.renderDrawings(d.drawings)}
            </g>
          );
        default:
          return assertUnreachable(d);
      }
    });
  }

  public static getDrawings = (grids: ROArray<Grid>): Drawing[] => {
    return _.flatten(grids.map(g => g.rows.a.map(r => r.getDrawing())));
  }

  private static getTransformForCoordinateSystem = ({center, scale, rotation}: CoordinateSystem): string => {
    const {x, y} = center;
    const {ccw} = rotation;
    return `translate(${x} ${y}) rotate(${-ccw * 360}) scale(${scale / 100})`;
  }

  private convertMouseVectorToDataVector = (mouseVector: XYCoordinate): XYCoordinate => {
    if (this.ref === undefined) {
      throw new Error("Expected SVG ref to be defined.");
    }
    const {width, height} = this.ref.getBoundingClientRect();
    const x = mouseVector.x * 200 / width;
    const y = mouseVector.y * 200 / height;
    return {x, y};
  }

  private renderFakeTargets = (): JSX.Element[] => {
    const {fakeTargets} = this.state;
    return fakeTargets.map((t, i) => <circle key={`drag-target-${i}`} className={"drag-target"}
      onMouseDown={this.onMousedownTarget} data-index={i} r={3} cx={t.x} cy={t.y} />);
  }

  private onMousedownTarget = (e: React.MouseEvent) => {
    const index = parseInt(e.currentTarget.getAttribute("data-index")!, 10);
    if (isNaN(index)) {
      throw new Error("Invalid data index on mousedown target.");
    }
    this.setDragListener(index);
  }

  private setDragListener = (index: number) => {
    const preDragState = this.state.fakeTargets[index];
    this.dragTargetData = {index, preDragState};
    this.props.uiGlobals.mouseMoveManager.setDragListener(this.dragListener);
  }

  private clearDragListener = () => {
    this.dragTargetData = undefined;
    this.props.uiGlobals.mouseMoveManager.clearDragListener(this.dragListener);
  }

  private onDrag = (mousemove: MouseEvent, originMousedown: MouseEvent) => {
    const {fakeTargets} = this.state;
    if (!this.dragTargetData) {
      throw new Error("Expected drag target data to be set.");
    }
    const {index, preDragState} = this.dragTargetData;
    const dxMouse = mousemove.x - originMousedown.x;
    const dyMouse = mousemove.y - originMousedown.y;
    const {x: dxData, y: dyData} = this.convertMouseVectorToDataVector({x: dxMouse, y: dyMouse});
    const x = preDragState.x + dxData;
    const y = preDragState.y + dyData;
    const updatedTargets = fakeTargets.slice(0);
    updatedTargets[index] = {x, y};
    this.setState({fakeTargets: updatedTargets});
  }

  private onDragEnd = () => {
    this.clearDragListener();
  }
}
