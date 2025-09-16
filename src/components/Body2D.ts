/**
 * 2D Rigid Body Component for Deterministic Physics
 * 用于确定性物理引擎的2D刚体组件
 *
 * Uses 16.16 fixed point arithmetic for deterministic simulation
 * across different platforms and environments.
 * 使用16.16定点数运算确保跨平台确定性仿真。
 */

import type { FX } from '../math/fixed';
import { ZERO, ONE } from '../math/fixed';

/**
 * 2D Rigid Body component with fixed-point precision
 * 带定点精度的2D刚体组件
 */
export class Body2D {
  /**
   * Position X coordinate (fixed point)
   * X坐标位置（定点数）
   */
  px: FX = ZERO;

  /**
   * Position Y coordinate (fixed point)
   * Y坐标位置（定点数）
   */
  py: FX = ZERO;

  /**
   * Linear velocity X component (fixed point)
   * X方向线速度（定点数）
   */
  vx: FX = ZERO;

  /**
   * Linear velocity Y component (fixed point)
   * Y方向线速度（定点数）
   */
  vy: FX = ZERO;

  /**
   * Rotation angle in custom 16-bit format (0..65535 maps to 0..2π)
   * 旋转角度，使用自定义16位格式（0..65535映射到0..2π）
   */
  angle: number = 0;

  /**
   * Angular velocity (fixed point radians per time unit)
   * 角速度（定点数弧度每时间单位）
   */
  w: FX = ZERO;

  /**
   * Inverse mass (1/mass, fixed point)
   * Use 0 for infinite mass (static body)
   * 质量倒数（1/质量，定点数）
   * 使用0表示无限质量（静态物体）
   */
  invMass: FX = ONE;

  /**
   * Inverse moment of inertia (1/I, fixed point)
   * Use 0 for infinite inertia (no rotation)
   * 转动惯量倒数（1/I，定点数）
   * 使用0表示无限转动惯量（不旋转）
   */
  invI: FX = ONE;

  /**
   * Awake state (0 = sleeping, 1 = awake)
   * Physics integration is skipped for sleeping bodies
   * 唤醒状态（0=休眠，1=唤醒）
   * 休眠物体跳过物理积分
   */
  awake: 0 | 1 = 1;

  /**
   * Restitution coefficient (0..1, where 0 = no bounce, 1 = perfect bounce)
   * 恢复系数（0..1，其中0=无反弹，1=完全弹性反弹）
   */
  restitution: FX = ZERO;

  /**
   * Friction coefficient (0..1+, where 0 = no friction)
   * 摩擦系数（0..1+，其中0=无摩擦）
   */
  friction: FX = ZERO;

  constructor(
    px: FX = ZERO,
    py: FX = ZERO,
    vx: FX = ZERO,
    vy: FX = ZERO,
    angle = 0,
    w: FX = ZERO
  ) {
    this.px = px;
    this.py = py;
    this.vx = vx;
    this.vy = vy;
    this.angle = angle & 0xffff; // Ensure 16-bit range
    this.w = w;
  }
}

/**
 * Static body helper - creates a body with infinite mass and no movement
 * 静态物体辅助函数 - 创建无限质量且不移动的物体
 */
export const createStaticBody = (px: FX = ZERO, py: FX = ZERO, angle = 0): Body2D => {
  const body = new Body2D(px, py, ZERO, ZERO, angle, ZERO);
  body.invMass = ZERO; // Infinite mass
  body.invI = ZERO;    // Infinite inertia
  body.awake = 0;      // Static bodies start sleeping
  return body;
};

/**
 * Dynamic body helper - creates a body with specified mass
 * 动态物体辅助函数 - 创建指定质量的物体
 */
export const createDynamicBody = (
  px: FX = ZERO,
  py: FX = ZERO,
  mass: FX = ONE,
  inertia: FX = ONE
): Body2D => {
  const body = new Body2D(px, py);
  body.invMass = mass > ZERO ? ONE / mass : ZERO;
  body.invI = inertia > ZERO ? ONE / inertia : ZERO;
  return body;
};