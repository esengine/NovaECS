/**
 * 2D Camera Component for Rendering System
 * 用于渲染系统的2D相机组件
 *
 * Defines the viewing area, projection matrix, and viewport settings for 2D rendering.
 * Supports orthographic projection with configurable viewport and render layer filtering.
 * 定义2D渲染的可视区域、投影矩阵和视口设置。
 * 支持正交投影，具有可配置的视口和渲染层过滤。
 */

/**
 * 2D Camera component for orthographic projection
 * 2D相机组件，用于正交投影
 */
export class Camera2D {
  /**
   * Viewport width in world units
   * 世界单位的视口宽度
   */
  width: number = 800;

  /**
   * Viewport height in world units
   * 世界单位的视口高度
   */
  height: number = 600;

  /**
   * Camera zoom factor (1.0 = normal, >1.0 = zoom in, <1.0 = zoom out)
   * 相机缩放因子（1.0 = 正常，>1.0 = 放大，<1.0 = 缩小）
   */
  zoom: number = 1.0;

  /**
   * Near clipping plane (for depth testing)
   * 近裁剪平面（用于深度测试）
   */
  near: number = -1000;

  /**
   * Far clipping plane (for depth testing)
   * 远裁剪平面（用于深度测试）
   */
  far: number = 1000;

  /**
   * Rendering priority (lower values render first)
   * 渲染优先级（较低值先渲染）
   */
  priority: number = 0;

  /**
   * Render layer mask (bitfield for layer filtering)
   * 渲染层掩码（用于层过滤的位字段）
   */
  layerMask: number = 0xFFFFFFFF;

  /**
   * Viewport rectangle in screen coordinates [x, y, width, height]
   * 屏幕坐标中的视口矩形 [x, y, width, height]
   */
  viewport: [number, number, number, number] = [0, 0, 800, 600];

  /**
   * Background clear color [r, g, b, a] (0-1 range)
   * 背景清除颜色 [r, g, b, a]（0-1范围）
   */
  clearColor: [number, number, number, number] = [0, 0, 0, 1];

  /**
   * Whether to clear color buffer before rendering
   * 渲染前是否清除颜色缓冲区
   */
  clearColorBuffer: boolean = true;

  /**
   * Whether to clear depth buffer before rendering
   * 渲染前是否清除深度缓冲区
   */
  clearDepthBuffer: boolean = true;

  /**
   * Cached projection matrix [3x3 matrix in column-major order]
   * 缓存的投影矩阵（列主序的3x3矩阵）
   */
  projectionMatrix: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /**
   * Cached view matrix [3x3 matrix in column-major order]
   * 缓存的视图矩阵（列主序的3x3矩阵）
   */
  viewMatrix: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /**
   * Combined view-projection matrix for rendering
   * 用于渲染的组合视图-投影矩阵
   */
  viewProjectionMatrix: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /**
   * Whether the camera matrices need to be recalculated
   * 相机矩阵是否需要重新计算
   */
  dirty: boolean = true;
}

/**
 * Create a standard 2D camera with orthographic projection
 * 创建具有正交投影的标准2D相机
 *
 * @param width Viewport width in world units
 * @param height Viewport height in world units
 * @param zoom Initial zoom factor
 * @returns Configured Camera2D instance
 */
export const createCamera2D = (
  width: number = 800,
  height: number = 600,
  zoom: number = 1.0
): Camera2D => {
  const camera = new Camera2D();
  camera.width = width;
  camera.height = height;
  camera.zoom = zoom;
  camera.viewport = [0, 0, width, height];
  return camera;
};

/**
 * Create a camera with specific viewport settings
 * 创建具有特定视口设置的相机
 *
 * @param x Viewport X offset
 * @param y Viewport Y offset
 * @param width Viewport width
 * @param height Viewport height
 * @returns Configured Camera2D instance
 */
export const createViewportCamera = (
  x: number,
  y: number,
  width: number,
  height: number
): Camera2D => {
  const camera = createCamera2D(width, height);
  camera.viewport = [x, y, width, height];
  return camera;
};