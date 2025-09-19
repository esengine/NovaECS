/**
 * Build Revolute Joints 2D System
 * 构建铰链关节2D系统
 *
 * Collects RevoluteJoint2D components, applies stable sorting using (a,b) pairKey + joint entity id.
 * Precomputes rA/rB, inverse effective mass matrix, bias and gamma.
 * Skips sleeping pairs directly; one awake + one sleeping → wake up (consistent with contacts).
 *
 * 收集RevoluteJoint2D组件，使用(a,b)的pairKey加上关节实体id进行稳定排序。
 * 预计算rA/rB、逆有效质量矩阵、偏置和gamma。
 * 直接跳过睡眠对；一醒一睡→唤醒（与接触一致）。
 */

import { Body2D } from '../../components/Body2D';
import { Sleep2D } from '../../components/Sleep2D';
import type { World } from '../../core/World';
import { RevoluteJoint2D } from '../../components/RevoluteJoint2D';
import { RevoluteBatch2D } from '../../resources/RevoluteBatch2D';
import type { RevoluteRow } from '../../resources/RevoluteBatch2D';
import { makePairKey } from '../../determinism/PairKey';
import { system, SystemContext } from '../../core/System';
import { getComponentType } from '../../core/ComponentRegistry';
import {
  FX, add, sub, mul, div, f, ZERO
} from '../../math/fixed';

/**
 * Compute inverse of 2x2 symmetric matrix
 * 计算2x2对称矩阵的逆矩阵
 */
const invSym2x2 = (a: FX, b: FX, c: FX): [FX, FX, FX] => {
  // 返回 (a b; b c)^(-1) 的 (im00, im01, im11)
  // det = a*c - b*b
  const det = sub(mul(a, c), mul(b, b));
  if (!det) return [ZERO, ZERO, ZERO];
  return [div(c, det), div((0 - b), det), div(a, det)];
};

/**
 * Check if body is static (infinite mass)
 * 检查物体是否为静态（无限质量）
 */
const isStatic = (b: Body2D): boolean => (b.invMass | b.invI) === 0;

/**
 * Wake up a sleeping body
 * 唤醒睡眠的物体
 */
const wakeBody = (world: World, entityId: number, sleep: Sleep2D, body: Body2D): void => {
  if (sleep.sleeping) {
    sleep.sleeping = 0;
    sleep.timer = ZERO;
    body.awake = 1;

    // Update components in world
    world.replaceComponent(entityId, Sleep2D, sleep);
    world.replaceComponent(entityId, Body2D, body);
  }
};

/**
 * Build Revolute Joints 2D System
 * 构建铰链关节2D系统
 */
