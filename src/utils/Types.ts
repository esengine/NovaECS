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

// Memory Management Types
// 内存管理类型

/**
 * Pool configuration for component object pools
 * 组件对象池的配置
 */
export interface PoolConfig {
  /** Initial pool size 初始池大小 */
  initialSize: number;
  /** Maximum pool size 最大池大小 */
  maxSize: number;
  /** Enable automatic cleanup 启用自动清理 */
  autoCleanup: boolean;
  /** Cleanup interval in milliseconds 清理间隔（毫秒） */
  cleanupInterval: number;
  /** Maximum idle time before cleanup 清理前的最大空闲时间 */
  maxIdleTime: number;
}

/**
 * Pool statistics for monitoring
 * 用于监控的池统计信息
 */
export interface PoolStatistics {
  /** Total objects created 创建的对象总数 */
  totalCreated: number;
  /** Objects currently in pool 当前池中的对象数 */
  poolSize: number;
  /** Objects currently in use 当前使用中的对象数 */
  inUse: number;
  /** Pool hit rate 池命中率 */
  hitRate: number;
}

// Event System Types
// 事件系统类型

/**
 * Event unique identifier type
 * 事件唯一标识符类型
 */
export type EventId = string;

/**
 * Event constructor type
 * 事件构造函数类型
 */
export type EventConstructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Event class type
 * 事件类类型
 */
export type EventType<T = unknown> = EventConstructor<T>;

/**
 * Event listener function type
 * 事件监听器函数类型
 */
export type EventListener<T = unknown> = (event: T) => void | Promise<void>;

/**
 * Event listener with metadata
 * 带有元数据的事件监听器
 */
export interface EventListenerInfo<T = unknown> {
  /** Listener function 监听器函数 */
  listener: EventListener<T>;
  /** Listener priority 监听器优先级 */
  priority: number;
  /** Whether listener should be called only once 是否只调用一次 */
  once: boolean;
  /** Listener identifier for removal 用于移除的监听器标识符 */
  id: string;
}

