import {BaseModel, UpdateDescriptor} from './base_model';
import {EpochManager} from './epoch_manager';
import {Grid, GridUpdateDescriptor} from './grid';
import {Resolver} from './resolver';
import {DocumentUpdateType} from './update_types';

export interface DocumentUpdateDescriptor extends UpdateDescriptor<DocumentUpdateType> {}

export class Document extends BaseModel<DocumentUpdateDescriptor> {
  private readonly resolver: Resolver;

  constructor() {
    // Unlike other models, Document creates its own EpochManager. There is one
    // epoch manager per document and all other models receive this singleton.
    super(new EpochManager());

    this.resolver = new Resolver();
  }

  public createGrid = (): Grid => {
    const gridId = this.resolver.generateUID('g');
    const grid = new Grid(this.epochManager, gridId);
    grid.listenForEpochUpdate(this.onGridEpochUpdated);
    this.resolver.addGrid(grid);

    const descriptor = {type: DocumentUpdateType.GRID_UPDATED};
    this.onSelfMutated([descriptor]);
    return grid;
  }

  public getAllGridsFunctionally = (): Grid[] => {
    return this.resolver.getAllGridsFunctionally();
  }

  private onGridEpochUpdated = (epoch: number, updates: GridUpdateDescriptor[]) => {
    const descriptor = {type: DocumentUpdateType.GRID_UPDATED};
    this.onDependencyEpochUpdated(epoch, [descriptor]);
  }
}
