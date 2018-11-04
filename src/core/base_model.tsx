import {Namespace, Resolver} from './resolver';
import {UpdateManager} from './update_manager';
import {UndefinedUpdateType, UpdateType} from './update_types';

export interface UpdateDescriptor<T = UpdateType> {
  type: T;
}

export interface UndefinedUpdateDescriptor extends UpdateDescriptor<UndefinedUpdateType> {}

export type UpdateListener<T extends BaseModel<TD>, TD extends UpdateDescriptor> =
    (epoch: number, updateDescriptors: TD[], object: T) => void;

export type BaseModelOrId = BaseModel<UpdateDescriptor> | string;

export class BaseModel<D extends UpdateDescriptor> {
  public readonly id: string;
  protected readonly namespace: Namespace = Namespace.MODEL;
  public epoch: number;
  protected readonly updateManager: UpdateManager;
  private updateListeners: Array<UpdateListener<this, D>> = [];

  constructor(updateManager: UpdateManager) {
    this.id = Resolver.generateUID(this.namespace);
    this.updateManager = updateManager;
    this.epoch = updateManager.epoch;
  }

  public listenForUpdate = (updateGraphNode: BaseModelOrId, onUpdate: UpdateListener<this, D>) => {
    // ensure unique
    const index = this.updateListeners.indexOf(onUpdate);
    if (index < 0) {
      this.updateListeners.push(onUpdate);
    }
  }

  public removeUpdateListener = (onUpdate: UpdateListener<this, D>) => {
    const index = this.updateListeners.indexOf(onUpdate);
    if (index >= 0) {
      this.updateListeners.splice(index, 1);
    }
  }

  private announceUpdate = (descriptors: D[]) => {
    this.updateListeners.forEach(listener => listener(this.epoch, descriptors, this));
  }

  protected onDependencyUpdated = (epoch: number, descriptors: D[]) => {
    if (this.epoch < epoch) {
      this.epoch = epoch;
      this.announceUpdate(descriptors);
    }
  }

  protected onSelfMutated = (descriptors: D[]) => {
    this.epoch = this.updateManager.nextEpoch();
      this.announceUpdate(descriptors);
  }
}