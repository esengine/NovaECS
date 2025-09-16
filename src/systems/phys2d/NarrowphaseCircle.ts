/**
 * Narrowphase Circle-Circle Collision Detection System
 * 圆-圆窄相碰撞检测系统
 *
 * Processes broadphase candidate pairs and generates stable contact manifolds
 * for circle-circle collisions using fixed-point arithmetic for determinism.
 * 处理宽相候选对并为圆-圆碰撞生成稳定的接触流形，使用定点算术确保确定性。
 */

import { system, SystemContext } from '../../core/System';
import { Body2D } from '../../components/Body2D';
import { ShapeCircle } from '../../components/ShapeCircle';
import { BroadphasePairs } from '../../resources/BroadphasePairs';
import { Contacts2D, type Contact1 } from '../../resources/Contacts2D';
import { makePairKey } from '../../determinism/PairKey';
import { add, sub, mul, div, abs, f, ONE, ZERO } from '../../math/fixed';
import type { FX } from '../../math/fixed';
import type { World } from '../../core/World';
import type { Entity } from '../../utils/Types';

/**
 * Check if a pair of entities both have circle shapes
 * 检查一对实体是否都具有圆形形状
 */
function isCirclePair(world: World, a: Entity, b: Entity): boolean {
  return world.hasComponent(a, ShapeCircle) && world.hasComponent(b, ShapeCircle);
}

/**
 * Narrowphase Circle-Circle collision detection system
 * 圆-圆窄相碰撞检测系统
 *
 * Takes broadphase pairs and generates contact manifolds for overlapping circles.
 * Uses deterministic fixed-point math and stable contact ordering.
 * 接收宽相对并为重叠的圆生成接触流形。
 * 使用确定性定点数学和稳定的接触排序。
 */
export const NarrowphaseCircle = system(
  'phys.narrow.circle',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get or create contacts resource first
    // 首先获取或创建接触资源
    let contacts = world.getResource(Contacts2D);
    if (!contacts) {
      contacts = new Contacts2D();
      world.setResource(Contacts2D, contacts);
    }

    // Get broadphase results
    // 获取宽相结果
    const bp = world.getResource(BroadphasePairs);
    if (!bp || bp.pairs.length === 0) {
      // Still need to clear contacts and update frame even if no pairs
      // 即使没有配对也需要清空接触并更新帧
      contacts.frame = world.frame >>> 0;
      contacts.clear();
      return; // No broadphase pairs to process
    }

    // Store previous frame cache and start new frame
    // 存储上一帧缓存并开始新帧
    const prevCache = contacts.prev;
    contacts.frame = world.frame >>> 0;
    contacts.clear();

    // Process each broadphase pair
    // 处理每个宽相对
    for (const pair of bp.pairs) {
      if (!isCirclePair(world, pair.a, pair.b)) {
        continue; // Skip non-circle pairs
      }

      // Normalize order and get pair key for deterministic processing
      // 规范化顺序并获取配对键以进行确定性处理
      const { a, b, key } = makePairKey(world, pair.a, pair.b);

      // Get components
      // 获取组件
      const bodyA = world.getComponent(a, Body2D);
      const bodyB = world.getComponent(b, Body2D);
      const circleA = world.getComponent(a, ShapeCircle);
      const circleB = world.getComponent(b, ShapeCircle);

      if (!bodyA || !bodyB || !circleA || !circleB) {
        continue; // Missing required components
      }

      // Calculate center-to-center vector (B - A)
      // 计算圆心间向量（B - A）
      const dx = sub(bodyB.px, bodyA.px);
      const dy = sub(bodyB.py, bodyA.py);

      // Combined radius
      // 半径和
      const combinedRadius = add(circleA.r, circleB.r);

      // Fast rejection using L-infinity norm (optional optimization)
      // 使用L无穷范数快速剔除（可选优化）
      if (abs(dx) > combinedRadius || abs(dy) > combinedRadius) {
        continue; // Definitely not overlapping
      }

      // Calculate squared distance for overlap test
      // 计算距离平方用于重叠测试
      const dx2 = mul(dx, dx);
      const dy2 = mul(dy, dy);
      const distSquared = add(dx2, dy2);
      const radiusSquared = mul(combinedRadius, combinedRadius);

      if (distSquared >= radiusSquared) {
        continue; // Not overlapping
      }

      // Calculate contact normal and penetration
      // 计算接触法向和穿透深度
      let nx: FX, ny: FX, penetration: FX;

      if (dx === ZERO && dy === ZERO) {
        // Circles are exactly concentric - use deterministic fallback normal
        // 圆完全同心 - 使用确定性回退法向
        // Use fixed direction (1,0) for consistency
        nx = ONE;
        ny = ZERO;
        penetration = combinedRadius; // Full overlap
      } else {
        // Calculate distance using stable approximation
        // 使用稳定近似计算距离
        // dist ≈ max(|dx|,|dy|) + 3/8 * min²/max
        const adx = abs(dx);
        const ady = abs(dy);
        const maxComp = adx > ady ? adx : ady;
        const minComp = adx > ady ? ady : adx;

        let distance: FX;
        if (minComp === ZERO) {
          distance = maxComp;
        } else {
          const minSquaredOverMax = div(mul(minComp, minComp), maxComp);
          const correction = mul(f(0.375), minSquaredOverMax); // 0.375 = 3/8
          distance = add(maxComp, correction);
        }

        // Normalize direction vector
        // 归一化方向向量
        nx = div(dx, distance);
        ny = div(dy, distance);

        // Calculate penetration depth
        // 计算穿透深度
        penetration = sub(combinedRadius, distance);
      }

      // Calculate contact point on surface of circle A
      // 在圆A表面计算接触点
      const contactX = add(bodyA.px, mul(nx, circleA.r));
      const contactY = add(bodyA.py, mul(ny, circleA.r));

      // Get warm-start impulses from previous frame
      // 从上一帧获取warm-start冲量
      const cachedImpulse = prevCache.get(key);
      const normalImpulse = cachedImpulse ? cachedImpulse.jn : ZERO;
      const tangentImpulse = cachedImpulse ? cachedImpulse.jt : ZERO;

      // Create contact
      // 创建接触
      const contact: Contact1 = {
        a,
        b,
        nx,
        ny,
        px: contactX,
        py: contactY,
        pen: penetration,
        jn: normalImpulse,
        jt: tangentImpulse
      };

      contacts.addContact(contact);
    }

    // Sort contacts for deterministic ordering across runs
    // 对接触进行排序以确保跨运行的确定性排序
    // Since makePairKey already ensures a <= b, we can sort by entity IDs
    contacts.list.sort((contactA, contactB) => {
      if (contactA.a !== contactB.a) {
        return Number(contactA.a) - Number(contactB.a);
      }
      return Number(contactB.b) - Number(contactB.b);
    });
  }
)
  .stage('update')
  .after('phys.broadphase.sap')
  .inSet('physics');