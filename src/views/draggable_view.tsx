import * as React from 'react';

import {Vector} from '@core/geometry';
import {classNames} from '@utils/utils';
import {DragListener, MouseMoveManager} from './mouse_move_manager';

interface Props {
  mouseMoveManager: MouseMoveManager;
  onDragStart?: () => void;
  onDragMove?: (delta: Vector) => void;
  onDragRelease?: (delta: Vector) => void;
  onDragCancel?: () => void;
  className?: string;
}

export class DraggableView extends React.Component<Props, {}> {
  private readonly dragListener: DragListener;

  constructor(props: Props) {
    super(props);

    this.dragListener = {
      onDragStart: this.onDragStart,
      onDragMove: this.onDragMove,
      onDragRelease: this.onDragRelease,
      onDragCancel: this.onDragCancel,
      onMouseupNeverDragged: this.onMouseupNeverDragged,
    };
  }

  public render = (): JSX.Element => {
    const className = classNames("draggable-view", this.props.className);
    return (
      <div className={className} onMouseDown={this.onMouseDownTarget} />
    );
  }

  public cancelDragIfAny = () => {
    this.props.mouseMoveManager.clearDragIfAny();
  }

  private onMouseDownTarget = (e: React.MouseEvent) => {
    this.setDragListener();
  }

  private setDragListener = () => {
    this.props.mouseMoveManager.setDragListener(this.dragListener);
  }

  private clearDragListener = () => {
    this.props.mouseMoveManager.clearDragListener(this.dragListener);
  }

  private onDragStart = () => {
    const {onDragStart} = this.props;
    if (onDragStart) {
      onDragStart();
    }
  }

  private onDragMove = (mousemove: MouseEvent, originMousedown: MouseEvent) => {
    const {onDragMove} = this.props;
    if (onDragMove) {
      const delta = DraggableView.getDelta(mousemove, originMousedown);
      onDragMove(delta);
    }
  }

  private onDragRelease = (mouseup: MouseEvent, originMousedown: MouseEvent) => {
    const {onDragRelease: onDragEnd} = this.props;
    if (onDragEnd) {
      const delta = DraggableView.getDelta(mouseup, originMousedown);
      onDragEnd(delta);
    }
    this.clearDragListener();
  }

  private onDragCancel = () => {
    const {onDragCancel} = this.props;
    if (onDragCancel) {
      onDragCancel();
    }
    this.clearDragListener();
  }

  private onMouseupNeverDragged = () => {
    this.clearDragListener();
  }

  private static getDelta = (current: MouseEvent, origin: MouseEvent): Vector => {
      const x = current.x - origin.x;
      const y = current.y - origin.y;
      return {x, y};
  }
}
