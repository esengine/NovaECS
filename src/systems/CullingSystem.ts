/**
 * Frustum Culling System for Rendering Optimization
 * 用于渲染优化的视锥剔除系统
 *
 * Performs visibility culling to avoid rendering objects outside camera view.
 * Supports different culling strategies and provides visibility status for rendering.
 * 执行可见性剔除以避免渲染相机视野外的对象。
 * 支持不同的剔除策略并为渲染提供可见性状态。
 */

import { system, SystemContext } from '../core/System';
import { Camera2D } from '../components/Camera2D';
import { Sprite } from '../components/Sprite';
import { RenderLayer, isLayerVisible } from '../components/RenderLayer';
import { LocalTransform, WorldTransform } from '../components/Transform';
import { AABB2D } from '../components/AABB2D';

/**
 * Visibility result for culling
 * 剔除的可见性结果
 */
export enum VisibilityResult {
  Visible = 0,      // Object is visible 对象可见
  Culled = 1,       // Object is culled 对象被剔除
  PartiallyVisible = 2, // Object is partially visible 对象部分可见
}

/**
 * Culling statistics for performance monitoring
 * 用于性能监控的剔除统计
 */
export interface CullingStats {
  /** Total objects processed 处理的总对象数 */
  totalObjects: number;
  /** Objects marked as visible 标记为可见的对象 */
  visibleObjects: number;
  /** Objects culled 被剔除的对象 */
  culledObjects: number;
  /** Objects outside layer mask 层掩码外的对象 */
  layerCulledObjects: number;
  /** Culling efficiency (0-1) 剔除效率 */
  cullingEfficiency: number;
}

/**
 * Frustum bounds for 2D culling
 * 用于2D剔除的视锥边界
 */
export interface FrustumBounds {
  /** Left boundary 左边界 */
  left: number;
  /** Right boundary 右边界 */
  right: number;
  /** Top boundary 上边界 */
  top: number;
  /** Bottom boundary 下边界 */
  bottom: number;
  /** Camera position X 相机位置X */
  cameraX: number;
  /** Camera position Y 相机位置Y */
  cameraY: number;
  /** Camera zoom factor 相机缩放因子 */
  zoom: number;
}

/**
 * Visible object component (added by culling system)
 * 可见对象组件（由剔除系统添加）
 */
export class Visible {
  /** Visibility result 可见性结果 */
  result: VisibilityResult = VisibilityResult.Visible;
  /** Distance from camera 距离相机的距离 */
  distanceFromCamera: number = 0;
  /** Frame when visibility was last updated 最后更新可见性的帧 */
  lastUpdateFrame: number = 0;
}

/**
 * Calculate frustum bounds from camera
 * 从相机计算视锥边界
 *
 * @param camera Camera component
 * @param transform Camera transform (optional)
 * @returns Frustum bounds
 */
const calculateFrustumBounds = (
  camera: Camera2D,
  transform?: LocalTransform | WorldTransform
): FrustumBounds => {
  let cameraX = 0;
  let cameraY = 0;

  if (transform) {
    if ('x' in transform) {
      // LocalTransform
      cameraX = transform.x;
      cameraY = transform.y;
    } else {
      // WorldTransform - extract position from matrix
      cameraX = transform.m[6];
      cameraY = transform.m[7];
    }
  }

  const halfWidth = (camera.width / 2) / camera.zoom;
  const halfHeight = (camera.height / 2) / camera.zoom;

  // Add some margin for partially visible objects
  const margin = Math.max(halfWidth, halfHeight) * 0.1;

  return {
    left: cameraX - halfWidth - margin,
    right: cameraX + halfWidth + margin,
    top: cameraY + halfHeight + margin,
    bottom: cameraY - halfHeight - margin,
    cameraX,
    cameraY,
    zoom: camera.zoom,
  };
};

/**
 * Test AABB against frustum bounds
 * 测试AABB与视锥边界
 *
 * @param aabb AABB component
 * @param frustum Frustum bounds
 * @returns Visibility result
 */
