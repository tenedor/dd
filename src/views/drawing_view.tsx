import * as _ from 'lodash';
import * as React from 'react';

import {CoordinateSystem, Displacement, GeometryUtils, Position, Vector} from '@core/geometry';
import {Address, AddressNode, AddressUtils} from '@drawing/address';
import {AffordanceUtils, WrappedAffordance, WrappedAffordanceId} from '@drawing/affordance';
import {Drawing, DrawingType, DrawingUtils} from '@drawing/drawing';
import {Grid} from '@models/domain_specific/grid';
import {Dictionary, ROArray} from '@utils/types';
import {assertUnreachable} from '@utils/utils';
import {BaseComponent, BaseProps} from './base_component';
import {DragListener} from './mouse_move_manager';
import {UIGlobals} from './ui_globals';

interface DragTargetData {
  affordance: WrappedAffordance,
  initialPosition: Position,
}

interface Props extends BaseProps {
  grids: ROArray<Grid>,
  size?: number,
  uiGlobals: UIGlobals,
}

interface State {
  dragUpdate?: {idString: string, position: Position},
}

export class DrawingView extends BaseComponent<Props, State> {
  private readonly dragListener: DragListener;
  private dragTargetData?: DragTargetData;
  private ref?: SVGSVGElement;

  constructor(props: Props) {
    super(props);

    this.state = {};

    this.dragListener = {
      onDragMove: this.onDrag,
      onDragRelease: this.onDragEnd,
      onDragCancel: this.onDragEnd,
    };
  }

  public render = (): JSX.Element => {
    const {grids, size} = this.props;
    const {drawing, affordances} = DrawingView.getDrawingAndAffordances(grids);
    const renderedDrawing = DrawingView.renderDrawing(drawing, 0);
    const renderedAffordances = this.renderAffordances(affordances);

    return (
      <div className="drawing-view" style={{height: size, width: size}}>
        <svg ref={r => this.ref = r || undefined} viewBox={"-100 -100 200 200"}
            style={{backgroundColor: "#888888"}}>
          {renderedDrawing}
          {renderedAffordances}
        </svg>
      </div>
    );
  }

  private static renderDrawing = (drawing: Drawing, i: number): JSX.Element => {
      switch (drawing.drawingType) {
        case DrawingType.CIRCLE:
          return <circle key={`d-${i}`} r={drawing.radius} fill={drawing.fill} />;
        case DrawingType.ELLIPSE:
          return <ellipse key={`d-${i}`} rx={drawing.radius1} ry={drawing.radius2} fill={drawing.fill} />;
        case DrawingType.PATH:
          return <path key={`d-${i}`} d={drawing.path} fill={drawing.fill} />;
        case DrawingType.GROUP:
          const transform = DrawingView.getTransformForCoordinateSystem(drawing.transform);
          return (
            <g key={`d-${i}`} transform={transform}>
              {Object.values(drawing.drawings).map(DrawingView.renderDrawing)}
            </g>
          );
        case DrawingType.LIST:
          return (
            <g key={`d-${i}`}>
              {drawing.drawings.map(DrawingView.renderDrawing)}
            </g>
          );
        default:
          return assertUnreachable(drawing);
      }
  }

  private renderAffordances = (affordances: ROArray<WrappedAffordance>): JSX.Element[] => {
    const {dragUpdate} = this.state;
    return affordances.map(wa => {
      const {transform, affordance} = wa;
      const id = WrappedAffordanceId.buildFromAffordance(wa);
      const idString = id.encodeAsString();
      const pos = GeometryUtils.applyCoordinateTransformToPoint(transform, affordance.initialPosition);
      const {x, y} = dragUpdate && (dragUpdate.idString === idString) ? dragUpdate.position : pos;
      return <circle key={`a-${idString}`} className={"drag-target"} r={3} cx={x} cy={y}
          onMouseDown={this.onMousedownTarget} data-id={idString} />;
    });
  }

  private static getDrawingAndAffordances = (grids: ROArray<Grid>): {
    drawing: Drawing, affordances: ROArray<WrappedAffordance>,
  } => {
    const drawing = DrawingView.getDrawings(grids);
    const affordances = AffordanceUtils.extractTransformedAffordances(drawing);
    return {drawing, affordances};
  }

  private static getDrawings = (grids: ROArray<Grid>): Drawing => {
    const drawings: Dictionary<Drawing> = {};
    grids.forEach(g => drawings[g.id] = g.getDrawing());
    const transform = GeometryUtils.defaultCoordinateSystem;
    return DrawingUtils.groupOf({drawings, transform, affordances: []});
  }

