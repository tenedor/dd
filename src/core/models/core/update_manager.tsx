import * as _ from 'lodash';

import {ROArray} from '@utils/types';
import {assert} from '@utils/utils';
import {DependencySetUpdateType, UndefinedUpdateType, UpdateType} from './update_types';

// ===============
// Dependency Node
// ===============

export interface UpdateDescriptor<T = UpdateType> {
  type: T;
}

export interface UndefinedUpdateDescriptor extends UpdateDescriptor<UndefinedUpdateType> {}
export interface DependencySetUpdateDescriptor extends UpdateDescriptor<DependencySetUpdateType> {}

// This listener is called for updates TD[] to a model T. It may return void or,
// if it is associated with a model `S extends BaseModel<SD>`, may return a list
// of resulting updates SD[] to S.
export type UpdateListener<T extends DependencyNode<TD>, TD extends UpdateDescriptor, SD extends UpdateDescriptor> =
    (epoch: number, updateDescriptors: TD[], dependency: T, updatesRemain: boolean) => SD[] | void;

// This listener is called for dependency set updates to a model `S extends
// BaseModel<SD>` and must return a list of resulting updates SD[] to S.
export type DependencySetUpdateListener<S extends DependencyNode<SD>, SD extends UpdateDescriptor> =
    (epoch: number, updateDescriptors: DependencySetUpdateDescriptor[], dependency: S, updatesRemain: boolean) => SD[];

// This listener is called for updates TD[] to a model T. It may return void or,
// if it is associated with a model `S extends BaseModel<SD>`, may return a list
// of resulting dependency set updates to S.
export type DependencyUpdateListener<T extends DependencyNode<TD>, TD extends UpdateDescriptor> =
    (updateDescriptors: TD[], dependency: T, dependencyUpdatesRemain: boolean) =>
    DependencySetUpdateDescriptor[] | void;

export interface DependencyNode<D extends UpdateDescriptor = UpdateDescriptor> {
  readonly id: string;
  readonly dependencyGraphPartitionIndex: DependencyGraphPartitionIndex;
  readonly epoch: number;
  // The UpdateDescriptors in updateListeners (not including D) must match per
  // key-value pair. Can't enforce this with TS.
  readonly updateListeners: Map<DependencyNode<UpdateDescriptor>,
    UpdateListener<this, D, UpdateDescriptor>>;
  readonly dependencyUpdateListeners: Map<DependencyNode<UpdateDescriptor>,
    DependencyUpdateListener<this, D>>;

  // LD is the listener's descriptor, if one exists - namely, if onUpdate
  // returns a list of descriptors they must describe changes to the model given
  // by `id`. This occurs if the listener's model updates because of this
  // model's updates.
  listenForUpdate: <LD extends UpdateDescriptor>(
    id: DependencyNode<LD>,
    onUpdate: UpdateListener<this, D, LD>,
  ) => void;

  // This follows the same pattern as listenForUpdate.
  listenForDependencyUpdate: <LD extends UpdateDescriptor>(
    id: DependencyNode<LD>,
    onUpdate: DependencyUpdateListener<this, D>,
  ) => void;

  removeUpdateListener: (id: DependencyNode<UpdateDescriptor>) => void;

  removeDependencyUpdateListener: (id: DependencyNode<UpdateDescriptor>) => void;

  // Override this method in a child to listen to resolution-time updates to the
  // child's dependency set.
  onDependencySetUpdated: DependencySetUpdateListener<this, D>;

  // Optionally override this to process all update descriptors this model
  // generated in a resolution cycle before they are sent to dependents. This
  // may be useful for performance optimizations.
  aggregateUpdateDescriptors: (descriptors: D[]) => D[];
}


// =================
// Update Resolution
// =================

type CurriedUpdateListener<SD extends UpdateDescriptor> = (updatesRemain: boolean) => SD[] | void;

