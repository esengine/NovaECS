/**
 * Build Joints Distance 2D System
 * 构建距离关节2D系统
 *
 * Reads JointDistance2D + Body2D, applies stable sorting using (a,b) pairKey + joint entity id.
 * Pre-computes rA/rB, direction n, effective mass mN, bias and gamma.
 * Skips sleeping pairs directly; one awake + one sleeping → wake up (consistent with contacts).
 * Joints with rest < 0 are initialized with current distance on first frame.
 *
 * 读取JointDistance2D + Body2D，使用(a,b)的pairKey加上关节实体id进行稳定排序。
 * 预计算rA/rB、方向n、有效质量mN、偏置和gamma。
 * 直接跳过睡眠对；一醒一睡→唤醒（与接触一致）。
 * rest<0的关节在第一帧用当前距离初始化。
 */

import { Body2D } from '../../components/Body2D';
import { JointDistance2D } from '../../components/JointDistance2D';
import { Sleep2D } from '../../components/Sleep2D';
import { JointBatch2D } from '../../resources/JointBatch2D';
import type { JointRow } from '../../resources/JointBatch2D';
import { makePairKey } from '../../determinism/PairKey';
import { system, SystemContext } from '../../core/System';
import { getComponentType } from '../../core/ComponentRegistry';
import {
  FX, add, sub, mul, div, abs, f, ONE, ZERO
} from '../../math/fixed';

/**
 * Fast approximate length calculation using Manhattan + correction
 * 使用曼哈顿距离加修正的快速近似长度计算
 */
const approxLen = (dx: FX, dy: FX): FX => {
  const ax = abs(dx);
  const ay = abs(dy);
  const hi = ax > ay ? ax : ay;
  const lo = ax > ay ? ay : ax;

  if (hi === 0) return ZERO;

  const lo2_over_hi = div(mul(lo, lo), hi);
  return add(hi, mul(f(0.375), lo2_over_hi));
};

/**
 * Cross product for constraint calculations: r × n
 * 约束计算的叉积：r × n
 */
const cross_r_n = (rx: FX, ry: FX, nx: FX, ny: FX): FX =>
  sub(mul(rx, ny), mul(ry, nx));

/**
 * Check if body is static (infinite mass)
 * 检查物体是否为静态（无限质量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Wake up a sleeping body
 * 唤醒睡眠的物体
 */
const wakeBody = (world: any, entityId: number, sleep: Sleep2D, body: Body2D): void => {
  if (sleep.sleeping) {
    sleep.sleeping = 0;
    sleep.timer = ZERO;
    body.awake = 1;

    // Update components in world
    world.setComponent(entityId, Sleep2D, sleep);
    world.setComponent(entityId, Body2D, body);
  }
};

/**
 * Build Joints Distance 2D System
 * 构建距离关节2D系统
 */
