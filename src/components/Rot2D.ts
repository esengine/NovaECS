/**
 * 2D Rotation Component with precomputed trigonometric values
 * 带预计算三角函数值的2D旋转组件
 *
 * Stores rotation as cosine and sine values for efficient computation.
 * Can be used alongside or instead of Body2D.angle for systems that
 * require frequent trigonometric calculations.
 *
 * 以余弦和正弦值存储旋转以实现高效计算。
 * 可与Body2D.angle配合使用或替代它，适用于需要频繁三角函数计算的系统。
 */

import type { FX } from '../math/fixed';
import { ONE, ZERO } from '../math/fixed';

/**
 * 2D Rotation component with fixed-point trigonometric values
 * 带定点三角函数值的2D旋转组件
 */
export class Rot2D {
  /**
   * Cosine of rotation angle (fixed point)
   * 旋转角度的余弦值（定点数）
   */
  cos: FX = ONE;

  /**
   * Sine of rotation angle (fixed point)
   * 旋转角度的正弦值（定点数）
   */
  sin: FX = ZERO;

  /**
   * Set rotation from angle in radians
   * 从弧度角度设置旋转
   */
  setFromAngle(angleRadians: number): void {
    this.cos = Math.cos(angleRadians) as FX;
    this.sin = Math.sin(angleRadians) as FX;
  }

  /**
   * Set rotation from cosine and sine values
   * 从余弦和正弦值设置旋转
   */
  setFromCosSin(cos: FX, sin: FX): void {
    this.cos = cos;
    this.sin = sin;
  }

  /**
   * Get rotation angle in radians
   * 获取弧度角度
   */
  getAngle(): number {
    return Math.atan2(this.sin as number, this.cos as number);
  }
}