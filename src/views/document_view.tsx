import * as _ from 'lodash';
import * as React from 'react';
import {Document} from 'src/core/document';
import {Grid} from 'src/core/grid';
import {ROArray} from 'src/utils/types';
import {DrawingView} from 'src/views/drawing_view';
import {TableView} from 'src/views/table_view';
import {BaseComponent, BaseProps} from './base_component';

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
      <TableView key={`table-${grid.id}`} epoch={epoch} grid={grid} />
    );
  }
}
