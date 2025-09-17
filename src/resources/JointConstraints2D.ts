/**
 * Resource for managing 2D joint constraints
 *
 * Stores and manages distance joint entities for constraint solving.
 * Follows the same pattern as Contacts2D for integration with the GS solver.
 *
 * 2D关节约束资源
 *
 * 存储和管理距离关节实体以进行约束求解。
 * 遵循与Contacts2D相同的模式，以便与GS求解器集成。
 */

import type { Entity } from '../utils/Types';

/**
 * Resource containing all active joint constraints
 * 包含所有活跃关节约束的资源
 */
export class JointConstraints2D {
  /**
   * List of joint entities to be processed by the constraint solver
   * 待约束求解器处理的关节实体列表
   */
  list: Entity[] = [];

  /**
   * Add a joint entity to the constraint list
   * 将关节实体添加到约束列表
   */
  addJoint(jointEntity: Entity): void {
    this.list.push(jointEntity);
  }

  /**
   * Remove a joint entity from the constraint list
   * 从约束列表中移除关节实体
   */
  removeJoint(jointEntity: Entity): void {
    const index = this.list.indexOf(jointEntity);
    if (index !== -1) {
      this.list.splice(index, 1);
    }
  }

  /**
   * Clear all joint constraints
   * 清除所有关节约束
   */
  clear(): void {
    this.list.length = 0;
  }

  /**
   * Get the number of active joints
   * 获取活跃关节数量
   */
  get count(): number {
    return this.list.length;
  }
}