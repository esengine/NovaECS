/**
 * Grid Snap Component
 * 网格吸附组件
 *
 * Enables snapping to grid for precise positioning
 * 启用网格吸附以实现精确定位
 */

export class GridSnap {
  /** Whether grid snapping is enabled 是否启用网格吸附 */
  enabled: boolean = false;

  /** Grid size in world units 世界单位的网格大小 */
  gridSize: number = 32;

  /** Snap offset from grid origin 相对于网格原点的吸附偏移 */
  offsetX: number = 0;
  offsetY: number = 0;

  /** Whether to snap position 是否吸附位置 */
  snapPosition: boolean = true;

  /** Whether to snap rotation 是否吸附旋转 */
  snapRotation: boolean = false;

  /** Rotation snap angle in degrees 旋转吸附角度（度） */
  rotationStep: number = 15;

  /** Whether to snap scale 是否吸附缩放 */
  snapScale: boolean = false;

  /** Scale snap increment 缩放吸附增量 */
  scaleStep: number = 0.1;

  /** Visual grid properties for rendering 用于渲染的可视网格属性 */
  visual: {
    /** Whether to show grid lines 是否显示网格线 */
    showGrid: boolean;
    /** Grid line color 网格线颜色 */
    color: [number, number, number, number];
    /** Grid line thickness 网格线厚度 */
    thickness: number;
    /** Grid opacity 网格不透明度 */
    opacity: number;
    /** Whether to show major grid lines 是否显示主要网格线 */
    showMajorLines: boolean;
    /** Major line interval (every N grid lines) 主要线间隔（每N条网格线） */
    majorLineInterval: number;
    /** Major line color 主要线颜色 */
    majorLineColor: [number, number, number, number];
  } = {
    showGrid: true,
    color: [0.5, 0.5, 0.5, 0.3],
    thickness: 1,
    opacity: 0.3,
    showMajorLines: true,
    majorLineInterval: 4,
    majorLineColor: [0.7, 0.7, 0.7, 0.5]
  };
}