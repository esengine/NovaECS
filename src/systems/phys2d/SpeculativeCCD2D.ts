/**
 * Speculative Continuous Collision Detection for 2D Physics
 * 2D物理引擎的推测连续碰撞检测
 *
 * Implements speculative contacts for CCD without sub-stepping.
 * Predicts future collisions within the current frame and creates
 * pre-constraints for the existing GS solver to handle.
 * 实现不使用子步的推测接触CCD。
 * 预测当前帧内的未来碰撞，并为现有GS解算器创建预约束。
 */

import { BroadphasePairs } from '../../resources/BroadphasePairs';
import { Contacts2D } from '../../resources/Contacts2D';
import { Body2D } from '../../components/Body2D';
import { ShapeCircle } from '../../components/ShapeCircle';
import { makePairKey } from '../../determinism/PairKey';
import {
  FX, add, sub, mul, div, abs, f, ONE, ZERO, clamp
} from '../../math/fixed';
import { system, SystemContext } from '../../core/System';

/**
 * Fast approximate distance calculation using hi + 3/8 * (lo²/hi) method
 * 使用 hi + 3/8 * (lo²/hi) 方法的快速近似距离计算
 *
 * This matches the method used in narrowphase for consistency.
 * 这与窄相中使用的方法一致，确保一致性。
 */
const approxLen = (dx: FX, dy: FX): FX => {
  const ax = abs(dx);
  const ay = abs(dy);
  const hi = ax > ay ? ax : ay;
  const lo = ax > ay ? ay : ax;
  const lo2_over_hi = hi ? div(mul(lo, lo), hi) : ZERO;
  return add(hi, mul(f(0.375), lo2_over_hi));
};

/**
 * Check if two entities both have circle shapes
 * 检查两个实体是否都具有圆形形状
 */
const isCirclePair = (world: any, a: any, b: any): boolean => {
  return world.hasComponent(a, ShapeCircle) && world.hasComponent(b, ShapeCircle);
};

/**
 * Speculative CCD System for Circle-Circle Collisions
 * 圆-圆碰撞的推测CCD系统
 *
 * Creates speculative contacts for objects that will collide within the current frame
 * but are not currently overlapping. These contacts are processed by the constraint
 * solver to prevent tunneling without requiring sub-stepping.
 * 为当前帧内将要碰撞但目前未重叠的物体创建推测接触。
 * 这些接触由约束解算器处理，无需子步即可防止穿透。
 */
