import {assert, generateSessionUID} from '@utils/utils';
import {DependencyGraphPartitionIndex, DependencyNode, DependencySetUpdateDescriptor,
        DependencySetUpdateListener, DependencyUpdateListener, UpdateDescriptor,
        UpdateListener} from './dependency_node';
import {ModelType} from './model';
import {UpdateManager} from './update_manager';

// =============
// Mutable Model
// =============
//
// Mutable is the base model for mutable dependency nodes. It implements the
// core dependency-node-side logic for dependency management. It also supports
// model hydration with a 2-Phase Construction design that separates dependency
// node construction from dependency graph construction.
//
// ====================
// 2-Phase Construction
// ====================
//
// The dependency graph has a subgraph of dependency edges that are final at
// construction. The construction order of dependency nodes is constrained by
// the partial ordering defined by dependencies in this subgraph.
//
// Model Construction Phases:
// 1. Register: Construct final information and register with lookup services as
//    needed
// 2. Initialize: Bind to dependencies and construct dynamic information
//
// Details:
// a. Phase 1: constructor - called once:
//   i. Responsibility
//     i) Ensure children are constructed
//     ii) Ensure all state except non-final derived state is stored
//     iii) Ensure this model can be looked up if needed
//   ii. Algorithm
//     i) Construct unconstructed children
//     ii) Store children and any non-derived initial state
//     iii) Derive and store all final state, which necessarily cannot depend on
//          non-final information
//     iv) Register self with lookup service, if any
// b. Phase 2: init - called at least once:
//   i. Responsibility
//     i) Ensure dependencies are initialized
//     ii) Bind to dependencies
//     iii) Derive and store non-final derived state
//     iv) Defend against dependency cycles
//   ii. Algorithm
//     i) If already initialized, skip
//     ii) If already initializing, error - cannot have cycles. Else, set
//         is-initializing flag
//     iii) Look up, initialize, and bind to all known dependencies
//     iv) Derive and store all non-final derived state. If dynamic dependencies
//         are encountered, initialize and bind them before deriving information
//         from them
//     v) Clear is-initializing flag and set is-initialized flag
// c. bind:
//   i. Responsibility:
//     i) Register dependency listener
//     ii) Defend against failure to initialize
//   ii. Algorithm
//     i) Error if not done initializing
//     ii) Register dependency graph edge (dependent, dependency, and on-change
//         handler) with update manager
// d. Post-init changes to dependency set:
//   i. Responsibility:
//     i) Ensure dependencies are constructed and initialized
//     ii) Ensure node is bound to dependencies (and not to non-dependencies)
//     iii) [Do not defend against dependency cycles - work should scale with
//          size of changes, not size of dependency graph]
//   ii. Algorithm
//     i) Construct, store, and initialize any new children
//     ii) Add and remove dependency binds as appropriate

export interface MutableOptions {
  id?: string,
  epoch?: number,
}

export abstract class Mutable<D extends UpdateDescriptor = UpdateDescriptor> implements DependencyNode<D> {
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

  private isInitializing: boolean = false;
  private initInnerCalled: boolean = false;
  private isInitialized: boolean = false;

  // Phase 1 - Register
  //
  // Store all final information and non-derived initial state.
  //
  // Child classes should override modelType.
  constructor(
    updateManager: UpdateManager,
    {id, epoch}: MutableOptions,
    modelType: ModelType = ModelType.MUTABLE,
  ) {
    this.id = (id === undefined) ? generateSessionUID(modelType) : id;
    this.updateManager = updateManager;
    this.epoch = (epoch === undefined) ? updateManager.epoch : epoch;
  }

  // Phase 2 - Initialize
  //
  // Bind to dependencies and construct dynamic information.
  //
  // Once a node is initialized its state must be valid to read for its epoch
  // and it must update its state and epoch along with its dependencies.
  //
  // A node's state should not be read until it has been initialized. Binding a
  // listener to a node will initialize the node before continuing, but init can
  // also be called directly. The parent that constructs a node is responsible
  // for initializing it.
  //
  // Do not override init - override initInner.
  public init(): void {
    if (this.isInitialized) {
      return;
    }
    assert(!this.isInitializing, "Model initialization loop detected.");

    this.isInitializing = true;
    this.isInitialized = false;

    this.initInner();

    this.isInitializing = false;
    this.isInitialized = true;
  }

  // Override with model-specific initialization logic. Do not call directly in
  // subclasses.
  protected initInner(): void {
    assert(this.isInitializing, "initInner was called outside of initialization.");
    assert(!this.initInnerCalled, "initInner was called more than once.");
    this.initInnerCalled = true;
  }

  // LD is the listener's descriptor, if one exists - namely, if onUpdate
  // returns a list of descriptors they must describe changes to the listener.
  // This occurs if the listener updates because of this model's updates.
  public listenForUpdate<LD extends UpdateDescriptor>(
    listener: DependencyNode<LD>,
    onUpdate: UpdateListener<this, D, LD>,
  ) {
    this.init();

    // Require a static partial ordering of dependencies. A node cannot depend
    // on a node with a higher partition index.
    assert(this.dependencyGraphPartitionIndex <= listener.dependencyGraphPartitionIndex);

    // TODO - is this a problem?
    // each listener may only bind one callback
    this.updateListeners.set(listener, onUpdate);
  }

  // This follows the same pattern as listenForUpdate.
  public listenForDependencyUpdate<LD extends UpdateDescriptor>(
    listener: DependencyNode<LD>,
    onUpdate: DependencyUpdateListener<this, D>,
  ) {
    this.init();

    // Require a static partial ordering of dependencies. A node cannot depend
    // on a node with a higher partition index.
    assert(this.dependencyGraphPartitionIndex < listener.dependencyGraphPartitionIndex);

    // TODO - is this a problem?
    // each listener may only bind one callback
    this.dependencyUpdateListeners.set(listener, onUpdate);
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
  // dependency update resolution. This alerts the dependency graph of the
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