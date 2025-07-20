import type { ComponentType, EntityId } from './Types';
import type { Component } from '../core/Component';

/**
 * Archetype ID for identifying unique component combinations
 * 用于标识唯一组件组合的原型ID
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
 * Query signature for fast archetype matching
 * 用于快速原型匹配的查询签名
 */
export interface QuerySignature {
  /** Required component types 需要的组件类型 */
  required: Set<ComponentType>;
  /** Optional component types 可选的组件类型 */
  optional?: Set<ComponentType>;
  /** Excluded component types 排除的组件类型 */
  excluded?: Set<ComponentType>;
}