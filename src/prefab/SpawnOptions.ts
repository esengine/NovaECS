/**
 * Options for World.spawn batch entity creation
 * World.spawn批量实体创建选项
 */

import type { Entity } from '../utils/Types';

export interface SpawnOverrides {
  /** Shared overrides: applied to all instances 统一覆盖：所有实例共享 */
  shared?: Record<string, any>; // key=component name or ctor.name, value=Partial<T>
  /** Per-entity overrides: array or function 每个实例的覆盖：数组或函数 */
  perEntity?: Array<Record<string, any>> | ((i: number) => Record<string, any>);
}

export interface SpawnOptions {
  /** Number of entities to create 要创建的实体数量 */
  count?: number;
  /** Component and value overrides 组件和值覆盖 */
  overrides?: SpawnOverrides;
  /** Additional tags to add 要添加的额外标签 */
  tags?: string[];
  /** Epoch for change tracking (usually world.frame) 变更跟踪的时代（通常是world.frame） */
  epoch?: number;
  /** Whether to add Guid component 是否添加Guid组件 */
  withGuid?: boolean;
}