export const SpeculativeCCD2D = system(
  'phys.ccd.spec',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get broadphase results
    // 获取宽相结果
    const bp = world.getResource(BroadphasePairs) as BroadphasePairs | undefined;
    if (!bp || bp.pairs.length === 0) return;

    // Get fixed timestep
    // 获取固定时间步长
    const dt = world.getFixedDtFX ? world.getFixedDtFX() : f(1 / 60);

    // Get or create contacts resource
    // 获取或创建接触资源
    let contactsRes = world.getResource(Contacts2D) as Contacts2D | undefined;
    if (!contactsRes) {
      contactsRes = new Contacts2D();
      world.setResource(Contacts2D, contactsRes);
    }

    const contactList = contactsRes.list;

    // Build set of existing contact keys to avoid duplicates
    // 构建现有接触键集合以避免重复
    const existingContacts = new Set<string>();
    for (const contact of contactList) {
      const { key } = makePairKey(world, contact.a, contact.b);
      existingContacts.add(key);
    }

    // Array to collect speculative contacts before sorting
    // 收集推测接触的数组，排序前
    const speculativeContacts: any[] = [];

    // Process each broadphase pair
    // 处理每个宽相对
    for (const pair of bp.pairs) {
      // Only handle circle-circle pairs
      // 仅处理圆-圆对
      if (!isCirclePair(world, pair.a, pair.b)) continue;

      // Get normalized pair key and check if contact already exists
      // 获取规范化的对键并检查接触是否已存在
      const { a, b, key } = makePairKey(world, pair.a, pair.b);
      if (existingContacts.has(key)) continue; // Skip existing actual contacts

      // Get components
      // 获取组件
      const bodyA = world.getComponent(a, Body2D) as Body2D;
      const bodyB = world.getComponent(b, Body2D) as Body2D;
      const shapeA = world.getComponent(a, ShapeCircle) as ShapeCircle;
      const shapeB = world.getComponent(b, ShapeCircle) as ShapeCircle;

      if (!bodyA || !bodyB || !shapeA || !shapeB) continue;

      // Calculate current separation
      // 计算当前分离距离
      const dx = sub(bodyB.px, bodyA.px);
      const dy = sub(bodyB.py, bodyA.py);
      const combinedRadius = add(shapeA.r, shapeB.r);

      // Handle concentric case deterministically
      // 确定性地处理同心情况
      const dist = (dx === ZERO && dy === ZERO) ? ZERO : approxLen(dx, dy);
      const currentSeparation = sub(dist, combinedRadius);

      // Skip if already overlapping (will be handled by narrowphase)
      // 如果已经重叠则跳过（将由窄相处理）
      if (currentSeparation <= ZERO) continue;

      // Calculate contact normal (deterministic for concentric case)
      // 计算接触法向（同心情况下确定性）
      let nx: FX, ny: FX;
      if (dx === ZERO && dy === ZERO) {
        // Concentric case: use deterministic default direction
        // 同心情况：使用确定性默认方向
        nx = ONE;
        ny = ZERO;
      } else {
        nx = div(dx, dist);
        ny = div(dy, dist);
      }

      // Calculate relative velocity along contact normal
      // 计算沿接触法向的相对速度
      const relativeVelX = sub(bodyB.vx, bodyA.vx);
      const relativeVelY = sub(bodyB.vy, bodyA.vy);
      const relativeNormalVel = add(mul(relativeVelX, nx), mul(relativeVelY, ny));

      // Skip if objects are separating or moving parallel
      // 如果物体在分离或平行移动则跳过
      if (relativeNormalVel >= ZERO) continue;

      // Predict separation at end of frame: s1 = s0 + vn * dt
      // 预测帧末分离：s1 = s0 + vn * dt
      const predictedSeparation = add(currentSeparation, mul(relativeNormalVel, dt));

      // Skip if no collision predicted within this frame
      // 如果本帧内未预测到碰撞则跳过
      if (predictedSeparation >= ZERO) continue;

      // Calculate time of impact (normalized to frame time: t_hit/dt)
      // 计算冲击时间（归一化为帧时间：t_hit/dt）
      const timeToImpact = div(currentSeparation, sub(ZERO, relativeNormalVel));
      const normalizedTOI = clamp(div(timeToImpact, dt), ZERO, ONE);

      // Calculate future penetration (positive value for constraint solver)
      // 计算未来穿透（约束解算器的正值）
      const futurePenetration = sub(ZERO, predictedSeparation);

      // Calculate contact point on surface of body A
      // 计算在物体A表面的接触点
      const contactX = add(bodyA.px, mul(nx, shapeA.r));
      const contactY = add(bodyA.py, mul(ny, shapeA.r));

      // Get warm-start impulse from previous frame if available
      // 如果可用，从上一帧获取warm-start冲量
      const cachedImpulse = contactsRes.prev.get(key);
      const warmStartJn = cachedImpulse ? cachedImpulse.jn : ZERO;
      const warmStartJt = cachedImpulse ? cachedImpulse.jt : ZERO;

      // Create speculative contact
      // 创建推测接触
      const speculativeContact = {
        a,
        b,
        nx,
        ny,
        px: contactX,
        py: contactY,
        pen: futurePenetration,
        jn: warmStartJn,
        jt: warmStartJt,
        speculative: 1 as const,
        toi: normalizedTOI
      };

      speculativeContacts.push(speculativeContact);
      existingContacts.add(key); // Prevent duplicates in this pass
    }

    // Add speculative contacts to the main list
    // 将推测接触添加到主列表
    for (const contact of speculativeContacts) {
      contactList.push(contact);
    }

    // Maintain stable sorting by (a, b) entity IDs for determinism
    // 通过(a, b)实体ID保持稳定排序以确保确定性
    contactList.sort((contactA, contactB) => {
      const aDiff = (contactA.a as number) - (contactB.a as number);
      return aDiff !== 0 ? aDiff : (contactA.b as number) - (contactB.b as number);
    });
  }
);