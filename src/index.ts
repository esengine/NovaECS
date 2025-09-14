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
export { CommandBuffer } from './core/CommandBuffer';

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

// Core Types
export * from './utils/Types';