const testAABBInFrustum = (aabb: AABB2D, frustum: FrustumBounds): VisibilityResult => {
  // Quick rejection test
  if (aabb.maxx < frustum.left || aabb.minx > frustum.right ||
      aabb.maxy < frustum.bottom || aabb.miny > frustum.top) {
    return VisibilityResult.Culled;
  }

  // Check if completely inside
  if (aabb.minx >= frustum.left && aabb.maxx <= frustum.right &&
      aabb.miny >= frustum.bottom && aabb.maxy <= frustum.top) {
    return VisibilityResult.Visible;
  }

  // Partially visible
  return VisibilityResult.PartiallyVisible;
};

/**
 * Test sprite bounds against frustum (when no AABB available)
 * 测试精灵边界与视锥（当没有AABB可用时）
 *
 * @param sprite Sprite component
 * @param transform Object transform
 * @param frustum Frustum bounds
 * @returns Visibility result
 */
const testSpriteInFrustum = (
  sprite: Sprite,
  transform: LocalTransform | WorldTransform,
  frustum: FrustumBounds
): VisibilityResult => {
  let x, y;
  if ('x' in transform) {
    x = transform.x;
    y = transform.y;
  } else {
    x = transform.m[6];
    y = transform.m[7];
  }

  // Calculate sprite bounds
  const halfWidth = sprite.width / 2;
  const halfHeight = sprite.height / 2;
  const left = x - halfWidth;
  const right = x + halfWidth;
  const top = y + halfHeight;
  const bottom = y - halfHeight;

  // Quick rejection
  if (right < frustum.left || left > frustum.right ||
      top < frustum.bottom || bottom > frustum.top) {
    return VisibilityResult.Culled;
  }

  // Check if completely inside
  if (left >= frustum.left && right <= frustum.right &&
      bottom >= frustum.bottom && top <= frustum.top) {
    return VisibilityResult.Visible;
  }

  return VisibilityResult.PartiallyVisible;
};

/**
 * Calculate distance from camera
 * 计算距离相机的距离
 *
 * @param objectX Object X position
 * @param objectY Object Y position
 * @param frustum Frustum bounds
 * @returns Distance squared (for performance)
 */
const calculateDistanceFromCamera = (
  objectX: number,
  objectY: number,
  frustum: FrustumBounds
): number => {
  const dx = objectX - frustum.cameraX;
  const dy = objectY - frustum.cameraY;
  return dx * dx + dy * dy;
};

/**
 * Frustum Culling System - performs visibility culling for renderable objects
 * 视锥剔除系统 - 对可渲染对象执行可见性剔除
 */
