/**
 * Gauss-Seidel Revolute Joint Constraint Solver for 2D Physics
 * 2D物理高斯-赛德尔铰链关节约束求解器
 *
 * Fixed iteration count (ITER_R = 8), traverses in stable order after construction.
 * Uses two-dimensional constraint solving for point-to-point constraints.
 * Warm-start from component (jx, jy), and writes back to components for next frame use.
 * If breakImpulse > 0 and |j| exceeds threshold, fires "break event".
 *
 * 固定迭代次数（ITER_R = 8），按构建后的稳定顺序遍历。
 * 对点对点约束使用二维约束求解。
 * 从组件(jx, jy)热启动，并在结束后写回组件以供下一帧使用。
 * 若breakImpulse > 0且|j|超阈值，发"断裂事件"。
 */

import { RevoluteBatch2D } from '../../resources/RevoluteBatch2D';
import { RevoluteJoint2D } from '../../components/RevoluteJoint2D';
import { Body2D } from '../../components/Body2D';
import { system, SystemContext } from '../../core/System';
import { getComponentType } from '../../core/ComponentRegistry';
import { JointEvents2D } from './SolverGSJoints2D';
import {
  FX, add, sub, mul, div, abs, ZERO
} from '../../math/fixed';

const ITER_R = 8; // Fixed revolute joint iteration count

/**
 * Cross product: r × v (returns scalar)
 * 叉积：r × v（返回标量）
 */
const cross_r_v = (rx: FX, ry: FX, vx: FX, vy: FX): FX =>
  sub(mul(rx, vy), mul(ry, vx));

/**
 * Cross product: w × r (returns vector)
 * 叉积：w × r（返回向量）
 */
const cross_w_r = (w: FX, rx: FX, ry: FX): readonly [FX, FX] =>
  [sub(ZERO, mul(w, ry)), mul(w, rx)];

/**
 * Fast approximation for vector length
 * 向量长度的快速近似
 */
const lenApprox = (x: FX, y: FX): FX => {
  const ax = abs(x);
  const ay = abs(y);
  if (ax === 0 && ay === 0) return ZERO;

  const hi = ax > ay ? ax : ay;
  const lo = ax > ay ? ay : ax;

  if (hi === 0) return ZERO;

  // First-order approximation: hi + lo²/hi
  return add(hi, div(mul(lo, lo), hi));
};

/**
 * Check if body is static (infinite mass)
 * 检查物体是否为静态（无限质量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Gauss-Seidel Revolute Joint Constraint Solver System
 * 高斯-赛德尔铰链关节约束求解器系统
 */
