/**
 * 2D Gauss-Seidel Constraint Solver for Deterministic Physics
 * 2D高斯-赛德尔约束解算器，用于确定性物理
 *
 * Implements sequential impulse solver with fixed iteration count and stable ordering.
 * Reads from Contacts2D.list, updates Body2D velocities, and maintains warm-start cache.
 * 实现具有固定迭代次数和稳定排序的序贯冲量解算器。
 * 从Contacts2D.list读取数据，更新Body2D速度，并维护warm-start缓存。
 */

import { Body2D } from '../../components/Body2D';
import { Contacts2D } from '../../resources/Contacts2D';
import { makePairKey } from '../../determinism/PairKey';
import {
  FX, add, sub, mul, div, clamp, f, ONE, ZERO
} from '../../math/fixed';
import { getComponentType } from '../../core/ComponentRegistry';
import { system, SystemContext } from '../../core/System';

const ITER_N = 8;                // 法向迭代次数（固定）
const ITER_T = 4;                // 切向迭代次数（固定）
const BAUMGARTE = f(0.2);        // 位置穿透速度偏置系数
const RESTIT_THRESH = f(1.0);    // 回弹阈值（>1 m/s 才考虑弹性）

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
 * Perpendicular vector of normal (tangent vector)
 * 法向量的垂直向量（切向量）
 */
const perp_t_of_n = (nx: FX, ny: FX): readonly [FX, FX] => [ny, sub(ZERO, nx)];

/**
 * Check if body is static (infinite mass)
 * 检查物体是否为静态（无限质量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Precomputed constraint data for efficient solving
 * 预计算的约束数据，用于高效求解
 */
interface PrecomputedConstraint {
  rax: FX;
  ray: FX;
  rbx: FX;
  rby: FX;
  tx: FX;
  ty: FX;
  mN: FX;   // Effective normal mass
  mT: FX;   // Effective tangent mass
  mu: FX;   // Combined friction coefficient
  e: FX;    // Combined restitution coefficient
}

/**
 * 2D Gauss-Seidel Physics Solver System
 * 2D高斯-赛德尔物理解算器系统
 */