export const FrustumCullingSystem = system(
  'render.culling.frustum',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const cmd = world.cmd();

    // Get all active cameras with their transforms
    const cameras: Array<{
      entity: number,
      camera: Camera2D,
      transform?: LocalTransform | WorldTransform,
      frustum: FrustumBounds
    }> = [];

    // Collect cameras with local transforms
    world.query(Camera2D, LocalTransform).forEach((entity, camera, transform) => {
      if (camera.layerMask !== 0) { // Only active cameras
        cameras.push({
          entity,
          camera,
          transform,
          frustum: calculateFrustumBounds(camera, transform)
        });
      }
    });

    // Collect cameras with world transforms (that don't have local transforms)
    world.query(Camera2D, WorldTransform).without(LocalTransform).forEach((entity, camera, worldTransform) => {
      if (camera.layerMask !== 0) {
        cameras.push({
          entity,
          camera,
          transform: worldTransform,
          frustum: calculateFrustumBounds(camera, worldTransform)
        });
      }
    });

    if (cameras.length === 0) {
      return; // No active cameras
    }

    // Cull objects with AABB and RenderLayer
    world.query(AABB2D, RenderLayer).forEach((entity, aabb, layer) => {
      let isVisible = false;

      // Test against each camera
      for (const cameraInfo of cameras) {
        // Check layer visibility
        if (!isLayerVisible(layer.layer, cameraInfo.camera.layerMask)) {
          continue;
        }

        // Test against frustum
        const result = testAABBInFrustum(aabb, cameraInfo.frustum);
        if (result !== VisibilityResult.Culled) {
          isVisible = true;
          break;
        }
      }

      // Add or update visibility component
      let visible = world.getComponent(entity, Visible);
      if (!visible) {
        visible = new Visible();
        cmd.addInstance(entity, visible);
      }

      visible.result = isVisible ? VisibilityResult.Visible : VisibilityResult.Culled;
      visible.lastUpdateFrame = world.frame;

      if (isVisible) {
        // Calculate distance from first camera for sorting
        const transform = world.getComponent(entity, LocalTransform) || world.getComponent(entity, WorldTransform);
        if (transform) {
          let x, y;
          if ('x' in transform) {
            x = transform.x;
            y = transform.y;
          } else {
            x = transform.m[6];
            y = transform.m[7];
          }
          visible.distanceFromCamera = calculateDistanceFromCamera(x, y, cameras[0].frustum);
        }
      }
    });

    // Cull sprites without AABB
    world.query(Sprite, RenderLayer).without(AABB2D).forEach((entity, sprite, layer) => {

      // Get transform
      const localTransform = world.getComponent(entity, LocalTransform);
      const worldTransform = world.getComponent(entity, WorldTransform);
      const transform = localTransform || worldTransform;

      if (!transform) {
        return; // No transform, can't cull
      }

      let isVisible = false;

      // Test against each camera
      for (const cameraInfo of cameras) {
        // Check layer visibility
        if (!isLayerVisible(layer.layer, cameraInfo.camera.layerMask)) {
          continue;
        }

        // Test against frustum
        const result = testSpriteInFrustum(sprite, transform, cameraInfo.frustum);
        if (result !== VisibilityResult.Culled) {
          isVisible = true;
          break;
        }
      }

      // Add or update visibility component
      let visible = world.getComponent(entity, Visible);
      if (!visible) {
        visible = new Visible();
        cmd.addInstance(entity, visible);
      }

      visible.result = isVisible ? VisibilityResult.Visible : VisibilityResult.Culled;
      visible.lastUpdateFrame = world.frame;

      if (isVisible) {
        let x, y;
        if ('x' in transform) {
          x = transform.x;
          y = transform.y;
        } else {
          x = transform.m[6];
          y = transform.m[7];
        }
        visible.distanceFromCamera = calculateDistanceFromCamera(x, y, cameras[0].frustum);
      }
    });

    // Flush command buffer to apply pending additions
    world.flush(cmd);
  }
)
  .stage('preUpdate')
  .after('render.camera.update')
  .inSet('rendering')
  .build();

/**
 * Cleanup invisible objects system - removes stale visibility components
 * 清理不可见对象系统 - 移除过时的可见性组件
 */
export const CleanupVisibilitySystem = system(
  'render.culling.cleanup',
  (ctx: SystemContext) => {
    const { world } = ctx;
    const cmd = world.cmd();
    const currentFrame = world.frame;
    const maxAge = 60; // Remove visibility components not updated for 60 frames

    world.query(Visible).forEach((entity, visible) => {
      if (currentFrame - visible.lastUpdateFrame > maxAge) {
        cmd.remove(entity, Visible);
      }
    });

    // Flush command buffer to apply pending removals
    world.flush(cmd);
  }
)
  .stage('postUpdate')
  .inSet('rendering')
  .build();

/**
 * Get culling statistics for the current frame
 * 获取当前帧的剔除统计
 *
 * @param world World instance
 * @returns Culling statistics
 */
export const getCullingStats = (world: any): CullingStats => {
  let totalObjects = 0;
  let visibleObjects = 0;
  let culledObjects = 0;

  world.query(Visible).forEach((_: any, visible: Visible) => {
    totalObjects++;
    if (visible.result === VisibilityResult.Culled) {
      culledObjects++;
    } else {
      visibleObjects++;
    }
  });

  const cullingEfficiency = totalObjects > 0 ? culledObjects / totalObjects : 0;

  return {
    totalObjects,
    visibleObjects,
    culledObjects,
    layerCulledObjects: 0, // Would need additional tracking
    cullingEfficiency,
  };
};