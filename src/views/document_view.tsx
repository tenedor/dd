import * as _ from 'lodash';
import * as React from 'react';
import {Document} from '../core/document';
import {assert} from '../utils/utils';
import {DrawingView} from '../views/drawing_view';
import {TableView} from '../views/table_view';
import {BaseComponent, BaseProps} from './base_component';

interface Props extends BaseProps {
  document: Document,
}

export class DocumentView extends BaseComponent<Props> {
  public render = () => {
    const {document, epoch} = this.props;
    const grids = document.getAllGridsFunctionally();
    // for now there is always one grid
    assert(grids.length === 1);
    const grid = grids[0];
    return (
      <div>
        <DrawingView epoch={epoch} grids={grids} />
        <TableView epoch={epoch} grid={grid} />
      </div>
    );
  }
}
