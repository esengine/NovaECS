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
  /** Memory usage estimate 内存使用估计 */
  memoryUsage: number;
}

