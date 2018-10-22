import * as _ from 'lodash';
import * as React from 'react';
import {BaseModel} from '../core/base_model';
import {keysEqual, shallowEqual} from '../utils/utils';

export interface BaseProps {
  epoch: number,
}

export class BaseComponent<P extends BaseProps, S = {}> extends React.Component<P, S> {
  private lastRenderedEpoch: number = -1;

  public shouldComponentUpdate? = (nextProps: Readonly<P>, nextState: Readonly<S>): boolean => {
    const ignoreKeys = {props: ["epoch"]};
    return this.shouldComponentUpdateHelper(nextProps, nextState, ignoreKeys);
  }

  public componentDidUpdate = () => {
    this.lastRenderedEpoch = this.props.epoch;
  }

  // returns true if props, state, or context has changed
  protected shouldComponentUpdateHelper = (
    nextProps: Readonly<P>,
    nextState: Readonly<S>,
    ignoreKeys: {props?: string[], state?: string[]},
  ): boolean => {
    if (!keysEqual(this.props, nextProps)) {
      return true;
    }
    const ignoreProps = ignoreKeys.props || [];
    for (const k in nextProps) {
      if (k in ignoreProps) {
        continue;
      }
      const v = nextProps[k];
      if (v !== this.props[k] || (v instanceof BaseModel && v.epoch > this.lastRenderedEpoch)) {
        return true;
      }
    }

    const stateUnchanged = ignoreKeys.state ?
      shallowEqual(_.omit(this.state, ignoreKeys.state), _.omit(nextState, ignoreKeys.state)) :
      shallowEqual(this.state, nextState);
    return !stateUnchanged;
  }
}