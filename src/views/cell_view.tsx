import * as React from 'react';

import {Vector} from '@core/geometry';
import {classNames} from '@utils/utils';
import {DraggableView} from './draggable_view';
import {UIGlobals} from './ui_globals';

export interface ResizerCallbacks {
  resize: (offset: number) => void;
  transientResize: (offset: number) => void;
}

interface Props {
  dataCellId: string;
  value: string;
  isHeader?: boolean;
  isDefaultValue?: boolean;
  resizerCallbacks?: ResizerCallbacks;
  uiGlobals: UIGlobals,
}

export class CellView extends React.Component<Props, {}> {

  public render = (): JSX.Element => {
    const {dataCellId, value, isHeader, isDefaultValue, resizerCallbacks, uiGlobals} = this.props;
    const className = classNames("cell-view", {
      header: !!isHeader,
      defaultValue: !!isDefaultValue,
    });
    const resizer = resizerCallbacks ?
      <DraggableView className="resizer" mouseMoveManager={uiGlobals.mouseMoveManager}
          onDragMove={this.onDragMove} onDragRelease={this.onDragRelease} onDragCancel={this.onDragCancel} /> :
      undefined;
    return (
      <div className={className} data-cell-id={dataCellId}>
        <div className="value">
          {value}
        </div>
        {resizer}
      </div>
    );
  }

  private onDragMove = (delta: Vector) => {
    const {resizerCallbacks} = this.props;
    if (resizerCallbacks) {
      resizerCallbacks.transientResize(delta.x);
    }
  }

  private onDragRelease = (delta: Vector) => {
    const {resizerCallbacks} = this.props;
    if (resizerCallbacks) {
      resizerCallbacks.resize(delta.x);
    }
  }

  private onDragCancel = () => {
    const {resizerCallbacks} = this.props;
    if (resizerCallbacks) {
      resizerCallbacks.transientResize(0);
    }
  }
}
