/**
 * Gauss-Seidel Prismatic Joint Constraint Solver for 2D Physics
 * 2D物理高斯-赛德尔滑动关节约束求解器
 *
 * Solves prismatic joint constraints with warm-start, fixed iteration count,
 * and stable ordering. Handles perpendicular constraints (equality) and
 * axial constraints (motor/limits with inequality projection).
 *
 * 求解滑动关节约束，具有热启动、固定迭代次数和稳定排序。
 * 处理垂直约束（等式）和轴向约束（电机/限位的不等式投影）。
 */

import { PrismaticBatch2D } from '../../resources/PrismaticBatch2D';
import { PrismaticJoint2D } from '../../components/PrismaticJoint2D';
import { Body2D } from '../../components/Body2D';
import { JointEvents2D } from './SolverGSJoints2D';
import {
  FX, add, sub, mul, div, abs, ZERO, f
} from '../../math/fixed';
import { system, SystemContext } from '../../core/System';
import { getComponentType } from '../../core/ComponentRegistry';

const ITER_P = 8; // Fixed prismatic joint iteration count
const SLOP = f(0.005); // 容差：5mm，避免在边界附近抖刹车

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
 * Gauss-Seidel Prismatic Joint Constraint Solver System
 * 高斯-赛德尔滑动关节约束求解器系统
 */
