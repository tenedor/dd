import {assert, generateUID} from '@utils/utils';
import {ModelType} from './model';
import {DependencyGraphPartitionIndex, DependencyNode, DependencySetUpdateDescriptor,
        DependencySetUpdateListener, DependencyUpdateListener, UpdateDescriptor,
        UpdateListener, UpdateManager} from './update_manager';

export class Mutable<D extends UpdateDescriptor = UpdateDescriptor> implements DependencyNode<D> {
  public readonly id: string;
  public readonly dependencyGraphPartitionIndex: DependencyGraphPartitionIndex = DependencyGraphPartitionIndex.VALUE;
  public epoch: number;
  protected readonly updateManager: UpdateManager;
  // The UpdateDescriptors in updateListeners (not including D) must match per
  // key-value pair. Can't enforce this with TS.
  public updateListeners: Map<DependencyNode<UpdateDescriptor>,
    UpdateListener<this, D, UpdateDescriptor>> = new Map();
  public dependencyUpdateListeners: Map<DependencyNode<UpdateDescriptor>,
    DependencyUpdateListener<this, D>> = new Map();

  // Child class properties are not initialized until after calling super() so
  // the model type must be overridden by passing it as a constructor parameter.
  // By contract Mutable must initialize the id.
  constructor(updateManager: UpdateManager, modelType: ModelType = ModelType.MODEL, id?: string) {
    this.id = id || generateUID(modelType);
    this.updateManager = updateManager;
    this.epoch = updateManager.epoch;
  }

  // LD is the listener's descriptor, if one exists - namely, if onUpdate
  // returns a list of descriptors they must describe changes to the model given
  // by `id`. This occurs if the listener's model updates because of this
  // model's updates.
  public listenForUpdate<LD extends UpdateDescriptor>(
    id: DependencyNode<LD>,
    onUpdate: UpdateListener<this, D, LD>,
  ) {
    // Require a static partial ordering of dependencies. A node cannot depend
    // on a node with a higher partition index.
    assert(this.dependencyGraphPartitionIndex <= id.dependencyGraphPartitionIndex);

    // listeners must be unique per id
    this.updateListeners.set(id, onUpdate);
  }

  // This follows the same pattern as listenForUpdate.
  public listenForDependencyUpdate<LD extends UpdateDescriptor>(
    id: DependencyNode<LD>,
    onUpdate: DependencyUpdateListener<this, D>,
  ) {
    // Require a static partial ordering of dependencies. A node cannot depend
    // on a node with a higher partition index.
    assert(this.dependencyGraphPartitionIndex < id.dependencyGraphPartitionIndex);

    // listeners must be unique per id
    this.dependencyUpdateListeners.set(id, onUpdate);
  }

  public removeUpdateListener = (id: DependencyNode<UpdateDescriptor>) => {
    this.updateListeners.delete(id);
  }

  public removeDependencyUpdateListener = (id: DependencyNode<UpdateDescriptor>) => {
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
  // dependency update resolution (i.e. in an update listener). This notifies
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