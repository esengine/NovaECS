/**
 * Convex Hull 2D Shape Component for SAT Collision Detection
 * 用于SAT碰撞检测的2D凸包形状组件
 *
 * Represents a convex polygon with vertices in counter-clockwise order
 * for deterministic collision detection using Separating Axis Theorem.
 * 表示逆时针顶点顺序的凸多边形，用于使用分离轴定理的确定性碰撞检测。
 */

import type { FX } from '../math/fixed';
import { ZERO, f } from '../math/fixed';

/**
 * Convex hull collision shape with fixed-point vertices
 * 带定点顶点的凸包碰撞形状
 */
export class ConvexHull2D {
  /**
   * Local vertices in counter-clockwise order (CCW)
   * Array stores as [vx0, vy0, vx1, vy1, ...]
   * 逆时针顺序的局部顶点
   * 数组存储为 [vx0, vy0, vx1, vy1, ...]
   */
  verts: FX[] = [];

  /**
   * Number of vertices in the hull
   * 凸包中的顶点数量
   */
  count = 0;

  /**
   * Skin radius for conservative contact generation
   * Recommended: 1-2 LSB for stable contacts
   * 用于保守接触生成的皮肤半径
   * 建议值：1-2个最低有效位，用于稳定接触
   */
  radius: FX = f(0.01);

  constructor(vertices: FX[] = [], skinRadius: FX = f(0.01)) {
    this.setVertices(vertices);
    this.radius = skinRadius;
  }

  /**
   * Set vertices for the convex hull
   * Vertices must be in counter-clockwise order
   * 设置凸包顶点
   * 顶点必须按逆时针顺序
   */
  setVertices(vertices: FX[]): void {
    if (vertices.length % 2 !== 0) {
      throw new Error('Vertices array length must be even (x,y pairs)');
    }

    this.count = vertices.length / 2;
    this.verts = [...vertices];
  }

  /**
   * Get vertex at specified index
   * 获取指定索引的顶点
   */
  getVertex(index: number): readonly [FX, FX] {
    if (index < 0 || index >= this.count) {
      throw new Error(`Vertex index ${index} out of range [0, ${this.count})`);
    }

    const i = index * 2;
    return [this.verts[i], this.verts[i + 1]];
  }

  /**
   * Set vertex at specified index
   * 设置指定索引的顶点
   */
  setVertex(index: number, x: FX, y: FX): void {
    if (index < 0 || index >= this.count) {
      throw new Error(`Vertex index ${index} out of range [0, ${this.count})`);
    }

    const i = index * 2;
    this.verts[i] = x;
    this.verts[i + 1] = y;
  }
}

/**
 * Create a box-shaped convex hull
 * 创建矩形凸包
 */
export function createBoxHull(width: FX, height: FX, skinRadius: FX = f(0.01)): ConvexHull2D {
  const hw = width >> 1; // half width
  const hh = height >> 1; // half height

  const vertices: FX[] = [
    -hw, -hh, // bottom-left
     hw, -hh, // bottom-right
     hw,  hh, // top-right
    -hw,  hh  // top-left
  ];

  return new ConvexHull2D(vertices, skinRadius);
}

/**
 * Create a triangle-shaped convex hull
 * 创建三角形凸包
 */
export function createTriangleHull(
  x1: FX, y1: FX,
  x2: FX, y2: FX,
  x3: FX, y3: FX,
  skinRadius: FX = f(0.01)
): ConvexHull2D {
  const vertices: FX[] = [x1, y1, x2, y2, x3, y3];
  return new ConvexHull2D(vertices, skinRadius);
}

/**
 * Validate that vertices are in counter-clockwise order
 * 验证顶点是否按逆时针顺序排列
 */
export function validateCCW(hull: ConvexHull2D): boolean {
  if (hull.count < 3) return true;

  let area: FX = ZERO;

  for (let i = 0; i < hull.count; i++) {
    const [x1, y1] = hull.getVertex(i);
    const [x2, y2] = hull.getVertex((i + 1) % hull.count);
    area = area + ((x1 * y2 - x2 * y1) >> 16); // Fixed point cross product
  }

  return area > ZERO; // Positive area means CCW
}

/**
 * Calculate the centroid of the convex hull
 * 计算凸包的质心
 */
export function calculateCentroid(hull: ConvexHull2D): readonly [FX, FX] {
  if (hull.count === 0) return [ZERO, ZERO];

  let cx: FX = ZERO;
  let cy: FX = ZERO;

  for (let i = 0; i < hull.count; i++) {
    const [x, y] = hull.getVertex(i);
    cx = cx + x;
    cy = cy + y;
  }

  const invCount = (1 << 16) / hull.count; // Fixed point 1/count
  cx = (cx * invCount) >> 16;
  cy = (cy * invCount) >> 16;

  return [cx, cy];
}