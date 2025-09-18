/**
 * Prismatic joint component for 2D physics
 *
 * Constrains two bodies to translate along a fixed axis while preventing rotation
 * relative to each other. Supports position limits and motor drive capabilities.
 *
 * 2D物理滑动关节组件
 *
 * 约束两个刚体沿固定轴移动，同时防止彼此相对旋转。
 * 支持位置限制和电机驱动功能。
 */

import type { Entity } from '../utils/Types';
import type { FX } from '../math/fixed';
import { f, ZERO, ONE, sqrt, add, mul, div } from '../math/fixed';

export class PrismaticJoint2D {
  /**
   * Entity A (first body)
   * 实体A（第一个刚体）
   */
  a!: Entity;

  /**
   * Entity B (second body)
   * 实体B（第二个刚体）
   */
  b!: Entity;

  /**
   * Local anchor point on body A relative to center of mass
   * 相对于A刚体质心的局部锚点
   */
  ax: FX = ZERO;
  ay: FX = ZERO;

  /**
   * Local anchor point on body B relative to center of mass
   * 相对于B刚体质心的局部锚点
   */
  bx: FX = ZERO;
  by: FX = ZERO;

  /**
   * World-space sliding axis direction (will be normalized during solving)
   * 世界空间滑动轴方向（求解过程中会被归一化）
   */
  axisX: FX = ONE;
  axisY: FX = ZERO;

  /**
   * Baumgarte position drift correction parameter
   * Higher values correct position errors more aggressively
   * 位置漂移修正参数
   * 更高的值会更积极地修正位置错误
   */
  beta: FX = f(0.2);

  /**
   * Constraint softening parameter
   * Higher values make the constraint softer/more springy
   * Zero means rigid constraint
   * 约束软化参数
   * 更高的值使约束更软/更有弹性
   * 零表示刚性约束
   */
  gamma: FX = ZERO;

  /**
   * Enable position limits along the sliding axis
   * 启用沿滑动轴的位置限制
   */
  enableLimit: 0 | 1 = 0;

  /**
   * Lower limit of relative translation (when enableLimit = 1)
   * 相对平移的下限（当enableLimit = 1时）
   */
  lower: FX = ZERO;

  /**
   * Upper limit of relative translation (when enableLimit = 1)
   * 相对平移的上限（当enableLimit = 1时）
   */
  upper: FX = ZERO;

  /**
   * Enable motor drive along the sliding axis
   * 启用沿滑动轴的电机驱动
   */
  enableMotor: 0 | 1 = 0;

  /**
   * Target relative velocity along the axis (when enableMotor = 1)
   * 沿轴的目标相对速度（当enableMotor = 1时）
   */
  motorSpeed: FX = ZERO;

  /**
   * Maximum motor impulse per frame (when enableMotor = 1)
   * 每帧最大电机冲量（当enableMotor = 1时）
   */
  maxMotorImpulse: FX = ONE;

  /**
   * Accumulated perpendicular impulse for warm-starting
   * Used for constraining motion perpendicular to the sliding axis
   * 用于热启动的累积垂直冲量
   * 用于约束垂直于滑动轴的运动
   */
  jPerp: FX = ZERO;

  /**
   * Accumulated axial impulse for warm-starting
   * Used for motor drive and limit constraints along the sliding axis
   * 用于热启动的累积轴向冲量
   * 用于沿滑动轴的电机驱动和限位约束
   */
  jAxis: FX = ZERO;

  /**
   * Break impulse threshold
   * Joint breaks when total impulse magnitude exceeds this value
   * <= 0 means breaking is disabled
   * 断裂冲量阈值
   * 当总冲量大小超过此值时关节断裂
   * <= 0表示不启用断裂
   */
  breakImpulse: FX = ZERO;

  /**
   * Whether this joint has been broken
   * 关节是否已断裂
   */
  broken: 0 | 1 = 0;
}

/**
 * Create a basic prismatic joint with specified parameters
 * 创建具有指定参数的基本滑动关节
 */
export function createPrismaticJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  axis: { x: number; y: number } = { x: 1, y: 0 }
): PrismaticJoint2D {
  const joint = new PrismaticJoint2D();
  joint.a = bodyA;
  joint.b = bodyB;
  joint.ax = f(anchorA.x);
  joint.ay = f(anchorA.y);
  joint.bx = f(anchorB.x);
  joint.by = f(anchorB.y);

  // Normalize axis vector
  const axisLen = sqrt(add(mul(f(axis.x), f(axis.x)), mul(f(axis.y), f(axis.y))));
  if (axisLen > 0) {
    joint.axisX = div(f(axis.x), axisLen);
    joint.axisY = div(f(axis.y), axisLen);
  }

  return joint;
}

/**
 * Create a prismatic joint with position limits
 * 创建具有位置限制的滑动关节
 */
export function createLimitedPrismaticJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  axis: { x: number; y: number } = { x: 1, y: 0 },
  lowerLimit: number = -1.0,
  upperLimit: number = 1.0
): PrismaticJoint2D {
  const joint = createPrismaticJoint(bodyA, bodyB, anchorA, anchorB, axis);
  joint.enableLimit = 1;
  joint.lower = f(lowerLimit);
  joint.upper = f(upperLimit);
  return joint;
}

/**
 * Create a motorized prismatic joint
 * 创建具有电机驱动的滑动关节
 */
export function createMotorizedPrismaticJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  axis: { x: number; y: number } = { x: 1, y: 0 },
  motorSpeed: number = 1.0,
  maxMotorImpulse: number = 10.0
): PrismaticJoint2D {
  const joint = createPrismaticJoint(bodyA, bodyB, anchorA, anchorB, axis);
  joint.enableMotor = 1;
  joint.motorSpeed = f(motorSpeed);
  joint.maxMotorImpulse = f(maxMotorImpulse);
  return joint;
}

/**
 * Create a breakable prismatic joint
 * 创建可断裂的滑动关节
 */
export function createBreakablePrismaticJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  axis: { x: number; y: number } = { x: 1, y: 0 },
  breakImpulse: number = 10.0
): PrismaticJoint2D {
  const joint = createPrismaticJoint(bodyA, bodyB, anchorA, anchorB, axis);
  joint.breakImpulse = f(breakImpulse);
  return joint;
}

/**
 * Create a soft prismatic joint with spring-like behavior
 * 创建具有弹簧行为的软滑动关节
 */
export function createSoftPrismaticJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  axis: { x: number; y: number } = { x: 1, y: 0 },
  beta: number = 0.1,
  gamma: number = 0.1
): PrismaticJoint2D {
  const joint = createPrismaticJoint(bodyA, bodyB, anchorA, anchorB, axis);
  joint.beta = f(beta);
  joint.gamma = f(gamma);
  return joint;
}