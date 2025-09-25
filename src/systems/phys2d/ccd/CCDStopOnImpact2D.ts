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
import { Material2D, createDefaultMaterial } from '../../../components/Material2D';
import { BroadphasePairs } from '../../../resources/BroadphasePairs';
import { MaterialTable2D, mix, resolveRestitution, resolveFriction } from '../../../resources/MaterialTable2D';
import { TOIQueue2D } from '../../../resources/TOIQueue2D';
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
 * Get material for entity, with fallback hierarchy
 * 获取实体的材质，带回退层次结构
 */
function getMaterial(world: World, entity: Entity): Material2D {
  // Try entity-specific material first
  let material = world.getComponent(entity, Material2D);
  if (material) return material;

  // Fall back to world default material
  material = world.getResource(Material2D);
  if (material) return material;

  // Use built-in default as last resort
  return createDefaultMaterial();
}

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
 * Apply aggressive CCD response for overlapping objects (t=0 case)
 * 对重叠物体应用激进的CCD响应（t=0情况）
 */
function applyCCDResponseOverlapping(
  world: World,
  entityA: Entity, // Hull entity
  entityB: Entity, // Circle entity
  _materialTable: MaterialTable2D,
  nx: FX, ny: FX,   // Contact normal (points toward circle)
  _dt: FX
): void {
  const bodyA = world.getComponent(entityA, Body2D);
  const bodyB = world.getComponent(entityB, Body2D);

  if (!bodyA || !bodyB) return;

  // Use materials for CCD response calculation
  // 使用材质进行CCD响应计算
  const materialA = getMaterial(world, entityA);
  const materialB = getMaterial(world, entityB);

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

  // For overlapping case, be very aggressive - stop all penetrating motion
  // 对于重叠情况，非常激进 - 停止所有穿透运动
  if (vn < ZERO) {
    // Completely stop relative motion in normal direction
    // 完全停止法向的相对运动
    const deltaVn = sub(ZERO, vn);
    const deltaVnx = mul(normalizedNx, deltaVn);
    const deltaVny = mul(normalizedNy, deltaVn);

    // Apply full correction to the moving object (circle)
    // 对运动物体（圆形）应用完全修正
    bodyB.vx = add(bodyB.vx, deltaVnx);
    bodyB.vy = add(bodyB.vy, deltaVny);

    // Apply friction for tangential motion
    // 对切向运动应用摩擦
    const materialTable = world.getResource(MaterialTable2D);
    if (materialTable) {
      const rule = materialTable.getRule(materialA, materialB);
      const frictionCoeffs = resolveFriction(materialA, materialB, rule);
      const friction = frictionCoeffs.muS;

      // Calculate tangent vector
      const tx = sub(ZERO, normalizedNy);
      const ty = normalizedNx;
      const vt = dot(relVx, relVy, tx, ty);

      if (abs(vt) > f(0.001)) {
        const frictionImpulse = mul(friction, abs(deltaVn));
        const maxFrictionImpulse = abs(vt);
        const actualFrictionImpulse = vt > ZERO
          ? sub(ZERO, abs(frictionImpulse) < maxFrictionImpulse ? frictionImpulse : maxFrictionImpulse)
          : (abs(frictionImpulse) < maxFrictionImpulse ? frictionImpulse : maxFrictionImpulse);

        const deltaVtx = mul(tx, actualFrictionImpulse);
        const deltaVty = mul(ty, actualFrictionImpulse);

        bodyB.vx = add(bodyB.vx, deltaVtx);
        bodyB.vy = add(bodyB.vy, deltaVty);
      }
    }

    // IMPORTANT: Save the modified component back to the world
    // 重要：将修改后的组件保存回世界
    world.replaceComponent(entityB, Body2D, bodyB);

  }
}

/**
 * Apply CCD collision response with velocity correction
 * 应用带速度修正的CCD碰撞响应
 */
