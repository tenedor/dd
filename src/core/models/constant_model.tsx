import * as _ from 'lodash';

import {BaseModel, ModelType} from './base_model';
import {DependencySetUpdateDescriptor, DependencySetUpdateListener,
        DependencyUpdateListener, UpdateDescriptor, UpdateGraphNodeId, UpdateListener,
        UpdateManager} from './update_manager';

class ConstantUpdateManager implements UpdateManager {
  public readonly epoch = 0;

  public nextEpoch = () => {
    throw new Error("Models using a constant update manager cannot evolve.");
  }

  public announceMutated = <D extends UpdateDescriptor> (id: UpdateGraphNodeId<D>, updates: D[]) => {
    throw new Error("Models using a constant update manager cannot mutate.");
  }
}

export class ConstantModel<D extends UpdateDescriptor = UpdateDescriptor> extends BaseModel<D> {

  constructor(namespace: ModelType = ModelType.CONSTANT) {
    super(new ConstantUpdateManager(), namespace);
  }

  public listenForUpdate<LD extends UpdateDescriptor>(
    id: UpdateGraphNodeId<LD>,
    onUpdate: UpdateListener<this, D, LD>,
  ) {
    // Do nothing
  }

  public listenForDependencyUpdate<LD extends UpdateDescriptor>(
    id: UpdateGraphNodeId<LD>,
    onUpdate: DependencyUpdateListener<this, D>,
  ) {
    // Do nothing
  }

  public removeUpdateListener = (id: UpdateGraphNodeId<UpdateDescriptor>) => {
    // Do nothing
  }

  public removeDependencyUpdateListener = (id: UpdateGraphNodeId<UpdateDescriptor>) => {
    // Do nothing
  }

  public onDependencySetUpdated: DependencySetUpdateListener<this, D> = (
    epoch: number,
    updates: DependencySetUpdateDescriptor[],
    dependency: this,
    updatesRemain: boolean,
  ): D[] => {
    throw new Error("A constant cannot depend on anything.");
  }

  protected onDependencyUpdated = (epoch: number) => {
    throw new Error("A constant cannot depend on anything.");
  }

  protected onSelfMutated = (descriptors: D[]) => {
    throw new Error("A constant cannot be mutated.");
  }
}
