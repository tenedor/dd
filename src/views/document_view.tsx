import * as _ from 'lodash';
import * as React from 'react';

import {Document} from '@models/document';
import {Grid} from '@models/grid';
import {ROArray} from '@utils/types';
import {BaseComponent, BaseProps} from './base_component';
import {DrawingView} from './drawing_view';
import {TableView} from './table_view';

interface Props extends BaseProps {
  document: Document,
}

export class DocumentView extends BaseComponent<Props> {
  public render = () => {
    const {document, epoch} = this.props;
    const grids = document.getAllGridsFunctionally();
    const tables = this.renderTables(epoch, grids);
    return (
      <div>
        <DrawingView epoch={epoch} grids={grids} />
        {tables}
      </div>
    );
  }

  private renderTables = (epoch: number, grids: ROArray<Grid>) => {
    return grids.map(grid =>
      <div key={`grid-${grid.id}`} className="grid">
        <div className="grid-name">{grid.name}</div>
        <TableView key={`table-${grid.id}`} epoch={epoch} grid={grid} />
      </div>
    );
  }
}
