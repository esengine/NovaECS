/**
 * Circle World Synchronization System
 * 圆形世界同步系统
 *
 * Updates world space circle cache for all entities with Circle2D components.
 * Transforms local circle center to world coordinates using body position and rotation.
 * 为所有具有Circle2D组件的实体更新世界空间圆形缓存。
 * 使用刚体位置和旋转将局部圆心变换到世界坐标。
 */

import { system, SystemContext } from '../../core/System';
import { Circle2D } from '../../components/Circle2D';
import { CircleWorld2D } from '../../components/CircleWorld2D';
import { Body2D } from '../../components/Body2D';
import { Rot2D } from '../../components/Rot2D';
import type { World } from '../../core/World';
import type { FX } from '../../math/fixed';
import { add, mul, neg, angleToCosSin, f } from '../../math/fixed';

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
 * Circle World Synchronization System
 * 圆形世界同步系统
 *
 * Transforms circle local offsets to world space using body transform.
 * Updates CircleWorld2D cache for efficient collision detection.
 * 使用刚体变换将圆形局部偏移变换到世界空间。
 * 更新CircleWorld2D缓存以实现高效碰撞检测。
 */
export const SyncCircleWorld2D = system(
  'geom.syncCircleWorld2D',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query entities with required components
    // 查询具有所需组件的实体
    world
      .query(Circle2D, CircleWorld2D, Body2D)
      .forEach((entity, circle: Circle2D, cache: CircleWorld2D, body: Body2D) => {
        // Get rotation for transforming local offset
        // 获取旋转以变换局部偏移
        const [cos, sin] = getCosSin(world, entity);

        // Transform local offset to world space
        // World center = body position + rotated local offset
        // 将局部偏移变换到世界空间
        // 世界中心 = 刚体位置 + 旋转的局部偏移

        // Rotated offset: [cos -sin] [ox]   [ox*cos - oy*sin]
        //                 [sin  cos] [oy] = [ox*sin + oy*cos]
        // 旋转偏移：[cos -sin] [ox]   [ox*cos - oy*sin]
        //          [sin  cos] [oy] = [ox*sin + oy*cos]
        const rotatedOffsetX = add(mul(circle.ox, cos), mul(circle.oy, neg(sin)));
        const rotatedOffsetY = add(mul(circle.ox, sin), mul(circle.oy, cos));

        // Final world position
        // 最终世界位置
        cache.cx = add(body.px, rotatedOffsetX);
        cache.cy = add(body.py, rotatedOffsetY);

        // Update cache epoch for invalidation tracking
        // 更新缓存纪元以进行失效跟踪
        cache.epoch = world.frame;
      });
  }
);

/**
 * Helper function to check if circle world cache needs update
 * 检查圆形世界缓存是否需要更新的辅助函数
 */
export function needsCircleWorldUpdate(
  world: World,
  _entity: number,
  _circle: Circle2D,
  cache: CircleWorld2D,
  _body: Body2D
): boolean {
  const currentFrame = world.frame || 0;

  // Always update if cache is outdated
  // 如果缓存过时则总是更新
  if (cache.epoch < currentFrame - 1) return true;

  // Additional checks for changes can be added here
  // 可以在此处添加其他变更检查
  // For example: body transform changes, circle offset changes, etc.
  // 例如：刚体变换变更、圆形偏移变更等

  return false;
}

/**
 * Manual update for a specific entity (useful for selective updates)
 * 对特定实体的手动更新（用于选择性更新）
 */
export function updateEntityCircleWorld(
  world: World,
  entity: number,
  circle: Circle2D,
  cache: CircleWorld2D,
  body: Body2D
): void {
  if (!needsCircleWorldUpdate(world, entity, circle, cache, body)) return;

  // Get rotation for transforming local offset
  // 获取旋转以变换局部偏移
  const [cos, sin] = getCosSin(world, entity);

  // Transform local offset to world space
  // 将局部偏移变换到世界空间
  const rotatedOffsetX = add(mul(circle.ox, cos), mul(circle.oy, neg(sin)));
  const rotatedOffsetY = add(mul(circle.ox, sin), mul(circle.oy, cos));

  // Update world position
  // 更新世界位置
  cache.cx = add(body.px, rotatedOffsetX);
  cache.cy = add(body.py, rotatedOffsetY);

  // Update cache epoch
  // 更新缓存纪元
  cache.epoch = world.frame;
}