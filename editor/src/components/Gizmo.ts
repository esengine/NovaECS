/**
 * Gizmo Component
 * 工具手柄组件
 *
 * Represents transform gizmos for selected objects
 * 表示选中对象的变换工具手柄
 */

export enum GizmoType {
  Move = 'move',
  Rotate = 'rotate',
  Scale = 'scale'
}

export enum GizmoAxis {
  X = 'x',
  Y = 'y',
  Z = 'z',
  XY = 'xy',
  XZ = 'xz',
  YZ = 'yz',
  XYZ = 'xyz'
}

export class Gizmo {
  /** Type of gizmo 工具手柄类型 */
  type: GizmoType = GizmoType.Move;

  /** Which axis is currently being manipulated 当前正在操作的轴 */
  activeAxis: GizmoAxis | null = null;

  /** Gizmo size scale 工具手柄大小缩放 */
  size: number = 1.0;

  /** Whether gizmo is visible 工具手柄是否可见 */
  visible: boolean = true;

  /** Gizmo colors for each axis 每个轴的工具手柄颜色 */
  colors: {
    x: [number, number, number, number];
    y: [number, number, number, number];
    z: [number, number, number, number];
    center: [number, number, number, number];
  } = {
    x: [1, 0, 0, 1], // Red 红色
    y: [0, 1, 0, 1], // Green 绿色
    z: [0, 0, 1, 1], // Blue 蓝色
    center: [1, 1, 1, 1] // White 白色
  };

  /** Whether gizmo is currently being dragged 工具手柄当前是否正在被拖拽 */
  isDragging: boolean = false;

  /** Start position when dragging began 开始拖拽时的起始位置 */
  dragStartX: number = 0;
  dragStartY: number = 0;

  /** Screen space position of gizmo center 工具手柄中心的屏幕空间位置 */
  screenX: number = 0;
  screenY: number = 0;

  /** Sensitivity for rotation and scale operations 旋转和缩放操作的敏感度 */
  sensitivity: number = 1.0;

  /** Snap settings for transform operations 变换操作的吸附设置 */
  snap: {
    enabled: boolean;
    position: number; // Position snap increment 位置吸附增量
    rotation: number; // Rotation snap in degrees 旋转吸附角度
    scale: number; // Scale snap increment 缩放吸附增量
  } = {
    enabled: false,
    position: 1.0,
    rotation: 15.0,
    scale: 0.1
  };
}