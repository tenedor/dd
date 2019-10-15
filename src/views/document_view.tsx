import * as _ from 'lodash';
import * as React from 'react';

import {Document, DrawingSurfaceInfos} from '@models/domain_specific/document';
import {Grid} from '@models/domain_specific/grid';
import {ROArray} from '@utils/types';
import {BaseComponent, BaseProps} from './base_component';
import {DrawingView} from './drawing_view';
import {TableView} from './table_view';
import {TitleEditorView} from './title_editor_view';
import {UIGlobals} from './ui_globals';
import {PopUpView} from './utilities/pop_up_view';

interface Props extends BaseProps {
  document: Document,
  uiGlobals: UIGlobals,
}

interface State {
  drawingSurfaceSize: number,
  showAddGridMenu?: {x: number, y: number},
}

export class DocumentView extends BaseComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {drawingSurfaceSize: 300};
  }

  public render = () => {
    const {document, epoch} = this.props;
    const {grids, drawingSurfaceInfos: drawingSurfacesInfo} = document;
    const drawingSurfaces = this.renderDrawingSurfaces(epoch, drawingSurfacesInfo);
    const addButtons = this.renderAddButtons();
    const tables = this.renderTables(epoch, grids.a);
    return (
      <div>
        {drawingSurfaces}
        {addButtons}
        {tables}
      </div>
    );
  }

  private renderDrawingSurfaces = (epoch: number, infos: DrawingSurfaceInfos) => {
    const {uiGlobals} = this.props;
    const {drawingSurfaceSize} = this.state;
    const drawingViews = infos.a.map((info, i) => (
      <DrawingView key={`dv-${i}`} epoch={epoch} uiGlobals={uiGlobals} grids={info.a}
          size={drawingSurfaceSize} />
    ));
    return (
      <div className="drawing-surfaces">
        {drawingViews}
      </div>
    );
  }

  private renderAddButtons = () => {
    const addGridMenu = this.renderAddGridMenu();
    return (
        <div className="add-buttons">
          <div className="add-grid">
            <div className="add-grid-click-target click-target" onClick={this.onClickAddGrid} />
            {addGridMenu}
          </div>
          <div className="add-drawing-surface click-target" onClick={this.onClickAddDrawingSurface} />
          <div className="increase-surface-size click-target" onClick={this.onClickIncreaseSurfaceSize} />
          <div className="decrease-surface-size click-target" onClick={this.onClickDecreaseSurfaceSize} />
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

  private onClickAddDrawingSurface = (e: React.MouseEvent) => {
    this.props.document.addDrawingSurface();
  }

  private onClickIncreaseSurfaceSize = (e: React.MouseEvent) => {
    this.setState({drawingSurfaceSize: this.state.drawingSurfaceSize + 20});
  }

  private onClickDecreaseSurfaceSize = (e: React.MouseEvent) => {
    this.setState({drawingSurfaceSize: this.state.drawingSurfaceSize - 20});
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
