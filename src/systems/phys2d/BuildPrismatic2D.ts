/**
 * Prismatic Joint Builder System for 2D Physics
 * 2D物理滑动关节构建系统
 *
 * Precomputes constraint data for prismatic joints with stable sorting and sleep handling.
 * Builds PrismaticBatch2D resource for efficient constraint solving.
 * 为滑动关节预计算约束数据，具有稳定排序和睡眠处理。
 * 构建PrismaticBatch2D资源以进行高效约束求解。
 */

import { Body2D } from '../../components/Body2D';
import { Sleep2D } from '../../components/Sleep2D';
import { PrismaticJoint2D } from '../../components/PrismaticJoint2D';
import { PrismaticBatch2D } from '../../resources/PrismaticBatch2D';
import { makePairKey } from '../../determinism/PairKey';
import {
  FX, add, sub, mul, div, abs, f, ONE, ZERO, toFloat
} from '../../math/fixed';
import { system, SystemContext } from '../../core/System';

/**
 * Cross product: r × n (returns scalar)
 * 叉积：r × n（返回标量）
 */
const cross_r_n = (rx: FX, ry: FX, nx: FX, ny: FX): FX =>
  sub(mul(rx, ny), mul(ry, nx)) as FX;

/**
 * Fast approximation for vector normalization using Manhattan distance + correction
 * 使用曼哈顿距离+修正的快速向量归一化近似
 */
const fastNormalize = (x: FX, y: FX): FX => {
  const sx = abs(x);
  const sy = abs(y);
  const hi = sx > sy ? sx : sy;
  const lo = sx > sy ? sy : sx;
  if (hi === 0) return ONE;

  // Manhattan approximation with one correction step
  const len = add(hi, div(mul(lo, lo), hi));
  return len || ONE;
};

/**
 * Prismatic Joint Builder System
 * 滑动关节构建系统
 */
