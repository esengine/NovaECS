/**
 * Time-of-Impact Hull-Circle Collision System
 * 首次接触时刻凸包-圆形碰撞系统
 *
 * Implements continuous collision detection between convex hulls and circles.
 * Prevents tunneling by finding the exact time of first contact and applying
 * impulse-based response with optional restitution and sliding behavior.
 * 实现凸包和圆形之间的连续碰撞检测。
 * 通过找到精确的首次接触时刻并应用基于冲量的响应来防止穿透，支持可选的弹性和滑动行为。
 */

import { system, SystemContext } from '../../../core/System';
import { Body2D } from '../../../components/Body2D';
import { ShapeCircle } from '../../../components/ShapeCircle';
import { ConvexHull2D } from '../../../components/ConvexHull2D';
import { HullWorld2D } from '../../../components/HullWorld2D';
import { Material2D } from '../../../components/Material2D';
import { BroadphasePairs } from '../../../resources/BroadphasePairs';
import { MaterialTable2D, resolveRestitution } from '../../../resources/MaterialTable2D';
// import { makePairKey } from '../../../determinism/PairKey';
import { raycastConvexInflated } from './RaycastConvexInflated2D';
import type { FX } from '../../../math/fixed';
import { add, sub, mul, div, abs, f, ONE, ZERO, sqrt } from '../../../math/fixed';
import type { World } from '../../../core/World';
import type { Entity } from '../../../utils/Types';

/**
 * Minimum velocity threshold for applying restitution
 * 应用弹性的最小速度阈值
 */
const MIN_RESTITUTION_VELOCITY = f(0.1);

/**
 * Safety epsilon for TOI positioning
 * TOI定位的安全间隙
 */
const TOI_EPSILON = f(0.001);

/**
 * Vector length calculation
 * 向量长度计算
 */
const length = (x: FX, y: FX): FX => sqrt(add(mul(x, x), mul(y, y)));

/**
 * Vector dot product
 * 向量点积
 */
const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

/**
 * Normalize vector (returns zero vector if input is zero)
 * 向量归一化（输入为零向量时返回零向量）
 */
const normalize = (x: FX, y: FX): readonly [FX, FX] => {
  const len = length(x, y);
  if (len === ZERO) return [ZERO, ZERO];
  return [div(x, len), div(y, len)];
};

/**
 * Apply TOI collision response between hull and circle
 * 在凸包和圆形之间应用TOI碰撞响应
 */
function applyTOIResponse(
  bodyA: Body2D, // Hull body
  bodyB: Body2D, // Circle body
  materialA: Material2D,
  materialB: Material2D,
  materialTable: MaterialTable2D,
  nx: FX, ny: FX, // Contact normal (points toward circle)
  _dt: FX
): void {
  // Get combined material properties
  // 获取组合材质属性
  const rule = materialTable.getRule(materialA, materialB);
  const restitution = resolveRestitution(materialA, materialB, rule);

  // Relative velocity at contact
  // 接触点相对速度
  const relVx = sub(bodyB.vx, bodyA.vx);
  const relVy = sub(bodyB.vy, bodyA.vy);

  // Normal velocity component
  // 法向速度分量
  const vn = dot(relVx, relVy, nx, ny);

  // Only apply response if objects are approaching
  // 仅当物体相互接近时应用响应
  if (vn >= ZERO) return;

  // Calculate impulse magnitude
  // 计算冲量大小
  const invMassSum = add(bodyA.invMass, bodyB.invMass);
  if (invMassSum === ZERO) return; // Both static

  // Determine restitution coefficient
  // 确定弹性系数
  const e = abs(vn) > MIN_RESTITUTION_VELOCITY ? restitution : ZERO;

  // Impulse magnitude: j = -(1 + e) * vn / (1/mA + 1/mB)
  // 冲量大小: j = -(1 + e) * vn / (1/mA + 1/mB)
  const j = div(mul(sub(ZERO, add(ONE, e)), vn), invMassSum);

  // Apply impulse to both bodies
  // 对两个物体应用冲量
  const jx = mul(j, nx);
  const jy = mul(j, ny);

  // Hull gets negative impulse
  // 凸包获得负冲量
  bodyA.vx = sub(bodyA.vx, mul(jx, bodyA.invMass));
  bodyA.vy = sub(bodyA.vy, mul(jy, bodyA.invMass));

  // Circle gets positive impulse
  // 圆形获得正冲量
  bodyB.vx = add(bodyB.vx, mul(jx, bodyB.invMass));
  bodyB.vy = add(bodyB.vy, mul(jy, bodyB.invMass));
}

/**
 * Process TOI collision between hull and circle
 * 处理凸包和圆形之间的TOI碰撞
 */
function processTOICollision(
  world: World,
  entityA: Entity, // Hull entity
  entityB: Entity, // Circle entity
  dt: FX
): void {
  const bodyA = world.getComponent(entityA, Body2D);
  const bodyB = world.getComponent(entityB, Body2D);
  const hullWorld = world.getComponent(entityA, HullWorld2D);
  const circle = world.getComponent(entityB, ShapeCircle);
  const materialA = world.getComponent(entityA, Material2D);
  const materialB = world.getComponent(entityB, Material2D);

  if (!bodyA || !bodyB || !hullWorld || !circle || !materialA || !materialB) {
    return;
  }

  // Get material table
  // 获取材质表
  const materialTable = world.getResource(MaterialTable2D);
  if (!materialTable) return;

  // Calculate relative motion
  // 计算相对运动
  const relVx = sub(bodyB.vx, bodyA.vx);
  const relVy = sub(bodyB.vy, bodyA.vy);
  const dx = mul(relVx, dt);
  const dy = mul(relVy, dt);


  // Early exit if no relative motion
  // 无相对运动时提前退出
  if (dx === ZERO && dy === ZERO) return;

  // Calculate inflation radius (circle radius + hull skin)
  // 计算膨胀半径（圆半径 + 凸包表皮厚度）
  const hull = world.getComponent(entityA, ConvexHull2D);
  const hullRadius = hull?.radius || ZERO;
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

  // Calculate TOI position (slightly before contact)
  // 计算TOI位置（略早于接触）
  const safeT = sub(hit.t, TOI_EPSILON);
  if (safeT < ZERO) return;

  // Move circle to TOI position
  // 将圆移动到TOI位置
  const toiX = add(bodyB.px, mul(dx, safeT));
  const toiY = add(bodyB.py, mul(dy, safeT));


  bodyB.px = toiX;
  bodyB.py = toiY;

  // Normalize contact normal
  // 归一化接触法线
  const [nx, ny] = normalize(hit.nx, hit.ny);

  // Apply collision response
  // 应用碰撞响应
  applyTOIResponse(bodyA, bodyB, materialA, materialB, materialTable, nx, ny, dt);
}

/**
 * TOI Hull-Circle Collision Detection System
 * TOI凸包-圆形碰撞检测系统
 */
export const TOIHullCircle2D = system(
  'phys.toi.hullCircle',
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
        processTOICollision(world, entityA, entityB, dt);
      } else if (hasHullB && hasCircleA) {
        processTOICollision(world, entityB, entityA, dt);
      }
    }
  }
)
  .stage('update')
  .after('geom.syncHullWorld2D')
  .before('phys.integrateVelocities')
  .inSet('physics')
  .build();