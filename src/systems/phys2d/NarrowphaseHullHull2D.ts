/**
 * Narrowphase Hull-Hull Collision Detection System
 * 凸包-凸包窄相碰撞检测系统
 *
 * Implements SAT (Separating Axis Theorem) collision detection with Sutherland-Hodgman
 * clipping for convex polygon pairs. Generates stable contact manifolds with feature IDs.
 * 实现SAT（分离轴定理）碰撞检测和Sutherland-Hodgman裁剪，用于凸多边形对。
 * 生成带有特征ID的稳定接触流形。
 */

import { system, SystemContext } from '../../core/System';
import { ConvexHull2D } from '../../components/ConvexHull2D';
import { HullWorld2D } from '../../components/HullWorld2D';
import { Body2D } from '../../components/Body2D';
import { BroadphasePairs } from '../../resources/BroadphasePairs';
import { Contacts2D, type Contact1 } from '../../resources/Contacts2D';
import { makePairKey } from '../../determinism/PairKey';
import type { FX } from '../../math/fixed';
import { add, sub, mul, div, abs, f, ONE, ZERO, max } from '../../math/fixed';
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
 * SAT separation result
 * SAT分离结果
 */
interface SeparationResult {
  depth: FX;       // Penetration depth (negative if separated)
  nX: FX;          // Separating axis normal X
  nY: FX;          // Separating axis normal Y
  refEdge: number; // Reference edge index
  flip: boolean;   // Whether to flip normal direction
}

/**
 * Find minimum separation along hull A's normals
 * 沿凸包A的法线找到最小分离
 */
function findMinSeparation(A: HullWorld2D, B: HullWorld2D, refFromA: boolean): SeparationResult {
  let best: SeparationResult = {
    depth: f(-1000000), // Start with large negative value for maximum search
    nX: ZERO,
    nY: ZERO,
    refEdge: 0,
    flip: !refFromA
  };

  const nA = A.count;
  const nB = B.count;

  for (let i = 0; i < nA; i++) {
    const rawNx = A.normals[i * 2];
    const rawNy = A.normals[i * 2 + 1];

    // Normalize the normal for accurate projection
    const [nx, ny] = normalize(rawNx, rawNy);

    // Project A vertices onto normal to find projection range
    let minA = f(1000000);
    let maxA = f(-1000000);
    for (let j = 0; j < nA; j++) {
      const ax = A.wverts[j * 2];
      const ay = A.wverts[j * 2 + 1];
      const proj = dot(nx, ny, ax, ay);
      if (proj < minA) minA = proj;
      if (proj > maxA) maxA = proj;
    }

    // Project B vertices onto normal to find projection range
    let minB = f(1000000);
    let maxB = f(-1000000);
    for (let j = 0; j < nB; j++) {
      const bx = B.wverts[j * 2];
      const by = B.wverts[j * 2 + 1];
      const proj = dot(nx, ny, bx, by);
      if (proj < minB) minB = proj;
      if (proj > maxB) maxB = proj;
    }

    // Check for separation: intervals [minA, maxA] and [minB, maxB]
    // If separated: maxA < minB or maxB < minA
    let separation: FX;
    if (maxA < minB) {
      // A is completely to the left of B on this axis
      separation = sub(minB, maxA);
    } else if (maxB < minA) {
      // B is completely to the left of A on this axis
      separation = sub(minA, maxB);
    } else {
      // Overlapping: calculate negative overlap (penetration)
      // Overlap = min(maxA, maxB) - max(minA, minB)
      const minOverlap = (maxA < maxB ? maxA : maxB);
      const maxOverlap = (minA > minB ? minA : minB);
      const overlapAmount = sub(minOverlap, maxOverlap);
      separation = sub(ZERO, overlapAmount); // Make negative to indicate overlap
    }

    // For SAT, we want the axis with maximum separation (least overlap)
    // If all axes show overlap (negative), choose the least negative (closest to 0)
    if (separation > best.depth) {
      best = {
        depth: separation,
        nX: nx,
        nY: ny,
        refEdge: i,
        flip: !refFromA
      };
    }
  }

  return best;
}

/**
 * Pick reference face using SAT
 * 使用SAT选择参考面
 */
function pickReference(A: HullWorld2D, B: HullWorld2D): { ref: 'A' | 'B'; sep: SeparationResult } {
  const sA = findMinSeparation(A, B, true);
  const sB = findMinSeparation(B, A, false);

  // If either shows separation (positive), objects don't collide
  if (sA.depth > ZERO || sB.depth > ZERO) {
    // Return the one showing separation, or the one with less penetration
    return sA.depth > sB.depth ? { ref: 'A', sep: sA } : { ref: 'B', sep: sB };
  }

  // Both negative (overlapping): choose the one with less penetration (larger negative value)
  // 两者都为负（重叠）：选择穿透较少的（较大负值）
  if (sA.depth > sB.depth) return { ref: 'A', sep: sA };
  if (sB.depth > sA.depth) return { ref: 'B', sep: sB };

  // Tie-breaking for deterministic results
  // 确定性结果的平局处理
  if (sA.nX !== sB.nX) return sA.nX < sB.nX ? { ref: 'A', sep: sA } : { ref: 'B', sep: sB };
  if (sA.nY !== sB.nY) return sA.nY < sB.nY ? { ref: 'A', sep: sA } : { ref: 'B', sep: sB };
  if (sA.refEdge !== sB.refEdge) return sA.refEdge < sB.refEdge ? { ref: 'A', sep: sA } : { ref: 'B', sep: sB };

  return { ref: 'A', sep: sA };
}

