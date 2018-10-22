import {BaseModel} from './base_model';
import {EpochManager} from './epoch_manager';
import {Grid} from './grid';
import {Resolver} from './resolver';

export class Document extends BaseModel {
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
    grid.listenForEpochUpdate(this.onChildEpochUpdated);
    this.resolver.addGrid(grid);
    this.onSelfMutated();

    return grid;
  }

  public getAllGridsFunctionally = (): Grid[] => {
    return this.resolver.getAllGridsFunctionally();
  }
}
