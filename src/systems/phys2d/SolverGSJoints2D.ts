/**
 * Gauss-Seidel Joint Constraint Solver for 2D Physics
 * 2D物理高斯-赛德尔关节约束求解器
 *
 * Fixed iteration count (ITER_J = 8), traverses in stable order after construction.
 * Uses same incremental strategy as contacts, warm-start (from component jn),
 * and writes back to components for next frame use.
 * If breakImpulse > 0 and |jn| exceeds threshold, fires "break event".
 *
 * 固定迭代次数（ITER_J = 8），按构建后的稳定顺序遍历。
 * 使用与接触同样的增量策略、warm-start（来自组件的jn）、并在结束后写回组件以供下一帧使用。
 * 若breakImpulse > 0且|jn|超阈，发"断裂事件"。
 */

import { JointBatch2D } from '../../resources/JointBatch2D';
import { JointDistance2D } from '../../components/JointDistance2D';
import { Body2D } from '../../components/Body2D';
import { system, SystemContext } from '../../core/System';
import { getComponentType } from '../../core/ComponentRegistry';
import {
  FX, add, sub, mul, ZERO
} from '../../math/fixed';

const ITER_J = 8; // Fixed joint iteration count

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
 * Check if body is static (infinite mass)
 * 检查物体是否为静态（无限质量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Joint broken event
 * 关节断裂事件
 */
export class JointBrokenEvent {
  constructor(public joint: number) {}
}

/**
 * Joint events resource
 * 关节事件资源
 */
export class JointEvents2D {
  events: JointBrokenEvent[] = [];

  /**
   * Clear all events
   * 清除所有事件
   */
  clear(): void {
    this.events.length = 0;
  }

  /**
   * Add a joint broken event
   * 添加关节断裂事件
   */
  addBrokenEvent(jointEntity: number): void {
    this.events.push(new JointBrokenEvent(jointEntity));
  }
}

/**
 * Gauss-Seidel Joint Constraint Solver System
 * 高斯-赛德尔关节约束求解器系统
 */
export const SolverGSJoints2D = system(
  'phys.solver.joints.gs',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get or create joint events resource
    let events = world.getResource(JointEvents2D);
    if (!events) {
      events = new JointEvents2D();
      world.setResource(JointEvents2D, events);
    }

    const batch = world.getResource(JointBatch2D);
    if (!batch || batch.list.length === 0) return;

    const bodyStore = world.getStore(getComponentType(Body2D));
    const jointStore = world.getStore(getComponentType(JointDistance2D));

    // —— Warm-start phase ——
    // Apply accumulated impulses from previous frame
    // 热启动阶段：应用上一帧的累积冲量
    for (const row of batch.list) {
      const jd = world.getComponent(row.e, JointDistance2D);
      if (!jd || jd.broken === 1) continue;

      const ba = world.getComponent(row.a, Body2D);
      const bb = world.getComponent(row.b, Body2D);
      if (!ba || !bb) continue;
      if (isStatic(ba) && isStatic(bb)) continue;

      const jn = jd.jn;
      if (jn !== 0) {
        const Px = mul(row.nx, jn);
        const Py = mul(row.ny, jn);

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
    for (let iteration = 0; iteration < ITER_J; iteration++) {
      for (const row of batch.list) {
        const jd = world.getComponent(row.e, JointDistance2D);
        if (!jd || jd.broken === 1) continue;

        const ba = world.getComponent(row.a, Body2D);
        const bb = world.getComponent(row.b, Body2D);
        if (!ba || !bb) continue;
        if (isStatic(ba) && isStatic(bb)) continue;

        // Calculate relative velocity with angular contributions
        // 计算包含角速度贡献的相对速度
        const [wxra_x, wxra_y] = cross_w_r(ba.w, row.rax, row.ray);
        const [wxrb_x, wxrb_y] = cross_w_r(bb.w, row.rbx, row.rby);
        const vax = add(ba.vx, wxra_x);
        const vay = add(ba.vy, wxra_y);
        const vbx = add(bb.vx, wxrb_x);
        const vby = add(bb.vy, wxrb_y);
        const rvx = sub(vbx, vax);
        const rvy = sub(vby, vay);

        // Velocity constraint: n·rv + bias + gamma * jn == 0
        // 速度约束：n·rv + bias + gamma * jn == 0
        const vn = add(mul(row.nx, rvx), mul(row.ny, rvy));
        const rhs = sub(ZERO, add(vn, add(row.bias, mul(row.gamma, jd.jn))));
        const dJn = mul(row.mN, rhs);

        if (dJn !== 0) {
          const jnNew = add(jd.jn, dJn);
          const Px = mul(row.nx, dJn);
          const Py = mul(row.ny, dJn);

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
          jd.jn = jnNew;
          world.replaceComponent(row.e, JointDistance2D, jd);
        }
      }
    }

    // —— Joint breaking detection phase ——
    // Check for joints that exceed break impulse threshold
    // 关节断裂检测阶段：检查超过断裂冲量阈值的关节
    for (const row of batch.list) {
      const jd = world.getComponent(row.e, JointDistance2D);
      if (!jd || jd.broken === 1) continue;

      if (row.breakImpulse > 0) {
        const absJn = jd.jn < 0 ? sub(ZERO, jd.jn) : jd.jn;
        if (absJn > row.breakImpulse) {
          // Mark joint as broken
          // 标记关节为断裂
          jd.broken = 1;
          jd.jn = ZERO;
          world.replaceComponent(row.e, JointDistance2D, jd);

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
  .after('phys.joint.build.distance')
  .before('phys.sleep.update')
  .build();