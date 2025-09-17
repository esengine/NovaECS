/**
 * Joint Batch Builder System for 2D Physics
 * 2D物理关节批处理构建系统
 *
 * Builds optimized JointBatch2D from JointConstraints2D for efficient solving.
 * Pre-computes constraint data and caches it for the solver, improving performance
 * by reducing repeated calculations during constraint iterations.
 * 从JointConstraints2D构建优化的JointBatch2D以高效求解。
 * 预计算约束数据并为求解器缓存，通过减少约束迭代期间的重复计算来提高性能。
 */

import { Body2D } from '../../components/Body2D';
import { JointDistance2D } from '../../components/JointDistance2D';
import { JointConstraints2D } from '../../resources/JointConstraints2D';
import { JointBatch2D } from '../../resources/JointBatch2D';
import type { JointRow } from '../../resources/JointBatch2D';
import {
  FX, add, sub, mul, div, f, ONE, ZERO, sqrt
} from '../../math/fixed';
import { system, SystemContext } from '../../core/System';

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
 * Joint Batch Builder System
 * 关节批处理构建系统
 */
export const JointBatchBuilder2D = system(
  'phys.joints.batch',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const jointsRes = world.getResource(JointConstraints2D) as JointConstraints2D | undefined;

    // Get or create joint batch resource
    let batchRes = world.getResource(JointBatch2D) as JointBatch2D | undefined;
    if (!batchRes) {
      batchRes = new JointBatch2D();
      world.setResource(JointBatch2D, batchRes);
    }

    // Clear previous batch
    batchRes.clear();

    // Early exit if no joints
    if (!jointsRes || jointsRes.list.length === 0) return;

    const dtFX: FX = world.getFixedDtFX ? world.getFixedDtFX() : f(1 / 60);

    // Reserve capacity for efficiency
    batchRes.reserve(jointsRes.list.length);

    // Process each joint and build batch rows
    for (const jointEntity of jointsRes.list) {
      const joint = world.getComponent(jointEntity, JointDistance2D) as JointDistance2D;
      if (!joint || joint.broken === 1) continue;

      const ba = world.getComponent(joint.a, Body2D) as Body2D;
      const bb = world.getComponent(joint.b, Body2D) as Body2D;
      if (!ba || !bb) continue;
      if (isStatic(ba) && isStatic(bb)) continue;

      // Auto-initialize rest length if needed
      if (joint.rest < 0 && joint.initialized === 0) {
        const wax = add(ba.px, joint.ax);
        const way = add(ba.py, joint.ay);
        const wbx = add(bb.px, joint.bx);
        const wby = add(bb.py, joint.by);
        const currentDist = distance(wax, way, wbx, wby);

        joint.rest = currentDist;
        joint.initialized = 1;
        world.replaceComponent(jointEntity, JointDistance2D, joint);
      }

      // Skip if rest length is still invalid
      if (joint.rest < 0) continue;

      // Calculate world space anchor points
      const wax = add(ba.px, joint.ax);
      const way = add(ba.py, joint.ay);
      const wbx = add(bb.px, joint.bx);
      const wby = add(bb.py, joint.by);

      const rax = sub(wax, ba.px);
      const ray = sub(way, ba.py);
      const rbx = sub(wbx, bb.px);
      const rby = sub(wby, bb.py);

      const currentDist = distance(wax, way, wbx, wby);
      if (currentDist === 0) continue;

      // Constraint direction (unit vector from A to B)
      const nx = div(sub(wbx, wax), currentDist);
      const ny = div(sub(wby, way), currentDist);

      // Constraint value: C = currentDist - restDist
      const C = sub(currentDist, joint.rest);

      // Effective constraint mass
      const rnA = cross_r_v(rax, ray, nx, ny);
      const rnB = cross_r_v(rbx, rby, nx, ny);
      let k = add(ba.invMass, bb.invMass);
      if (ba.invI) k = add(k, mul(rnA, mul(rnA, ba.invI)));
      if (bb.invI) k = add(k, mul(rnB, mul(rnB, bb.invI)));
      k = add(k, joint.gamma); // Add constraint softening
      const mN = k > 0 ? div(ONE, k) : ZERO;

      // Baumgarte bias for position drift correction
      const bias = mul(joint.beta, div(C, dtFX));

      // Create batch row
      const row: JointRow = {
        e: jointEntity,
        a: joint.a,
        b: joint.b,
        rax,
        ray,
        rbx,
        rby,
        nx,
        ny,
        rest: joint.rest,
        mN,
        bias,
        gamma: joint.gamma,
        breakImpulse: joint.breakImpulse,
        broken: joint.broken
      };

      batchRes.addRow(row);
    }
  }
)
  .stage('update')
  .after('phys.narrowphase')
  .before('phys.solver.joints2d')
  .build();