export const SolverGSRevolute2D = system(
  'phys.solver.joint.revolute',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get or create joint events resource
    let events = world.getResource(JointEvents2D);
    if (!events) {
      events = new JointEvents2D();
      world.setResource(JointEvents2D, events);
    }

    const batch = world.getResource(RevoluteBatch2D);
    if (!batch || batch.list.length === 0) return;

    const bodyStore = world.getStore(getComponentType(Body2D));
    const jointStore = world.getStore(getComponentType(RevoluteJoint2D));

    // —— Warm-start phase ——
    // Apply accumulated impulses from previous frame
    // 热启动阶段：应用上一帧的累积冲量
    for (const row of batch.list) {
      const j = world.getComponent(row.e, RevoluteJoint2D);
      if (!j || j.broken === 1) continue;

      const ba = world.getComponent(row.a, Body2D);
      const bb = world.getComponent(row.b, Body2D);
      if (!ba || !bb) continue;
      if (isStatic(ba) && isStatic(bb)) continue;

      const jx = j.jx;
      const jy = j.jy;

      if ((jx | jy) !== 0) {
        const Px = jx;
        const Py = jy;

        // Apply impulse to body A (negative direction)
        // 对物体A应用冲量（负方向）
        if (!isStatic(ba)) {
          ba.vx = sub(ba.vx, mul(Px, ba.invMass));
          ba.vy = sub(ba.vy, mul(Py, ba.invMass));
          ba.w = sub(ba.w, mul(cross_r_v(row.rax, row.ray, Px, Py), ba.invI));
          world.replaceComponent(row.a, Body2D, ba);
        }

        // Apply impulse to body B (positive direction)
        // 对物体B应用冲量（正方向）
        if (!isStatic(bb)) {
          bb.vx = add(bb.vx, mul(Px, bb.invMass));
          bb.vy = add(bb.vy, mul(Py, bb.invMass));
          bb.w = add(bb.w, mul(cross_r_v(row.rbx, row.rby, Px, Py), bb.invI));
          world.replaceComponent(row.b, Body2D, bb);
        }
      }
    }

    // —— Iterative constraint solving phase ——
    // Fixed iteration count with stable order
    // 迭代约束求解阶段：固定迭代次数和稳定顺序
    for (let iteration = 0; iteration < ITER_R; iteration++) {
      for (const row of batch.list) {
        const j = world.getComponent(row.e, RevoluteJoint2D);
        if (!j || j.broken === 1) continue;

        const ba = world.getComponent(row.a, Body2D);
        const bb = world.getComponent(row.b, Body2D);
        if (!ba || !bb) continue;
        if (isStatic(ba) && isStatic(bb)) continue;

        // Calculate relative velocity at anchor points with angular contributions
        // 计算锚点处包含角速度贡献的相对速度
        const [wxra_x, wxra_y] = cross_w_r(ba.w, row.rax, row.ray);
        const [wxrb_x, wxrb_y] = cross_w_r(bb.w, row.rbx, row.rby);
        const vax = add(ba.vx, wxra_x);
        const vay = add(ba.vy, wxra_y);
        const vbx = add(bb.vx, wxrb_x);
        const vby = add(bb.vy, wxrb_y);
        const rvx = sub(vbx, vax);
        const rvy = sub(vby, vay);

        // 2D constraint: rv + bias + gamma * j == 0
        // 二维约束：rv + bias + gamma * j == 0
        // rhs = -(rv + bias + gamma * j)
        const rhsX = sub(ZERO, add(rvx, add(row.biasX, mul(row.gamma, j.jx))));
        const rhsY = sub(ZERO, add(rvy, add(row.biasY, mul(row.gamma, j.jy))));

        // dJ = M^-1 * rhs (using precomputed inverse mass matrix)
        // dJ = M^-1 * rhs（使用预计算的逆质量矩阵）
        const dJx = add(mul(row.im00, rhsX), mul(row.im01, rhsY));
        const dJy = add(mul(row.im01, rhsX), mul(row.im11, rhsY));

        if ((dJx | dJy) !== 0) {
          const Px = dJx;
          const Py = dJy;

          // Apply impulse to body A (negative direction)
          // 对物体A应用冲量（负方向）
          if (!isStatic(ba)) {
            ba.vx = sub(ba.vx, mul(Px, ba.invMass));
            ba.vy = sub(ba.vy, mul(Py, ba.invMass));
            ba.w = sub(ba.w, mul(cross_r_v(row.rax, row.ray, Px, Py), ba.invI));
            world.replaceComponent(row.a, Body2D, ba);
          }

          // Apply impulse to body B (positive direction)
          // 对物体B应用冲量（正方向）
          if (!isStatic(bb)) {
            bb.vx = add(bb.vx, mul(Px, bb.invMass));
            bb.vy = add(bb.vy, mul(Py, bb.invMass));
            bb.w = add(bb.w, mul(cross_r_v(row.rbx, row.rby, Px, Py), bb.invI));
            world.replaceComponent(row.b, Body2D, bb);
          }

          // Update joint accumulated impulse
          // 更新关节累积冲量
          j.jx = add(j.jx, dJx);
          j.jy = add(j.jy, dJy);
          world.replaceComponent(row.e, RevoluteJoint2D, j);
        }
      }
    }

    // —— Joint breaking detection phase ——
    // Check for joints that exceed break impulse threshold
    // 关节断裂检测阶段：检查超过断裂冲量阈值的关节
    for (const row of batch.list) {
      const j = world.getComponent(row.e, RevoluteJoint2D);
      if (!j || j.broken === 1) continue;

      if (j.breakImpulse > 0) {
        const impulseMagnitude = lenApprox(j.jx, j.jy);
        if (impulseMagnitude > j.breakImpulse) {
          // Mark joint as broken
          // 标记关节为断裂
          j.broken = 1;
          j.jx = ZERO;
          j.jy = ZERO;
          world.replaceComponent(row.e, RevoluteJoint2D, j);

          // Fire break event
          // 触发断裂事件
          events.addBrokenEvent(row.e);
        }
      }
    }

    // Mark components as changed for downstream systems
    // 为下游系统标记组件已更改
    if (bodyStore && bodyStore.markChanged) {
      for (const row of batch.list) {
        bodyStore.markChanged(row.a, world.frame);
        bodyStore.markChanged(row.b, world.frame);
      }
    }

    if (jointStore && jointStore.markChanged) {
      for (const row of batch.list) {
        jointStore.markChanged(row.e, world.frame);
      }
    }
  }
)
  .stage('update')
  .after('phys.joint.build.revolute')
  .before('phys.sleep.update')
  .build();