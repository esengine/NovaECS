/**
 * Editor Camera Component
 * 编辑器相机组件
 *
 * Controls camera behavior specific to the editor
 * 控制编辑器特定的相机行为
 */

export class EditorCamera {
  /** Camera zoom level 相机缩放级别 */
  zoom: number = 1.0;

  /** Pan speed for mouse/keyboard movement 鼠标/键盘移动的平移速度 */
  panSpeed: number = 1.0;

  /** Zoom speed for mouse wheel 鼠标滚轮的缩放速度 */
  zoomSpeed: number = 0.1;

  /** Minimum zoom level 最小缩放级别 */
  minZoom: number = 0.1;

  /** Maximum zoom level 最大缩放级别 */
  maxZoom: number = 10.0;

  /** Whether camera is currently panning 相机当前是否正在平移 */
  isPanning: boolean = false;

  /** Last mouse position for panning 用于平移的上一个鼠标位置 */
  lastMouseX: number = 0;
  lastMouseY: number = 0;

  /** Camera movement bounds (optional) 相机移动边界（可选） */
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };

  /** Whether to smooth camera movement 是否平滑相机移动 */
  smoothMovement: boolean = true;

  /** Smoothing factor (0-1) 平滑因子（0-1） */
  smoothFactor: number = 0.1;

  /** Target position for smooth movement 平滑移动的目标位置 */
  targetX: number = 0;
  targetY: number = 0;

  /** Target zoom for smooth zooming 平滑缩放的目标缩放 */
  targetZoom: number = 1.0;
}