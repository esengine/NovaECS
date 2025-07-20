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

// Memory Management Tools (standalone utilities)
export { ComponentPool, ComponentPoolManager } from './core/ComponentPool';

export * from './utils/Types';
export * from './utils/AccessType';
export * from './utils/ArchetypeTypes';