/**
 * Narrowphase Hull-Circle Collision Detection System
 * 凸包-圆形窄相碰撞检测系统
 *
 * Implements SAT (Separating Axis Theorem) with closest feature determination
 * for convex hull vs circle collision detection. Generates stable contact manifolds
 * with proper feature IDs for warm-start behavior.
 * 实现SAT（分离轴定理）与最近特征判定，用于凸包vs圆形碰撞检测。
 * 生成带有正确特征ID的稳定接触流形，支持warm-start行为。
 */

import { system, SystemContext } from '../../core/System';
import { ConvexHull2D } from '../../components/ConvexHull2D';
import { HullWorld2D } from '../../components/HullWorld2D';
import { Circle2D } from '../../components/Circle2D';
import { CircleWorld2D } from '../../components/CircleWorld2D';
import { BroadphasePairs } from '../../resources/BroadphasePairs';
import { Contacts2D, type Contact1 } from '../../resources/Contacts2D';
import type { FX } from '../../math/fixed';
import { add, sub, mul, div, abs, f, ONE, ZERO } from '../../math/fixed';
import type { World } from '../../core/World';
import type { Entity } from '../../utils/Types';

/**
 * Vector dot product (2D)
 * 向量点积（2D）
 */
const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

/**
 * Fast approximate length for normalization
 * 用于归一化的快速近似长度
 */
const lenApprox = (x: FX, y: FX): FX => {
  const ax = abs(x);
  const ay = abs(y);
  return ax > ay ? add(ax, div(mul(ay, ay), ax || ONE)) : add(ay, div(mul(ax, ax), ay || ONE));
};

/**
 * Normalize vector to unit length (approximate)
 * 将向量归一化为单位长度（近似）
 */
const normalize = (x: FX, y: FX): readonly [FX, FX] => {
  const L = lenApprox(x, y) || ONE;
  return [div(x, L), div(y, L)];
};


/**
 * Check if a pair has hull-circle configuration
 * 检查配对是否为凸包-圆形配置
 */
function isHullCirclePair(world: World, a: Entity, b: Entity): { hull: Entity; circle: Entity } | null {
  const aHasHull = world.hasComponent(a, ConvexHull2D);
  const aHasCircle = world.hasComponent(a, Circle2D);
  const bHasHull = world.hasComponent(b, ConvexHull2D);
  const bHasCircle = world.hasComponent(b, Circle2D);

  if (aHasHull && bHasCircle) {
    return { hull: a, circle: b };
  }
  if (bHasHull && aHasCircle) {
    return { hull: b, circle: a };
  }
  return null;
}

/**
 * Narrowphase Hull-Circle collision detection system
 * 凸包-圆形窄相碰撞检测系统
 *
 * Takes broadphase pairs and generates contact manifolds for overlapping hull-circle pairs.
 * Uses SAT with closest feature determination for stable contacts.
 * 接收宽相对并为重叠的凸包-圆形对生成接触流形。
 * 使用SAT和最近特征判定来生成稳定接触。
 */
