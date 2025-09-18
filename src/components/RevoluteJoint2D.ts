/**
 * Revolute (Hinge) joint component for 2D physics
 *
 * Constrains two bodies to rotate around a common pivot point while allowing
 * free rotation. Uses two-dimensional constraint solving with warm-starting
 * for stable and deterministic behavior.
 *
 * 2D物理铰链关节组件
 *
 * 约束两个刚体围绕共同枢轴点旋转，同时允许自由转动。
 * 使用二维约束求解和热启动以获得稳定和确定性行为。
 */

import type { Entity } from '../utils/Types';
import type { FX } from '../math/fixed';
import { f } from '../math/fixed';

export class RevoluteJoint2D {
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
   * When bodies rotate, this local point rotates with them
   * 相对于A刚体质心的局部锚点
   * 当刚体旋转时，此局部点随之旋转
   */
  ax: FX = 0 as FX;
  ay: FX = 0 as FX;

  /**
   * Local anchor point on body B relative to center of mass
   * When bodies rotate, this local point rotates with them
   * 相对于B刚体质心的局部锚点
   * 当刚体旋转时，此局部点随之旋转
   */
  bx: FX = 0 as FX;
  by: FX = 0 as FX;

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
   * Accumulated impulse in X direction for warm-starting
   * Improves convergence across frames by carrying over constraint forces
   * X方向累积冲量，用于热启动
   * 通过保持约束力改善跨帧收敛性
   */
  jx: FX = 0 as FX;

  /**
   * Accumulated impulse in Y direction for warm-starting
   * Improves convergence across frames by carrying over constraint forces
   * Y方向累积冲量，用于热启动
   * 通过保持约束力改善跨帧收敛性
   */
  jy: FX = 0 as FX;

  /**
   * Break impulse threshold
   * Joint breaks when combined impulse magnitude exceeds this value
   * <= 0 means breaking is disabled
   * 断裂冲量阈值
   * 当合力冲量大小超过此值时关节断裂
   * <= 0表示不启用断裂
   */
  breakImpulse: FX = 0 as FX;

  /**
   * Whether this joint has been broken
   * 关节是否已断裂
   */
  broken: 0 | 1 = 0;

  /**
   * Whether this joint has been initialized
   * Used for any one-time setup during first constraint solve
   * 关节是否已初始化
   * 用于首次约束求解期间的一次性设置
   */
  initialized: 0 | 1 = 0;
}

/**
 * Create a revolute joint with specified parameters
 * 创建具有指定参数的铰链关节
 */
export function createRevoluteJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 }
): RevoluteJoint2D {
  const joint = new RevoluteJoint2D();
  joint.a = bodyA;
  joint.b = bodyB;
  joint.ax = f(anchorA.x);
  joint.ay = f(anchorA.y);
  joint.bx = f(anchorB.x);
  joint.by = f(anchorB.y);
  return joint;
}

/**
 * Create a breakable revolute joint
 * 创建可断裂的铰链关节
 */
export function createBreakableRevoluteJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  breakImpulse: number = 10.0
): RevoluteJoint2D {
  const joint = createRevoluteJoint(bodyA, bodyB, anchorA, anchorB);
  joint.breakImpulse = f(breakImpulse);
  return joint;
}

/**
 * Create a soft revolute joint with spring-like behavior
 * 创建具有弹簧行为的软铰链关节
 */
export function createSoftRevoluteJoint(
  bodyA: Entity,
  bodyB: Entity,
  anchorA: { x: number; y: number } = { x: 0, y: 0 },
  anchorB: { x: number; y: number } = { x: 0, y: 0 },
  beta: number = 0.1,
  gamma: number = 0.1
): RevoluteJoint2D {
  const joint = createRevoluteJoint(bodyA, bodyB, anchorA, anchorB);
  joint.beta = f(beta);
  joint.gamma = f(gamma);
  return joint;
}