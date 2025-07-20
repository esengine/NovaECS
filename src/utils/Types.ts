/**
 * Common type definitions for NovaECS
 * NovaECS通用类型定义
 */

import type { Component } from '../core/Component';

/**
 * Entity unique identifier type
 * 实体唯一标识符类型
 */
export type EntityId = number;

/**
 * Component constructor type
 * 组件构造函数类型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentConstructor<T extends Component = Component> = new (...args: any[]) => T;

/**
 * Component class type
 * 组件类类型
 */
export type ComponentType<T extends Component = Component> = ComponentConstructor<T>;

/**
 * Query filter function type
 * 查询过滤函数类型
 */
export type QueryFilter = (entity: import('../core/Entity').Entity) => boolean;