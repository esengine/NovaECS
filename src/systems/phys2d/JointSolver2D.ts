/**
 * 2D Joint Constraint Solver for Deterministic Physics
 * 2D关节约束解算器，用于确定性物理
 *
 * Implements distance joint constraints using the same deterministic approach as contacts.
 * Supports warm-start impulse accumulation, auto-initialization of rest length, and joint breaking.
 * 实现距离关节约束，使用与接触相同的确定性方法。
 * 支持warm-start冲量累积、rest长度自动初始化和关节断裂。
 */

import { Body2D } from '../../components/Body2D';
import { JointDistance2D } from '../../components/JointDistance2D';
import { JointConstraints2D } from '../../resources/JointConstraints2D';
import {
  FX, add, sub, mul, div, f, ONE, ZERO, sqrt
} from '../../math/fixed';
import { getComponentType } from '../../core/ComponentRegistry';
import { system, SystemContext } from '../../core/System';

const JOINT_ITER = 4; // 关节约束迭代次数（固定）

/**
 * Vector dot product (2D)
 * 向量点积（2D）
 */
const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

/**
 * Cross product: r × v (returns scalar)
 * 叉积：r × v（返回标量）
 */
const cross_r_v = (rx: FX, ry: FX, vx: FX, vy: FX): FX => sub(mul(rx, vy), mul(ry, vx));

/**
 * Cross product: w × r (returns vector)
 * 叉积：w × r（返回向量）
 */
const cross_w_r = (w: FX, rx: FX, ry: FX): readonly [FX, FX] => [sub(ZERO, mul(w, ry)), mul(w, rx)];

/**
 * Check if body is static (infinite mass)
 * 检查物体是否为静态（无限质量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Calculate distance between two points
 * 计算两点间距离
 */
const distance = (x1: FX, y1: FX, x2: FX, y2: FX): FX => {
  const dx = sub(x2, x1);
  const dy = sub(y2, y1);
  return sqrt(add(mul(dx, dx), mul(dy, dy)));
};

/**
 * Precomputed joint constraint data for efficient solving
 * 预计算的关节约束数据，用于高效求解
 */
interface PrecomputedJoint {
  rax: FX;
  ray: FX;
  rbx: FX;
  rby: FX;
  nx: FX;
  ny: FX;
  currentDist: FX;
  C: FX;       // Constraint value (current - rest)
  mass: FX;    // Effective constraint mass
  bias: FX;    // Baumgarte bias
}

/**
 * 2D Joint Constraint Solver System
 * 2D关节约束解算器系统
 */
