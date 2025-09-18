/**
 * Revolute joint batch resource for 2D physics
 *
 * Stores processed revolute joint data in batch format for efficient solving.
 * Each row contains precomputed constraint matrices and bias terms needed
 * for the iterative constraint solver.
 *
 * 2D物理铰链关节批次资源
 *
 * 以批次格式存储处理后的铰链关节数据，用于高效求解。
 * 每行包含迭代约束求解器所需的预计算约束矩阵和偏置项。
 */

import type { Entity } from '../utils/Types';
import type { FX } from '../math/fixed';

/**
 * Single revolute constraint row with precomputed solver data
 * 包含预计算求解器数据的单个铰链约束行
 */
export type RevoluteRow = {
  /**
   * Joint entity
   * 关节实体
   */
  e: Entity;

  /**
   * Body A entity
   * 刚体A实体
   */
  a: Entity;

  /**
   * Body B entity
   * 刚体B实体
   */
  b: Entity;

  /**
   * Relative anchor vector for body A in world coordinates
   * 刚体A的相对锚点向量（世界坐标）
   */
  rax: FX;
  ray: FX;

  /**
   * Relative anchor vector for body B in world coordinates
   * 刚体B的相对锚点向量（世界坐标）
   */
  rbx: FX;
  rby: FX;

  /**
   * Inverse of (K + gamma*I) matrix - 2x2 symmetric matrix stored as 3 components
   * (K + gamma*I)^(-1) 矩阵 - 2x2对称矩阵存储为3个分量
   * im00 = (0,0), im01 = (0,1) = (1,0), im11 = (1,1)
   */
  im00: FX;
  im01: FX;
  im11: FX;

  /**
   * Baumgarte position correction bias terms
   * Baumgarte位置修正偏置项
   */
  biasX: FX;
  biasY: FX;

  /**
   * Constraint softening parameter (copied from joint for batch processing)
   * 约束软化参数（从关节复制用于批次处理）
   */
  gamma: FX;
};

/**
 * Batch resource containing processed revolute joint constraint data
 * 包含处理后的铰链关节约束数据的批次资源
 */
export class RevoluteBatch2D {
  /**
   * List of processed revolute joint rows ready for constraint solving
   * 准备进行约束求解的已处理铰链关节行列表
   */
  list: RevoluteRow[] = [];

  /**
   * Add a revolute constraint row to the batch
   * 向批次添加铰链约束行
   */
  addRow(row: RevoluteRow): void {
    this.list.push(row);
  }

  /**
   * Clear all rows from the batch
   * 清空批次中的所有行
   */
  clear(): void {
    this.list.length = 0;
  }

  /**
   * Get the number of constraint rows in this batch
   * 获取此批次中的约束行数量
   */
  get count(): number {
    return this.list.length;
  }
}