interface UpdateGraphNode<D extends UpdateDescriptor> {
  numUnresolvedDependencies: number;
  readonly preresolvedUpdateDescriptors: ROArray<D>;
  readonly updates: Array<CurriedUpdateListener<D>>;
  readonly dependentsInPartition: ROArray<DependencyNode<UpdateDescriptor>>;
}

// Each curried listener is a DependencyUpdateListener.
type CurriedDependencyUpdatesMap = Map<DependencyNode<UpdateDescriptor>,
    Array<CurriedUpdateListener<DependencySetUpdateDescriptor>>>;

// Each curried listener is an UpdateListener or DependencySetUpdateListener.
// These UpdateDescriptors must match per key-value pair. Can't enforce this
// with TS.
type CurriedUpdatesMap = Map<DependencyNode<UpdateDescriptor>, Array<CurriedUpdateListener<UpdateDescriptor>>>;

// These UpdateDescriptors must match per key-value pair.
type ResolvedUpdatesMap = ReadonlyMap<DependencyNode<UpdateDescriptor>, UpdateDescriptor[]>;

// Resolved updates should generally be immutable, but a mutable version is
// useful when building the map.
type MutableResolvedUpdatesMap = Map<DependencyNode<UpdateDescriptor>, UpdateDescriptor[]>;

// These UpdateDescriptors must match per key-value pair.
type PartitionUpdateGraph = Map<DependencyNode<UpdateDescriptor>, UpdateGraphNode<UpdateDescriptor>>;

export enum DependencyGraphPartitionIndex {
  CONSTANT = 0,
  SCHEMA = 1,
  VALUE = 2,
}

interface PartitionData {
  readonly partitionIndex: DependencyGraphPartitionIndex;
  readonly dependencyUpdates: CurriedDependencyUpdatesMap;
  readonly seedUpdates: CurriedUpdatesMap;
  readonly seedResolvedUpdates: ResolvedUpdatesMap;
};

class UpdateResolver {
  private readonly unresolvedPartitions: DependencyGraphPartitionIndex[];
  private readonly partitionsData: Map<DependencyGraphPartitionIndex, PartitionData>;

  constructor(seedUpdates: ResolvedUpdatesMap) {
    const seedUpdatesByPartition: Map<DependencyGraphPartitionIndex, MutableResolvedUpdatesMap> = new Map();
    seedUpdates.forEach((updates, nodeId) => {
      const partitionIndex = UpdateResolver.getPartitionIndex(nodeId);
      if (!seedUpdatesByPartition.has(partitionIndex)) {
        seedUpdatesByPartition.set(partitionIndex, new Map());
      }
      seedUpdatesByPartition.get(partitionIndex)!.set(nodeId, updates);
    });

    this.unresolvedPartitions = Array.from(seedUpdatesByPartition.keys()).sort();
    this.partitionsData = new Map();
    seedUpdatesByPartition.forEach((seedResolvedUpdates, partitionIndex) => {
      const partitionData = UpdateResolver.createPartitionData(partitionIndex, seedResolvedUpdates);
      this.partitionsData.set(partitionIndex, partitionData);
    });
  }

  private static createPartitionData = (
    partitionIndex: DependencyGraphPartitionIndex,
    seedResolvedUpdates: ResolvedUpdatesMap,
  ): PartitionData => {
    return {
      partitionIndex,
      dependencyUpdates: new Map(),
      seedUpdates: new Map(),
      seedResolvedUpdates,
    };
  }

  private addPartition = (partitionIndex: DependencyGraphPartitionIndex) => {
    assert(!this.partitionsData.has(partitionIndex));
    const partitionData = UpdateResolver.createPartitionData(partitionIndex, new Map());
    this.partitionsData.set(partitionIndex, partitionData);
    const insertIndex = _.sortedIndex(this.unresolvedPartitions, partitionIndex);
    this.unresolvedPartitions.splice(insertIndex, 0, partitionIndex);
  }

