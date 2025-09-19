/**
 * Synchronize World Space Hull Cache System
 * 同步世界空间凸包缓存系统
 *
 * Transforms local convex hull vertices to world space and computes
 * outward-facing edge normals for efficient narrow-phase collision detection.
 * 将局部凸包顶点变换到世界空间并计算向外边法线，以实现高效的窄相碰撞检测。
 */

import { system, SystemContext } from '../../core/System';
import { ConvexHull2D } from '../../components/ConvexHull2D';
import { HullWorld2D } from '../../components/HullWorld2D';
import { Body2D } from '../../components/Body2D';
import { Rot2D } from '../../components/Rot2D';
import type { World } from '../../core/World';
import type { FX } from '../../math/fixed';
import { add, sub, mul, neg, angleToCosSin, f } from '../../math/fixed';

/**
 * Get rotation cosine and sine from entity
 * Priority: Rot2D component -> Body2D.angle -> no rotation
 * 从实体获取旋转的余弦和正弦值
 * 优先级：Rot2D组件 -> Body2D.angle -> 无旋转
 */
function getCosSin(world: World, entity: number): readonly [FX, FX] {
  // Check for Rot2D component first
  // 优先检查Rot2D组件
  const rot = world.getComponent(entity, Rot2D);
  if (rot) {
    return [rot.cos, rot.sin];
  }

  // Fallback to Body2D.angle
  // 回退到Body2D.angle
  const body = world.getComponent(entity, Body2D);
  if (body) {
    return angleToCosSin(body.angle);
  }

  // Default: no rotation
  // 默认：无旋转
  return [f(1), f(0)];
}

/**
 * Hull World Synchronization System
 * 凸包世界同步系统
 *
 * Updates world space hull cache for all entities with ConvexHull2D components.
 * Transforms local vertices to world coordinates and computes edge normals.
 * 为所有具有ConvexHull2D组件的实体更新世界空间凸包缓存。
 * 将局部顶点变换到世界坐标并计算边法线。
 */
export const SyncHullWorld2D = system(
  'geom.syncHullWorld2D',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query entities with required components
    // 查询具有所需组件的实体
    world
      .query(ConvexHull2D, HullWorld2D, Body2D)
      .forEach((entity, hull: ConvexHull2D, cache: HullWorld2D, body: Body2D) => {
        const vertexCount = hull.count | 0;
        if (vertexCount <= 0) return;

        // Ensure cache has enough space
        // 确保缓存有足够空间
        const requiredSize = vertexCount * 2;
        if (cache.wverts.length < requiredSize) {
          cache.wverts = new Array(requiredSize);
          cache.normals = new Array(requiredSize);
        }
        cache.count = vertexCount;

        // Get rotation
        // 获取旋转
        const [cos, sin] = getCosSin(world, entity);
        const px = body.px;
        const py = body.py;

        // Transform local vertices to world space
        // 将局部顶点变换到世界空间
        for (let i = 0; i < vertexCount; i++) {
          const localX = hull.verts[i * 2];
          const localY = hull.verts[i * 2 + 1];

          // World position = body.position + rotate(localVertex, body.rotation)
          // 世界位置 = 物体位置 + 旋转(局部顶点, 物体旋转)
          const rotatedX = sub(mul(localX, cos), mul(localY, sin));
          const rotatedY = add(mul(localX, sin), mul(localY, cos));

          const worldX = add(px, rotatedX);
          const worldY = add(py, rotatedY);

          cache.wverts[i * 2] = worldX;
          cache.wverts[i * 2 + 1] = worldY;
        }

        // Compute outward-facing edge normals
        // 计算向外的边法线
        for (let i = 0; i < vertexCount; i++) {
          const nextIndex = (i + 1) % vertexCount;

          const x0 = cache.wverts[i * 2];
          const y0 = cache.wverts[i * 2 + 1];
          const x1 = cache.wverts[nextIndex * 2];
          const y1 = cache.wverts[nextIndex * 2 + 1];

          // Edge vector: v1 - v0
          // 边向量：v1 - v0
          const edgeX = sub(x1, x0);
          const edgeY = sub(y1, y0);

          // Outward normal: rotate edge 90 degrees clockwise (y, -x)
          // 外法线：将边顺时针旋转90度 (y, -x)
          cache.normals[i * 2] = edgeY;
          cache.normals[i * 2 + 1] = neg(edgeX);
        }

        // Update cache epoch for change detection
        // 更新缓存时期号用于变更检测
        cache.epoch = world.frame;
      });
  }
)
  .stage('update')
  .inSet('physics')
  .build();

/**
 * Helper function to check if hull world cache needs update
 * 检查凸包世界缓存是否需要更新的辅助函数
 */
export function needsHullWorldUpdate(
  world: World,
  _entity: number,
  hull: ConvexHull2D,
  cache: HullWorld2D,
  _body: Body2D
): boolean {
  const currentFrame = world.frame || 0;

  // Always update if cache is outdated
  // 如果缓存过时则总是更新
  if (cache.epoch < currentFrame - 1) return true;

  // Check if vertex count changed
  // 检查顶点数量是否改变
  if (cache.count !== hull.count) return true;

  // Check if arrays are not properly sized
  // 检查数组是否正确大小
  if (cache.wverts.length < hull.count * 2) return true;
  if (cache.normals.length < hull.count * 2) return true;

  return false;
}

/**
 * Manual update for a specific entity (useful for selective updates)
 * 对特定实体的手动更新（用于选择性更新）
 */
export function updateEntityHullWorld(
  world: World,
  entity: number,
  hull: ConvexHull2D,
  cache: HullWorld2D,
  body: Body2D
): void {
  if (!needsHullWorldUpdate(world, entity, hull, cache, body)) return;

  const vertexCount = hull.count | 0;
  if (vertexCount <= 0) return;

  const requiredSize = vertexCount * 2;
  if (cache.wverts.length < requiredSize) {
    cache.wverts = new Array(requiredSize);
    cache.normals = new Array(requiredSize);
  }
  cache.count = vertexCount;

  const [cos, sin] = getCosSin(world, entity);
  const px = body.px;
  const py = body.py;

  // Transform vertices
  // 变换顶点
  for (let i = 0; i < vertexCount; i++) {
    const localX = hull.verts[i * 2];
    const localY = hull.verts[i * 2 + 1];

    const rotatedX = sub(mul(localX, cos), mul(localY, sin));
    const rotatedY = add(mul(localX, sin), mul(localY, cos));

    cache.wverts[i * 2] = add(px, rotatedX);
    cache.wverts[i * 2 + 1] = add(py, rotatedY);
  }

  // Compute normals
  // 计算法线
  for (let i = 0; i < vertexCount; i++) {
    const nextIndex = (i + 1) % vertexCount;

    const edgeX = sub(cache.wverts[nextIndex * 2], cache.wverts[i * 2]);
    const edgeY = sub(cache.wverts[nextIndex * 2 + 1], cache.wverts[i * 2 + 1]);

    cache.normals[i * 2] = edgeY;
    cache.normals[i * 2 + 1] = neg(edgeX);
  }

  cache.epoch = world.frame;
}