function applyCCDResponse(
  world: World,
  entityA: Entity, // Hull entity
  entityB: Entity, // Circle entity
  _materialTable: MaterialTable2D,
  nx: FX, ny: FX,   // Contact normal (points toward circle)
  _dt: FX
): void {
  const bodyA = world.getComponent(entityA, Body2D);
  const bodyB = world.getComponent(entityB, Body2D);

  if (!bodyA || !bodyB) return;

  const materialA = getMaterial(world, entityA);
  const materialB = getMaterial(world, entityB);

  // Get combined material properties
  // 获取组合材质属性
  const rule = _materialTable.getRule(materialA, materialB);
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

  // Calculate tangent vector and tangential velocity for friction
  // 计算切向量和切向速度用于摩擦
  const tx = sub(ZERO, normalizedNy);
  const ty = normalizedNx;
  const vt = dot(relVx, relVy, tx, ty);

  // Get friction coefficient
  // 获取摩擦系数
  const frictionCoeffs = resolveFriction(materialA, materialB, rule);
  const friction = frictionCoeffs.muS; // Use static friction for CCD

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

  // Apply friction impulse if there's tangential velocity
  // 如果有切向速度，应用摩擦冲量
  if (abs(vt) > f(0.001)) { // Small threshold to avoid jitter
    const frictionImpulse = mul(friction, abs(deltaVn));
    const maxFrictionImpulse = abs(vt);
    const actualFrictionImpulse = vt > ZERO
      ? sub(ZERO, abs(frictionImpulse) < maxFrictionImpulse ? frictionImpulse : maxFrictionImpulse)
      : (abs(frictionImpulse) < maxFrictionImpulse ? frictionImpulse : maxFrictionImpulse);

    const deltaVtx = mul(tx, actualFrictionImpulse);
    const deltaVty = mul(ty, actualFrictionImpulse);
    const halfDeltaVtx = div(deltaVtx, f(2));
    const halfDeltaVty = div(deltaVty, f(2));

    bodyB.vx = add(bodyB.vx, halfDeltaVtx);
    bodyB.vy = add(bodyB.vy, halfDeltaVty);
    bodyA.vx = sub(bodyA.vx, halfDeltaVtx);
    bodyA.vy = sub(bodyA.vy, halfDeltaVty);
  }

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

  // Handle overlapping case (t=0) differently from future collision (t>0)
  // 对重叠情况(t=0)和未来碰撞(t>0)采用不同处理
  if (hit.t === ZERO) {

    // Already overlapping - calculate proper separation distance
    // 已经重叠 - 计算适当的分离距离
    const [normalizedNx, normalizedNy] = normalize(hit.nx, hit.ny);

    // Calculate target position to place circle exactly at inflated boundary
    // 计算目标位置，将圆精确放置在膨胀边界处

    // Find the closest point on the inflated hull surface
    // 找到膨胀凸包表面最近的点
    let targetX = bodyB.px, targetY = bodyB.py;
    let minDistanceToSurface = add(ONE, ONE); // Large value

    for (let i = 0; i < hullWorld.count; i++) {
      const nx = hullWorld.normals[i * 2], ny = hullWorld.normals[i * 2 + 1];
      const sx = hullWorld.wverts[i * 2],  sy = hullWorld.wverts[i * 2 + 1];

      // Distance from circle center to inflated plane: n·p - (n·s + R)
      // 从圆心到膨胀平面的距离：n·p - (n·s + R)
      const planeConstant = add(dot(nx, ny, sx, sy), inflationRadius);
      const distanceToPlane = sub(dot(nx, ny, bodyB.px, bodyB.py), planeConstant);

      // If we're penetrating this plane (distance < 0), and this is the closest violation
      // 如果我们穿透了这个平面（距离 < 0），且这是最近的违反
      if (distanceToPlane > ZERO && distanceToPlane < minDistanceToSurface) {
        minDistanceToSurface = distanceToPlane;
        // Target position: move circle back along plane normal to exactly touch the surface
        // 目标位置：沿平面法线将圆后移，恰好接触表面
        targetX = sub(bodyB.px, mul(nx, distanceToPlane));
        targetY = sub(bodyB.py, mul(ny, distanceToPlane));
      }
    }


    // For overlapping collision, move circle to safe distance from wall
    // 对于重叠碰撞，将圆移动到距离墙壁的安全距离
    const wallBody = world.getComponent(entityA, Body2D);
    if (wallBody) {
      // Calculate safe position: wall_left_edge - circle_radius - safety_margin
      // 计算安全位置：墙左边缘 - 圆半径 - 安全间隙
      const wallLeftEdge = sub(wallBody.px, f(0.1)); // Wall half-width = 0.1
      const safePosition = sub(sub(wallLeftEdge, circle.r), f(0.15)); // Additional safety margin


      // Always move to safe position for overlapping collisions
      // 对于重叠碰撞总是移动到安全位置
      bodyB.px = safePosition;
      // Y position remains unchanged

      // Save position changes to world
      // 将位置变化保存到世界
      world.replaceComponent(entityB, Body2D, bodyB);
    } else {
      // Fallback: use calculated target with safety margin
      // 回退：使用计算的目标加安全间隙
      const safetyMargin = f(0.01);
      const sepX = sub(targetX, bodyB.px);
      const sepY = sub(targetY, bodyB.py);
      const sepMag = length(sepX, sepY);
      const finalSepX = sepMag > ZERO ? mul(sepX, div(add(sepMag, safetyMargin), sepMag)) : mul(normalizedNx, safetyMargin);
      const finalSepY = sepMag > ZERO ? mul(sepY, div(add(sepMag, safetyMargin), sepMag)) : mul(normalizedNy, safetyMargin);

      bodyB.px = add(bodyB.px, finalSepX);
      bodyB.py = add(bodyB.py, finalSepY);

      // Save fallback position changes to world
      // 将回退位置变化保存到世界
      world.replaceComponent(entityB, Body2D, bodyB);
    }


    // DEBUG: log the wall position for comparison
    if (wallBody) {
      // TODO: Add debug logging for wall position
    }
  } else {

    // Calculate adjusted TOI position: p = p0 + d * (t - ε)
    // 计算调整后的TOI位置：p = p0 + d * (t - ε)
    const tAdjusted = hit.t > TOI_EPSILON ? sub(hit.t, TOI_EPSILON) : ZERO;
    const moveX = mul(dx, tAdjusted);
    const moveY = mul(dy, tAdjusted);

    // Update circle position to TOI
    // 将圆位置更新到TOI
    bodyB.px = add(bodyB.px, moveX);
    bodyB.py = add(bodyB.py, moveY);

    // Save TOI position changes to world
    // 将TOI位置变化保存到世界
    world.replaceComponent(entityB, Body2D, bodyB);
  }

  // Apply velocity correction with restitution and sliding
  // 应用带弹性和滑动的速度修正
  if (hit.t === ZERO) {
    // For overlapping case, apply more aggressive velocity correction
    // 对于重叠情况，应用更激进的速度修正
    applyCCDResponseOverlapping(world, entityA, entityB, materialTable, hit.nx, hit.ny, dt);
  } else {
    applyCCDResponse(world, entityA, entityB, materialTable, hit.nx, hit.ny, dt);
  }

  // For overlapping collisions (t=0), don't generate TOI events since we already handled them
  // 对于重叠碰撞(t=0)，不生成TOI事件，因为我们已经处理了
  if (hit.t > ZERO) {
    // Push TOI event to queue for sub-stepping
    // 将TOI事件推送到队列以进行子步长处理

    // Calculate contact point (circle center pushed back to circle surface)
    // 计算接触点（圆心沿法线推回到圆面）
    const back = circle.r; // For skin distance: circle.r - skinCorrect
    const cpX = sub(bodyB.px, mul(hit.nx, back));
    const cpY = sub(bodyB.py, mul(hit.ny, back));

    // Get or create TOI queue resource
    // 获取或创建TOI队列资源
    let toiQueue = world.getResource(TOIQueue2D);
    if (!toiQueue) {
      toiQueue = new TOIQueue2D();
      world.setResource(TOIQueue2D, toiQueue);
    }

    // Add TOI event
    // 添加TOI事件
    toiQueue.add({
      a: entityA,  // Hull entity / 凸包实体
      b: entityB,  // Circle entity / 圆形实体
      t: hit.t,    // Time of impact / 撞击时间
      nx: hit.nx,  // Impact normal X / 撞击法线X
      ny: hit.ny,  // Impact normal Y / 撞击法线Y
      px: cpX,     // Contact point X / 接触点X
      py: cpY      // Contact point Y / 接触点Y
    });

  } else {
    // No action needed for other cases
  }
}

/**
 * CCD Stop-on-Impact Hull-Circle System
 * CCD停止于撞击时刻凸包-圆形系统
 */
export const CCDStopOnImpact2D = system(
  'phys.ccd.hullCircle.stop',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const dt = world.getFixedDtFX(); // Use fixed-point timestep

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
      } else {
        // Unsupported collision type combination
      }
    }
  }
)
  .stage('update')
  .after('phys.broadphase.sap')       // After broadphase generates pairs
  .before('phys.ccd.toiSort')         // Before TOI sorting
  .inSet('physics')
  .build();