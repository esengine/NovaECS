/**
 * NovaECS - Next-generation Entity Component System framework
 * 下一代实体组件系统框架
 *
 * @packageDocumentation
 */

export { Entity } from './core/Entity';
export { Component } from './core/Component';
export { System } from './core/System';
export { World } from './core/World';
export { ParallelScheduler } from './core/ParallelScheduler';
export { Archetype } from './core/Archetype';
export { ArchetypeManager } from './core/ArchetypeManager';

// Event System
export {
  Event,
  TypedEvent,
  EntityCreatedEvent,
  EntityDestroyedEvent,
  ComponentAddedEvent,
  ComponentRemovedEvent,
  SystemAddedEvent,
  SystemRemovedEvent,
  WorldPausedEvent,
  WorldResumedEvent,
  WorldUpdateStartEvent,
  WorldUpdateEndEvent
} from './core/Event';
export { EventBus } from './core/EventBus';
export { EventScheduler } from './core/EventScheduler';

// Memory Management Tools (standalone utilities)
export { ComponentPool, ComponentPoolManager } from './core/ComponentPool';

export * from './utils/Types';
export * from './utils/AccessType';
export * from './utils/ArchetypeTypes';
export * from './utils/EventTypes';

// Serialization System
export { Serializer, serializer, SerializationUtils } from './core/Serialization';
export type {
  SerializationOptions,
  DeserializationOptions,
  SerializationResult,
  DeserializationResult,
  SerializationVersion
} from './utils/SerializationTypes';
export {
  SerializationFormat,
  CURRENT_SERIALIZATION_VERSION
} from './utils/SerializationTypes';

// Query System
export { QueryBuilder } from './core/QueryBuilder';
export { QueryManager } from './core/QueryManager';
export { QueryCache } from './core/QueryCache';
export { QueryPerformanceMonitor } from './core/QueryPerformanceMonitor';
export type {
  QueryCriteria,
  QueryOptions,
  QueryResult,
  QueryStatistics,
  QueryCacheConfig,
  IQueryBuilder,
  IQueryManager
} from './utils/QueryTypes';
export {
  QueryComplexity,
  QueryExecutionStrategy,
  QueryEventType,
  DEFAULT_QUERY_CACHE_CONFIG
} from './utils/QueryTypes';

// Plugin System
export { PluginManager } from './core/PluginManager';
export { BasePlugin } from './core/BasePlugin';
export { PluginPerformanceAnalyzer } from './core/PluginPerformanceAnalyzer';
export { PluginSandbox } from './core/PluginSandbox';
export { PluginUtils, PluginDecorators } from './utils/PluginUtils';
export type {
  ECSPlugin,
  PluginMetadata,
  PluginInstallOptions,
  PluginInstallResult,
  PluginDependencyResult,
  PluginLifecycleHooks,
  PluginManagerEvents,
  PluginRegistry
} from './utils/PluginTypes';
export type {
  PluginPerformanceMetrics,
  PluginPerformanceConfig
} from './core/PluginPerformanceAnalyzer';
export type {
  PluginSandboxConfig,
  SandboxExecutionResult
} from './core/PluginSandbox';
export {
  PluginLifecyclePhase,
  PluginPriority,
  PluginState
} from './utils/PluginTypes';