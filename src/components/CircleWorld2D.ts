/**
 * World Space Circle Cache Component for 2D Physics
 * 2D物理引擎的世界空间圆形缓存组件
 *
 * Pre-computes world position for circle shapes to optimize
 * narrow-phase collision detection performance in Hull-Circle pairs.
 * 为圆形预计算世界位置，以优化Hull-Circle对的窄相碰撞检测性能。
 */

import type { FX } from '../math/fixed';
import { ZERO } from '../math/fixed';

/**
 * World space circle cache with transformed center position
 * 带变换中心位置的世界空间圆形缓存
 */
export class CircleWorld2D {
  /**
   * World space center X coordinate (fixed-point)
   * Body position + rotated local offset
   * 世界空间中心X坐标（定点数）
   * 刚体位置 + 旋转的局部偏移
   */
  cx: FX = ZERO;

  /**
   * World space center Y coordinate (fixed-point)
   * Body position + rotated local offset
   * 世界空间中心Y坐标（定点数）
   * 刚体位置 + 旋转的局部偏移
   */
  cy: FX = ZERO;

  /**
   * Cache update epoch for invalidation tracking
   * 用于失效跟踪的缓存更新纪元
   */
  epoch = 0;

  constructor(centerX: FX = ZERO, centerY: FX = ZERO) {
    this.cx = centerX;
    this.cy = centerY;
  }

  /**
   * Set world center position
   * 设置世界中心位置
   */
  setCenter(cx: FX, cy: FX): void {
    this.cx = cx;
    this.cy = cy;
  }

  /**
   * Update cache epoch
   * 更新缓存纪元
   */
  updateEpoch(newEpoch: number): void {
    this.epoch = newEpoch;
  }

  /**
   * Check if cache needs update based on frame epoch
   * 基于帧纪元检查缓存是否需要更新
   */
  needsUpdate(currentFrame: number): boolean {
    return this.epoch < currentFrame - 1;
  }
}