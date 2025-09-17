/**
 * Joint batch resource for efficient constraint solving
 * 用于高效约束求解的关节批处理资源
 *
 * Pre-computes and caches joint constraint data for the solver.
 * Similar to contact batching, this improves cache locality and reduces
 * repeated calculations during constraint iterations.
 * 预计算并缓存关节约束数据供求解器使用。
 * 类似于接触批处理，这改善了缓存局部性并减少约束迭代期间的重复计算。
 */

import type { Entity } from '../utils/Types';
import type { FX } from '../math/fixed';

/**
 * Pre-computed joint constraint row for efficient solving
 * 用于高效求解的预计算关节约束行
 */
export type JointRow = {
  /**
   * Joint entity reference
   * 关节实体引用
   */
  e: Entity;

  /**
   * Connected body entities
   * 连接的刚体实体
   */
  a: Entity;
  b: Entity;

  /**
   * Relative anchor positions from body centers
   * 相对于刚体中心的锚点位置
   */
  rax: FX;
  ray: FX;
  rbx: FX;
  rby: FX;

  /**
   * Constraint direction (unit vector from A to B)
   * 约束方向（从A到B的单位向量）
   */
  nx: FX;
  ny: FX;

  /**
   * Target rest length
   * 目标静止长度
   */
  rest: FX;

  /**
   * Effective constraint mass (1 / (invMassA + invMassB + angular terms + gamma))
   * 有效约束质量（1 / (invMassA + invMassB + 角度项 + gamma））
   */
  mN: FX;

  /**
   * Baumgarte position correction bias (β * C / dt)
   * Baumgarte位置修正偏置（β * C / dt）
   */
  bias: FX;

  /**
   * Constraint softening parameter
   * 约束软化参数
   */
  gamma: FX;

  /**
   * Break impulse threshold (0 = no breaking)
   * 断裂冲量阈值（0 = 不断裂）
   */
  breakImpulse: FX;

  /**
   * Joint status flags
   * 关节状态标志
   */
  broken: 0 | 1;
};

/**
 * Batch container for joint constraints
 * 关节约束的批处理容器
 */
export class JointBatch2D {
  /**
   * Array of pre-computed joint constraint rows
   * 预计算的关节约束行数组
   */
  list: JointRow[] = [];

  /**
   * Clear all joint rows
   * 清除所有关节行
   */
  clear(): void {
    this.list.length = 0;
  }

  /**
   * Get the number of joint constraints in the batch
   * 获取批次中关节约束的数量
   */
  get count(): number {
    return this.list.length;
  }

  /**
   * Add a pre-computed joint constraint row
   * 添加预计算的关节约束行
   */
  addRow(row: JointRow): void {
    this.list.push(row);
  }

  /**
   * Reserve capacity for expected number of joints
   * 为预期的关节数量预留容量
   */
  reserve(capacity: number): void {
    if (capacity > this.list.length) {
      this.list.length = capacity;
      this.list.length = 0; // Reset to empty but keep capacity
    }
  }
}