export const NarrowphaseHullCircle2D = system('phys.narrow.hullCircle', (ctx: SystemContext) => {
    const { world } = ctx;

    // Get or create contacts resource
    // 获取或创建接触资源
    let contacts = world.getResource(Contacts2D);
    if (!contacts) {
      contacts = new Contacts2D();
      world.setResource(Contacts2D, contacts);
    }

    // Get broadphase results
    // 获取宽相结果
    const bp = world.getResource(BroadphasePairs);
    if (!bp || bp.pairs.length === 0) {
      return; // No pairs to process
    }

    // Process each broadphase pair
    // 处理每个宽相对
    for (const pair of bp.pairs) {
      const config = isHullCirclePair(world, pair.a, pair.b);
      if (!config) continue; // Not a hull-circle pair

      const { hull: eH, circle: eC } = config;

      // Get required components
      // 获取必需组件
      const hull = world.getComponent(eH, ConvexHull2D);
      const wH = world.getComponent(eH, HullWorld2D);
      const circle = world.getComponent(eC, Circle2D);
      const wC = world.getComponent(eC, CircleWorld2D);

      if (!hull || !wH || !circle || !wC || wH.count <= 0) continue;

      // Calculate total radius (circle + hull skin + circle skin)
      // 计算总半径（圆形半径 + 凸包皮肤 + 圆形皮肤）
      const totalRadius = add(add(circle.radius, hull.radius), circle.skin);
      const n = wH.count;

      // Step 1: SAT on hull edge normals to find maximum separation
      // 步骤1：在凸包边法线上做SAT，找到最大分离
      let maxSep = f(-1000000); // Start with very negative value
      let maxEdge = 0;

      for (let i = 0; i < n; i++) {
        const nx = wH.normals[i * 2];
        const ny = wH.normals[i * 2 + 1];
        const vx = wH.wverts[i * 2];
        const vy = wH.wverts[i * 2 + 1];

        // Separation = normal · (circle_center - vertex) - circle_radius
        // 分离距离 = 法线 · (圆心 - 顶点) - 圆形半径
        const sep = sub(
          dot(nx, ny, sub(wC.cx, vx), sub(wC.cy, vy)),
          circle.radius
        );

        if (sep > maxSep) {
          maxSep = sep;
          maxEdge = i;
        }
      }

      // Check for separation (including skin tolerance)
      // 检查分离（包括皮肤容差）
      if (sub(maxSep, add(hull.radius, circle.skin)) > ZERO) {
        continue; // Separated
      }

      // Get reference edge vertices and normal
      // 获取参考边顶点和法线
      const v0x = wH.wverts[maxEdge * 2];
      const v0y = wH.wverts[maxEdge * 2 + 1];
      const v1x = wH.wverts[((maxEdge + 1) % n) * 2];
      const v1y = wH.wverts[((maxEdge + 1) % n) * 2 + 1];
      const nx = wH.normals[maxEdge * 2];
      const ny = wH.normals[maxEdge * 2 + 1];

      // Normalize the edge normal (hull -> circle direction)
      // 归一化边法线（凸包 -> 圆形方向）
      const [nox, noy] = normalize(nx, ny);

      // Step 2: Determine closest feature (face vs vertex)
      // 步骤2：判定最近特征（面 vs 顶点）
      const ex = sub(v1x, v0x);
      const ey = sub(v1y, v0y);
      const px = sub(wC.cx, v0x);
      const py = sub(wC.cy, v0y);
      const elen2 = add(mul(ex, ex), mul(ey, ey)) || ONE;
      const t = div(add(mul(px, ex), mul(py, ey)), elen2);

      // Create contact manifold
      // 创建接触流形
      const contact: Contact1 = {
        a: eH,
        b: eC,
        nx: ZERO,
        ny: ZERO,
        px: ZERO,
        py: ZERO,
        pen: ZERO,
        jn: ZERO,
        jt: ZERO
      };

      if (t >= ZERO && t <= ONE) {
        // Face feature: circle contacts the edge
        // 面特征：圆形接触边
        contact.nx = nox;
        contact.ny = noy;

        // Penetration depth including skin
        // 包括皮肤的穿透深度
        const pen = sub(totalRadius, maxSep);
        if (pen <= ZERO) continue;

        // Contact point: circle center pushed back along normal
        // Place contact slightly inside skin layer for stability
        // 接触点：圆心沿法线推回
        // 将接触点稍微放在皮肤层内以保持稳定性
        const backDist = sub(circle.radius, div(pen, f(2)));
        contact.px = sub(wC.cx, mul(nox, backDist));
        contact.py = sub(wC.cy, mul(noy, backDist));
        contact.pen = pen;

        // Apply cached impulse for warm-start
        // 应用缓存冲量进行warm-start
        const cached = contacts.getCachedImpulse(world, contact.a, contact.b);
        if (cached) {
          contact.jn = cached.jn;
          contact.jt = cached.jt;
        }

        contacts.addContact(contact);

      } else {
        // Vertex feature: circle contacts a vertex
        // 顶点特征：圆形接触顶点
        const closestVertex = t < ZERO ? 0 : 1;
        const vx = closestVertex === 0 ? v0x : v1x;
        const vy = closestVertex === 0 ? v0y : v1y;

        let dx = sub(wC.cx, vx);
        let dy = sub(wC.cy, vy);
        const dist = lenApprox(dx, dy);

        // Check vertex-circle separation
        // 检查顶点-圆形分离
        if (sub(dist, totalRadius) > ZERO) continue;

        // Normal: vertex -> circle center (normalized)
        // 法线：顶点 -> 圆心（归一化）
        if (dx === ZERO && dy === ZERO) {
          // Degenerate case: use face normal
          // 退化情况：使用面法线
          dx = nox;
          dy = noy;
        }
        const [ux, uy] = normalize(dx, dy);

        const pen = sub(totalRadius, dist);
        if (pen <= ZERO) continue;

        // Contact point on circle surface
        // 圆形表面的接触点
        const backDist = sub(circle.radius, div(pen, f(2)));
        contact.px = sub(wC.cx, mul(ux, backDist));
        contact.py = sub(wC.cy, mul(uy, backDist));
        contact.pen = pen;
        contact.nx = ux;
        contact.ny = uy;

        // Apply cached impulse for warm-start
        // 应用缓存冲量进行warm-start
        const cached = contacts.getCachedImpulse(world, contact.a, contact.b);
        if (cached) {
          contact.jn = cached.jn;
          contact.jt = cached.jt;
        }

        contacts.addContact(contact);
      }
    }
  }
)
  .stage('update')
  .after('phys.broadphase.sap')
  .before('phys.solver.gs')
  .build();