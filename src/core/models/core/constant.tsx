import * as _ from 'lodash';

import {generateUID} from '@utils/utils';
import {ModelType} from './model';
import {DependencyGraphPartitionIndex, DependencyNode, UpdateDescriptor}
        from './update_manager';

export class Constant<D extends UpdateDescriptor = UpdateDescriptor> implements DependencyNode<D> {
  public readonly id: string;
  public readonly dependencyGraphPartitionIndex = DependencyGraphPartitionIndex.CONSTANT;
  public readonly epoch = 0;
  public readonly updateListeners = new Map();
  public readonly dependencyUpdateListeners = new Map();

  constructor(uid?: string, modelType: ModelType = ModelType.CONSTANT) {
    this.id = uid === undefined ? generateUID(modelType) : uid;
  }

  public listenForUpdate() { /* do nothing */ }
  public listenForDependencyUpdate() { /* do nothing */ }
  public removeUpdateListener() { /* do nothing */ }
  public removeDependencyUpdateListener() { /* do nothing */ }

  public onDependencySetUpdated(): never {
    throw new Error("A constant cannot depend on anything.");
  }

  protected onDependencyUpdated(): never {
    throw new Error("A constant cannot depend on anything.");
  }

  public aggregateUpdateDescriptors(descriptors: D[]): D[] {
    return descriptors;
  }
}
