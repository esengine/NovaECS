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
export type { ComponentCtor, ComponentType } from './core/ComponentRegistry';

// Storage System
export { SparseSetStore } from './core/SparseSetStore';
export type { IComponentStore } from './core/SparseSetStore';

// Query and Command System
export { Query } from './core/Query';
export { CommandBuffer } from './core/CommandBuffer';

// World
export { World } from './core/World';
export type { Component } from './core/World';

// Core Types
export * from './utils/Types';