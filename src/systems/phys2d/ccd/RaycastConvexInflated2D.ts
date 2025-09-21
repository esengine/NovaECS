/**
 * Raycast against Inflated Convex Hull for CCD
 * 针对膨胀凸包的射线投射用于CCD
 *
 * Implements Cyrus-Beck line clipping against a convex polygon inflated by radius R.
 * Used for Time-of-Impact (TOI) calculations in continuous collision detection.
 * 实现针对半径R膨胀凸多边形的Cyrus-Beck线段裁剪。
 * 用于连续碰撞检测中的首次接触时刻(TOI)计算。
 */

import type { FX } from '../../../math/fixed';
import { add, sub, mul, div, ONE, ZERO } from '../../../math/fixed';
import { HullWorld2D } from '../../../components/HullWorld2D';

/**
 * Result of raycast against inflated convex hull
 * 针对膨胀凸包射线投射的结果
 */
export type RaycastInflatedHit = {
  /** Whether the ray hits the inflated hull / 射线是否命中膨胀凸包 */
  hit: boolean;
  /** Time of impact t ∈ [0,1] / 首次接触时刻 t ∈ [0,1] */
  t: FX;
  /** Contact normal X component (points toward circle) / 接触法线X分量（指向圆心） */
  nx: FX;
  /** Contact normal Y component (points toward circle) / 接触法线Y分量（指向圆心） */
  ny: FX;
};

/**
 * Vector dot product (2D)
 * 向量点积（2D）
 */
const dot = (ax: FX, ay: FX, bx: FX, by: FX): FX => add(mul(ax, bx), mul(ay, by));

/**
 * Raycast against convex hull inflated by radius R
 * 对半径R膨胀的凸包进行射线投射
 *
 * Uses Cyrus-Beck clipping to find first intersection of ray p(t) = p0 + d*t
 * with the Minkowski sum of the convex hull and a circle of radius R.
 * 使用Cyrus-Beck裁剪算法找到射线p(t) = p0 + d*t与凸包和半径R圆的闵可夫斯基和的首次相交。
 *
 * @param hull - World-space convex hull / 世界空间凸包
 * @param p0x - Ray start X / 射线起点X
 * @param p0y - Ray start Y / 射线起点Y
 * @param dx - Ray direction X / 射线方向X
 * @param dy - Ray direction Y / 射线方向Y
 * @param R - Inflation radius / 膨胀半径
 * @returns Hit result with TOI and contact normal / 命中结果包含TOI和接触法线
 */
export function raycastConvexInflated(
  hull: HullWorld2D,
  p0x: FX, p0y: FX,
  dx: FX,  dy: FX,
  R: FX
): RaycastInflatedHit {
  const n = hull.count | 0;
  if (n <= 0) return { hit: false, t: ONE, nx: ZERO, ny: ZERO };

  // Cyrus-Beck: aggregate all half-plane constraints n·x <= n·s + R
  // Cyrus-Beck: 聚合所有半平面约束 n·x <= n·s + R
  let tEnter = ZERO, tExit = ONE;
  let enterNx = ZERO, enterNy = ZERO;

  for (let i = 0; i < n; i++) {
    // Get edge normal and vertex
    // 获取边法线和顶点
    const nx = hull.normals[i * 2], ny = hull.normals[i * 2 + 1];
    const sx = hull.wverts[i * 2],  sy = hull.wverts[i * 2 + 1];

    // Right-hand side constant: n·s + R
    // 右侧常数: n·s + R
    const c = add(dot(nx, ny, sx, sy), R);

    // Distance from start point to plane: c - n·p0
    // 起点到平面的距离: c - n·p0
    const num = sub(c, dot(nx, ny, p0x, p0y));

    // Ray direction projection: n·d
    // 射线方向投影: n·d
    const den = dot(nx, ny, dx, dy);

    if (den === ZERO) {
      // Parallel: if start point is outside half-plane, no solution
      // 平行: 若起点在半平面外，无解
      if (num < ZERO) return { hit: false, t: ONE, nx: ZERO, ny: ZERO };
      continue;
    }

    // Intersection time with this plane
    // 与该平面的相交时刻
    const tPlane = div(num, den);

    if (den < ZERO) {
      // Entering constraint (lower bound)
      // 进入约束（下界）
      if (tPlane > tEnter) {
        tEnter = tPlane;
        enterNx = nx;
        enterNy = ny;
      }
    } else {
      // Leaving constraint (upper bound)
      // 离开约束（上界）
      if (tPlane < tExit) tExit = tPlane;
    }

    // Early exit if interval becomes invalid
    // 区间无效时提前退出
    if (tEnter > tExit) return { hit: false, t: ONE, nx: ZERO, ny: ZERO };
  }

  // Hit condition: valid interval and tEnter ∈ [0,1]
  // 命中条件: 有效区间且 tEnter ∈ [0,1]
  if (tEnter < ZERO || tEnter > ONE) return { hit: false, t: ONE, nx: ZERO, ny: ZERO };

  // Special case: if tEnter is exactly 0, we're already overlapping
  // Need to find closest surface normal instead of enter normal
  // 特殊情况：如果tEnter恰好是0，说明已经重叠
  // 需要找到最近表面法线而不是进入法线
  if (tEnter === ZERO) {
    // Find the constraint plane with smallest violation
    // 找到违反最小的约束平面
    let minViolation = add(ONE, ONE); // Large positive value
    let closestNx = ZERO, closestNy = ZERO;

    for (let i = 0; i < n; i++) {
      const nx = hull.normals[i * 2], ny = hull.normals[i * 2 + 1];
      const sx = hull.wverts[i * 2],  sy = hull.wverts[i * 2 + 1];
      const c = add(dot(nx, ny, sx, sy), R);
      const violation = sub(c, dot(nx, ny, p0x, p0y));

      if (violation < minViolation) {
        minViolation = violation;
        closestNx = nx;
        closestNy = ny;
      }
    }

    return { hit: true, t: ZERO, nx: closestNx, ny: closestNy };
  }

  return { hit: true, t: tEnter, nx: enterNx, ny: enterNy };
}