export const BuildPrismatic2D = system(
  'phys.joint.build.prismatic',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get fixed timestep
    const dt: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1 / 60);

    // Get or create batch resource
    let batch = world.getResource(PrismaticBatch2D) as PrismaticBatch2D | undefined;
    if (!batch) {
      batch = new PrismaticBatch2D();
      world.setResource(PrismaticBatch2D, batch);
    }
    batch.clear();

    // Collect all prismatic joints with stable sorting
    const rows: Array<{ key: string; jid: number; j: PrismaticJoint2D }> = [];

    const joints = world.query(PrismaticJoint2D);
    joints.forEach((jointEntity: number, joint: PrismaticJoint2D) => {
      if (joint.broken === 1) return; // Skip broken joints

      const { key } = makePairKey(world, joint.a, joint.b);
      rows.push({ key, jid: jointEntity, j: joint });
    });

    // Stable sort by pair key, then by joint entity ID
    rows.sort((A, B) => {
      const keyCompare = A.key.localeCompare(B.key);
      return keyCompare !== 0 ? keyCompare : (A.jid - B.jid);
    });

    // Process each joint
    for (const row of rows) {
      const joint = row.j;
      const entityA = joint.a as number;
      const entityB = joint.b as number;

      const bodyA = world.getComponent(entityA, Body2D) as Body2D | undefined;
      const bodyB = world.getComponent(entityB, Body2D) as Body2D | undefined;
      if (!bodyA || !bodyB) continue;

      // Handle sleeping bodies
      const sleepA = world.getComponent(entityA, Sleep2D) as Sleep2D | undefined;
      const sleepB = world.getComponent(entityB, Sleep2D) as Sleep2D | undefined;
      const aSleeping = !!(sleepA && sleepA.sleeping);
      const bSleeping = !!(sleepB && sleepB.sleeping);

      // Skip if both bodies are sleeping
      if (aSleeping && bSleeping) continue;

      // Wake up sleeping bodies when one is awake
      if (aSleeping && sleepA) {
        sleepA.sleeping = 0;
        sleepA.timer = ZERO;
        world.replaceComponent(entityA, Sleep2D, sleepA);
      }
      if (bSleeping && sleepB) {
        sleepB.sleeping = 0;
        sleepB.timer = ZERO;
        world.replaceComponent(entityB, Sleep2D, sleepB);
      }

      // Calculate world-space anchor points
      const pax = add(bodyA.px, joint.ax);
      const pay = add(bodyA.py, joint.ay);
      const pbx = add(bodyB.px, joint.bx);
      const pby = add(bodyB.py, joint.by);

      // Calculate anchor offsets from centers of mass
      const rax = sub(pax, bodyA.px);
      const ray = sub(pay, bodyA.py);
      const rbx = sub(pbx, bodyB.px);
      const rby = sub(pby, bodyB.py);

      // Normalize sliding axis
      let ax = joint.axisX;
      let ay = joint.axisY;
      const axisLength = fastNormalize(ax, ay);
      ax = div(ax, axisLength);
      ay = div(ay, axisLength);

      // Calculate perpendicular axis (90 degree rotation)
      const px = sub(ZERO, ay);
      const py = ax;

      // Calculate effective mass for perpendicular constraint
      const rnA_p = cross_r_n(rax, ray, px, py);
      const rnB_p = cross_r_n(rbx, rby, px, py);
      let kPerp = add(bodyA.invMass, bodyB.invMass);
      if (bodyA.invI !== 0) kPerp = add(kPerp, mul(rnA_p, mul(rnA_p, bodyA.invI)));
      if (bodyB.invI !== 0) kPerp = add(kPerp, mul(rnB_p, mul(rnB_p, bodyB.invI)));
      const mPerp = kPerp > 0 ? div(ONE, kPerp) : ZERO;

      // Calculate effective mass for axial constraint with softening
      const rnA_a = cross_r_n(rax, ray, ax, ay);
      const rnB_a = cross_r_n(rbx, rby, ax, ay);
      let kAxis = add(bodyA.invMass, bodyB.invMass);
      if (bodyA.invI !== 0) kAxis = add(kAxis, mul(rnA_a, mul(rnA_a, bodyA.invI)));
      if (bodyB.invI !== 0) kAxis = add(kAxis, mul(rnB_a, mul(rnB_a, bodyB.invI)));

      // Add constraint softening
      const gamma = joint.gamma !== 0 ? div(joint.gamma, dt) : ZERO;
      kAxis = add(kAxis, gamma);
      const mAxis = kAxis > 0 ? div(ONE, kAxis) : ZERO;

      // Calculate perpendicular bias for position drift correction
      const Cx = sub(pbx, pax);
      const Cy = sub(pby, pay);
      const Cperp = add(mul(px, Cx), mul(py, Cy));
      const biasPerp = joint.beta !== 0 ? div(mul(joint.beta, Cperp), dt) : ZERO;

      // Handle position limits along the sliding axis
      let limitActive: 0 | 1 = 0;
      let limitSign: -1 | 0 | 1 = 0;
      let biasAxis: FX = ZERO;

      if (joint.enableLimit === 1) {
        // Current translation along the axis
        // 计算Body A相对于Body B的位移
        const translation = sub(ZERO, add(mul(ax, Cx), mul(ay, Cy)));


        if (translation < joint.lower) {
          limitActive = 1;
          limitSign = -1; // Need to push in positive direction
          const penetration = sub(translation, joint.lower); // Negative value
          biasAxis = joint.beta !== 0 ? div(mul(joint.beta, penetration), dt) : ZERO;
        } else if (translation > joint.upper) {
          limitActive = 1;
          limitSign = 1; // Need to push in negative direction
          const penetration = sub(translation, joint.upper); // Positive value
          biasAxis = joint.beta !== 0 ? div(mul(joint.beta, penetration), dt) : ZERO;
        }
      }


      // Add constraint row to batch
      batch.addRow({
        e: row.jid as any,
        a: entityA as any,
        b: entityB as any,
        rax,
        ray,
        rbx,
        rby,
        ax,
        ay,
        px,
        py,
        mPerp,
        mAxis,
        biasPerp,
        limitActive,
        limitSign,
        biasAxis,
        gamma
      });
    }
  }
)
  .stage('update')
  .before('phys.solver.prismatic2d')
  .after('phys.broadphase')
  .build();