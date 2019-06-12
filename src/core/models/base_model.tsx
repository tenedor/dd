import {assert, generateUID} from '@utils/utils';
import {DependencyGraphPartitionIndex, DependencySetUpdateDescriptor,
        DependencySetUpdateListener, DependencyUpdateListener, UpdateDescriptor,
        UpdateGraphNodeId, UpdateListener, UpdateManager} from './update_manager';

export enum ModelType {
  ARRAY = 'arr',
  CELL = 'cell',
  COLUMN = 'col',
  CONSTANT = 'const',
  DICTIONARY = 'dict',
  DOCUMENT = 'doc',
  FORMULA_EXPRESSION = 'formula-expr',
  GRID = 'grid',
  GRID_COLUMN = 'gridcol',
  MODEL = 'model',
  ROW = 'row',
}

export class BaseModel<D extends UpdateDescriptor = UpdateDescriptor> {
  public readonly id: string;
  public readonly dependencyGraphPartitionIndex: DependencyGraphPartitionIndex = DependencyGraphPartitionIndex.DEFAULT;
  public epoch: number;
  protected readonly updateManager: UpdateManager;
  // The UpdateDescriptors in updateListeners (not including D) must match per
  // key-value pair. Can't enforce this with TS.
  public updateListeners: Map<UpdateGraphNodeId<UpdateDescriptor>,
    UpdateListener<this, D, UpdateDescriptor>> = new Map();
  public dependencyUpdateListeners: Map<UpdateGraphNodeId<UpdateDescriptor>,
    DependencyUpdateListener<this, D>> = new Map();

  // Child class properties are not initialized until after calling super() so
  // the namespace must be overridden by passing it as a constructor parameter.
  // By contract the base model must initialize the id.
  constructor(updateManager: UpdateManager, namespace: ModelType = ModelType.MODEL) {
    this.id = generateUID(namespace);
    this.updateManager = updateManager;
    this.epoch = updateManager.epoch;
  }

  // LD is the listener's descriptor, if one exists - namely, if onUpdate
  // returns a list of descriptors they must describe changes to the model given
  // by `id`. This occurs if the listener's model updates because of this
  // model's updates.
  public listenForUpdate<LD extends UpdateDescriptor>(
    id: UpdateGraphNodeId<LD>,
    onUpdate: UpdateListener<this, D, LD>,
  ) {
    // Require a static partial ordering of dependencies. A model cannot depend
    // on a model with a higher partition index. (Since only BaseModels can be
    // dependend on, non-BaseModel objects have partition index infinity.)
    if (id instanceof BaseModel) {
      assert(this.dependencyGraphPartitionIndex <= id.dependencyGraphPartitionIndex);
    }
    // listeners must be unique per id
    this.updateListeners.set(id, onUpdate);
  }

  // This follows the same pattern as listenForUpdate.
  public listenForDependencyUpdate<LD extends UpdateDescriptor>(
    id: UpdateGraphNodeId<LD>,
    onUpdate: DependencyUpdateListener<this, D>,
  ) {
    // Require a static partial ordering of dependency dependencies. A model
    // cannot depend on a model with a higher partition index.
    if (id instanceof BaseModel) {
      assert(this.dependencyGraphPartitionIndex < id.dependencyGraphPartitionIndex);
    }
    // listeners must be unique per id
    this.dependencyUpdateListeners.set(id, onUpdate);
  }

  public removeUpdateListener = (id: UpdateGraphNodeId<UpdateDescriptor>) => {
    this.updateListeners.delete(id);
  }

  public removeDependencyUpdateListener = (id: UpdateGraphNodeId<UpdateDescriptor>) => {
    this.dependencyUpdateListeners.delete(id);
  }

  // Override this method in a child to listen to resolution-time updates to the
  // child's dependency set.
  public onDependencySetUpdated: DependencySetUpdateListener<this, D> = (
    epoch: number,
    updates: DependencySetUpdateDescriptor[],
    dependency: this,
    updatesRemain: boolean,
  ): D[] => {
    throw new Error("Must implement onDependencySetUpdated to process resolution-time dependency updates.");
  }

  // This method must be called for any model update that occurs during
  // depenendency update resolution (i.e. in an update listener). This notifies
  // downstream dependency listeners of the update.
  protected onDependencyUpdated = (epoch: number) => {
    if (this.epoch < epoch) {
      this.epoch = epoch;
    }
  }

  // This method must be called for any model update that occurs outside
  // depenendency update resolution. This alerts the dependency graph of the
  // need for resolution.
  protected onSelfMutated = (descriptors: D[]) => {
    this.epoch = this.updateManager.nextEpoch();
    this.updateManager.announceMutated(this, descriptors);
  }

  // Optionally override this to process all update descriptors this model
  // generated in a resolution cycle before they are sent to dependents. This
  // may be useful for performance optimizations.
  public aggregateUpdateDescriptors = (descriptors: D[]): D[] => {
    return descriptors;
  }
}