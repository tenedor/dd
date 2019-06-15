import * as _ from 'lodash';

import {addBuiltInGrids} from '@core/built_in_grids';
import {FormulaEnvironment} from '@language/formula_environment';
import {ROArray} from '@utils/types';
import {ArrayUpdateDescriptor as ArrayUD, FunctionalArrayM} from './functional_array';
import {Grid, GridData, GridUpdateDescriptor} from './grid';
import {ModelType} from './model';
import {Mutable} from './mutable';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {DocumentUpdateType} from './update_types';

export type Grids = FunctionalArrayM<Grid, GridUpdateDescriptor>;

export interface DocumentUpdateDescriptor extends UpdateDescriptor<DocumentUpdateType> {}

export class Document extends Mutable<DocumentUpdateDescriptor> {
  private readonly formulaEnvironment: FormulaEnvironment;
  public readonly grids: Grids;

  constructor(updateManager: UpdateManager, modelType: ModelType = ModelType.DOCUMENT) {
    // Unlike other models, Document creates its own UpdateManager. There is one
    // update manager per document and all other models receive this singleton.
    super(updateManager, modelType);

    this.formulaEnvironment = new FormulaEnvironment();
    this.grids = new FunctionalArrayM(this.updateManager, []);
    this.grids.listenForUpdate(this, this.onGridsUpdated);
  }

  public loadBuiltInFormulas = () => {
    // this.formulaEnvironment;
  }

  public addBuiltInGrids = () => {
    addBuiltInGrids(this, this.updateManager, this.formulaEnvironment);
  }

  public createGrid = (gridData: GridData): Grid => {
    const grid = new Grid(this.updateManager, gridData);
    this.formulaEnvironment.addGrid(grid);
    this.grids.push(grid);
    return grid;
  }

  public getAllGridsFunctionally = (): ROArray<Grid> => {
    return this.grids.a;
  }

  private onGridsUpdated = (epoch: number, updates: Array<ArrayUD<GridUpdateDescriptor>>): DocumentUpdateDescriptor[] => {
    const descriptors: DocumentUpdateDescriptor[] = [{type: DocumentUpdateType.GRIDS_UPDATED}];
    this.onDependencyUpdated(epoch);
    return descriptors;
  }
}