export const BuildJointsDistance2D = system(
  'phys.joint.build.distance',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const dt: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1/60);

    // Get or create joint batch resource
    let batch = world.getResource(JointBatch2D) as JointBatch2D | undefined;
    if (!batch) {
      batch = new JointBatch2D();
      world.setResource(JointBatch2D, batch);
    }

    // Clear previous batch
    batch.clear();

    // Collect joints with deterministic sorting keys
    // 收集关节并生成确定性排序键
    const rows: Array<{
      key: string;
      jid: number;
      jd: JointDistance2D;
    }> = [];

    world.query(JointDistance2D).forEach((entityId: number, jd: JointDistance2D) => {
      const { a, b } = jd;
      const { key } = makePairKey(world, a, b);
      rows.push({
        key,
        jid: entityId,
        jd
      });
    });

    // Stable deterministic sorting: first by pair key, then by joint entity ID
    // 稳定的确定性排序：首先按对键，然后按关节实体ID
    rows.sort((A, B) => {
      const keyCompare = A.key.localeCompare(B.key);
      return keyCompare !== 0 ? keyCompare : (A.jid - B.jid);
    });

    const bodyStore = world.getStore(getComponentType(Body2D));
    const jointStore = world.getStore(getComponentType(JointDistance2D));

    // Process each joint in sorted order
    // 按排序顺序处理每个关节
    for (const row of rows) {
      const { jd, jid } = row;
      const a = jd.a;
      const b = jd.b;

      const ba = world.getComponent(a, Body2D) as Body2D | undefined;
      const bb = world.getComponent(b, Body2D) as Body2D | undefined;
      if (!ba || !bb) continue;

      // Skip if both bodies are static
      // 如果两个物体都是静态的则跳过
      if (isStatic(ba) && isStatic(bb)) continue;

      // Handle sleeping logic (consistent with contacts)
      // 处理睡眠逻辑（与接触一致）
      const sa = world.getComponent(a, Sleep2D) as Sleep2D | undefined;
      const sb = world.getComponent(b, Sleep2D) as Sleep2D | undefined;

      const aSleep = !!(sa && sa.sleeping);
      const bSleep = !!(sb && sb.sleeping);

      // Skip if both bodies are sleeping
      // 如果两个物体都在睡眠则跳过
      if (aSleep && bSleep) continue;

      // Wake up sleeping body if other is awake (one awake + one sleeping → wake up)
      // 如果另一个醒着则唤醒睡眠的物体（一醒一睡→唤醒）
      if (aSleep && sa) {
        wakeBody(world, a, sa, ba);
      }
      if (bSleep && sb) {
        wakeBody(world, b, sb, bb);
      }

      // Calculate world space anchor points
      // 计算世界空间锚点
      const pax = add(ba.px, jd.ax);
      const pay = add(ba.py, jd.ay);
      const pbx = add(bb.px, jd.bx);
      const pby = add(bb.py, jd.by);

      const dx = sub(pbx, pax);
      const dy = sub(pby, pay);

      // Calculate distance with protection against zero
      // 计算距离并防止零值
      const dist = (dx | dy) ? approxLen(dx, dy) : ONE;

      // Normalize direction vector
      // 归一化方向向量
      const nx = div(dx, dist);
      const ny = div(dy, dist);

      // Initialize rest length if needed (rest < 0)
      // 如果需要则初始化静止长度（rest < 0）
      let rest = jd.rest;
      if ((jd.rest as number) < 0 && jd.initialized === 0) {
        rest = dist;
        jd.rest = dist;
        jd.initialized = 1;

        // Update component in world
        world.setComponent(jid, JointDistance2D, jd);
      }

      // Skip if rest is still invalid
      // 如果rest仍然无效则跳过
      if ((rest as number) < 0) continue;

      // Calculate relative positions from body centers
      // 计算相对于物体中心的位置
      const rax = sub(pax, ba.px);
      const ray = sub(pay, ba.py);
      const rbx = sub(pbx, bb.px);
      const rby = sub(pby, bb.py);

      // Calculate effective mass (same form as contact normal)
      // 计算有效质量（与接触法向相同形式）
      const rnA = cross_r_n(rax, ray, nx, ny);
      const rnB = cross_r_n(rbx, rby, nx, ny);

      let k = add(ba.invMass, bb.invMass);
      if (ba.invI) k = add(k, mul(rnA, mul(rnA, ba.invI)));
      if (bb.invI) k = add(k, mul(rnB, mul(rnB, bb.invI)));

      // Softening γ: add it to k (mN = 1/(k+γ/dt))
      // 软化γ：将其加到k中（mN = 1/(k+γ/dt)）
      const gamma = jd.gamma ? div(jd.gamma, dt) : ZERO;
      const denom = add(k, gamma);
      const mN = denom > 0 ? div(ONE, denom) : ZERO;

      // Constraint C = |d| - rest, Baumgarte bias: β * C / dt
      // 约束C = |d| - rest，Baumgarte偏置：β * C / dt
      const C = sub(dist, rest);
      const bias = jd.beta ? mul(jd.beta, div(C, dt)) : ZERO;

      // Create batch row
      // 创建批次行
      const jointRow: JointRow = {
        e: jid,
        a,
        b,
        rax,
        ray,
        rbx,
        rby,
        nx,
        ny,
        rest,
        mN,
        bias,
        gamma: jd.gamma,
        breakImpulse: jd.breakImpulse,
        broken: jd.broken
      };

      batch.addRow(jointRow);
    }

    // Mark components as changed for downstream systems
    // 为下游系统标记组件已更改
    if (bodyStore && bodyStore.markChanged) {
      for (const jointRow of batch.list) {
        bodyStore.markChanged(jointRow.a, world.frame);
        bodyStore.markChanged(jointRow.b, world.frame);
      }
    }

    if (jointStore && jointStore.markChanged) {
      for (const jointRow of batch.list) {
        jointStore.markChanged(jointRow.e, world.frame);
      }
    }
  }
)
  .stage('update')
  .after('phys.narrowphase')
  .before('phys.solver.joints2d')
  .build();