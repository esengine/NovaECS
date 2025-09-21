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
import { SolverTimeScale } from '../../resources/SolverTimeScale';
import { ContactWithMaterial } from './BuildContactMaterial2D';
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
    const contactsRes = world.getResource(Contacts2D);
    if (!contactsRes || contactsRes.list.length === 0) return;

    const dtFX: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1 / 60);

    // Get time scale for sub-stepping support
    // 获取子步长支持的时间缩放
    const timeScale = world.getResource(SolverTimeScale);
    const effectiveDt = timeScale ? mul(dtFX, timeScale.value) : dtFX;

    const bodyStore = world.getStore(getComponentType(Body2D));

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

      // Get material properties from BuildContactMaterial2D if available
      // 从BuildContactMaterial2D获取材质属性（如果可用）
      const contactWithMat = c as ContactWithMaterial;
      const mu = contactWithMat.muD || div(add(ba.friction, bb.friction), f(2));
      let e = contactWithMat.effRest || (ba.restitution > bb.restitution ? ba.restitution : bb.restitution);

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

        // Normal constraint with time-scaled bias
        // 带时间缩放偏置的法向约束
        const vn = dot(rvx, rvy, c.nx, c.ny);
        const bias = (c.pen > 0) ? mul(BAUMGARTE, div(c.pen, effectiveDt)) : ZERO;

        // Use effective restitution from BuildContactMaterial2D if available
        // 使用BuildContactMaterial2D计算的有效恢复系数（如果可用）
        const contactWithMat = c as ContactWithMaterial;
        let bounce = ZERO;
        if (contactWithMat.effRest && contactWithMat.effRest > 0) {
          // Use pre-calculated effective restitution (already threshold-checked)
          // 使用预计算的有效恢复系数（已检查阈值）
          bounce = mul(contactWithMat.effRest, sub(ZERO, vn));
        } else if (sub(ZERO, vn) > RESTIT_THRESH) {
          // Fallback to old method if BuildContactMaterial2D hasn't run
          // 如果BuildContactMaterial2D未运行则回退到旧方法
          bounce = mul(pc.e, sub(ZERO, vn));
        }

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

    // Impulse accumulation is maintained in contact.jn/jt for ContactsCommit2D
    // 冲量累积保存在contact.jn/jt中供ContactsCommit2D使用

    // Mark Body2D components as changed for downstream change tracking
    // 标记Body2D组件为已更改，用于下游变更跟踪
    if (bodyStore && bodyStore.markChanged) {
      for (const c of contactsRes.list) {
        bodyStore.markChanged(c.a, world.frame);
        bodyStore.markChanged(c.b, world.frame);
      }
    }
  }
)
  .stage('update')
  .after('phys.contacts.buildMaterial')
  .before('phys.joint.build.distance')
  .build();