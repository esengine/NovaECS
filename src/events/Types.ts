/**
 * Event types for component structure changes
 * 组件结构变更事件类型
 */

import type { Entity } from '../utils/Types';

/**
 * Event for component addition (non-existent → existent)
 * 组件添加事件（不存在→存在）
 * Note: Replacing existing component of same type does not trigger Added
 * 注意：替换同类型的现有组件不会触发Added
 */
export interface Added {
  /** Entity that received the component 接收组件的实体 */
  e: Entity;
  /** Component type ID 组件类型ID */
  typeId: number;
  /** New component value 新组件值 */
  value: unknown;
}

/**
 * Event for component removal (existent → non-existent)
 * 组件移除事件（存在→不存在）
 */
export interface Removed {
  /** Entity that lost the component 失去组件的实体 */
  e: Entity;
  /** Component type ID 组件类型ID */
  typeId: number;
  /** Previous component value (optional) 之前的组件值（可选） */
  old?: unknown;
}

/**
 * Resource key classes for event channels
 * 事件通道的资源键类
 * These classes are used only as unique keys, not for instantiation
 * 这些类仅用作唯一键，不用于实例化
 */

/**
 * Resource key for Added events channel
 * Added事件通道的资源键
 */
export class AddedEvent {}

/**
 * Resource key for Removed events channel
 * Removed事件通道的资源键
 */
export class RemovedEvent {}