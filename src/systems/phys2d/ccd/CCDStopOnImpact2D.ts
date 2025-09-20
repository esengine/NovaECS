/**
 * CCD Stop-on-Impact Hull-Circle System
 * CCD停止于接触时刻的凸包-圆形系统
 *
 * Implements continuous collision detection that stops objects at the exact
 * time of impact and applies velocity correction with restitution and sliding.
 * 实现连续碰撞检测，在精确的撞击时刻停止物体并应用带弹性和滑动的速度修正。
 */

import { system, SystemContext } from '../../../core/System';
import { Body2D } from '../../../components/Body2D';
import { ShapeCircle } from '../../../components/ShapeCircle';
import { ConvexHull2D } from '../../../components/ConvexHull2D';
import { HullWorld2D } from '../../../components/HullWorld2D';
import { Material2D } from '../../../components/Material2D';
import { BroadphasePairs } from '../../../resources/BroadphasePairs';
import { MaterialTable2D, mix, resolveRestitution } from '../../../resources/MaterialTable2D';
import { raycastConvexInflated } from './RaycastConvexInflated2D';
import type { FX } from '../../../math/fixed';
import { add, sub, mul, div, abs, f, ONE, ZERO } from '../../../math/fixed';
import type { World } from '../../../core/World';
import type { Entity } from '../../../utils/Types';

/**
 * Safety epsilon for TOI positioning
 * TOI定位的安全间隙
 */
const TOI_EPSILON = f(0.0005);

/**
 * Vector dot product
 * 向量点积
 */
const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

/**
 * Vector length approximation using L1 norm for performance
 * 使用L1范数的向量长度近似以提高性能
 */
const length = (x: FX, y: FX): FX => {
  if (x === ZERO && y === ZERO) return ZERO;
  return add(abs(x), abs(y));
};

/**
 * Normalize vector using L1 approximation
 * 使用L1近似归一化向量
 */
const normalize = (x: FX, y: FX): readonly [FX, FX] => {
  const len = length(x, y);
  if (len === ZERO) return [ZERO, ZERO];
  return [div(x, len), div(y, len)];
};

/**
 * Get material from entity or fallback to default
 * 从实体获取材质或回退到默认值
 */
function getMaterial(world: World, entity: Entity): Material2D {
  return world.getComponent(entity, Material2D) ?? new Material2D('default', f(0.5), f(0.4), f(0.8), f(0.1));
}

/**
 * Apply CCD collision response with velocity correction
 * 应用带速度修正的CCD碰撞响应
 */
function applyCCDResponse(
  world: World,
  entityA: Entity, // Hull entity
  entityB: Entity, // Circle entity
  materialTable: MaterialTable2D,
  nx: FX, ny: FX,   // Contact normal (points toward circle)
  dt: FX
): void {
  const bodyA = world.getComponent(entityA, Body2D);
  const bodyB = world.getComponent(entityB, Body2D);

  if (!bodyA || !bodyB) return;

  const materialA = getMaterial(world, entityA);
  const materialB = getMaterial(world, entityB);

  // Get combined material properties
  // 获取组合材质属性
  const rule = materialTable.getRule(materialA, materialB);
  const restitution = resolveRestitution(materialA, materialB, rule);
  const threshold = rule.customThreshold
    ? rule.customThreshold(materialA, materialB)
    : mix(materialA.bounceThreshold, materialB.bounceThreshold, rule.thresholdRule ?? 'max');

  // Normalize contact normal
  // 归一化接触法线
  const [normalizedNx, normalizedNy] = normalize(nx, ny);

  // Calculate relative velocity
  // 计算相对速度
  const relVx = sub(bodyB.vx, bodyA.vx);
  const relVy = sub(bodyB.vy, bodyA.vy);

  // Normal velocity component (negative means approaching)
  // 法向速度分量（负值表示接近）
  const vn = dot(relVx, relVy, normalizedNx, normalizedNy);

  // Only apply response if objects are approaching
  // 仅当物体相互接近时应用响应
  if (vn >= ZERO) return;

  // Calculate tangent vector for sliding
  // 计算滑动的切向量
  const tx = sub(ZERO, normalizedNy);
  const ty = normalizedNx;
  const vt = dot(relVx, relVy, tx, ty);

  // Determine if bounce should occur based on threshold
  // 根据阈值确定是否应该发生弹跳
  const shouldBounce = abs(vn) > threshold;
  const vnAfter = shouldBounce ? sub(ZERO, mul(vn, add(ONE, restitution))) : ZERO;

  // Calculate velocity change needed
  // 计算所需的速度变化
  const deltaVn = sub(vnAfter, vn);
  const deltaVnx = mul(normalizedNx, deltaVn);
  const deltaVny = mul(normalizedNy, deltaVn);

  // Apply velocity correction with equal weight distribution
  // 使用等权分配应用速度修正
  // Note: For mass-based distribution, use inverse mass weighting
  // 注意：对于基于质量的分配，使用逆质量加权
  const halfDeltaVnx = div(deltaVnx, f(2));
  const halfDeltaVny = div(deltaVny, f(2));

  bodyB.vx = add(bodyB.vx, halfDeltaVnx);
  bodyB.vy = add(bodyB.vy, halfDeltaVny);
  bodyA.vx = sub(bodyA.vx, halfDeltaVnx);
  bodyA.vy = sub(bodyA.vy, halfDeltaVny);

  // Preserve tangential velocity for sliding behavior
  // 保持切向速度以实现滑动行为
  // Note: Friction could be applied here to reduce tangential velocity
  // 注意：可以在此应用摩擦力来减少切向速度
}

