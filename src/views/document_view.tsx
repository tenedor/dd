import * as _ from 'lodash';
import * as React from 'react';

import {Document} from '@models/domain_specific/document';
import {Grid} from '@models/domain_specific/grid';
import {ROArray} from '@utils/types';
import {BaseComponent, BaseProps} from './base_component';
import {DrawingView} from './drawing_view';
import {TableView} from './table_view';
import {TitleEditorView} from './title_editor_view';
import {PopUpView} from './utilities/pop_up_view';

interface Props extends BaseProps {
  document: Document,
}

interface State {
  showAddGridMenu?: {x: number, y: number},
}

export class DocumentView extends BaseComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  public render = () => {
    const {document, epoch} = this.props;
    const grids = document.getAllGridsFunctionally();
    const addGridMenu = this.renderAddGridMenu();
    const tables = this.renderTables(epoch, grids);
    return (
      <div>
        <DrawingView epoch={epoch} grids={grids} />
        <div className="add-grid">
          <div className="add-grid-click-target" onClick={this.onClickAddGrid} />
          {addGridMenu}
        </div>
        {tables}
      </div>
    );
  }

  private renderAddGridMenu = () => {
    const {epoch} = this.props;
    const {showAddGridMenu} = this.state;
    if (showAddGridMenu === undefined) {
      return;
    }
    const pos = showAddGridMenu;
    const content = this.renderAddGridMenuContent();
    return (
      <PopUpView epoch={epoch} className="add-grid-menu-pop-up" position={pos}>
        {content}
      </PopUpView>
    );
  }

  private renderAddGridMenuContent = () => {
    const {document} = this.props;
    const grids = document.getAllExtensibleGrids();
    const newGridMenuItem = this.renderGridMenuItem("New Grid", e => this.onClickAddNewGrid(e));
    const extendGridMenuItems = grids.map(grid =>
      this.renderGridMenuItem(grid.name, e => this.onClickAddGridExtending(grid, e)));
    return (
      <div className="add-grid-menu">
        {newGridMenuItem}
        <div className="menu-item-divider" />
        <div className="menu-item-hint">or extend...</div>
        {extendGridMenuItems}
      </div>
    );
  }

  private renderGridMenuItem = (name: string, onClick: React.MouseEventHandler<HTMLDivElement>) => {
      return (
        // Disable linting for now as a placeholder to defer implementing more UI. TODO fix this.
        // tslint:disable-next-line:jsx-no-lambda
        <div key={name} className="add-grid-menu-item add-menu-item" onClick={onClick}>
          {name}
        </div>
      );
  }

  private renderTables = (epoch: number, grids: ROArray<Grid>) => {
    return grids.map(grid =>
      <div key={`grid-${grid.id}`} className="grid">
        <TitleEditorView key='title' title={grid.name} onSetTitle={grid.setName} epoch={epoch} />
        <TableView key={`table-${grid.id}`} epoch={epoch} grid={grid} />
      </div>
    );
  }

  private onClickAddGrid = (e: React.MouseEvent) => {
    if (this.gridMenuIsOpen()) {
      this.closeAddGridMenu();
    } else {
      const {offsetX: x, offsetY: y} = e.nativeEvent;
      this.openAddGridMenu({x, y});
    }
    e.stopPropagation();
  }

  private onClickAddNewGrid = (e: React.MouseEvent) => {
    this.props.document.addGrid({index: 0});
    this.closeAddGridMenu();
  }

  private onClickAddGridExtending = (parentGrid: Grid, e: React.MouseEvent) => {
    this.props.document.addGrid({parentGrid, index: 0});
    this.closeAddGridMenu();
  }

  private gridMenuIsOpen = () => {
    return this.state.showAddGridMenu !== undefined;
  }

  private openAddGridMenu = (position: {x: number, y: number}) => {
    this.setState({showAddGridMenu: position});
  }

  private closeAddGridMenu = () => {
    this.setState({showAddGridMenu: undefined});
  }
}
