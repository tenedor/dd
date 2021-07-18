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

export type UpdateListener<T extends DependencyNode<TD>, TD extends UpdateDescriptor, SD extends UpdateDescriptor> = (epoch: number, updateDescriptors: TD[], dependency: T, updatesRemain: boolean) => SD[] | void;
// This listener is called for dependency set updates to a model `S extends
// BaseModel<SD>` and must return a list of resulting updates SD[] to S.

export type DependencySetUpdateListener<S extends DependencyNode<SD>, SD extends UpdateDescriptor> = (epoch: number, updateDescriptors: DependencySetUpdateDescriptor[], dependency: S, updatesRemain: boolean) => SD[];
// This listener is called for updates TD[] to a model T. It may return void or,
// if it is associated with a model `S extends BaseModel<SD>`, may return a list
// of resulting dependency set updates to S.

export type DependencyUpdateListener<T extends DependencyNode<TD>, TD extends UpdateDescriptor> = (updateDescriptors: TD[], dependency: T, dependencyUpdatesRemain: boolean) =>
  DependencySetUpdateDescriptor[] | void;

export enum DependencyGraphPartitionIndex {
  CONSTANT = 0,
  SCHEMA = 1,
  VALUE = 2
}

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

  // Once a node is initialized its state must be valid to read for its epoch
  // and it must update its state and epoch along with its dependencies.
  //
  // A node's state should not be read until it has been initialized. Binding a
  // listener to a node will initialize the node before continuing, but init can
  // also be called directly. The parent that constructs a node is responsible
  // for initializing it.
  init: () => void;

  // LD is the listener's descriptor, if one exists - namely, if onUpdate
  // returns a list of descriptors they must describe changes to the listener.
  // This occurs if the listener updates because of this model's updates.
  listenForUpdate: <LD extends UpdateDescriptor>(
    id: DependencyNode<LD>,
    onUpdate: UpdateListener<this, D, LD>
  ) => void;

  // This follows the same pattern as listenForUpdate.
  listenForDependencyUpdate: <LD extends UpdateDescriptor>(
    id: DependencyNode<LD>,
    onUpdate: DependencyUpdateListener<this, D>
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
