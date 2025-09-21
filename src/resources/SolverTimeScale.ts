/**
 * Solver Time Scale Resource
 * 解算器时间缩放资源
 *
 * Provides time scaling factor for physics solver to handle sub-stepping
 * and partial time intervals (e.g., TOI remaining time).
 * 为物理解算器提供时间缩放因子，以处理子步长和部分时间间隔（如TOI剩余时间）。
 */

import type { FX } from '../math/fixed';
import { f } from '../math/fixed';

/**
 * Solver Time Scale Resource
 * 解算器时间缩放资源
 *
 * Controls the effective time step used by the physics solver.
 * Used for TOI sub-stepping where only partial frame time remains.
 * 控制物理解算器使用的有效时间步长。
 * 用于TOI子步长，其中只剩余部分帧时间。
 */
export class SolverTimeScale {
  /**
   * Time scaling factor applied to solver calculations
   * Default value of 1.0 means full time step
   * Values < 1.0 represent partial time steps
   * 应用于解算器计算的时间缩放因子
   * 默认值1.0表示完整时间步长
   * 小于1.0的值表示部分时间步长
   */
  value: FX = f(1);

  /**
   * Set the time scale factor
   * 设置时间缩放因子
   */
  setScale(scale: FX): void {
    this.value = scale;
  }

  /**
   * Reset to full time scale
   * 重置为完整时间缩放
   */
  reset(): void {
    this.value = f(1);
  }

  /**
   * Check if using scaled time
   * 检查是否使用缩放时间
   */
  isScaled(): boolean {
    return this.value !== f(1);
  }
}