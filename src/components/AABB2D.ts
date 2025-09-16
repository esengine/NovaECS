/**
 * 2D Axis-Aligned Bounding Box Component
 * 2D轴对齐包围盒组件
 *
 * Used for broadphase collision detection with fixed-point precision
 * for deterministic results across platforms.
 * 用于宽相碰撞检测的定点精度包围盒，确保跨平台确定性结果。
 */

import type { FX } from '../math/fixed';
import { ZERO } from '../math/fixed';

/**
 * 2D Axis-Aligned Bounding Box with fixed-point coordinates
 * 带定点坐标的2D轴对齐包围盒
 */
export class AABB2D {
  /**
   * Minimum X coordinate (left edge)
   * 最小X坐标（左边缘）
   */
  minx: FX = ZERO;

  /**
   * Minimum Y coordinate (bottom edge)
   * 最小Y坐标（下边缘）
   */
  miny: FX = ZERO;

  /**
   * Maximum X coordinate (right edge)
   * 最大X坐标（右边缘）
   */
  maxx: FX = ZERO;

  /**
   * Maximum Y coordinate (top edge)
   * 最大Y坐标（上边缘）
   */
  maxy: FX = ZERO;

  /**
   * Frame/epoch when this AABB was last updated
   * Used for change detection and cache invalidation
   * 此AABB最后更新的帧/时期号
   * 用于变更检测和缓存失效
   */
  epoch = 0;

  constructor(
    minx: FX = ZERO,
    miny: FX = ZERO,
    maxx: FX = ZERO,
    maxy: FX = ZERO
  ) {
    this.minx = minx;
    this.miny = miny;
    this.maxx = maxx;
    this.maxy = maxy;
  }
}

/**
 * Check if two AABBs overlap
 * 检查两个AABB是否重叠
 */
export function aabbOverlap(a: AABB2D, b: AABB2D): boolean {
  return a.maxx >= b.minx &&
         b.maxx >= a.minx &&
         a.maxy >= b.miny &&
         b.maxy >= a.miny;
}

/**
 * Calculate AABB area (for debugging/optimization)
 * 计算AABB面积（用于调试/优化）
 */
export function aabbArea(aabb: AABB2D): FX {
  const width = aabb.maxx - aabb.minx;
  const height = aabb.maxy - aabb.miny;
  return width * height;
}