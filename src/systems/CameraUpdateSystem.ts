/**
 * Camera Update System for Rendering Pipeline
 * 用于渲染管线的相机更新系统
 *
 * Updates camera matrices, viewport settings, and manages camera state changes.
 * Calculates view and projection matrices for 2D orthographic rendering.
 * 更新相机矩阵、视口设置并管理相机状态变化。
 * 计算用于2D正交渲染的视图和投影矩阵。
 */

import { system, SystemContext } from '../core/System';
import { Camera2D } from '../components/Camera2D';
import { LocalTransform, WorldTransform } from '../components/Transform';

/**
 * Create 2D orthographic projection matrix
 * 创建2D正交投影矩阵
 *
 * @param left Left boundary 左边界
 * @param right Right boundary 右边界
 * @param bottom Bottom boundary 下边界
 * @param top Top boundary 上边界
 * @param near Near clipping plane 近裁剪平面
 * @param far Far clipping plane 远裁剪平面
 * @returns 3x3 projection matrix in column-major order
 */
const createOrthographicMatrix = (
  left: number,
  right: number,
  bottom: number,
  top: number,
  _near: number,
  _far: number
): number[] => {
  const width = right - left;
  const height = top - bottom;

  return [
    2 / width,               0,                    0,
    0,                       2 / height,          0,
    -(right + left) / width, -(top + bottom) / height, 1
  ];
};

/**
 * Create 2D view matrix from transform
 * 从变换创建2D视图矩阵
 *
 * @param x Camera position X 相机位置X
 * @param y Camera position Y 相机位置Y
 * @param rotation Camera rotation in radians 相机旋转（弧度）
 * @param zoom Camera zoom factor 相机缩放因子
 * @returns 3x3 view matrix in column-major order
 */
const createViewMatrix = (
  x: number,
  y: number,
  rotation: number,
  zoom: number
): number[] => {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const scale = 1 / zoom;

  return [
    cos * scale,  sin * scale,  0,
    -sin * scale, cos * scale,  0,
    -x * cos * scale + y * sin * scale, -x * -sin * scale - y * cos * scale, 1
  ];
};

/**
 * Multiply two 3x3 matrices
 * 乘以两个3x3矩阵
 *
 * @param a First matrix 第一个矩阵
 * @param b Second matrix 第二个矩阵
 * @returns Resulting matrix 结果矩阵
 */
const multiplyMatrix3 = (a: number[], b: number[]): number[] => {
  return [
    a[0] * b[0] + a[3] * b[1] + a[6] * b[2],   // m00
    a[1] * b[0] + a[4] * b[1] + a[7] * b[2],   // m10
    a[2] * b[0] + a[5] * b[1] + a[8] * b[2],   // m20

    a[0] * b[3] + a[3] * b[4] + a[6] * b[5],   // m01
    a[1] * b[3] + a[4] * b[4] + a[7] * b[5],   // m11
    a[2] * b[3] + a[5] * b[4] + a[8] * b[5],   // m21

    a[0] * b[6] + a[3] * b[7] + a[6] * b[8],   // m02
    a[1] * b[6] + a[4] * b[7] + a[7] * b[8],   // m12
    a[2] * b[6] + a[5] * b[7] + a[8] * b[8],   // m22
  ];
};

/**
 * Camera Update System - recalculates camera matrices when needed
 * 相机更新系统 - 在需要时重新计算相机矩阵
 */
