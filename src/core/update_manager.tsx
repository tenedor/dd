import * as _ from 'lodash';
import {assert} from '../utils/utils';
import {BaseModel} from './base_model';
import {UndefinedUpdateType, UpdateType} from './update_types';

export interface UpdateDescriptor<T = UpdateType> {
  type: T;
}

export interface UndefinedUpdateDescriptor extends UpdateDescriptor<UndefinedUpdateType> {}

// This listener is called for updates TD[] to a model T. It may return void or,
// if it is associated with a model `S extends BaseModel<SD>`, may return a list
// of resulting updates SD[] to S.
export type UpdateListener<T extends BaseModel<TD>, TD extends UpdateDescriptor, SD extends UpdateDescriptor> =
    (epoch: number, updateDescriptors: TD[], dependency: T, updatesRemain: boolean) => SD[] | void;

type CurriedUpdateListener<SD extends UpdateDescriptor> = (updatesRemain: boolean) => SD[] | void;

export type UpdateGraphNodeId<D extends UpdateDescriptor> = BaseModel<D> | string;

interface UpdateGraphNode<D extends UpdateDescriptor> {
  numUnresolvedDependencies: number;
  dependencyUpdates: Array<CurriedUpdateListener<D>>;
  dependents: Array<UpdateGraphNodeId<UpdateDescriptor>>;
}

// The UpdateDescriptors here must match per key-value pair. Can't enforce this with TS.
type UpdateGraph = Map<UpdateGraphNodeId<UpdateDescriptor>, UpdateGraphNode<UpdateDescriptor>>;

export class UpdateManager {
  private _epoch: number = 0;

  public get epoch(): number {
    return this._epoch;
  }

  public nextEpoch = (): number => {
    this._epoch++;
    return this._epoch;
  };

  public announceMutated = <D extends UpdateDescriptor> (id: UpdateGraphNodeId<D>, updates: D[]) => {
    const updateGraph = UpdateManager.buildUpdateGraph(id);
    UpdateManager.resolveGraphUpdate(id, updates, updateGraph, this.epoch);
  }

  private static getDependents = (id: UpdateGraphNodeId<UpdateDescriptor>) => {
    return id instanceof BaseModel ? Array.from(id.updateListeners.keys()) : [];
  }

  private static buildUpdateGraph = <D extends UpdateDescriptor> (rootUpdateId: UpdateGraphNodeId<D>): UpdateGraph => {
    const updateGraph = new Map();

    // Build the root node.
    const rootDependents = UpdateManager.getDependents(rootUpdateId);
    updateGraph.set(rootUpdateId, {
      numUnresolvedDependencies: 0,
      dependencyUpdates: [],
      dependents: rootDependents,
    });

    // Recursively build dependents and count their dependencies.
    let dependentsToAdd = rootDependents.slice(0);
    while (dependentsToAdd.length) {
      const nodeId = dependentsToAdd.pop()!;
      if (updateGraph.has(nodeId)) {
        updateGraph.get(nodeId)!.numUnresolvedDependencies++;
      } else {
        const dependents = UpdateManager.getDependents(nodeId);
        updateGraph.set(nodeId, {
          numUnresolvedDependencies: 1,
          dependencyUpdates: [],
          dependents,
        });
        dependentsToAdd = dependentsToAdd.concat(dependents);
      }
    }

    return updateGraph;
  }

  private static resolveNode = <D extends UpdateDescriptor> (node: UpdateGraphNode<D>): D[] => {
    // Run the node's update callbacks and return its updates.
    const numUpdates = node.dependencyUpdates.length;
    const updateLists: D[][] = node.dependencyUpdates.map((announceUpdate, i) =>
      announceUpdate(i < numUpdates - 1) || []);
    const updates: D[] = _.flatten(updateLists);
    return updates;
  }

  private static propagateNodeResolution = <ND extends UpdateDescriptor> (
    nodeId: UpdateGraphNodeId<ND>,
    nodeUpdates: ND[],
    updateGraph: UpdateGraph,
    epoch: number,
  ) => {
    const node = updateGraph.get(nodeId) as UpdateGraphNode<ND>;
    // If the node has updates, add a curried callback to each dependency to announce them.
    if (nodeUpdates.length && nodeId instanceof BaseModel) {
      // Compress descriptors since they may be redundant across updates to the node.
      const aggregatedUpdates = nodeId.aggregateUpdateDescriptors(nodeUpdates);

      // Add announceUpdate callback to each dependency.
      node.dependents.forEach(<DD extends UpdateDescriptor> (depId: UpdateGraphNodeId<DD>) => {
        const updateListener = nodeId.updateListeners.get(depId) as UpdateListener<BaseModel<ND>, ND, DD>;
        const announceUpdate =
          (updatesRemain: boolean) => updateListener(epoch, aggregatedUpdates, nodeId, updatesRemain);
        const dep = updateGraph.get(depId) as UpdateGraphNode<DD>;
        dep.dependencyUpdates.push(announceUpdate);
      });
    }
    assert(!nodeUpdates.length || nodeId instanceof BaseModel,
      "Node must implement BaseModel interface to propagate updates.");

    // Decrement each dependency's dependencies count.
    node.dependents.forEach(depId => {
      updateGraph.get(depId)!.numUnresolvedDependencies--;
    });
  }

  private static resolveGraphUpdate = <D extends UpdateDescriptor> (
    rootUpdateId: UpdateGraphNodeId<D>,
    rootUpdates: D[],
    updateGraph: UpdateGraph,
    epoch: number,
  ) => {
    const rootNode = updateGraph.get(rootUpdateId)!;
    assert(rootNode.numUnresolvedDependencies === 0, "Dependency cycle detected.");
    UpdateManager.propagateNodeResolution(rootUpdateId, rootUpdates, updateGraph, epoch);
    let numResolvedDependencies = 0;
    let readyToResolve = rootNode.dependents.filter(depId =>
      updateGraph.get(depId)!.numUnresolvedDependencies === 0);
    while (readyToResolve.length) {
      // Resolve the next node.
      const nodeId = readyToResolve.pop()!;
      const node = updateGraph.get(nodeId)!;
      const nodeUpdate = UpdateManager.resolveNode(node);
      numResolvedDependencies++;

      // Inform the node's dependents of its resolution.
      UpdateManager.propagateNodeResolution(nodeId, nodeUpdate, updateGraph, epoch);

      // Enqueue for resolution any of its dependents whose dependencies are fully resolved.
      const newlyReadyToResolve = node.dependents.filter(depId =>
        updateGraph.get(depId)!.numUnresolvedDependencies === 0);
      readyToResolve = readyToResolve.concat(newlyReadyToResolve);
    }

    // Ensure all nodes have been resolved - if not, there is a cycle.
    const numResolvedNodes = numResolvedDependencies + 1;
    assert(numResolvedNodes === updateGraph.size, "Dependency cycle detected.");
  }
}