export const BuildRevolute2D = system(
  'phys.joint.build.revolute',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const dt: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1/60);

    // Get or create joint batch resource
    let batch = world.getResource(RevoluteBatch2D);
    if (!batch) {
      batch = new RevoluteBatch2D();
      world.setResource(RevoluteBatch2D, batch);
    }

    // Clear previous batch
    batch.clear();

    // Collect joints with deterministic sorting keys
    // 收集关节并生成确定性排序键
    const rows: Array<{
      key: string;
      jid: number;
      j: RevoluteJoint2D;
    }> = [];

    world.query(RevoluteJoint2D).forEach((entityId: number, j: RevoluteJoint2D) => {
      if (j.broken === 1) return; // Skip broken joints

      const { a, b } = j;
      const { key } = makePairKey(world, a, b);
      rows.push({
        key,
        jid: entityId,
        j
      });
    });

    // Stable deterministic sorting: first by pair key, then by joint entity ID
    // 稳定的确定性排序：首先按对键，然后按关节实体ID
    rows.sort((A, B) => {
      const keyCompare = A.key.localeCompare(B.key);
      return keyCompare !== 0 ? keyCompare : (A.jid - B.jid);
    });

    const bodyStore = world.getStore(getComponentType(Body2D));
    const jointStore = world.getStore(getComponentType(RevoluteJoint2D));

    // Process each joint in sorted order
    // 按排序顺序处理每个关节
    for (const row of rows) {
      const { j, jid } = row;
      const a = j.a;
      const b = j.b;

      const ba = world.getComponent(a, Body2D);
      const bb = world.getComponent(b, Body2D);
      if (!ba || !bb) continue;

      // Skip if both bodies are static
      // 如果两个物体都是静态的则跳过
      if (isStatic(ba) && isStatic(bb)) continue;

      // Handle sleeping logic (consistent with contacts)
      // 处理睡眠逻辑（与接触一致）
      const sa = world.getComponent(a, Sleep2D);
      const sb = world.getComponent(b, Sleep2D);

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
      const pax = add(ba.px, j.ax);
      const pay = add(ba.py, j.ay);
      const pbx = add(bb.px, j.bx);
      const pby = add(bb.py, j.by);

      // Calculate relative positions from body centers
      // 计算相对于物体中心的位置
      const rax = sub(pax, ba.px);
      const ray = sub(pay, ba.py);
      const rbx = sub(pbx, bb.px);
      const rby = sub(pby, bb.py);

      // 有效质量矩阵 K
      // Effective mass matrix K:
      // K = [ mA+mB + iA*ray^2 + iB*rby^2,  -iA*rax*ray - iB*rbx*rby;
      //       symmetric                     mA+mB + iA*rax^2 + iB*rbx^2 ]
      let k00 = add(ba.invMass, bb.invMass);
      let k11 = add(ba.invMass, bb.invMass);
      let k01 = ZERO;

      // Add rotational contributions from body A
      if (ba.invI) {
        k00 = add(k00, mul(ray, mul(ray, ba.invI)));
        k11 = add(k11, mul(rax, mul(rax, ba.invI)));
        k01 = add(k01, (0 - mul(rax, mul(ray, ba.invI))));
      }

      // Add rotational contributions from body B
      if (bb.invI) {
        k00 = add(k00, mul(rby, mul(rby, bb.invI)));
        k11 = add(k11, mul(rbx, mul(rbx, bb.invI)));
        k01 = add(k01, (0 - mul(rbx, mul(rby, bb.invI))));
      }

      // 软化：K' = K + gamma*I，其中 gamma = j.gamma / dt
      // Softening: K' = K + gamma*I, where gamma = j.gamma / dt
      const gamma = j.gamma ? div(j.gamma, dt) : ZERO;
      k00 = add(k00, gamma);
      k11 = add(k11, gamma);

      // 求逆矩阵 - Compute inverse matrix
      const [im00, im01, im11] = invSym2x2(k00, k01, k11);

      // 位置误差 C = (pB + rB) - (pA + rA) → bias = beta * C / dt
      // Position error C = (pB + rB) - (pA + rA) → bias = beta * C / dt
      const Cx = sub(pbx, pax);
      const Cy = sub(pby, pay);
      const betaOverDt = j.beta ? div(j.beta, dt) : ZERO;
      const biasX = mul(betaOverDt, Cx);
      const biasY = mul(betaOverDt, Cy);

      // Create batch row
      // 创建批次行
      const revoluteRow: RevoluteRow = {
        e: jid,
        a,
        b,
        rax,
        ray,
        rbx,
        rby,
        im00,
        im01,
        im11,
        biasX,
        biasY,
        gamma: j.gamma
      };

      batch.addRow(revoluteRow);
    }

    // Mark components as changed for downstream systems
    // 为下游系统标记组件已更改
    if (bodyStore && bodyStore.markChanged) {
      for (const revoluteRow of batch.list) {
        bodyStore.markChanged(revoluteRow.a, world.frame);
        bodyStore.markChanged(revoluteRow.b, world.frame);
      }
    }

    if (jointStore && jointStore.markChanged) {
      for (const revoluteRow of batch.list) {
        jointStore.markChanged(revoluteRow.e, world.frame);
      }
    }
  }
)
  .stage('update')
  .after('phys.narrowphase')
  .before('phys.solver.joints2d')
  .build();