  private static getPartitionIndex = (nodeId: DependencyNode<UpdateDescriptor>): DependencyGraphPartitionIndex => {
    return nodeId.dependencyGraphPartitionIndex;
  }

  private static getDependents = (nodeId: DependencyNode<UpdateDescriptor>) => {
    return Array.from(nodeId.updateListeners.keys());
  }

  private static getDependencyDependents = (nodeId: DependencyNode<UpdateDescriptor>) => {
    return Array.from(nodeId.dependencyUpdateListeners.keys());
  }

  private static getDependentsInPartition = (
    id: DependencyNode<UpdateDescriptor>,
    partitionIndex: DependencyGraphPartitionIndex,
  ) => {
    return UpdateResolver.getDependents(id).filter(depId => UpdateResolver.getPartitionIndex(depId) === partitionIndex);
  }

  private static resolveDependencySetUpdatesForPartition = (
    {dependencyUpdates, seedUpdates}: PartitionData,
    epoch: number,
  ) => {
    dependencyUpdates.forEach(<ND extends UpdateDescriptor> (
      dependencySetUpdates: Array<CurriedUpdateListener<DependencySetUpdateDescriptor>>,
      nodeId: DependencyNode<ND>,
    ) => {
      const numUpdates = dependencySetUpdates.length;
      const updateDescriptorsList: DependencySetUpdateDescriptor[][] =
        dependencySetUpdates.map((updateFn, i) => updateFn(i < numUpdates - 1) || []);
      const updateDescriptors = _.flatten(updateDescriptorsList);
      if (updateDescriptors.length) {
        if (!seedUpdates.has(nodeId)) {
          seedUpdates.set(nodeId, []);
        }
        const curriedUpdateListener = (updatesRemain: boolean) =>
          nodeId.onDependencySetUpdated(epoch, updateDescriptors, nodeId, updatesRemain);
        seedUpdates.get(nodeId)!.push(curriedUpdateListener);
      }
    });
  }

  private static buildPartitionUpdateGraph = (
    {partitionIndex, seedResolvedUpdates, seedUpdates}: PartitionData,
  ): PartitionUpdateGraph => {
    const partitionUpdateGraph: PartitionUpdateGraph = new Map();
    let dependentsToAdd: Array<DependencyNode<UpdateDescriptor>> = [];

    // Build the seed update nodes.
    const seedUpdateIds = _.uniq(Array.from(seedResolvedUpdates.keys()).concat(Array.from(seedUpdates.keys())));
    seedUpdateIds.forEach(nodeId => {
      assert(UpdateResolver.getPartitionIndex(nodeId) === partitionIndex);
      const dependentsInPartition = UpdateResolver.getDependentsInPartition(nodeId, partitionIndex);
      partitionUpdateGraph.set(nodeId, {
        numUnresolvedDependencies: 0,
        preresolvedUpdateDescriptors: seedResolvedUpdates.get(nodeId) || [],
        updates: seedUpdates.get(nodeId) || [],
        dependentsInPartition,
      });
      dependentsToAdd = dependentsToAdd.concat(dependentsInPartition);
    })

    // Recursively build dependents and count their dependencies.
    while (dependentsToAdd.length) {
      const nodeId = dependentsToAdd.pop()!;
      if (partitionUpdateGraph.has(nodeId)) {
        partitionUpdateGraph.get(nodeId)!.numUnresolvedDependencies++;
      } else {
        const dependentsInPartition = UpdateResolver.getDependentsInPartition(nodeId, partitionIndex);
        partitionUpdateGraph.set(nodeId, {
          numUnresolvedDependencies: 1,
          preresolvedUpdateDescriptors: [],
          updates: [],
          dependentsInPartition,
        });
        dependentsToAdd = dependentsToAdd.concat(dependentsInPartition);
      }
    }

    return partitionUpdateGraph;
  }

