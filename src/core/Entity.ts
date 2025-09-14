/**
 * Entity handle utilities and constants
 * 实体句柄工具和常量
 *
 * This module provides pure functional utilities for working with entity handles.
 * Entity is now just a number (handle) containing index + generation information.
 * 此模块提供用于处理实体句柄的纯函数工具。
 * Entity现在只是一个包含索引+世代号信息的数字（句柄）。
 */

// Re-export entity types and functions from Types
// 从Types重新导出实体类型和函数
export type { Entity, EntityId } from '../utils/Types';
export { makeEntity, indexOf, genOf, isValidEntity } from '../utils/Types';

// Entity constants
// 实体常量

// Import Entity type for use in constants
import type { Entity } from '../utils/Types';

/**
 * Null entity handle (invalid entity)
 * 空实体句柄（无效实体）
 */
export const NULL_ENTITY: Entity = 0;

/**
 * Maximum number of entities (2^28)
 * 最大实体数量（2^28）
 */
export const MAX_ENTITIES = 268435456; // 2^28

/**
 * Maximum generation value (2^20)
 * 最大世代号（2^20）
 */
export const MAX_GENERATION = 1048576; // 2^20