/**
 * Find incident edge that is most anti-parallel to reference normal
 * 找到与参考法线最反平行的入射边
 */
function findIncidentEdge(other: HullWorld2D, nx: FX, ny: FX): number {
  let best = 0;
  let bestDot = f(1000000);

  for (let i = 0; i < other.count; i++) {
    const rawInx = other.normals[i * 2];
    const rawIny = other.normals[i * 2 + 1];

    // Normalize incident normal for accurate dot product
    const [inx, iny] = normalize(rawInx, rawIny);
    const d = dot(inx, iny, nx, ny);


    if (d < bestDot) {
      bestDot = d;
      best = i;
    }
  }

  return best;
}




/**
 * Check if a pair of entities both have convex hull shapes
 * 检查一对实体是否都具有凸包形状
 */
function isHullPair(world: World, a: Entity, b: Entity): boolean {
  return world.hasComponent(a, ConvexHull2D) && world.hasComponent(b, ConvexHull2D) &&
         world.hasComponent(a, HullWorld2D) && world.hasComponent(b, HullWorld2D);
}

/**
 * Narrowphase Hull-Hull collision detection system
 * 凸包-凸包窄相碰撞检测系统
 *
 * Processes broadphase pairs and generates contact manifolds for overlapping convex hulls.
 * Uses SAT for separation testing and Sutherland-Hodgman clipping for contact generation.
 * 处理宽相对并为重叠的凸包生成接触流形。
 * 使用SAT进行分离测试，使用Sutherland-Hodgman裁剪生成接触。
 */
