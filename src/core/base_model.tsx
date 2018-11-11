import {Namespace, Resolver} from './resolver';
import {UpdateDescriptor, UpdateGraphNodeId, UpdateListener, UpdateManager} from './update_manager';

export class BaseModel<D extends UpdateDescriptor> {
  public readonly id: string;
  protected readonly namespace: Namespace = Namespace.MODEL;
  public epoch: number;
  protected readonly updateManager: UpdateManager;
  // The UpdateDescriptors here (not including D) must match per key-value pair.
  // Can't enforce this with TS.
  public updateListeners: Map<UpdateGraphNodeId<UpdateDescriptor>,
    UpdateListener<this, D, UpdateDescriptor>> = new Map();

  constructor(updateManager: UpdateManager) {
    this.id = Resolver.generateUID(this.namespace);
    this.updateManager = updateManager;
    this.epoch = updateManager.epoch;
  }

  // LD is the listener's descriptor, if one exists - namely, if onUpdate returns
  // a list of descriptors they must describe changes to the model given by `id`.
  // This occurs if the listener's model updates because of this model's updates.
  public listenForUpdate<LD extends UpdateDescriptor>(
    id: UpdateGraphNodeId<LD>,
    onUpdate: UpdateListener<this, D, LD>,
  ) {
    // listeners must be unique per id
    this.updateListeners.set(id, onUpdate);
  }

  public removeUpdateListener = (id: UpdateGraphNodeId<UpdateDescriptor>) => {
    this.updateListeners.delete(id);
  }

  public announceUpdate = (descriptors: D[]) => {
    this.updateListeners.forEach(listener => listener(this.epoch, descriptors, this, false));
  }

  protected onDependencyUpdated = (epoch: number) => {
    if (this.epoch < epoch) {
      this.epoch = epoch;
    }
  }

  protected onSelfMutated = (descriptors: D[]) => {
    this.epoch = this.updateManager.nextEpoch();
    this.updateManager.announceMutated(this, descriptors);
  }

  public aggregateUpdateDescriptors = (descriptors: D[]): D[] => {
    return descriptors;
  }
}