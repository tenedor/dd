import * as React from 'react';

import {Identifier} from '@core/language/types';
import {CellView, ResizerCallbacks} from './cell_view';
import {UIGlobals} from './ui_globals';

interface Props {
  dataCellId: string;
  value: string;
  columnId: Identifier;
  resize: (columnId: Identifier, offset: number) => void;
  transientResize: (columnId: Identifier, offset: number) => void;
  uiGlobals: UIGlobals;
}

export class ColumnHeaderView extends React.Component<Props, {}> {

  private readonly resizerCallbacks: ResizerCallbacks;

  constructor(props: Props) {
    super(props);

    this.resizerCallbacks = {
      resize: this.resize,
      transientResize: this.transientResize,
    };
  }

  public render = (): JSX.Element => {
    const {dataCellId, value, uiGlobals} = this.props;
    return <CellView dataCellId={dataCellId} value={value} isHeader={true}
        resizerCallbacks={this.resizerCallbacks} uiGlobals={uiGlobals} />;
  }

  private resize = (offset: number) => {
    const {resize, columnId} = this.props;
    resize(columnId, offset);
  }

  private transientResize = (offset: number) => {
    const {transientResize, columnId} = this.props;
    transientResize(columnId, offset);
  }
}