export const SolverGSPrismatic2D = system(
  'phys.solver.joint.prismatic',
  (ctx: SystemContext) => {
    const { world } = ctx;

    const batch = world.getResource(PrismaticBatch2D);
    if (!batch || batch.list.length === 0) return;

    // Get or create joint events resource
    let events = world.getResource(JointEvents2D);
    if (!events) {
      events = new JointEvents2D();
      world.setResource(JointEvents2D, events);
    }

    const bodyStore = world.getStore(getComponentType(Body2D));
    const jointStore = world.getStore(getComponentType(PrismaticJoint2D));

    // —— Warm-start phase ——
    // Apply accumulated impulses from previous frame
    // 热启动阶段 - 应用上一帧的累积冲量
    for (const row of batch.list) {
      const joint = world.getComponent(row.e, PrismaticJoint2D);
      if (!joint) continue;

      // Skip if no accumulated impulse
      if ((joint.jPerp | joint.jAxis) === 0) continue;

      const bodyA = world.getComponent(row.a, Body2D);
      const bodyB = world.getComponent(row.b, Body2D);
      if (!bodyA || !bodyB) continue;
      if (isStatic(bodyA) && isStatic(bodyB)) continue;

      // Apply perpendicular impulse (locks lateral motion)
      // 应用垂直冲量（锁定横向运动）
      if (joint.jPerp !== 0) {
        const Px = mul(row.px, joint.jPerp);
        const Py = mul(row.py, joint.jPerp);

        if (!isStatic(bodyA)) {
          bodyA.vx = sub(bodyA.vx, mul(Px, bodyA.invMass));
          bodyA.vy = sub(bodyA.vy, mul(Py, bodyA.invMass));
          bodyA.w = sub(bodyA.w, mul(cross_r_v(row.rax, row.ray, Px, Py), bodyA.invI));
          world.replaceComponent(row.a, Body2D, bodyA);
        }
        if (!isStatic(bodyB)) {
          bodyB.vx = add(bodyB.vx, mul(Px, bodyB.invMass));
          bodyB.vy = add(bodyB.vy, mul(Py, bodyB.invMass));
          bodyB.w = add(bodyB.w, mul(cross_r_v(row.rbx, row.rby, Px, Py), bodyB.invI));
          world.replaceComponent(row.b, Body2D, bodyB);
        }
      }

      // Warm-start axial jAxis clamp when limit is active
      // 热启动时对限位的jAxis先做一次夹紧
      if (joint.enableLimit === 1) {
        const pax = add(bodyA.px, row.rax);
        const pay = add(bodyA.py, row.ray);
        const pbx = add(bodyB.px, row.rbx);
        const pby = add(bodyB.py, row.rby);
        const tr = sub(ZERO, add(mul(row.ax, sub(pbx, pax)), mul(row.ay, sub(pby, pay))));

        if (tr < joint.lower && joint.jAxis > ZERO) joint.jAxis = ZERO; // 触下限，仅允许 j ≤ 0
        if (tr > joint.upper && joint.jAxis < ZERO) joint.jAxis = ZERO; // 触上限，仅允许 j ≥ 0
      }

      // Apply axial impulse (motor/limits along axis)
      // 应用轴向冲量（沿轴的电机/限位）
      if (joint.jAxis !== 0) {
        const Qx = mul(row.ax, joint.jAxis);
        const Qy = mul(row.ay, joint.jAxis);

        if (!isStatic(bodyA)) {
          bodyA.vx = sub(bodyA.vx, mul(Qx, bodyA.invMass));
          bodyA.vy = sub(bodyA.vy, mul(Qy, bodyA.invMass));
          bodyA.w = sub(bodyA.w, mul(cross_r_v(row.rax, row.ray, Qx, Qy), bodyA.invI));
          world.replaceComponent(row.a, Body2D, bodyA);
        }
        if (!isStatic(bodyB)) {
          bodyB.vx = add(bodyB.vx, mul(Qx, bodyB.invMass));
          bodyB.vy = add(bodyB.vy, mul(Qy, bodyB.invMass));
          bodyB.w = add(bodyB.w, mul(cross_r_v(row.rbx, row.rby, Qx, Qy), bodyB.invI));
          world.replaceComponent(row.b, Body2D, bodyB);
        }
      }
    }

    // —— Iterative solving phase ——
    // Fixed iteration count for deterministic results
    // 迭代求解阶段 - 固定迭代次数确保确定性结果
    for (let iteration = 0; iteration < ITER_P; iteration++) {
      for (const row of batch.list) {
        const joint = world.getComponent(row.e, PrismaticJoint2D);
        if (!joint) continue;

        const bodyA = world.getComponent(row.a, Body2D);
        const bodyB = world.getComponent(row.b, Body2D);
        if (!bodyA || !bodyB) continue;
        if (isStatic(bodyA) && isStatic(bodyB)) continue;

        // Calculate relative velocity at anchor points
        // 计算锚点的相对速度
        const [wxra_x, wxra_y] = cross_w_r(bodyA.w, row.rax, row.ray);
        const [wxrb_x, wxrb_y] = cross_w_r(bodyB.w, row.rbx, row.rby);
        const vax = add(bodyA.vx, wxra_x);
        const vay = add(bodyA.vy, wxra_y);
        const vbx = add(bodyB.vx, wxrb_x);
        const vby = add(bodyB.vy, wxrb_y);
        const rvx = sub(vbx, vax);
        const rvy = sub(vby, vay);

        // === 1) Perpendicular equality constraint: p · rv + biasPerp == 0 ===
        // === 1) 垂直等式约束：p · rv + biasPerp == 0 ===
        {
          const vPerp = add(mul(row.px, rvx), mul(row.py, rvy)); // Perpendicular velocity
          const rhs = sub(ZERO, add(vPerp, row.biasPerp));
          const dJ = mul(row.mPerp, rhs);


          if (dJ !== 0) {
            const Px = mul(row.px, dJ);
            const Py = mul(row.py, dJ);


            if (!isStatic(bodyA)) {
              bodyA.vx = sub(bodyA.vx, mul(Px, bodyA.invMass));
              bodyA.vy = sub(bodyA.vy, mul(Py, bodyA.invMass));
              bodyA.w = sub(bodyA.w, mul(cross_r_v(row.rax, row.ray, Px, Py), bodyA.invI));
              world.replaceComponent(row.a, Body2D, bodyA);
            }
            if (!isStatic(bodyB)) {
              bodyB.vx = add(bodyB.vx, mul(Px, bodyB.invMass));
              bodyB.vy = add(bodyB.vy, mul(Py, bodyB.invMass));
              bodyB.w = add(bodyB.w, mul(cross_r_v(row.rbx, row.rby, Px, Py), bodyB.invI));
              world.replaceComponent(row.b, Body2D, bodyB);
            }


            joint.jPerp = add(joint.jPerp, dJ);
          }
        }

        // === 2) Axial constraint: motor + limits (inequality) ===
        // === 2) 轴向约束：电机 + 限位（不等式） ===
        {
          const useMotor = joint.enableMotor === 1;

          // 实时检测限位状态（避免帧延迟）
          let useLimit = false;
          let limitSign: -1 | 0 | 1 = 0;
          let biasAxis = ZERO;

          if (joint.enableLimit === 1) {
            // 重新计算当前translation（使用世界空间锚点）
            const bodyAPos = world.getComponent(row.a, Body2D) as Body2D;
            const bodyBPos = world.getComponent(row.b, Body2D) as Body2D;
            if (bodyAPos && bodyBPos) {
              // 使用世界空间锚点：pA = xA + rA, pB = xB + rB
              const pax = add(bodyAPos.px, row.rax);
              const pay = add(bodyAPos.py, row.ray);
              const pbx = add(bodyBPos.px, row.rbx);
              const pby = add(bodyBPos.py, row.rby);
              const Cx = sub(pbx, pax);
              const Cy = sub(pby, pay);
              // 沿世界轴的投影，保持与BuildPrismatic2D一致的符号约定
              const translation = sub(ZERO, add(mul(row.ax, Cx), mul(row.ay, Cy)));


              // 单边ERP + slop：只在越界时纠正，避免边界抖动
              if (translation < sub(joint.lower, SLOP)) {
                useLimit = true;
                limitSign = -1;
                // 只修正超出slop的量
                const penetration = sub(sub(joint.lower, SLOP), translation);
                const dt = world.getFixedDtFX();
                biasAxis = joint.beta !== ZERO ? div(mul(joint.beta, penetration), dt) : ZERO;
              } else if (translation > add(joint.upper, SLOP)) {
                useLimit = true;
                limitSign = 1;
                const penetration = sub(translation, add(joint.upper, SLOP));
                const dt = world.getFixedDtFX();
                biasAxis = joint.beta !== ZERO ? div(mul(joint.beta, penetration), dt) : ZERO;
              }
            }
          }

          // 只有在有限位或电机时才施加轴向约束
          if (useLimit || useMotor) {
            // 重新计算相对速度（垂直约束可能已经修改了速度）
            const bodyA2 = world.getComponent(row.a, Body2D) as Body2D;
            const bodyB2 = world.getComponent(row.b, Body2D) as Body2D;
            if (!bodyA2 || !bodyB2) continue;

            const [wxra2_x, wxra2_y] = cross_w_r(bodyA2.w, row.rax, row.ray);
            const [wxrb2_x, wxrb2_y] = cross_w_r(bodyB2.w, row.rbx, row.rby);
            const vax2 = add(bodyA2.vx, wxra2_x);
            const vay2 = add(bodyA2.vy, wxra2_y);
            const vbx2 = add(bodyB2.vx, wxrb2_x);
            const vby2 = add(bodyB2.vy, wxrb2_y);
            const rvx2 = sub(vbx2, vax2);
            const rvy2 = sub(vby2, vay2);

            // Set target velocity: motor speed when enabled, otherwise 0
            // 设置目标速度：启用电机时为电机速度，否则为0
            const targetVelocity = useMotor ? joint.motorSpeed : ZERO;
            const bias = useLimit ? biasAxis : ZERO;

            // Velocity constraint: a·rv + bias + gamma*jAxis ≈ target
            // 速度约束：a·rv + bias + gamma*jAxis ≈ target
            const vAxis = add(mul(row.ax, rvx2), mul(row.ay, rvy2));
            const rhs = sub(targetVelocity, add(vAxis, add(bias, mul(row.gamma, joint.jAxis))));
            let dJ = mul(row.mAxis, rhs);

            // 如果mAxis=1/K，需要补充γ分母修正，让等效刚度变为1/(K+γ)
            if (row.gamma !== ZERO) {
              dJ = div(dJ, add(f(1), mul(row.gamma, row.mAxis)));
            }



          // Apply inequality projection for limits
          // 对限位应用不等式投影
          if (useLimit) {
            const newJ = add(joint.jAxis, dJ);
            if (limitSign < 0) {
              // Lower limit: j <= 0 (触下限：冲量非正)
              if (newJ > ZERO) dJ = sub(ZERO, joint.jAxis);
            } else if (limitSign > 0) {
              // Upper limit: j >= 0 (触上限：冲量非负)
              if (newJ < ZERO) dJ = sub(ZERO, joint.jAxis);
            }



          } else if (joint.enableMotor === 1 && joint.maxMotorImpulse > ZERO) {
            // Motor impulse clamping
            // 电机冲量钳位
            const newJ = add(joint.jAxis, dJ);
            const cap = joint.maxMotorImpulse;
            const negCap = sub(ZERO, cap);
            if (newJ > cap) dJ = sub(cap, joint.jAxis);
            if (newJ < negCap) dJ = sub(negCap, joint.jAxis);
          }

          if (dJ !== 0) {
            const Qx = mul(row.ax, dJ);
            const Qy = mul(row.ay, dJ);


            if (!isStatic(bodyA2)) {
              bodyA2.vx = sub(bodyA2.vx, mul(Qx, bodyA2.invMass));
              bodyA2.vy = sub(bodyA2.vy, mul(Qy, bodyA2.invMass));
              bodyA2.w = sub(bodyA2.w, mul(cross_r_v(row.rax, row.ray, Qx, Qy), bodyA2.invI));
              world.replaceComponent(row.a, Body2D, bodyA2);
            }
            if (!isStatic(bodyB2)) {
              bodyB2.vx = add(bodyB2.vx, mul(Qx, bodyB2.invMass));
              bodyB2.vy = add(bodyB2.vy, mul(Qy, bodyB2.invMass));
              bodyB2.w = add(bodyB2.w, mul(cross_r_v(row.rbx, row.rby, Qx, Qy), bodyB2.invI));
              world.replaceComponent(row.b, Body2D, bodyB2);
            }


            joint.jAxis = add(joint.jAxis, dJ);
          }
          } // 结束 if (useLimit || useMotor)
        }

        // Update joint component
        world.replaceComponent(row.e, PrismaticJoint2D, joint);
      }
    }

    // —— Joint breaking detection ——
    // Check for joint breaking based on accumulated impulse magnitude
    // 关节断裂检测 - 基于累积冲量大小检查关节断裂
    for (const row of batch.list) {
      const joint = world.getComponent(row.e, PrismaticJoint2D);
      if (!joint || joint.breakImpulse <= ZERO) continue;

      // Simple approximation: |jPerp| + |jAxis|
      // 简单近似：|jPerp| + |jAxis|
      const totalImpulse = add(abs(joint.jPerp), abs(joint.jAxis));
      if (totalImpulse > joint.breakImpulse) {
        joint.broken = 1;
        joint.jPerp = ZERO;
        joint.jAxis = ZERO;
        world.replaceComponent(row.e, PrismaticJoint2D, joint);
        events.addBrokenEvent(row.e as unknown as number);
      }
    }

    // Mark Body2D and PrismaticJoint2D components as changed for downstream systems
    // 标记Body2D和PrismaticJoint2D组件为已更改，用于下游系统
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
  .after('phys.joint.build.prismatic')
  .before('phys.sleep.update')
  .build();