/**
 * Batch resource for 2D prismatic joint constraint solving
 *
 * Contains precomputed constraint data for efficient prismatic joint solving.
 * Each row represents one prismatic constraint with all necessary cached values.
 *
 * 2D滑动关节约束求解批次资源
 *
 * 包含预计算的约束数据，用于高效的滑动关节求解。
 * 每一行代表一个滑动约束，包含所有必要的缓存值。
 */

import type { Entity } from '../utils/Types';
import type { FX } from '../math/fixed';

/**
 * Precomputed data for a single prismatic joint constraint
 * 单个滑动关节约束的预计算数据
 */
export type PrismaticRow = {
  /**
   * Joint entity reference
   * 关节实体引用
   */
  e: Entity;

  /**
   * Body A entity reference
   * 刚体A实体引用
   */
  a: Entity;

  /**
   * Body B entity reference
   * 刚体B实体引用
   */
  b: Entity;

  /**
   * World-space anchor offset from body A center of mass
   * 相对于刚体A质心的世界空间锚点偏移
   */
  rax: FX;
  ray: FX;

  /**
   * World-space anchor offset from body B center of mass
   * 相对于刚体B质心的世界空间锚点偏移
   */
  rbx: FX;
  rby: FX;

  /**
   * Normalized sliding axis direction (unit vector)
   * 归一化的滑动轴方向（单位向量）
   */
  ax: FX;
  ay: FX;

  /**
   * Perpendicular axis direction (unit vector perpendicular to sliding axis)
   * 垂直轴方向（垂直于滑动轴的单位向量）
   */
  px: FX;
  py: FX;

  /**
   * Effective mass for perpendicular constraint (prevents motion perpendicular to axis)
   * 垂直约束的有效质量（防止垂直于轴的运动）
   */
  mPerp: FX;

  /**
   * Effective mass for axial constraint (limits/motor along axis)
   * 轴向约束的有效质量（沿轴的限位/电机）
   */
  mAxis: FX;

  /**
   * Baumgarte bias for perpendicular position drift correction
   * 垂直位置漂移修正的Baumgarte偏置
   */
  biasPerp: FX;

  /**
   * Whether position limit is currently active
   * 位置限制是否当前激活
   */
  limitActive: 0 | 1;

  /**
   * Limit constraint direction
   * -1: touching lower limit, +1: touching upper limit, 0: inactive
   * 限位约束方向
   * -1：触及下限，+1：触及上限，0：未激活
   */
  limitSign: -1 | 0 | 1;

  /**
   * Baumgarte bias for limit position correction (when limit is active)
   * 限位位置修正的Baumgarte偏置（当限位激活时）
   */
  biasAxis: FX;

  /**
   * Motor constraint softening parameter (gamma/dt)
   * Applied to motor constraints for compliance
   * 电机约束软化参数（gamma/dt）
   * 应用于电机约束以实现柔性
   */
  gamma: FX;
};

/**
 * Batch container for all prismatic joint constraints
 * 所有滑动关节约束的批次容器
 */
export class PrismaticBatch2D {
  /**
   * Array of precomputed prismatic constraint rows
   * 预计算的滑动约束行数组
   */
  list: PrismaticRow[] = [];

  /**
   * Clear all constraint rows
   * 清除所有约束行
   */
  clear(): void {
    this.list.length = 0;
  }

  /**
   * Get the number of active constraints
   * 获取活跃约束数量
   */
  get count(): number {
    return this.list.length;
  }

  /**
   * Add a precomputed constraint row
   * 添加预计算的约束行
   */
  addRow(row: PrismaticRow): void {
    this.list.push(row);
  }

  /**
   * Get all constraint rows as readonly array
   * 获取所有约束行的只读数组
   */
  getRows(): readonly PrismaticRow[] {
    return this.list;
  }

  /**
   * Find constraint row by joint entity
   * 通过关节实体查找约束行
   */
  findByEntity(jointEntity: Entity): PrismaticRow | undefined {
    return this.list.find(row => row.e === jointEntity);
  }
}