import {EpochManager} from './epoch_manager';
import {Namespace, Resolver} from './resolver';
import {UndefinedUpdateType, UpdateType} from './update_types';

export interface UpdateDescriptor<T = UpdateType> {
  type: T;
}

export interface UndefinedUpdateDescriptor extends UpdateDescriptor<UndefinedUpdateType> {}

export type EpochUpdateListener<T extends BaseModel<TD>, TD extends UpdateDescriptor> =
    (epoch: number, updateDescriptors: TD[], object: T) => void;

export type BaseModelOrId = BaseModel<UpdateDescriptor> | string;

export class BaseModel<D extends UpdateDescriptor> {
  public readonly id: string;
  protected readonly namespace: Namespace = Namespace.MODEL;
  public epoch: number;
  protected readonly epochManager: EpochManager;
  private epochUpdateListeners: Array<EpochUpdateListener<this, D>> = [];

  constructor(epochManager: EpochManager) {
    this.id = Resolver.generateUID(this.namespace);
    this.epochManager = epochManager;
    this.epoch = epochManager.epoch;
  }

  public listenForEpochUpdate = (updateGraphNode: BaseModelOrId, onEpochUpdate: EpochUpdateListener<this, D>) => {
    // ensure unique
    const index = this.epochUpdateListeners.indexOf(onEpochUpdate);
    if (index < 0) {
      this.epochUpdateListeners.push(onEpochUpdate);
    }
  }

  public removeEpochUpdateListener = (onEpochUpdate: EpochUpdateListener<this, D>) => {
    const index = this.epochUpdateListeners.indexOf(onEpochUpdate);
    if (index >= 0) {
      this.epochUpdateListeners.splice(index, 1);
    }
  }

  private announceUpdate = (descriptors: D[]) => {
    this.epochUpdateListeners.forEach(listener => listener(this.epoch, descriptors, this));
  }

  protected onDependencyEpochUpdated = (epoch: number, descriptors: D[]) => {
    if (this.epoch < epoch) {
      this.epoch = epoch;
      this.announceUpdate(descriptors);
    }
  }

  protected onSelfMutated = (descriptors: D[]) => {
    this.epoch = this.epochManager.nextEpoch();
      this.announceUpdate(descriptors);
  }
}