  private static resolveNode = <D extends UpdateDescriptor> (node: UpdateGraphNode<D>): D[] => {
    // Run the node's update callbacks and return its update descriptors.
    const numUpdates = node.updates.length;
    const updateDescriptorsList: D[][] = node.updates.map((announceUpdate, i) =>
      announceUpdate(i < numUpdates - 1) || []);
    const newUpdateDescriptors = _.flatten(updateDescriptorsList);
    return newUpdateDescriptors.concat(node.preresolvedUpdateDescriptors);
  }

  private static propagateNodeResolutionWithinPartition = <ND extends UpdateDescriptor> (
    nodeId: DependencyNode<ND>,
    updateDescriptors: ND[],
    updateGraph: PartitionUpdateGraph,
    epoch: number,
  ) => {
    const node = updateGraph.get(nodeId) as UpdateGraphNode<ND>;

    // Add an update callback to each dependent node.
    if (updateDescriptors.length) {
      node.dependentsInPartition.forEach(<DD extends UpdateDescriptor>(depId: DependencyNode<DD>) => {
        const updateListener = nodeId.updateListeners.get(depId) as UpdateListener<DependencyNode<ND>, ND, DD>;
        const update = (updatesRemain: boolean) => updateListener(epoch, updateDescriptors, nodeId, updatesRemain);
        const dep = updateGraph.get(depId) as UpdateGraphNode<DD>;
        dep.updates.push(update);
      });
    }

    // Decrement each dependent node's dependencies count.
    node.dependentsInPartition.forEach(depId => {
      updateGraph.get(depId)!.numUnresolvedDependencies--;
    });
  }

  private propagateNodeResolutionToOtherPartitions = <ND extends UpdateDescriptor> (
    nodeId: DependencyNode<ND>,
    updateDescriptors: ND[],
    epoch: number,
  ) => {
    if (!updateDescriptors.length) {
      return;
    }

    const nodePartitionIndex = UpdateResolver.getPartitionIndex(nodeId);

    // Add update callbacks to nodes with dependency dependencies.
    UpdateResolver.getDependencyDependents(nodeId)
      .forEach(<DD extends UpdateDescriptor>(depId: DependencyNode<DD>) => {
        const depPartitionIndex = UpdateResolver.getPartitionIndex(depId);
        assert(depPartitionIndex > nodePartitionIndex, "Violated dependency ordering.");

        // Construct partition data and dependency updates if needed.
        if (!this.partitionsData.has(depPartitionIndex)) {
          this.addPartition(depPartitionIndex);
        }
        const {dependencyUpdates} = this.partitionsData.get(depPartitionIndex)!;
        if (!dependencyUpdates.has(depId)) {
          dependencyUpdates.set(depId, []);
        }
        const depDependencyUpdates = dependencyUpdates.get(depId)!;

        // Add update callback to dependent node.
        const updateListener = nodeId.dependencyUpdateListeners.get(depId) as DependencyUpdateListener<DependencyNode<ND>, ND>;
        const update = (updatesRemain: boolean) => updateListener(updateDescriptors, nodeId, updatesRemain);
        depDependencyUpdates.push(update);
      });

    // Add update callbacks to nodes with regular dependencies.
    UpdateResolver.getDependents(nodeId)
      .filter(depId => UpdateResolver.getPartitionIndex(depId) !== nodePartitionIndex)
      .forEach(<DD extends UpdateDescriptor>(depId: DependencyNode<DD>) => {
        const depPartitionIndex = UpdateResolver.getPartitionIndex(depId);
        assert(depPartitionIndex > nodePartitionIndex, "Violated dependency ordering.");

        // Construct partition data and seed updates if needed.
        if (!this.partitionsData.has(depPartitionIndex)) {
          this.addPartition(depPartitionIndex);
        }
        const {seedUpdates} = this.partitionsData.get(depPartitionIndex)!;
        if (!seedUpdates.has(depId)) {
          seedUpdates.set(depId, []);
        }
        const depSeedUpdates = seedUpdates.get(depId)!;

        // Add update callback to dependent node.
        const updateListener = nodeId.updateListeners.get(depId) as UpdateListener<DependencyNode<ND>, ND, DD>;
        const update = (updatesRemain: boolean) => updateListener(epoch, updateDescriptors, nodeId, updatesRemain);
        depSeedUpdates.push(update);
      });
  }

