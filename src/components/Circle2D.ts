/**
 * Circle Shape Component for Advanced 2D Physics
 * 高级2D物理引擎的圆形组件
 *
 * Enhanced circle shape with local offset and skin radius for Hull-Circle
 * narrow-phase collision detection with deterministic manifold generation.
 * 带局部偏移和皮肤半径的增强圆形，用于Hull-Circle窄相碰撞检测
 * 和确定性流形生成。
 */

import type { FX } from '../math/fixed';
import { ZERO, f } from '../math/fixed';

/**
 * Circle collision shape with local offset and skin radius
 * 带局部偏移和皮肤半径的圆形碰撞形状
 */
export class Circle2D {
  /**
   * Local offset X relative to body center (fixed-point)
   * 相对刚体中心的局部偏移X（定点数）
   */
  ox: FX = ZERO;

  /**
   * Local offset Y relative to body center (fixed-point)
   * 相对刚体中心的局部偏移Y（定点数）
   */
  oy: FX = ZERO;

  /**
   * Geometric radius of the circle (fixed-point)
   * 圆形的几何半径（定点数）
   */
  radius: FX = f(0.5);

  /**
   * Skin radius for contact stability (fixed-point)
   * Recommended: 1-2 LSB, combined with Hull radius for stable contacts
   * 用于接触稳定性的皮肤半径（定点数）
   * 建议值：1-2个最低有效位，与Hull半径结合用于稳定接触
   */
  skin: FX = f(0.01);

  constructor(
    radius: FX = f(0.5),
    offsetX: FX = ZERO,
    offsetY: FX = ZERO,
    skinRadius: FX = f(0.01)
  ) {
    this.radius = radius;
    this.ox = offsetX;
    this.oy = offsetY;
    this.skin = skinRadius;
  }

  /**
   * Get effective radius (geometric + skin)
   * 获取有效半径（几何半径 + 皮肤半径）
   */
  getEffectiveRadius(): FX {
    return (this.radius + this.skin) as FX;
  }

  /**
   * Set local offset
   * 设置局部偏移
   */
  setOffset(ox: FX, oy: FX): void {
    this.ox = ox;
    this.oy = oy;
  }
}

/**
 * Create a circle shape with specified parameters
 * 创建指定参数的圆形
 */
export const createCircle2D = (
  radius: FX,
  offsetX: FX = ZERO,
  offsetY: FX = ZERO,
  skinRadius: FX = f(0.01)
): Circle2D => {
  return new Circle2D(radius, offsetX, offsetY, skinRadius);
};

/**
 * Create a centered circle (no offset)
 * 创建居中圆形（无偏移）
 */
export const createCenteredCircle = (radius: FX): Circle2D => {
  return new Circle2D(radius, ZERO, ZERO, f(0.01));
};