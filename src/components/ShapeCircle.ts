/**
 * Circle Shape Component for 2D Physics
 * 2D物理引擎的圆形组件
 *
 * Represents a circular collision shape with fixed-point radius
 * for deterministic collision detection.
 * 表示用于确定性碰撞检测的定点半径圆形碰撞形状。
 */

import type { FX } from '../math/fixed';
import { ONE } from '../math/fixed';
import type { Material2D } from './Material2D';

/**
 * Circle collision shape with fixed-point radius
 * 带定点半径的圆形碰撞形状
 */
export class ShapeCircle {
  /**
   * Circle radius (fixed-point)
   * 圆形半径（定点数）
   */
  r: FX = ONE;

  /**
   * Shape-specific material (optional)
   * 形状特定材质（可选）
   *
   * If provided, this material takes priority over entity-level materials
   * for collision response calculations.
   * 如果提供，此材质在碰撞响应计算中优先于实体级材质。
   */
  material?: Material2D;

  constructor(radius: FX = ONE, material?: Material2D) {
    this.r = radius;
    if (material !== undefined) {
      this.material = material;
    }
  }
}

/**
 * Create a circle shape with specified radius
 * 创建指定半径的圆形
 */
export const createCircleShape = (radius: FX, material?: Material2D): ShapeCircle => {
  return new ShapeCircle(radius, material);
};

/**
 * Get circle area (π * r²) - approximation using fixed point
 * 获取圆形面积（π * r²）- 使用定点数近似
 */
export function getCircleArea(circle: ShapeCircle): FX {
  // Using π ≈ 3.14159 in fixed point
  const PI_FX = 205887; // f(3.14159) ≈ 205887
  const rSquared = (circle.r * circle.r) >> 16; // r² with fixed point adjustment
  return (PI_FX * rSquared) >> 16;
}

/**
 * Check if a point is inside the circle
 * 检查点是否在圆内
 */
export function pointInCircle(px: FX, py: FX, cx: FX, cy: FX, circle: ShapeCircle): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const distSq = ((dx * dx) + (dy * dy)) >> 16; // Distance squared in fixed point
  const radiusSq = (circle.r * circle.r) >> 16;
  return distSq <= radiusSq;
}

/**
 * Calculate the distance between two circle centers
 * 计算两个圆心之间的距离
 */
export function circleDistance(c1x: FX, c1y: FX, c2x: FX, c2y: FX): FX {
  const dx = c1x - c2x;
  const dy = c1y - c2y;
  const distSq = ((dx * dx) + (dy * dy)) >> 16;

  // Simple square root approximation for fixed point
  // 定点数的简单平方根近似
  let result = distSq;
  for (let i = 0; i < 4; i++) {
    result = ((result + (distSq << 16) / result) >> 1);
  }
  return result;
}