/**
 * Transform hierarchy components for supporting rendering, camera, and collision systems
 * 支持渲染、相机和碰撞系统的变换层级组件
 */

import type { Entity } from '../utils/Types';

/**
 * Parent component - references parent entity in hierarchy
 * 父级组件 - 引用层级中的父实体
 */
export class Parent {
  value: Entity = 0; // 0 represents no parent 0代表无父级
}

/**
 * Local transform component - position, rotation, scale relative to parent
 * 本地变换组件 - 相对于父级的位置、旋转、缩放
 */
export class LocalTransform {
  /** X position 位置X */
  x = 0;
  /** Y position 位置Y */
  y = 0;
  /** Rotation in radians 旋转（弧度） */
  rot = 0;
  /** Scale X 缩放X */
  sx = 1;
  /** Scale Y 缩放Y */
  sy = 1;
}

/**
 * World transform component - final transformation matrix
 * 世界变换组件 - 最终变换矩阵
 */
export class WorldTransform {
  /** 3x3 transformation matrix [m00,m01,m02, m10,m11,m12, m20,m21,m22] */
  m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/**
 * Dirty transform marker component - indicates transform needs updating
 * 脏变换标记组件 - 表示变换需要更新
 */
export class DirtyTransform {}