  private propagateNodeResolution = <ND extends UpdateDescriptor> (
    nodeId: DependencyNode<ND>,
    updateDescriptors: ND[],
    updateGraph: PartitionUpdateGraph,
    epoch: number,
  ) => {
    // Compress descriptors since they may be redundant across updates to the node.
    const aggregatedDescriptors = nodeId.aggregateUpdateDescriptors(updateDescriptors);

    UpdateResolver.propagateNodeResolutionWithinPartition(nodeId, aggregatedDescriptors, updateGraph, epoch);
    this.propagateNodeResolutionToOtherPartitions(nodeId, aggregatedDescriptors, epoch);
  }

  private resolvePartitionUpdateGraph = (updateGraph: PartitionUpdateGraph, epoch: number) => {
    let numResolvedNodes = 0;
    let readyToResolve = Array.from(updateGraph.keys()).filter(depId =>
      updateGraph.get(depId)!.numUnresolvedDependencies === 0);
    while (readyToResolve.length) {
      // Resolve the next node.
      const nodeId = readyToResolve.pop()!;
      const node = updateGraph.get(nodeId)!;
      const updateDescriptors = UpdateResolver.resolveNode(node);
      numResolvedNodes++;

      // Propagate the node's resolution to its dependents.
      this.propagateNodeResolution(nodeId, updateDescriptors, updateGraph, epoch);

      // Enqueue for resolution any of its dependents whose dependencies are fully resolved.
      const newlyReadyToResolve = node.dependentsInPartition.filter(depId =>
        updateGraph.get(depId)!.numUnresolvedDependencies === 0);
      readyToResolve = readyToResolve.concat(newlyReadyToResolve);
    }

    // Ensure all nodes have been resolved - if not, there is a cycle.
    assert(numResolvedNodes === updateGraph.size, "Dependency cycle detected.");
  }

  private resolvePartition = (partitionIndex: DependencyGraphPartitionIndex, epoch: number) => {
    const partitionData = this.partitionsData.get(partitionIndex)!;
    UpdateResolver.resolveDependencySetUpdatesForPartition(partitionData, epoch);
    const updateGraph = UpdateResolver.buildPartitionUpdateGraph(partitionData);
    this.resolvePartitionUpdateGraph(updateGraph, epoch);
  }

  public resolveAll = (epoch: number) => {
    let lastPartitionIndex = -Infinity;
    while (this.unresolvedPartitions.length) {
      const partitionIndex = this.unresolvedPartitions.shift()!;
      assert(partitionIndex > lastPartitionIndex);
      this.resolvePartition(partitionIndex, epoch);
      lastPartitionIndex = partitionIndex;
    }
  }
}


// ==============
// Update Manager
// ==============

export interface UpdateManager {
  readonly epoch: number;
  nextEpoch: () => number;
  announceMutated: <D extends UpdateDescriptor> (id: DependencyNode<D>, updates: D[]) => void;
}

export class SimpleUpdateManager implements UpdateManager {
  private _epoch: number = 0;

  constructor() {
    //
  }

  public get epoch(): number {
    return this._epoch;
  }

  public nextEpoch = (): number => {
    this._epoch++;
    return this._epoch;
  };

  public announceMutated = <D extends UpdateDescriptor> (id: DependencyNode<D>, updates: D[]) => {
    const seedUpdates = new Map([[id, updates]])
    const updateResolver = new UpdateResolver(seedUpdates);
    updateResolver.resolveAll(this.epoch);
  }
}
