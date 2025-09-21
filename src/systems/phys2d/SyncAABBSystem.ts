/**
 * AABB Synchronization System
 * AABB同步系统
 *
 * Updates axis-aligned bounding boxes for all entities with Body2D and collision shapes
 * (ShapeCircle or ConvexHull2D). Only processes entities that have been modified since the last frame.
 * 当带有Body2D和碰撞形状（ShapeCircle或ConvexHull2D）组件的所有实体发生变化时更新轴对齐包围盒。
 * 仅处理自上一帧以来已修改的实体。
 */

import { system, SystemContext } from '../../core/System';
import { Body2D } from '../../components/Body2D';
import { ShapeCircle } from '../../components/ShapeCircle';
import { ConvexHull2D } from '../../components/ConvexHull2D';
import { HullWorld2D } from '../../components/HullWorld2D';
import { AABB2D } from '../../components/AABB2D';
import { sub, add, min, max, mul } from '../../math/fixed';
import type { FX } from '../../math/fixed';

/**
 * System that synchronizes AABB bounds with Body2D position and collision shapes
 * 将AABB边界与Body2D位置和碰撞形状同步的系统
 *
 * This system runs after physics integration to update bounding boxes
 * for broadphase collision detection. Processes all entities each frame for reliability.
 * 此系统在物理积分后运行，更新包围盒用于宽相碰撞检测。为了可靠性，每帧处理所有实体。
 */
export const SyncAABBSystem = system(
  'phys.syncAABB',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query entities with circles
    // 查询带有圆形的实体
    world
      .query(Body2D, ShapeCircle, AABB2D)
      .forEach((entity, body: Body2D, circle: ShapeCircle, aabb: AABB2D) => {
        // Calculate AABB bounds from circle center and radius
        // 从圆心和半径计算AABB边界
        const r = circle.r;

        // For CCD, extend AABB to include movement over one frame
        // 对于CCD，扩展AABB以包含一帧内的移动
        const dt = world.getFixedDtFX();
        const deltaX = mul(body.vx, dt);
        const deltaY = mul(body.vy, dt);

        // Calculate current and future positions
        // 计算当前和未来位置
        const currentMinX = sub(body.px, r);
        const currentMaxX = add(body.px, r);
        const currentMinY = sub(body.py, r);
        const currentMaxY = add(body.py, r);

        const futureMinX = sub(add(body.px, deltaX), r);
        const futureMaxX = add(add(body.px, deltaX), r);
        const futureMinY = sub(add(body.py, deltaY), r);
        const futureMaxY = add(add(body.py, deltaY), r);

        // Swept AABB covers both current and future positions
        // 扫描AABB覆盖当前和未来位置
        aabb.minx = min(currentMinX, futureMinX);
        aabb.maxx = max(currentMaxX, futureMaxX);
        aabb.miny = min(currentMinY, futureMinY);
        aabb.maxy = max(currentMaxY, futureMaxY);

        // Update epoch for change tracking
        // 更新时期以进行变更跟踪
        aabb.epoch = world.frame;

        // Save the modified AABB component back to the world
        // 将修改后的AABB组件保存回世界
        world.replaceComponent(entity, AABB2D, aabb);
      });

    // Query entities with convex hulls
    // 查询带有凸包的实体
    world
      .query(Body2D, ConvexHull2D, HullWorld2D)
      .forEach((entity, body: Body2D, hull: ConvexHull2D, hullWorld: HullWorld2D) => {
        const aabb = world.getComponent(entity, AABB2D);
        if (!aabb) return;

        // Calculate AABB bounds from transformed vertices
        // 从变换后的顶点计算AABB边界
        if (hullWorld.count === 0) {
          // Fallback to body position if hull not yet transformed
          // 如果凸包尚未变换，则回退到物体位置
          aabb.minx = body.px;
          aabb.maxx = body.px;
          aabb.miny = body.py;
          aabb.maxy = body.py;
        } else {
          // Find min/max from world vertices
          // 从世界顶点找到最小/最大值
          let minX: FX = hullWorld.wverts[0];
          let maxX: FX = hullWorld.wverts[0];
          let minY: FX = hullWorld.wverts[1];
          let maxY: FX = hullWorld.wverts[1];

          for (let i = 1; i < hullWorld.count; i++) {
            const x = hullWorld.wverts[i * 2];
            const y = hullWorld.wverts[i * 2 + 1];
            minX = min(minX, x);
            maxX = max(maxX, x);
            minY = min(minY, y);
            maxY = max(maxY, y);
          }

          // Expand by hull skin radius
          // 按凸包皮肤半径扩展
          const skinRadius = hull.radius;
          aabb.minx = sub(minX, skinRadius);
          aabb.maxx = add(maxX, skinRadius);
          aabb.miny = sub(minY, skinRadius);
          aabb.maxy = add(maxY, skinRadius);

        }

        // Update epoch for change tracking
        // 更新时期以进行变更跟踪
        aabb.epoch = world.frame;

        // Save the modified AABB component back to the world
        // 将修改后的AABB组件保存回世界
        world.replaceComponent(entity, AABB2D, aabb);
      });
  }
)
  .stage('update')
  .after('geom.syncHullWorld2D')
  .inSet('physics')
  .build();

