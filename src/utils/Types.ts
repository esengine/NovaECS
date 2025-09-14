/**
 * Common type definitions for NovaECS
 * NovaECS通用类型定义
 */

import type { Component } from '../core/World';

/**
 * Entity handle - pure numeric handle with generation
 * 实体句柄 - 带世代号的纯数字句柄
 *
 * Format: 28 bits index + 20 bits generation = 48 bits (< 2^53 safe)
 * 格式：28位索引 + 20位世代号 = 48位（< 2^53安全）
 */
export type Entity = number;

/**
 * @deprecated Use Entity instead
 * 使用Entity替代
 */
export type EntityId = Entity;

// Entity handle manipulation constants and functions
// 实体句柄操作常量和函数
const INDEX_BITS = 28;
const INDEX_MASK = (1 << INDEX_BITS) - 1;
const INDEX_BASE = 1 << INDEX_BITS;

/**
 * Create entity handle from index and generation
 * 从索引和世代号创建实体句柄
 */
export function makeEntity(index: number, generation: number): Entity {
  return generation * INDEX_BASE + index;
}

/**
 * Extract index from entity handle
 * 从实体句柄提取索引
 */
export function indexOf(entity: Entity): number {
  return entity & INDEX_MASK;
}

/**
 * Extract generation from entity handle
 * 从实体句柄提取世代号
 */
export function genOf(entity: Entity): number {
  return (entity / INDEX_BASE) | 0;
}

/**
 * Check if entity handle is valid (non-zero)
 * 检查实体句柄是否有效（非零）
 */
export function isValidEntity(entity: Entity): boolean {
  return entity !== 0;
}

/**
 * Component constructor type
 * 组件构造函数类型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentCtor<T = Component> = new (...args: any[]) => T;

/**
 * @deprecated Use ComponentCtor instead
 */
export type ComponentConstructor<T extends Component = Component> = ComponentCtor<T>;

/**
 * Component type identifier
 * 组件类型标识符
 */
export type ComponentTypeId = number;

/**
 * Component type definition with stable numeric ID
 * 包含稳定数字ID的组件类型定义
 */
export interface ComponentType<T = Component> {
  /** Stable numeric type identifier 稳定的数字类型标识符 */
  readonly id: number;
  /** Component constructor 组件构造函数 */
  readonly ctor: ComponentCtor<T>;
}

/**
 * Query filter function type
 * 查询过滤函数类型
 */
export type QueryFilter = (entity: Entity) => boolean;

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

