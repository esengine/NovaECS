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
export type ComponentCtor<T = Component> = new (...args: unknown[]) => T;

/**
 * Component type identifier
 * 组件类型标识符
 */
export type ComponentTypeId = number;

/**
 * Query filter function type
 * 查询过滤函数类型
 */
export type QueryFilter = (entity: Entity) => boolean;

