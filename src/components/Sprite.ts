/**
 * 2D Sprite Component for Textured Quad Rendering
 * 用于纹理四边形渲染的2D精灵组件
 *
 * Represents a textured rectangle that can be rendered with various properties
 * including UV coordinates, color tinting, and blend modes. Integrates with
 * the transform system for positioning and scaling.
 * 表示可以使用各种属性渲染的纹理矩形，包括UV坐标、颜色着色和混合模式。
 * 与变换系统集成以进行定位和缩放。
 */

/**
 * Blend modes for sprite rendering
 * 精灵渲染的混合模式
 */
export enum BlendMode {
  Normal = 0,
  Additive = 1,
  Multiply = 2,
  Screen = 3,
  Overlay = 4,
}

/**
 * Sprite component for 2D textured quad rendering
 * 用于2D纹理四边形渲染的精灵组件
 */
export class Sprite {
  /**
   * Texture resource identifier (reference to texture atlas or standalone texture)
   * 纹理资源标识符（对纹理图集或独立纹理的引用）
   */
  textureId: string = '';

  /**
   * Width of the sprite in world units
   * 精灵在世界单位中的宽度
   */
  width: number = 1.0;

  /**
   * Height of the sprite in world units
   * 精灵在世界单位中的高度
   */
  height: number = 1.0;

  /**
   * UV coordinates for texture sampling [u0, v0, u1, v1]
   * 纹理采样的UV坐标 [u0, v0, u1, v1]
   * (0,0) = top-left, (1,1) = bottom-right
   */
  uv: [number, number, number, number] = [0, 0, 1, 1];

  /**
   * Color tint multiplier [r, g, b, a] (0-1 range)
   * 颜色着色乘数 [r, g, b, a]（0-1范围）
   */
  color: [number, number, number, number] = [1, 1, 1, 1];

  /**
   * Blend mode for rendering
   * 渲染的混合模式
   */
  blendMode: BlendMode = BlendMode.Normal;

  /**
   * Sprite anchor point [x, y] (0,0 = top-left, 0.5,0.5 = center, 1,1 = bottom-right)
   * 精灵锚点 [x, y]（0,0 = 左上角，0.5,0.5 = 中心，1,1 = 右下角）
   */
  anchor: [number, number] = [0.5, 0.5];

  /**
   * Whether the sprite should be flipped horizontally
   * 精灵是否应该水平翻转
   */
  flipX: boolean = false;

  /**
   * Whether the sprite should be flipped vertically
   * 精灵是否应该垂直翻转
   */
  flipY: boolean = false;

  /**
   * Texture filtering mode (true = linear, false = nearest)
   * 纹理过滤模式（true = 线性，false = 最近邻）
   */
  smoothing: boolean = true;

  /**
   * Additional vertex offset for custom positioning
   * 用于自定义定位的额外顶点偏移
   */
  offset: [number, number] = [0, 0];
}

/**
 * Create a basic sprite with texture
 * 创建带有纹理的基本精灵
 *
 * @param textureId Texture resource identifier
 * @param width Sprite width in world units
 * @param height Sprite height in world units
 * @returns Configured Sprite instance
 */
export const createSprite = (
  textureId: string,
  width: number = 1.0,
  height: number = 1.0
): Sprite => {
  const sprite = new Sprite();
  sprite.textureId = textureId;
  sprite.width = width;
  sprite.height = height;
  return sprite;
};

/**
 * Create a sprite from texture atlas region
 * 从纹理图集区域创建精灵
 *
 * @param atlasId Atlas texture identifier
 * @param u0 Left UV coordinate
 * @param v0 Top UV coordinate
 * @param u1 Right UV coordinate
 * @param v1 Bottom UV coordinate
 * @param width Sprite width in world units
 * @param height Sprite height in world units
 * @returns Configured Sprite instance
 */
export const createAtlasSprite = (
  atlasId: string,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  width: number = 1.0,
  height: number = 1.0
): Sprite => {
  const sprite = createSprite(atlasId, width, height);
  sprite.uv = [u0, v0, u1, v1];
  return sprite;
};

/**
 * Create a colored sprite without texture (solid color quad)
 * 创建无纹理的彩色精灵（纯色四边形）
 *
 * @param r Red component (0-1)
 * @param g Green component (0-1)
 * @param b Blue component (0-1)
 * @param a Alpha component (0-1)
 * @param width Sprite width
 * @param height Sprite height
 * @returns Configured Sprite instance
 */
export const createColorSprite = (
  r: number,
  g: number,
  b: number,
  a: number = 1.0,
  width: number = 1.0,
  height: number = 1.0
): Sprite => {
  const sprite = createSprite('', width, height);
  sprite.color = [r, g, b, a];
  return sprite;
};