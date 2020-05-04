import * as _ from 'lodash';

import {FormulaEnvironment} from '@language/formula_environment';
import {addDemoGrids} from '@standard_library/built_in_grids';
import {loadStandardLibrary} from '@standard_library/standard_library';
import {ROArray} from '@utils/types';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from '../collections/functional_array';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {ArrayUpdateType, DocumentUpdateType} from '../core/update_types';
import {Grid, GridData, GridUpdateDescriptor} from './grid';

export type Grids = FunctionalArrayM<Grid, GridUpdateDescriptor>;
export type DrawingSurfaceInfos = FunctionalArrayM<FunctionalArrayM<Grid, GridUpdateDescriptor>, ArrayUD<GridUpdateDescriptor>>;

export interface DocumentUpdateDescriptor extends UpdateDescriptor<DocumentUpdateType> {}

export class Document extends Mutable<DocumentUpdateDescriptor> {
  private readonly environment: FormulaEnvironment;
  public readonly grids: Grids;
  public readonly drawingSurfaceInfos: DrawingSurfaceInfos;

  constructor(updateManager: UpdateManager, modelType: ModelType = ModelType.DOCUMENT) {
    // Unlike other models, Document creates its own UpdateManager. There is one
    // update manager per document and all other models receive this singleton.
    super(updateManager, modelType);

    this.environment = loadStandardLibrary(updateManager);
    this.grids = new FunctionalArrayM(this.updateManager, []);
    this.drawingSurfaceInfos = new FunctionalArrayM(this.updateManager, []);
    this.addDrawingSurface();
    this.grids.listenForUpdate(this, this.onGridsUpdated);
    this.drawingSurfaceInfos.listenForUpdate(this, this.onDrawingSurfaceInfosUpdated);

    this.environment.printSignatures(0);
  }

  public addDemoGrids = () => {
    addDemoGrids(this, this.updateManager, this.environment);
  }

  public addGridFromGridData = (gridData: GridData, index?: number): Grid => {
    const grid = new Grid(this.updateManager, gridData);
    index === undefined ? this.grids.push(grid) : this.grids.insert(grid, index);
    return grid;
  }

  public addGrid = ({name, parentGrid, index}: {name?: string, parentGrid?: Grid, index?: number} = {}): Grid => {
    const {environment} = this;
    const _name = name || this.getDefaultNameForGrid();
    return this.addGridFromGridData({name: _name, environment, parentGrid}, index)
  }

  public getAllExtensibleGrids = (): ROArray<Grid> => {
    return this.environment.getAllExtensibleGrids();
  }

  public addDrawingSurface = () => {
    this.drawingSurfaceInfos.push(new FunctionalArrayM(this.updateManager, []));
  }

  private getDefaultNameForGrid = (): string => {
    const baseName = "Grid";
    let i = 1;
    while (true) {
      const name = `${baseName} ${i}`;
      if (!this.environment.existsGridWithName(name)) {
        return name;
      }
      i++;
    }
  }

  private addNewGridsToDrawings = (grids: Grid[]) => {
    if (grids.length) {
      const latestSurface = this.drawingSurfaceInfos.a[this.drawingSurfaceInfos.length - 1];
      latestSurface.pushAll(grids);
    }
  }

  private onGridsUpdated = (epoch: number, updates: Array<ArrayUD<GridUpdateDescriptor>>): DocumentUpdateDescriptor[] => {
    const addedGridUpdates = updates.filter(u => u.type === ArrayUpdateType.ELEMENT_INSERTED);
    const addedGridIndices = _.flatten(addedGridUpdates.map(u => u.index));
    const addedGrids = _.map(addedGridIndices, i => this.grids.a[i]);
    this.addNewGridsToDrawings(addedGrids);
    const descriptors: DocumentUpdateDescriptor[] = [{type: DocumentUpdateType.GRIDS_UPDATED}];
    this.onDependencyUpdated(epoch);
    return descriptors;
  }

  private onDrawingSurfaceInfosUpdated = (epoch: number, updates: Array<ArrayUD<ArrayUD<GridUpdateDescriptor>>>): DocumentUpdateDescriptor[] => {
    const descriptors: DocumentUpdateDescriptor[] = [{type: DocumentUpdateType.GRIDS_UPDATED}];
    this.onDependencyUpdated(epoch);
    return descriptors;
  }
}