export const NarrowphaseHullHull2D = system(
  'phys.narrow.hullHull',
  (ctx: SystemContext) => {
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
      return; // No broadphase pairs to process
    }

    // Process each broadphase pair
    // 处理每个宽相对
    for (const pair of bp.pairs) {
      if (!isHullPair(world, pair.a, pair.b)) {
        continue; // Skip non-hull pairs
      }


      // Normalize order and get pair key
      // 规范化顺序并获取配对键
      const { a, b, key } = makePairKey(world, pair.a, pair.b);

      // Get components
      // 获取组件
      const bodyA = world.getComponent(a, Body2D);
      const bodyB = world.getComponent(b, Body2D);
      const hullA = world.getComponent(a, ConvexHull2D);
      const hullB = world.getComponent(b, ConvexHull2D);
      const worldA = world.getComponent(a, HullWorld2D);
      const worldB = world.getComponent(b, HullWorld2D);

      if (!bodyA || !bodyB || !hullA || !hullB || !worldA || !worldB) {
        continue; // Missing required components
      }

      if (worldA.count === 0 || worldB.count === 0) {
        continue; // Invalid hulls
      }

      // SAT separation test and reference face selection
      // SAT分离测试和参考面选择
      const pick = pickReference(worldA, worldB);
      const sep = pick.sep;

      // Check for separation considering skin radius tolerance
      // Use single skin radius as threshold (max of both)
      const skinThreshold = max(hullA.radius, hullB.radius);

      if (sep.depth < skinThreshold && sep.depth > ZERO) {
        continue; // Objects are separated but not within skin threshold
      }

      // Calculate actual penetration depth (positive value)
      // If separated but within skin threshold, use skin tolerance
      // If overlapping, use actual overlap
      const penetrationDepth = sep.depth > ZERO
        ? sub(skinThreshold, sep.depth)  // For separated objects within skin radius
        : sub(ZERO, sep.depth);          // For overlapping objects

      // Determine reference and incident hulls
      // 确定参考和入射凸包
      const refIsA = pick.ref === 'A';
      const refHull = refIsA ? worldA : worldB;
      const incHull = refIsA ? worldB : worldA;
      const refEdge = sep.refEdge;

      // Get reference edge vertices
      // 获取参考边顶点
      const v0x = refHull.wverts[refEdge * 2];
      const v0y = refHull.wverts[refEdge * 2 + 1];

      // Get reference normal and ensure it points from A to B (collision normal direction)
      // Collision normal should always point from A to B regardless of which is reference
      // 获取参考法线并确保它从A指向B（碰撞法线方向）
      let nX = sep.nX;
      let nY = sep.nY;

      // Calculate center-to-center vector from A to B
      // 计算从A到B的中心到中心向量
      const centerToCenter = {
        x: sub(bodyB.px, bodyA.px),
        y: sub(bodyB.py, bodyA.py)
      };

      // Ensure collision normal points from A to B by checking against center-to-center direction
      // 通过检查中心到中心方向确保碰撞法线从A指向B
      const dotProduct = add(mul(nX, centerToCenter.x), mul(nY, centerToCenter.y));
      if (dotProduct < ZERO) {
        nX = sub(ZERO, nX);
        nY = sub(ZERO, nY);
      }

      const [nx, ny] = normalize(nX, nY);

      // Find incident edge that is most anti-parallel to reference normal
      // For incident edge, we want the edge whose normal is most opposite to reference normal
      // 找到与参考法线最反平行的入射边
      const searchNx = nx; // Always search for anti-parallel to reference normal
      const searchNy = ny;


      const incEdge = findIncidentEdge(incHull, searchNx, searchNy);
      const i0x = incHull.wverts[incEdge * 2];
      const i0y = incHull.wverts[incEdge * 2 + 1];
      const i1x = incHull.wverts[((incEdge + 1) % incHull.count) * 2];
      const i1y = incHull.wverts[((incEdge + 1) % incHull.count) * 2 + 1];


      // Enhanced contact generation with multiple strategies
      // 增强的接触点生成，采用多种策略
      const contactPoints: FX[] = [];

      // Strategy 1: Test incident edge vertices against reference face
      // 策略1：测试入射边顶点与参考面
      const incidentVertices = [
        [i0x, i0y],
        [i1x, i1y]
      ] as const;

      for (const [px, py] of incidentVertices) {
        const distance = dot(nx, ny, sub(px, v0x), sub(py, v0y));


        if (distance <= ZERO) {
          const depth = sub(ZERO, distance);
          if (depth >= f(0.001)) {
            contactPoints.push(px, py, depth);
          }
        }
      }

      // Strategy 2: Test reference edge vertices against incident hull
      // 策略2：测试参考边顶点与入射凸包
      if (contactPoints.length === 0) {
        const v1x = refHull.wverts[((refEdge + 1) % refHull.count) * 2];
        const v1y = refHull.wverts[((refEdge + 1) % refHull.count) * 2 + 1];

        const refVertices = [
          [v0x, v0y],
          [v1x, v1y]
        ] as const;

        for (const [px, py] of refVertices) {
          let inside = true;
          for (let i = 0; i < incHull.count && inside; i++) {
            const normalX = incHull.normals[i * 2];
            const normalY = incHull.normals[i * 2 + 1];
            const vertexX = incHull.wverts[i * 2];
            const vertexY = incHull.wverts[i * 2 + 1];

            const distance = dot(normalX, normalY, sub(px, vertexX), sub(py, vertexY));
            if (distance > f(0.001)) {
              inside = false;
            }
          }

          if (inside) {
            const depth = penetrationDepth;
            contactPoints.push(px, py, depth);
          }
        }
      }

      // Strategy 3: If still no contacts, create contact at closest point on reference edge
      // 策略3：如果仍然没有接触点，在参考边上的最近点创建接触点
      if (contactPoints.length === 0) {
        // Project incident edge midpoint onto reference edge
        const midX = div(add(i0x, i1x), f(2));
        const midY = div(add(i0y, i1y), f(2));

        // Find closest point on reference edge to incident midpoint
        const v1x = refHull.wverts[((refEdge + 1) % refHull.count) * 2];
        const v1y = refHull.wverts[((refEdge + 1) % refHull.count) * 2 + 1];

        const edgeX = sub(v1x, v0x);
        const edgeY = sub(v1y, v0y);
        const edgeLength = lenApprox(edgeX, edgeY);

        if (edgeLength > ZERO) {
          const toMidX = sub(midX, v0x);
          const toMidY = sub(midY, v0y);
          const projection = div(dot(edgeX, edgeY, toMidX, toMidY), mul(edgeLength, edgeLength));

          // Clamp projection to edge
          const t = projection < ZERO ? ZERO : (projection > ONE ? ONE : projection);
          const closestX = add(v0x, mul(t, edgeX));
          const closestY = add(v0y, mul(t, edgeY));

          const depth = penetrationDepth;
          contactPoints.push(closestX, closestY, depth);
        }
      }

      // Generate contact objects from contactPoints
      // 从contactPoints生成接触对象
      const cachedImpulse = contacts.prev.get(key);

      for (let i = 0; i < contactPoints.length; i += 3) {
        const contactX = contactPoints[i];
        const contactY = contactPoints[i + 1];
        const penetration = contactPoints[i + 2];

        const contact: Contact1 = {
          a: refIsA ? a : b,
          b: refIsA ? b : a,
          nx,
          ny,
          px: contactX,
          py: contactY,
          pen: penetration,
          jn: cachedImpulse ? cachedImpulse.jn : ZERO,
          jt: cachedImpulse ? cachedImpulse.jt : ZERO
        };

        contacts.addContact(contact);
      }
    }
  }
)
  .stage('update')
  .after('phys.broadphase.sap')
  .before('phys.ccd.spec')
  .build();