  private static getAffordance = (id: WrappedAffordanceId, grids: ROArray<Grid>): WrappedAffordance | undefined => {
    const {affordances} = DrawingView.getDrawingAndAffordances(grids);
    return affordances.find(a => WrappedAffordanceId.buildFromAffordance(a).equals(id));
  }

  private static getTransformForCoordinateSystem = ({center, scale, rotation}: CoordinateSystem): string => {
    const {x, y} = center;
    const {ccw} = rotation;
    return `translate(${x} ${y}) rotate(${-ccw * 360}) scale(${scale})`;
  }

  private convertMouseVectorToDataVector = (mouseVector: Displacement): Displacement => {
    if (this.ref === undefined) {
      throw new Error("Expected SVG ref to be defined.");
    }
    const {width, height} = this.ref.getBoundingClientRect();
    const x = mouseVector.x * 200 / width;
    const y = mouseVector.y * 200 / height;
    return {x, y};
  }

  private onMousedownTarget = (e: React.MouseEvent) => {
    const id = WrappedAffordanceId.parseFromString(e.currentTarget.getAttribute("data-id")!);
    const x = parseFloat(e.currentTarget.getAttribute("cx")!);
    const y = parseFloat(e.currentTarget.getAttribute("cy")!);
    this.setDragListener(id, {x, y});
  }

  private setDragListener = (id: WrappedAffordanceId, initialPosition: Position) => {
    const {grids} = this.props;
    const affordance = DrawingView.getAffordance(id, grids);
    if (affordance === undefined) {
      throw new Error(`Unrecognized affordance id: ${id.encodeAsString()}`);
    }
    this.dragTargetData = {affordance, initialPosition};
    this.props.uiGlobals.mouseMoveManager.setDragListener(this.dragListener);
    const idString = id.encodeAsString();
    this.setState({dragUpdate: {idString, position: initialPosition}});
  }

  private clearDragListener = () => {
    this.dragTargetData = undefined;
    this.props.uiGlobals.mouseMoveManager.clearDragListener(this.dragListener);
    this.setState({dragUpdate: undefined});
  }

  private onDrag = (mousemove: MouseEvent, originMousedown: MouseEvent) => {
    const {dragUpdate} = this.state;
    if (!this.dragTargetData || !dragUpdate) {
      throw new Error("Expected drag target data and drag update state to be set.");
    }
    const {idString} = dragUpdate;
    const {initialPosition, affordance} = this.dragTargetData;
    const dxMouse = mousemove.x - originMousedown.x;
    const dyMouse = mousemove.y - originMousedown.y;
    const delta = this.convertMouseVectorToDataVector({x: dxMouse, y: dyMouse});
    const x = initialPosition.x + delta.x;
    const y = initialPosition.y + delta.y;
    const position = {x, y};
    this.setState({dragUpdate: {idString, position}});
    this.writeNewPositionToModel(position, affordance);
  }

  private writeNewPositionToModel = (positionInDrawingBasis: Position, affordance: WrappedAffordance) => {
    const {transform} = affordance;
    const inverseTransform = GeometryUtils.invertCoordinateTransform(transform);
    const positionInValueBasis = GeometryUtils.applyCoordinateTransformToPoint(
      inverseTransform, positionInDrawingBasis);
    const {editor, target} = this.getValueEditorAndTarget(affordance);
    this.writeToAddress(positionInValueBasis, editor, target);
  }

  private getValueEditorAndTarget = ({affordance, ancestry}: WrappedAffordance): {editor: Address, target: Address} => {
    // FIXME - An affordance should be able to write to any instance in the hierarchy
    // that could override the current value. Will therefore need to disambiguate.
    // For now this is simply wrong, and the error is patched downstream.
    return {editor: ancestry, target: affordance.relativeAddr};
  }

  private writeToAddress = (value: Vector, editor: Address, target: Address) => {
    const [node, address] = editor.unwrapNode();
    const grid = this.getMatchingGrid(node);
    grid.writeToAddress(value, address, target);
  }

  private getMatchingGrid = (topLevelNode: AddressNode): Grid => {
    const {grids} = this.props;
    if (!AddressUtils.isGroup(topLevelNode)) {
      throw new Error("Top-level address node should always specify a grid.");
    }
    const grid = grids.find(g => g.id === topLevelNode.id);
    if (grid === undefined) {
      throw new Error("Top-level address node should always specify a grid.");
    }
    return grid;
  }

  private onDragEnd = () => {
    this.clearDragListener();
  }
}
