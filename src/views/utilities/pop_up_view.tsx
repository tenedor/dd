import * as React from 'react';

import {classNames} from '@utils/utils';
import {BaseComponent, BaseProps} from '../base_component';

interface Props extends BaseProps {
  className?: string,
  position: {x: number, y: number},
}

export class PopUpView extends BaseComponent<Props> {
  public render = () => {
    const {children, className, position} = this.props;
    const {x, y} = position;
    const style = {left: x, top: y};

    return (
      <div className="pop-up-view-pixel" style={style}>
        <div className={classNames("pop-up-view", className)}>
          {children}
        </div>
      </div>
    );
  }
}
