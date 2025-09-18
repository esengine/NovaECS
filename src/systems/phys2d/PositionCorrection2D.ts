/**
 * Position-Based Correction System for 2D Physics
 * 2D物理引擎的位置校正系统
 *
 * Implements split impulse position correction to resolve penetration drift
 * in stacked objects while maintaining deterministic behavior.
 * 实现分离冲量位置校正，解决堆叠物体的穿透漂移，同时保持确定性行为。
 */

import { Body2D } from '../../components/Body2D';
import { Contacts2D } from '../../resources/Contacts2D';
import {
  FX, add, sub, mul, div, f, ZERO
} from '../../math/fixed';
import { getComponentType } from '../../core/ComponentRegistry';
import { system, SystemContext } from '../../core/System';

const POS_ITERS = 4;         // 位置级迭代次数（固定）
const POS_PERCENT = f(0.8);  // 推进比例（0..1）
const POS_SLOP = f(0.0005);  // 公差（米）内不修正，避免抖动

/**
 * Cross product for position constraint: r × n (returns scalar)
 * 位置约束的叉积：r × n（返回标量）
 */
const cross_r_n = (rx: FX, ry: FX, nx: FX, ny: FX): FX =>
  sub(mul(rx, ny), mul(ry, nx));

/**
 * Check if body is static (infinite mass and inertia)
 * 检查物体是否为静态（无限质量和转动惯量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Position-Based Correction System for Split Impulse
 * 分离冲量位置校正系统
 *
 * Corrects residual penetration after velocity-level constraint solving
 * without affecting velocities, preventing drift in stacked objects.
 * 在速度级约束解算后修正残余穿透，不影响速度，防止堆叠物体的漂移。
 */
export const PositionCorrection2D = system(
  'phys.poscor.split',
  (ctx: SystemContext) => {
    const { world } = ctx;

    const contacts = world.getResource(Contacts2D) as Contacts2D | undefined;
    if (!contacts || contacts.list.length === 0) return;

    const bodyStore = world.getStore(getComponentType(Body2D));

    // Fixed iteration count and stable order for determinism
    // 固定迭代次数和稳定顺序以确保确定性
    for (let it = 0; it < POS_ITERS; it++) {
      for (let i = 0; i < contacts.list.length; i++) {
        const c = contacts.list[i];
        const ba = world.getComponent(c.a, Body2D) as Body2D;
        const bb = world.getComponent(c.b, Body2D) as Body2D;
        if (!ba || !bb) continue;

        // Skip if both bodies are static
        // 如果两个物体都是静态的则跳过
        if (isStatic(ba) && isStatic(bb)) continue;

        // Only correct penetration beyond slop tolerance
        // 只修正超出公差的穿透
        const penOver = sub(c.pen, POS_SLOP);
        if (penOver <= 0) continue;

        // Contact point to center-of-mass vectors
        // 接触点到质心的向量
        const rax = sub(c.px, ba.px);
        const ray = sub(c.py, ba.py);
        const rbx = sub(c.px, bb.px);
        const rby = sub(c.py, bb.py);

        // Position-level effective mass (same form as velocity normal mass)
        // 位置级有效质量（与速度法向质量同形）
        const rnA = cross_r_n(rax, ray, c.nx, c.ny);
        const rnB = cross_r_n(rbx, rby, c.nx, c.ny);

        let k = add(ba.invMass, bb.invMass);
        if (ba.invI) k = add(k, mul(rnA, mul(rnA, ba.invI)));
        if (bb.invI) k = add(k, mul(rnB, mul(rnB, bb.invI)));

        if (k === 0) continue; // Both static or invalid configuration

        // Target: push out the over-slop penetration by percentage
        // 目标：按百分比推出超出公差的穿透部分
        const corr = mul(POS_PERCENT, penOver);
        const lambda = div(corr, k);

        // Position correction impulse along contact normal
        // 沿接触法向的位置修正冲量
        const dpx = mul(c.nx, lambda);
        const dpy = mul(c.ny, lambda);

        // Apply position corrections (A moves away from B along -n, B along +n)
        // 应用位置修正（A沿-n远离B，B沿+n）
        if (!isStatic(ba)) {
          ba.px = sub(ba.px, mul(dpx, ba.invMass));
          ba.py = sub(ba.py, mul(dpy, ba.invMass));

          // Angular position correction (for circle-circle, usually negligible)
          // 角位置修正（对于圆-圆碰撞，通常可忽略）
          if (ba.invI !== ZERO) {
            // For circles, rotational correction is typically minimal
            // but kept for generality to other shapes
            // 对于圆形，旋转修正通常很小，但为其他形状保留通用性
            const dthetaA = mul(rnA, mul(lambda, ba.invI));
            // Convert fixed-point angular change to 16-bit angle if needed
            // 如果需要，将定点角度变化转换为16位角度
            const angleChange = (dthetaA >> 16) & 0xFFFF;
            ba.angle = (ba.angle - angleChange) & 0xFFFF;
          }
        }

        if (!isStatic(bb)) {
          bb.px = add(bb.px, mul(dpx, bb.invMass));
          bb.py = add(bb.py, mul(dpy, bb.invMass));

          if (bb.invI !== ZERO) {
            const dthetaB = mul(rnB, mul(lambda, bb.invI));
            const angleChange = (dthetaB >> 16) & 0xFFFF;
            bb.angle = (bb.angle + angleChange) & 0xFFFF;
          }
        }
      }
    }

    // Mark bodies as changed for downstream systems (e.g., SyncAABBSystem)
    // 标记物体已更改，用于下游系统（如SyncAABBSystem）
    if (bodyStore && bodyStore.markChanged) {
      for (const c of contacts.list) {
        bodyStore.markChanged(c.a, world.frame);
        bodyStore.markChanged(c.b, world.frame);
      }
    }
  }
)
  .stage('update')
  .after('phys.solver.joint.revolute')
  .before('phys.wake.contact')
  .build();