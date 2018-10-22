import {EpochManager} from './epoch_manager';

export type EpochUpdateListener = (epoch: number) => void;

export class BaseModel {
  public epoch: number;
  protected readonly epochManager: EpochManager;
  private epochUpdateListeners: EpochUpdateListener[] = [];

  constructor(epochManager: EpochManager) {
    this.epochManager = epochManager;
    this.epoch = epochManager.epoch;
  }

  public listenForEpochUpdate = (onEpochUpdate: EpochUpdateListener) => {
    this.epochUpdateListeners.push(onEpochUpdate);
  }

  protected onChildEpochUpdated = (epoch: number) => {
    if (this.epoch < epoch) {
      this.epoch = epoch;
      this.epochUpdateListeners.forEach(listener => listener(this.epoch));
    }
  }

  protected onSelfMutated = () => {
    this.epoch = this.epochManager.nextEpoch();
    this.epochUpdateListeners.forEach(listener => listener(this.epoch));
  }
}