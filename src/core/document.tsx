import * as _ from 'lodash';
import {BaseModel} from './base_model';
import {getBuildInGrids} from './built_in_grids';
import {Grid, GridUpdateDescriptor} from './grid';
import {Namespace, Resolver} from './resolver';
import {UpdateDescriptor, UpdateManager} from './update_manager';
import {DocumentUpdateType} from './update_types';

export interface DocumentUpdateDescriptor extends UpdateDescriptor<DocumentUpdateType> {}

export class Document extends BaseModel<DocumentUpdateDescriptor> {
  private readonly resolver: Resolver;

  constructor(namespace: Namespace = Namespace.DOCUMENT) {
    // Unlike other models, Document creates its own UpdateManager. There is one
    // update manager per document and all other models receive this singleton.
    super(new UpdateManager(), namespace);

    this.resolver = new Resolver();
  }

  public createGrids = () => {
    const grids = getBuildInGrids(this.updateManager);
    grids.forEach(grid => {
      grid.listenForUpdate(this, this.onGridUpdated);
      this.resolver.addGrid(grid);
    });

    const descriptor = {type: DocumentUpdateType.GRID_UPDATED};
    this.onSelfMutated([descriptor]);
  }

  public getAllGridsFunctionally = (): Grid[] => {
    return this.resolver.getAllGridsFunctionally();
  }

  private onGridUpdated = (epoch: number, updates: GridUpdateDescriptor[]): DocumentUpdateDescriptor[] => {
    this.onDependencyUpdated(epoch);
    const descriptor = {type: DocumentUpdateType.GRID_UPDATED};
    return [descriptor];
  }
}
