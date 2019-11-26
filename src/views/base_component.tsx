import * as _ from 'lodash';
import * as React from 'react';

import {Mutable} from '@models/core/mutable';
import {ROArray} from '@utils/types';
import {keysEqual, shallowEqual} from '@utils/utils';

export interface BaseProps {
  epoch: number,
}

export interface IgnoreKeys {
  readonly props: ROArray<string>,
  readonly state: ROArray<string>,
}

export class BaseComponent<P extends BaseProps, S = {}> extends React.Component<P, S> {
  protected static readonly IGNORE_KEYS: IgnoreKeys = {props: ["epoch"], state: []};

  private lastRenderedEpoch: number = -1;
  protected readonly ignoreKeys = BaseComponent.IGNORE_KEYS;

  // may be overridden in subclass so can't use arrow method
  public shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>): boolean {
    return this.shouldComponentUpdateHelper(nextProps, nextState, this.ignoreKeys);
  }

  // may be overridden in subclass so can't use arrow method
  public componentDidUpdate() {
    this.lastRenderedEpoch = this.props.epoch;
  }

  // returns true if props, state, or context has changed
  protected shouldComponentUpdateHelper = (
    nextProps: Readonly<P>,
    nextState: Readonly<S>,
    ignoreKeys: IgnoreKeys,
  ): boolean => {
    if (!keysEqual(this.props, nextProps)) {
      return true;
    }
    for (const k in nextProps) {
      if (k in ignoreKeys.props) {
        continue;
      }
      const v = nextProps[k];
      if (v !== this.props[k] || (v instanceof Mutable && v.epoch > this.lastRenderedEpoch)) {
        return true;
      }
    }

    const stateUnchanged = shallowEqual(_.omit(this.state, ignoreKeys.state), _.omit(nextState, ignoreKeys.state));
    return !stateUnchanged;
  }

  protected static mergeIgnoreKeys = (keys: Array<Partial<IgnoreKeys>>): IgnoreKeys => {
    const props = _.uniq(_.flatMap(keys, k => k.props || []));
    const state = _.uniq(_.flatMap(keys, k => k.state || []));
    return {props, state};
  }
}