export const JointSolver2D = system(
  'phys.solver.joints2d',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const jointsRes = world.getResource(JointConstraints2D);
    if (!jointsRes || jointsRes.list.length === 0) return;

    const dtFX: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1 / 60);
    const bodyStore = world.getStore(getComponentType(Body2D));

    // Process each joint for initialization and warm-start
    // 处理每个关节的初始化和warm-start
    for (const jointEntity of jointsRes.list) {
      const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
      if (!joint || joint.broken === 1) continue;

      const ba = world.getComponent(joint.a, Body2D) as Body2D;
      const bb = world.getComponent(joint.b, Body2D) as Body2D;
      if (!ba || !bb) continue;
      if (isStatic(ba) && isStatic(bb)) continue;

      // Calculate world space anchor points
      // 计算世界空间锚点
      const wax = add(ba.px, joint.ax);
      const way = add(ba.py, joint.ay);
      const wbx = add(bb.px, joint.bx);
      const wby = add(bb.py, joint.by);

      // Auto-initialize rest length if needed
      // 如果需要，自动初始化rest长度
      if (joint.rest < 0 && joint.initialized === 0) {
        const currentDist = distance(wax, way, wbx, wby);
        joint.rest = currentDist;
        joint.initialized = 1;

        // Update component in world
        world.replaceComponent(jointEntity, JointDistance2D, joint);
      }

      // Skip if rest length is still invalid
      // 如果rest长度仍然无效则跳过
      if (joint.rest < 0) continue;

      // Warm-start: apply previous frame accumulated impulse to velocities
      // Warm-start：将上一帧累积冲量应用到速度
      if (joint.jn !== 0) {
        const rax = sub(wax, ba.px);
        const ray = sub(way, ba.py);
        const rbx = sub(wbx, bb.px);
        const rby = sub(wby, bb.py);

        const currentDist = distance(wax, way, wbx, wby);
        if (currentDist > 0) {
          const nx = div(sub(wbx, wax), currentDist);
          const ny = div(sub(wby, way), currentDist);

          const Px = mul(nx, joint.jn);
          const Py = mul(ny, joint.jn);

          if (!isStatic(ba)) {
            ba.vx = sub(ba.vx, mul(Px, ba.invMass));
            ba.vy = sub(ba.vy, mul(Py, ba.invMass));
            const dwA = mul(cross_r_v(rax, ray, Px, Py), ba.invI);
            ba.w = sub(ba.w, dwA);
            world.replaceComponent(joint.a, Body2D, ba);
          }
          if (!isStatic(bb)) {
            bb.vx = add(bb.vx, mul(Px, bb.invMass));
            bb.vy = add(bb.vy, mul(Py, bb.invMass));
            const dwB = mul(cross_r_v(rbx, rby, Px, Py), bb.invI);
            bb.w = add(bb.w, dwB);
            world.replaceComponent(joint.b, Body2D, bb);
          }
        }
      }
    }

    // Precompute joint constraint data for efficient solving
    // 预计算关节约束数据以提高求解效率
    const precomp = new Array<PrecomputedJoint | null>(jointsRes.list.length);
    for (let i = 0; i < jointsRes.list.length; i++) {
      const jointEntity = jointsRes.list[i];
      const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
      if (!joint || joint.broken === 1 || joint.rest < 0) {
        precomp[i] = null;
        continue;
      }

      const ba = world.getComponent(joint.a, Body2D) as Body2D;
      const bb = world.getComponent(joint.b, Body2D) as Body2D;
      if (!ba || !bb) {
        precomp[i] = null;
        continue;
      }

      // Calculate world space anchor points
      // 计算世界空间锚点
      const wax = add(ba.px, joint.ax);
      const way = add(ba.py, joint.ay);
      const wbx = add(bb.px, joint.bx);
      const wby = add(bb.py, joint.by);

      const rax = sub(wax, ba.px);
      const ray = sub(way, ba.py);
      const rbx = sub(wbx, bb.px);
      const rby = sub(wby, bb.py);

      const currentDist = distance(wax, way, wbx, wby);
      if (currentDist === 0) {
        precomp[i] = null;
        continue;
      }

      // Constraint direction (unit vector from A to B)
      // 约束方向（从A到B的单位向量）
      const nx = div(sub(wbx, wax), currentDist);
      const ny = div(sub(wby, way), currentDist);

      // Constraint value: C = currentDist - restDist
      // 约束值：C = 当前距离 - 静止距离
      const C = sub(currentDist, joint.rest);

      // Effective constraint mass
      // 有效约束质量
      const rnA = cross_r_v(rax, ray, nx, ny);
      const rnB = cross_r_v(rbx, rby, nx, ny);
      let k = add(ba.invMass, bb.invMass);
      if (ba.invI) k = add(k, mul(rnA, mul(rnA, ba.invI)));
      if (bb.invI) k = add(k, mul(rnB, mul(rnB, bb.invI)));
      k = add(k, joint.gamma); // Add constraint softening
      const mass = k > 0 ? div(ONE, k) : ZERO;

      // Baumgarte bias for position drift correction
      // 用于位置漂移修正的Baumgarte偏置
      const bias = mul(joint.beta, div(C, dtFX));

      precomp[i] = { rax, ray, rbx, rby, nx, ny, currentDist, C, mass, bias };
    }

    // Constraint solving with fixed iteration count and order
    // 使用固定迭代次数和顺序的约束求解
    for (let it = 0; it < JOINT_ITER; it++) {
      for (let i = 0; i < jointsRes.list.length; i++) {
        const jointEntity = jointsRes.list[i];
        const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
        const pc = precomp[i];
        if (!joint || !pc || joint.broken === 1) continue;

        const ba = world.getComponent(joint.a, Body2D) as Body2D;
        const bb = world.getComponent(joint.b, Body2D) as Body2D;
        if (!ba || !bb) continue;

        // Relative velocity with angular contributions
        // 包含角速度贡献的相对速度
        const [wxra_x, wxra_y] = cross_w_r(ba.w, pc.rax, pc.ray);
        const [wxrb_x, wxrb_y] = cross_w_r(bb.w, pc.rbx, pc.rby);
        const vax = add(ba.vx, wxra_x);
        const vay = add(ba.vy, wxra_y);
        const vbx = add(bb.vx, wxrb_x);
        const vby = add(bb.vy, wxrb_y);
        const rvx = sub(vbx, vax);
        const rvy = sub(vby, vay);

        // Relative velocity along constraint direction
        // 沿约束方向的相对速度
        const vn = dot(rvx, rvy, pc.nx, pc.ny);

        // Constraint impulse calculation
        // 约束冲量计算
        const jnCand = mul(pc.mass, sub(ZERO, add(vn, pc.bias)));
        const jnNew = add(joint.jn, jnCand);
        const dJn = jnCand;

        if (dJn !== 0) {
          const Px = mul(pc.nx, dJn);
          const Py = mul(pc.ny, dJn);

          if (!isStatic(ba)) {
            ba.vx = sub(ba.vx, mul(Px, ba.invMass));
            ba.vy = sub(ba.vy, mul(Py, ba.invMass));
            ba.w = sub(ba.w, mul(cross_r_v(pc.rax, pc.ray, Px, Py), ba.invI));
            world.replaceComponent(joint.a, Body2D, ba);
          }
          if (!isStatic(bb)) {
            bb.vx = add(bb.vx, mul(Px, bb.invMass));
            bb.vy = add(bb.vy, mul(Py, bb.invMass));
            bb.w = add(bb.w, mul(cross_r_v(pc.rbx, pc.rby, Px, Py), bb.invI));
            world.replaceComponent(joint.b, Body2D, bb);
          }
          joint.jn = jnNew;

          // Check for joint breaking
          // 检查关节断裂
          if (joint.breakImpulse > 0) {
            const absJn = joint.jn < 0 ? sub(ZERO, joint.jn) : joint.jn;
            if (absJn > joint.breakImpulse) {
              joint.broken = 1;
              joint.jn = ZERO;
            }
          }

          // Update component in world
          world.replaceComponent(jointEntity, JointDistance2D, joint);
        }
      }
    }

    // Mark Body2D components as changed for downstream change tracking
    // 标记Body2D组件为已更改，用于下游变更跟踪
    if (bodyStore && bodyStore.markChanged) {
      for (const jointEntity of jointsRes.list) {
        const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
        if (joint) {
          bodyStore.markChanged(joint.a, world.frame);
          bodyStore.markChanged(joint.b, world.frame);
        }
      }
    }
  }
)
  .stage('update')
  .after('phys.solver.gs2d')
  .before('phys.sleep.update')
  .build();