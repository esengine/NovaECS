/**
 * NovaECS - Next-generation Entity Component System framework
 * 下一代实体组件系统框架
 *
 * @packageDocumentation
 */

// Core Entity System
export type { Entity } from './core/Entity';
export {
  makeEntity,
  indexOf,
  genOf,
  isValidEntity,
  NULL_ENTITY,
  MAX_ENTITIES,
  MAX_GENERATION
} from './core/Entity';
export { EntityManager } from './core/EntityManager';

// Component System
export {
  getComponentType,
  registerComponent,
  getCtorByTypeId,
  typeFromId,
  __resetRegistry
} from './core/ComponentRegistry';
export type { ComponentType } from './core/ComponentRegistry';

// Storage System
export { SparseSetStore } from './core/SparseSetStore';
export type { IComponentStore } from './core/SparseSetStore';

// Query and Command System
export { Query } from './core/Query';
export { ChunkedQuery, chunked } from './core/ChunkedQuery';
export type { ChunkView } from './core/ChunkedQuery';
export { CommandBuffer } from './core/CommandBuffer';

// Parallel System
export { WorkerPool } from './parallel/WorkerPool';
export type { KernelPayload, KernelResult } from './parallel/WorkerPool';
export { ParallelQuery, parallel } from './parallel/ParallelQuery';
export { registerKernel, initWorkerKernel } from './parallel/WorkerKernel';
export type { KernelFunction } from './parallel/WorkerKernel';
export { forEachChunkParallel } from './parallel/ChunkParallel';

// SharedArrayBuffer System
export { registerSchema, getSchema, hasSchema, __resetSchemas } from './sab/Schema';
export type { FieldType, ComponentSchema } from './sab/Schema';
export { getFieldByteSize, getSchemaByteSize, getTypedArrayConstructor } from './sab/Schema';
export { isSharedArrayBufferAvailable, getSABAvailability, SAB_REQUIREMENTS } from './sab/Environment';
export { ColumnSAB } from './sab/ColumnSAB';
export { ColumnArray } from './storage/ColumnArray';
export type { IColumn } from './storage/IColumn';

// World
export { World } from './core/World';
export type { Component } from './core/World';

// Event System
export * from './events';

// System and Scheduler
export { system, SystemBuilder } from './core/System';
export type { SystemStage, SystemConfig, SystemContext } from './core/System';
export { Scheduler } from './core/Scheduler';
export { FixedTimestepScheduler } from './core/FixedTimestepScheduler';
export type { FixedStepOpts } from './core/FixedTimestepScheduler';

// Profiler
export { Profiler } from './core/Profiler';
export type { SysStat } from './core/Profiler';

// Inspector
export { snapshot, printSnapshot, exportSnapshot, getComponentSummary, getSystemSummary } from './core/Inspector';
export type { InspectorSnapshot, ComponentInfo } from './core/Inspector';

// Debug Systems
export { ProfilerDumpSystem, enableProfilerDump, disableProfilerDump, pauseProfilerDump, resumeProfilerDump, ProfilerDumpConfig_, DEFAULT_PROFILER_DUMP_CONFIG } from './systems/ProfilerDumpSystem';
export type { ProfilerDumpConfig } from './systems/ProfilerDumpSystem';

// Transform Components
export { Parent, LocalTransform, WorldTransform, DirtyTransform } from './components/Transform';

// Transform Systems
export { TransformMarkDirtySystem, TransformUpdateSystem, setLocalTransform, setParent } from './systems/TransformSystems';

// Math Utilities
export { mul, fromLocal, identity, transformPoint } from './math/Mat3';

// Serialization System
export * from './serialize';

// Tag System
export * from './tag';

// Hierarchy System
export * from './hierarchy';

// Signature System
export * from './signature';

// Archetype System
export * from './archetype';

// Determinism System
export * from './determinism';

// Replay System
export * from './replay';

// Core Types
export * from './utils/Types';