/**
 * Process CCD collision between hull and circle with stop-on-impact
 * 处理凸包和圆形之间的带停止于撞击时刻的CCD碰撞
 */
function processCCDCollision(
  world: World,
  entityA: Entity, // Hull entity
  entityB: Entity, // Circle entity
  dt: FX
): void {
  const bodyA = world.getComponent(entityA, Body2D);
  const bodyB = world.getComponent(entityB, Body2D);
  const hullWorld = world.getComponent(entityA, HullWorld2D);
  const circle = world.getComponent(entityB, ShapeCircle);

  if (!bodyA || !bodyB || !hullWorld || !circle) {
    return;
  }

  // Skip if no relative motion
  // 无相对运动时跳过
  if (bodyB.vx === ZERO && bodyB.vy === ZERO && bodyA.vx === ZERO && bodyA.vy === ZERO) {
    return;
  }

  // Get material table
  // 获取材质表
  const materialTable = world.getResource(MaterialTable2D);
  if (!materialTable) return;

  // Calculate relative motion vector: d = (vB - vA) * dt
  // 计算相对运动向量：d = (vB - vA) * dt
  const relVx = sub(bodyB.vx, bodyA.vx);
  const relVy = sub(bodyB.vy, bodyA.vy);
  const dx = mul(relVx, dt);
  const dy = mul(relVy, dt);


  // Early exit if no relative motion
  // 无相对运动时提前退出
  if (dx === ZERO && dy === ZERO) return;

  // Calculate inflation radius: R = circle.radius + hull.radius
  // 计算膨胀半径：R = 圆半径 + 凸包半径
  const hull = world.getComponent(entityA, ConvexHull2D);
  const hullRadius = hull?.radius ?? ZERO;
  const inflationRadius = add(circle.r, hullRadius);

  // Perform raycast from circle center
  // 从圆心执行射线投射
  const hit = raycastConvexInflated(
    hullWorld,
    bodyB.px, bodyB.py,
    dx, dy,
    inflationRadius
  );


  if (!hit.hit) return;

  // Calculate adjusted TOI position: p = p0 + d * (t - ε)
  // 计算调整后的TOI位置：p = p0 + d * (t - ε)
  const tAdjusted = hit.t > TOI_EPSILON ? sub(hit.t, TOI_EPSILON) : ZERO;
  const moveX = mul(dx, tAdjusted);
  const moveY = mul(dy, tAdjusted);

  // Update circle position to TOI
  // 将圆位置更新到TOI
  bodyB.px = add(bodyB.px, moveX);
  bodyB.py = add(bodyB.py, moveY);

  // Apply velocity correction with restitution and sliding
  // 应用带弹性和滑动的速度修正
  applyCCDResponse(world, entityA, entityB, materialTable, hit.nx, hit.ny, dt);
}

/**
 * CCD Stop-on-Impact Hull-Circle System
 * CCD停止于撞击时刻凸包-圆形系统
 */
export const CCDStopOnImpact2D = system(
  'phys.ccd.hullCircle.stop',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const dt = world.getFixedDt();

    const pairs = world.getResource(BroadphasePairs);
    if (!pairs) return;

    // Process each broadphase pair
    // 处理每个宽相对
    for (const pair of pairs.pairs) {
      const entityA = pair.a;
      const entityB = pair.b;

      // Check if this is a hull-circle pair
      // 检查是否为凸包-圆形对
      const hasHullA = world.hasComponent(entityA, ConvexHull2D) &&
                       world.hasComponent(entityA, HullWorld2D);
      const hasCircleA = world.hasComponent(entityA, ShapeCircle);
      const hasHullB = world.hasComponent(entityB, ConvexHull2D) &&
                       world.hasComponent(entityB, HullWorld2D);
      const hasCircleB = world.hasComponent(entityB, ShapeCircle);

      if (hasHullA && hasCircleB) {
        processCCDCollision(world, entityA, entityB, dt);
      } else if (hasHullB && hasCircleA) {
        processCCDCollision(world, entityB, entityA, dt);
      }
    }
  }
)
  .stage('update')
  .after('geom.syncHullWorld2D')
  .before('phys.broadphase.sap')
  .inSet('physics')
  .build();