export const SolverGS2D = system(
  'phys.solver.gs2d',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const contactsRes = world.getResource(Contacts2D) as Contacts2D | undefined;
    if (!contactsRes || contactsRes.list.length === 0) return;

    const dtFX: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1 / 60);
    const nextPrev = new Map<string, { jn: FX; jt: FX }>();
    const bodyStore = world.getStore(getComponentType(Body2D));

    // Warm-start: apply previous frame accumulated impulses to velocities
    // Warm-start：将上一帧累积冲量应用到速度
    for (const c of contactsRes.list) {
      const { a, b, nx, ny, px, py, jn, jt } = c;

      const ba = world.getComponent(a, Body2D) as Body2D;
      const bb = world.getComponent(b, Body2D) as Body2D;
      if (!ba || !bb) continue;
      if (isStatic(ba) && isStatic(bb)) continue;

      const rax = sub(px, ba.px);
      const ray = sub(py, ba.py);
      const rbx = sub(px, bb.px);
      const rby = sub(py, bb.py);

      const [tx, ty] = perp_t_of_n(nx, ny);
      const Px = add(mul(nx, jn), mul(tx, jt));
      const Py = add(mul(ny, jn), mul(ty, jt));

      if (!isStatic(ba)) {
        ba.vx = sub(ba.vx, mul(Px, ba.invMass));
        ba.vy = sub(ba.vy, mul(Py, ba.invMass));
        const dwA = mul(cross_r_v(rax, ray, Px, Py), ba.invI);
        ba.w = sub(ba.w, dwA);
      }
      if (!isStatic(bb)) {
        bb.vx = add(bb.vx, mul(Px, bb.invMass));
        bb.vy = add(bb.vy, mul(Py, bb.invMass));
        const dwB = mul(cross_r_v(rbx, rby, Px, Py), bb.invI);
        bb.w = add(bb.w, dwB);
      }
    }

    // Precompute constraint data for efficient solving
    // 预计算约束数据以提高求解效率
    const precomp = new Array<PrecomputedConstraint | null>(contactsRes.list.length);
    for (let i = 0; i < contactsRes.list.length; i++) {
      const c = contactsRes.list[i];
      const ba = world.getComponent(c.a, Body2D) as Body2D;
      const bb = world.getComponent(c.b, Body2D) as Body2D;
      if (!ba || !bb) {
        precomp[i] = null;
        continue;
      }

      const rax = sub(c.px, ba.px);
      const ray = sub(c.py, ba.py);
      const rbx = sub(c.px, bb.px);
      const rby = sub(c.py, bb.py);
      const [tx, ty] = perp_t_of_n(c.nx, c.ny);

      // Effective normal mass
      // 有效法向质量
      const rnA = cross_r_v(rax, ray, c.nx, c.ny);
      const rnB = cross_r_v(rbx, rby, c.nx, c.ny);
      let kN = add(ba.invMass, bb.invMass);
      if (ba.invI) kN = add(kN, mul(rnA, mul(rnA, ba.invI)));
      if (bb.invI) kN = add(kN, mul(rnB, mul(rnB, bb.invI)));
      const mN = kN ? div(ONE, kN) : ZERO;

      // Effective tangent mass
      // 有效切向质量
      const rtA = cross_r_v(rax, ray, tx, ty);
      const rtB = cross_r_v(rbx, rby, tx, ty);
      let kT = add(ba.invMass, bb.invMass);
      if (ba.invI) kT = add(kT, mul(rtA, mul(rtA, ba.invI)));
      if (bb.invI) kT = add(kT, mul(rtB, mul(rtB, bb.invI)));
      const mT = kT ? div(ONE, kT) : ZERO;

      // Combined material properties (deterministic: average)
      // 组合材质属性（确定性：平均值）
      const mu = div(add(ba.friction, bb.friction), f(2));
      let e = ba.restitution > bb.restitution ? ba.restitution : bb.restitution;

      // Speculative contacts should not bounce (prevent premature rebound)
      // 推测接触不应产生回弹（防止过早反弹）
      const isSpeculative = (c as any).speculative === 1;
      if (isSpeculative) {
        e = ZERO; // No restitution for speculative contacts
      }

      precomp[i] = { rax, ray, rbx, rby, tx, ty, mN, mT, mu, e };
    }

    // Velocity constraint solving with fixed iteration count and order
    // 使用固定迭代次数和顺序的速度约束求解
    for (let it = 0; it < ITER_N; it++) {
      for (let i = 0; i < contactsRes.list.length; i++) {
        const c = contactsRes.list[i];
        const pc = precomp[i];
        if (!pc) continue;

        const ba = world.getComponent(c.a, Body2D) as Body2D;
        const bb = world.getComponent(c.b, Body2D) as Body2D;
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

        // Normal constraint
        // 法向约束
        const vn = dot(rvx, rvy, c.nx, c.ny);
        const bias = (c.pen > 0) ? mul(BAUMGARTE, div(c.pen, dtFX)) : ZERO;
        const bounce = (sub(ZERO, vn) > RESTIT_THRESH) ? mul(pc.e, sub(ZERO, vn)) : ZERO;

        const jnCand = mul(pc.mN, sub(ZERO, add(vn, add(bias, bounce))));
        const jnNew = jnCand > 0 ? add(c.jn, jnCand) : c.jn;
        const dJn = sub(jnNew, c.jn);

        if (dJn !== 0) {
          const Px = mul(c.nx, dJn);
          const Py = mul(c.ny, dJn);

          if (!isStatic(ba)) {
            ba.vx = sub(ba.vx, mul(Px, ba.invMass));
            ba.vy = sub(ba.vy, mul(Py, ba.invMass));
            ba.w = sub(ba.w, mul(cross_r_v(pc.rax, pc.ray, Px, Py), ba.invI));
          }
          if (!isStatic(bb)) {
            bb.vx = add(bb.vx, mul(Px, bb.invMass));
            bb.vy = add(bb.vy, mul(Py, bb.invMass));
            bb.w = add(bb.w, mul(cross_r_v(pc.rbx, pc.rby, Px, Py), bb.invI));
          }
          c.jn = jnNew;
        }
      }
    }

    // Friction constraint solving with fixed iteration count and order
    // 使用固定迭代次数和顺序的摩擦约束求解
    for (let it = 0; it < ITER_T; it++) {
      for (let i = 0; i < contactsRes.list.length; i++) {
        const c = contactsRes.list[i];
        const pc = precomp[i];
        if (!pc) continue;

        const ba = world.getComponent(c.a, Body2D) as Body2D;
        const bb = world.getComponent(c.b, Body2D) as Body2D;
        if (!ba || !bb) continue;

        // Recalculate relative velocity
        // 重新计算相对速度
        const [wxra_x, wxra_y] = cross_w_r(ba.w, pc.rax, pc.ray);
        const [wxrb_x, wxrb_y] = cross_w_r(bb.w, pc.rbx, pc.rby);
        const vax = add(ba.vx, wxra_x);
        const vay = add(ba.vy, wxra_y);
        const vbx = add(bb.vx, wxrb_x);
        const vby = add(bb.vy, wxrb_y);
        const rvx = sub(vbx, vax);
        const rvy = sub(vby, vay);

        const vt = dot(rvx, rvy, pc.tx, pc.ty);
        const jtCand = mul(pc.mT, sub(ZERO, vt));
        const jtTarget = add(c.jt, jtCand);

        // Coulomb friction cone constraint: |jt| <= mu * jn
        // 库仑摩擦锥约束：|jt| <= mu * jn
        const cap = mul(pc.mu, c.jn);
        const jtNew = clamp(jtTarget, sub(ZERO, cap), cap);
        const dJt = sub(jtNew, c.jt);

        if (dJt !== 0) {
          const Px = mul(pc.tx, dJt);
          const Py = mul(pc.ty, dJt);

          if (!isStatic(ba)) {
            ba.vx = sub(ba.vx, mul(Px, ba.invMass));
            ba.vy = sub(ba.vy, mul(Py, ba.invMass));
            ba.w = sub(ba.w, mul(cross_r_v(pc.rax, pc.ray, Px, Py), ba.invI));
          }
          if (!isStatic(bb)) {
            bb.vx = add(bb.vx, mul(Px, bb.invMass));
            bb.vy = add(bb.vy, mul(Py, bb.invMass));
            bb.w = add(bb.w, mul(cross_r_v(pc.rbx, pc.rby, Px, Py), bb.invI));
          }
          c.jt = jtNew;
        }
      }
    }

    // Update warm-start cache with deterministic keys
    // 使用确定性键更新warm-start缓存
    for (const c of contactsRes.list) {
      const { a, b } = c;
      const { key } = makePairKey(world, a, b);
      nextPrev.set(key, { jn: c.jn, jt: c.jt });
    }
    contactsRes.prev = nextPrev;

    // Mark Body2D components as changed for downstream change tracking
    // 标记Body2D组件为已更改，用于下游变更跟踪
    if (bodyStore && bodyStore.markChanged) {
      for (const c of contactsRes.list) {
        bodyStore.markChanged(c.a, world.frame);
        bodyStore.markChanged(c.b, world.frame);
      }
    }
  }
);