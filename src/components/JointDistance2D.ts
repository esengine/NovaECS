/**
 * Distance joint component for 2D physics
 *
 * Maintains a fixed distance between two bodies using constraint-based solving.
 * Follows the same deterministic approach as contact solver with warm-starting.
 *
 * 2D物理距离关节组件
 *
 * 使用基于约束的求解器维持两个刚体间的固定距离。
 * 遵循与接触求解器相同的确定性方法，支持热启动。
 */

import type { Entity } from '../utils/Types';
import type { FX } from '../math/fixed';
import { f } from '../math/fixed';

export class JointDistance2D {
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
  ax: FX = 0 as FX;
  ay: FX = 0 as FX;

  /**
   * Local anchor point on body B relative to center of mass
   * 相对于B刚体质心的局部锚点
   */
  bx: FX = 0 as FX;
  by: FX = 0 as FX;

  /**
   * Target rest length
   * If rest < 0, system will auto-initialize to current distance on first frame
   * 目标静止长度
   * 如果rest < 0，系统将在首帧自动初始化为当前距离
   */
  rest: FX = f(-1);

  /**
   * Baumgarte position drift correction parameter (Erin Catto style)
   * Higher values correct position errors more aggressively
   * 位置漂移修正参数（Erin Catto风格）
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
  gamma: FX = 0 as FX;

  /**
   * Accumulated normal impulse for warm-starting
   * Improves convergence across frames
   * 用于热启动的累积法向冲量
   * 改善跨帧收敛性
   */
  jn: FX = 0 as FX;

  /**
   * Break impulse threshold
   * Joint breaks when accumulated normal impulse exceeds this value
   * <= 0 means breaking is disabled
   * 断裂冲量阈值
   * 当累积法向冲量超过此值时关节断裂
   * <= 0表示不启用断裂
   */
  breakImpulse: FX = 0 as FX;

  /**
   * Joint status flags
   * 关节状态标志
   */

  /**
   * Whether this joint has been broken
   * 关节是否已断裂
   */
  broken: 0 | 1 = 0;

  /**
   * Whether rest length has been auto-initialized
   * 静止长度是否已自动初始化
   */
  initialized: 0 | 1 = 0;
}

/**
 * Create a distance joint with specified parameters
 * 创建具有指定参数的距离关节
 */
export function createDistanceJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  restLength: number = -1
): JointDistance2D {
  const joint = new JointDistance2D();
  joint.a = bodyA;
  joint.b = bodyB;
  joint.ax = f(anchorA.x);
  joint.ay = f(anchorA.y);
  joint.bx = f(anchorB.x);
  joint.by = f(anchorB.y);
  joint.rest = f(restLength);
  return joint;
}

/**
 * Create a breakable distance joint
 * 创建可断裂的距离关节
 */
export function createBreakableDistanceJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  restLength: number = -1,
  breakImpulse: number = 10.0
): JointDistance2D {
  const joint = createDistanceJoint(bodyA, bodyB, anchorA, anchorB, restLength);
  joint.breakImpulse = f(breakImpulse);
  return joint;
}

/**
 * Create a soft distance joint with spring-like behavior
 * 创建具有弹簧行为的软距离关节
 */
export function createSoftDistanceJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  restLength: number = -1,
  beta: number = 0.1,
  gamma: number = 0.1
): JointDistance2D {
  const joint = createDistanceJoint(bodyA, bodyB, anchorA, anchorB, restLength);
  joint.beta = f(beta);
  joint.gamma = f(gamma);
  return joint;
}