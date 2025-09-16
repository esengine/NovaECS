/**
 * AABB Synchronization System
 * AABB同步系统
 *
 * Updates axis-aligned bounding boxes for all entities with Body2D and ShapeCircle components
 * when they change. Only processes entities that have been modified since the last frame.
 * 当带有Body2D和ShapeCircle组件的所有实体发生变化时更新轴对齐包围盒。
 * 仅处理自上一帧以来已修改的实体。
 */

import { system, SystemContext } from '../../core/System';
import { Body2D } from '../../components/Body2D';
import { ShapeCircle } from '../../components/ShapeCircle';
import { AABB2D } from '../../components/AABB2D';
import { sub, add } from '../../math/fixed';

/**
 * System that synchronizes AABB bounds with Body2D position and ShapeCircle radius
 * 将AABB边界与Body2D位置和ShapeCircle半径同步的系统
 *
 * This system runs after physics integration to update bounding boxes
 * for broadphase collision detection.
 * 此系统在物理积分后运行，更新包围盒用于宽相碰撞检测。
 */
export const SyncAABBSystem = system(
  'phys.syncAABB',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query entities with all three components and check for changes
    // 查询具有所有三个组件的实体并检查变更
    world
      .query(Body2D, ShapeCircle, AABB2D)
      .changed(Body2D)
      .forEach((_entity, body: Body2D, circle: ShapeCircle, aabb: AABB2D) => {
        // Calculate AABB bounds from circle center and radius
        // 从圆心和半径计算AABB边界
        const r = circle.r;
        aabb.minx = sub(body.px, r);
        aabb.maxx = add(body.px, r);
        aabb.miny = sub(body.py, r);
        aabb.maxy = add(body.py, r);

        // Update epoch for change tracking
        // 更新时期以进行变更跟踪
        aabb.epoch = world.frame;
      });
  }
)
  .stage('update')
  .after('phys.integrateVelocities')
  .inSet('physics');

/**
 * Alternative implementation using direct world API if .changed() is not available
 * 如果.changed()不可用，使用直接world API的替代实现
 */
export const SyncAABBSystemDirect = system(
  'phys.syncAABB.direct',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query all entities with the required components
    // 查询所有具有所需组件的实体
    world
      .query(Body2D, ShapeCircle, AABB2D)
      .forEach((_entity, body: Body2D, circle: ShapeCircle, aabb: AABB2D) => {
        // Check if we need to update (compare with last frame)
        // 检查是否需要更新（与上一帧比较）
        const currentFrame = world.frame;
        if (aabb.epoch >= currentFrame) {
          return; // Already updated this frame
        }

        // Calculate AABB bounds from circle center and radius
        // 从圆心和半径计算AABB边界
        const r = circle.r;
        const newMinX = sub(body.px, r);
        const newMaxX = add(body.px, r);
        const newMinY = sub(body.py, r);
        const newMaxY = add(body.py, r);

        // Only update if bounds have actually changed
        // 仅在边界实际发生变化时更新
        if (aabb.minx !== newMinX || aabb.maxx !== newMaxX ||
            aabb.miny !== newMinY || aabb.maxy !== newMaxY) {
          aabb.minx = newMinX;
          aabb.maxx = newMaxX;
          aabb.miny = newMinY;
          aabb.maxy = newMaxY;
          aabb.epoch = currentFrame;
        }
      });
  }
)
  .stage('update')
  .after('phys.integrateVelocities')
  .inSet('physics');