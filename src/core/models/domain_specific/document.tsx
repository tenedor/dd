import * as _ from 'lodash';

import {addDemoGrids} from '@core/built_in_grids';
import {FormulaEnvironment} from '@language/formula_environment';
import {loadStandardLibrary} from '@language/standard_library';
import {ROArray} from '@utils/types';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from '../collections/functional_array';
import {ModelType} from '../core/model';
import {Mutable} from '../core/mutable';
import {UpdateDescriptor, UpdateManager} from '../core/update_manager';
import {DocumentUpdateType} from '../core/update_types';
import {Grid, GridData, GridUpdateDescriptor} from './grid';

export type Grids = FunctionalArrayM<Grid, GridUpdateDescriptor>;

export interface DocumentUpdateDescriptor extends UpdateDescriptor<DocumentUpdateType> {}

export class Document extends Mutable<DocumentUpdateDescriptor> {
  private readonly formulaEnvironment: FormulaEnvironment;
  public readonly grids: Grids;

  constructor(updateManager: UpdateManager, modelType: ModelType = ModelType.DOCUMENT) {
    // Unlike other models, Document creates its own UpdateManager. There is one
    // update manager per document and all other models receive this singleton.
    super(updateManager, modelType);

    const standardLibrary = loadStandardLibrary(updateManager);
    this.formulaEnvironment = new FormulaEnvironment(standardLibrary);
    this.grids = new FunctionalArrayM(this.updateManager, []);
    this.grids.listenForUpdate(this, this.onGridsUpdated);
  }

  public addDemoGrids = () => {
    addDemoGrids(this, this.updateManager, this.formulaEnvironment);
  }

  public addGridFromGridData = (gridData: GridData, index?: number): Grid => {
    const grid = new Grid(this.updateManager, gridData);
    index === undefined ? this.grids.push(grid) : this.grids.insert(grid, index);
    return grid;
  }

  public addGrid = ({name, parentGrid, index}: {name?: string, parentGrid?: Grid, index?: number} = {}): Grid => {
    const {formulaEnvironment} = this;
    const _name = name || this.getDefaultNameForGrid();
    return this.addGridFromGridData({name: _name, formulaEnvironment, parentGrid}, index)
  }

  public getAllGridsFunctionally = (): ROArray<Grid> => {
    return this.grids.a;
  }

  public getAllExtensibleGrids = (): ROArray<Grid> => {
    return this.formulaEnvironment.getAllExtensibleGrids();
  }

  private getDefaultNameForGrid = (): string => {
    const baseName = "Grid";
    let i = 1;
    while (true) {
      const name = `${baseName} ${i}`;
      if (!this.formulaEnvironment.existsGridWithName(name)) {
        return name;
      }
      i++;
    }
  }

  private onGridsUpdated = (epoch: number, updates: Array<ArrayUD<GridUpdateDescriptor>>): DocumentUpdateDescriptor[] => {
    const descriptors: DocumentUpdateDescriptor[] = [{type: DocumentUpdateType.GRIDS_UPDATED}];
    this.onDependencyUpdated(epoch);
    return descriptors;
  }
}