export const CameraUpdateSystem = system(
  'render.camera.update',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Query cameras with transforms
    world.query(Camera2D, LocalTransform).forEach((entity, camera, transform) => {
      // Skip if camera doesn't need updating
      if (!camera.dirty) {
        return;
      }

      // Calculate view bounds based on zoom and camera size
      const halfWidth = (camera.width / 2) / camera.zoom;
      const halfHeight = (camera.height / 2) / camera.zoom;

      // Create projection matrix
      camera.projectionMatrix = createOrthographicMatrix(
        -halfWidth,
        halfWidth,
        -halfHeight,
        halfHeight,
        camera.near,
        camera.far
      );

      // Create view matrix from camera transform
      camera.viewMatrix = createViewMatrix(
        transform.x,
        transform.y,
        transform.rot,
        camera.zoom
      );

      // Combine view and projection matrices
      camera.viewProjectionMatrix = multiplyMatrix3(
        camera.projectionMatrix,
        camera.viewMatrix
      );

      // Update viewport if needed
      if (camera.viewport[2] !== camera.width || camera.viewport[3] !== camera.height) {
        camera.viewport[2] = camera.width;
        camera.viewport[3] = camera.height;
      }

      // Mark camera as updated
      camera.dirty = false;

      // Mark world transform as changed for other systems
      world.markChanged(entity, Camera2D);
    });

    // Query cameras without explicit transforms (using world transform)
    world.query(Camera2D, WorldTransform).without(LocalTransform).forEach((entity, camera, worldTransform) => {
      if (!camera.dirty) {
        return;
      }

      // Extract position and rotation from world transform matrix
      const m = worldTransform.m;
      const x = m[6]; // Translation X
      const y = m[7]; // Translation Y
      const rotation = Math.atan2(m[1], m[0]); // Rotation from matrix

      // Calculate view bounds
      const halfWidth = (camera.width / 2) / camera.zoom;
      const halfHeight = (camera.height / 2) / camera.zoom;

      // Create projection matrix
      camera.projectionMatrix = createOrthographicMatrix(
        -halfWidth,
        halfWidth,
        -halfHeight,
        halfHeight,
        camera.near,
        camera.far
      );

      // Create view matrix
      camera.viewMatrix = createViewMatrix(x, y, rotation, camera.zoom);

      // Combine matrices
      camera.viewProjectionMatrix = multiplyMatrix3(
        camera.projectionMatrix,
        camera.viewMatrix
      );

      // Update viewport
      if (camera.viewport[2] !== camera.width || camera.viewport[3] !== camera.height) {
        camera.viewport[2] = camera.width;
        camera.viewport[3] = camera.height;
      }

      camera.dirty = false;
      world.markChanged(entity, Camera2D);
    });
  }
)
  .stage('preUpdate')
  .inSet('rendering')
  .build();

/**
 * Mark camera as dirty when transform changes
 * 当变换改变时将相机标记为脏
 */
export const CameraTransformSyncSystem = system(
  'render.camera.transformSync',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // For now, we'll mark all cameras as dirty each frame
    // In a real implementation, we would track component changes more efficiently
    world.query(Camera2D).forEach((_entity, camera) => {
      camera.dirty = true;
    });
  }
)
  .stage('preUpdate')
  .before('render.camera.update')
  .inSet('rendering')
  .build();

/**
 * Initialize camera with default settings
 * 使用默认设置初始化相机
 *
 * @param camera Camera component to initialize
 * @param width Viewport width
 * @param height Viewport height
 */
export const initializeCamera = (
  camera: Camera2D,
  width: number = 800,
  height: number = 600
): void => {
  camera.width = width;
  camera.height = height;
  camera.viewport = [0, 0, width, height];
  camera.dirty = true;
};

/**
 * Set camera zoom and mark for update
 * 设置相机缩放并标记更新
 *
 * @param camera Camera component
 * @param zoom New zoom factor
 */
export const setCameraZoom = (camera: Camera2D, zoom: number): void => {
  if (camera.zoom !== zoom) {
    camera.zoom = Math.max(0.01, zoom); // Prevent zero/negative zoom
    camera.dirty = true;
  }
};

/**
 * Resize camera viewport
 * 调整相机视口大小
 *
 * @param camera Camera component
 * @param width New width
 * @param height New height
 */
export const resizeCamera = (camera: Camera2D, width: number, height: number): void => {
  if (camera.width !== width || camera.height !== height) {
    camera.width = width;
    camera.height = height;
    camera.viewport = [camera.viewport[0], camera.viewport[1], width, height];
    camera.dirty = true;
  }
};