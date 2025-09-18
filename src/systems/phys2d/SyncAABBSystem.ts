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
 * for broadphase collision detection. Processes all entities each frame for reliability.
 * 此系统在物理积分后运行，更新包围盒用于宽相碰撞检测。为了可靠性，每帧处理所有实体。
 */
export const SyncAABBSystem = system(
  'phys.syncAABB',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query all entities with the required components
    // 查询所有具有所需组件的实体
    world
      .query(Body2D, ShapeCircle, AABB2D)
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
  .inSet('physics')
  .build();

