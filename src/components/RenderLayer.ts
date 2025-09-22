/**
 * Render Layer Component for Z-ordering and Visibility Control
 * 用于Z排序和可见性控制的渲染层组件
 *
 * Controls rendering order, layer grouping, and visibility culling for entities.
 * Integrates with camera layer masks for selective rendering of object groups.
 * 控制实体的渲染顺序、层分组和可见性剔除。
 * 与相机层掩码集成，用于选择性渲染对象组。
 */

/**
 * Predefined render layer constants
 * 预定义的渲染层常量
 */
export enum RenderLayers {
  Background = 0,     // 背景层
  Default = 1,        // 默认层
  UI = 2,            // UI层
  Effects = 3,       // 效果层
  Overlay = 4,       // 覆盖层
  Debug = 5,         // 调试层
}

/**
 * Render Layer component for controlling draw order and visibility
 * 用于控制绘制顺序和可见性的渲染层组件
 */
export class RenderLayer {
  /**
   * Layer identifier (0-31, used with camera layer masks)
   * 层标识符（0-31，与相机层掩码一起使用）
   */
  layer: number = RenderLayers.Default;

  /**
   * Sub-layer ordering within the same layer (lower values render first)
   * 同一层内的子层排序（较低值先渲染）
   */
  sortingOrder: number = 0;

  /**
   * Z-depth for depth testing (-1000 to 1000)
   * 用于深度测试的Z深度（-1000到1000）
   */
  depth: number = 0;

  /**
   * Whether the entity should be rendered
   * 实体是否应该被渲染
   */
  visible: boolean = true;

  /**
   * Whether to cast shadows (for future shadow system)
   * 是否投射阴影（为未来的阴影系统）
   */
  castShadows: boolean = false;

  /**
   * Whether to receive shadows (for future shadow system)
   * 是否接收阴影（为未来的阴影系统）
   */
  receiveShadows: boolean = false;

  /**
   * Layer name for debugging and editor display
   * 用于调试和编辑器显示的层名称
   */
  name: string = 'Default';
}

/**
 * Create a render layer with specific settings
 * 创建具有特定设置的渲染层
 *
 * @param layer Layer identifier (0-31)
 * @param sortingOrder Sub-layer ordering
 * @param depth Z-depth value
 * @returns Configured RenderLayer instance
 */
export const createRenderLayer = (
  layer: number = RenderLayers.Default,
  sortingOrder: number = 0,
  depth: number = 0
): RenderLayer => {
  const renderLayer = new RenderLayer();
  renderLayer.layer = layer;
  renderLayer.sortingOrder = sortingOrder;
  renderLayer.depth = depth;
  return renderLayer;
};

/**
 * Create a background layer (renders behind everything)
 * 创建背景层（在所有内容后面渲染）
 *
 * @param sortingOrder Optional sub-ordering
 * @returns Configured RenderLayer for background
 */
export const createBackgroundLayer = (
  sortingOrder: number = 0
): RenderLayer => {
  const layer = createRenderLayer(RenderLayers.Background, sortingOrder, -100);
  layer.name = 'Background';
  return layer;
};

/**
 * Create a UI layer (renders in front of game objects)
 * 创建UI层（在游戏对象前面渲染）
 *
 * @param sortingOrder Optional sub-ordering
 * @returns Configured RenderLayer for UI
 */
export const createUILayer = (
  sortingOrder: number = 0
): RenderLayer => {
  const layer = createRenderLayer(RenderLayers.UI, sortingOrder, 100);
  layer.name = 'UI';
  return layer;
};

/**
 * Create an effects layer for particles and visual effects
 * 创建用于粒子和视觉效果的效果层
 *
 * @param sortingOrder Optional sub-ordering
 * @returns Configured RenderLayer for effects
 */
export const createEffectsLayer = (
  sortingOrder: number = 0
): RenderLayer => {
  const layer = createRenderLayer(RenderLayers.Effects, sortingOrder, 50);
  layer.name = 'Effects';
  return layer;
};

/**
 * Create a debug layer for development visualization
 * 创建用于开发可视化的调试层
 *
 * @param sortingOrder Optional sub-ordering
 * @returns Configured RenderLayer for debug
 */
export const createDebugLayer = (
  sortingOrder: number = 0
): RenderLayer => {
  const layer = createRenderLayer(RenderLayers.Debug, sortingOrder, 200);
  layer.name = 'Debug';
  layer.visible = false; // Hidden by default
  return layer;
};

/**
 * Check if a layer is visible to a camera's layer mask
 * 检查层是否对相机的层掩码可见
 *
 * @param layerBit Layer bit (0-31)
 * @param cameraMask Camera's layer mask
 * @returns True if layer should be rendered by camera
 */
export const isLayerVisible = (
  layerBit: number,
  cameraMask: number
): boolean => {
  return (cameraMask & (1 << layerBit)) !== 0;
};

/**
 * Create a layer mask that includes specific layers
 * 创建包含特定层的层掩码
 *
 * @param layers Array of layer numbers to include
 * @returns Layer mask bitfield
 */
export const createLayerMask = (layers: number[]): number => {
  let mask = 0;
  for (const layer of layers) {
    if (layer >= 0 && layer < 32) {
      mask |= (1 << layer);
    }
  }
  return mask;
};

/**
 * Standard layer mask presets
 * 标准层掩码预设
 */
export const LayerMasks = {
  /** All layers visible */
  All: 0xFFFFFFFF,
  /** Only game objects (no UI, effects, debug) */
  GameOnly: createLayerMask([RenderLayers.Background, RenderLayers.Default]),
  /** Only UI elements */
  UIOnly: createLayerMask([RenderLayers.UI]),
  /** Game objects and effects */
  GameAndEffects: createLayerMask([RenderLayers.Background, RenderLayers.Default, RenderLayers.Effects]),
  /** Everything except debug */
  NoDebug: 0xFFFFFFFF & ~(1 << RenderLayers.Debug),
};