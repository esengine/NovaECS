import type { ComponentType, ComponentTypeId, EntityId } from './Types';
import type { Component } from '../core/Component';

/**
 * Archetype ID for identifying unique component combinations
 * 用于标识唯一组件组合的原型ID
 *
 * Generated from sorted ComponentTypeId values for stability across environments
 * 从排序的ComponentTypeId值生成，确保跨环境稳定性
 *
 * Format: "archetype:{typeId1}|{typeId2}|..."
 * 格式："archetype:{typeId1}|{typeId2}|..."
 */
export type ArchetypeId = string;

/**
 * Component storage for a specific component type
 * 特定组件类型的存储
 */
export interface ComponentStorage {
  /** Component constructor 组件构造函数 */
  componentType: ComponentType;
  /** Dense array of components 组件的密集数组 */
  components: Component[];
}

/**
 * Entity index within an archetype
 * 实体在原型中的索引
 */
export interface EntityRecord {
  /** Entity ID 实体ID */
  entityId: EntityId;
  /** Index in archetype storage 在原型存储中的索引 */
  archetypeIndex: number;
}

/**
 * Archetype edge for component addition/removal
 * 用于组件添加/移除的原型边
 */
export interface ArchetypeEdge {
  /** Target archetype ID 目标原型ID */
  targetArchetypeId: ArchetypeId;
  /** Component being added/removed 被添加/移除的组件 */
  componentType: ComponentType;
  /** Whether this is an addition (true) or removal (false) 是否为添加(true)或移除(false) */
  isAddition: boolean;
}

/**
 * Query signature for fast archetype matching using stable typeIds
 * 使用稳定typeId进行快速原型匹配的查询签名
 */
export interface QuerySignature {
  /** Required component type IDs 需要的组件类型ID */
  required: Set<ComponentTypeId>;
  /** Optional component type IDs 可选的组件类型ID */
  optional?: Set<ComponentTypeId>;
  /** Excluded component type IDs 排除的组件类型ID */
  excluded?: Set<ComponentTypeId>;
}

