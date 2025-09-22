/**
 * Texture Atlas Resource for Efficient Sprite Batching
 * 用于高效精灵批处理的纹理图集资源
 *
 * Manages texture atlases containing multiple sprite frames packed into a single
 * texture. Provides UV coordinate lookup and metadata for efficient rendering.
 * 管理包含多个精灵帧的纹理图集，这些帧打包到单个纹理中。
 * 提供UV坐标查找和元数据以实现高效渲染。
 */

/**
 * Frame descriptor for texture atlas regions
 * 纹理图集区域的帧描述符
 */
export interface AtlasFrame {
  /** Frame identifier/name 帧标识符/名称 */
  name: string;
  /** UV coordinates [u0, v0, u1, v1] UV坐标 */
  uv: [number, number, number, number];
  /** Original frame size [width, height] 原始帧大小 */
  sourceSize: [number, number];
  /** Trimmed frame size [width, height] 修剪后的帧大小 */
  frameSize: [number, number];
  /** Trim offset [x, y] 修剪偏移 */
  offset: [number, number];
  /** Whether frame is rotated in atlas 帧是否在图集中旋转 */
  rotated: boolean;
}

/**
 * Texture Atlas metadata
 * 纹理图集元数据
 */
export interface AtlasMetadata {
  /** Atlas name/identifier 图集名称/标识符 */
  name: string;
  /** Atlas texture size [width, height] 图集纹理大小 */
  size: [number, number];
  /** Texture format (e.g., 'RGBA8', 'RGB8') 纹理格式 */
  format: string;
  /** Number of frames in atlas 图集中的帧数 */
  frameCount: number;
  /** Creation timestamp 创建时间戳 */
  created: number;
  /** Atlas version for cache invalidation 用于缓存失效的图集版本 */
  version: number;
}

/**
 * Texture Atlas resource for sprite frame management
 * 用于精灵帧管理的纹理图集资源
 */
export class TextureAtlas {
  /**
   * Atlas metadata
   * 图集元数据
   */
  metadata: AtlasMetadata;

  /**
   * Frame lookup map by name
   * 按名称的帧查找映射
   */
  frames: Map<string, AtlasFrame> = new Map();

  /**
   * Frame array for iteration
   * 用于迭代的帧数组
   */
  frameArray: AtlasFrame[] = [];

  /**
   * WebGL texture object (set by renderer)
   * WebGL纹理对象（由渲染器设置）
   */
  texture: WebGLTexture | null = null;

  /**
   * Whether the atlas is loaded and ready
   * 图集是否已加载并就绪
   */
  loaded: boolean = false;

  /**
   * Error message if loading failed
   * 加载失败时的错误消息
   */
  error: string | null = null;

  constructor(metadata: AtlasMetadata) {
    this.metadata = metadata;
  }

  /**
   * Add a frame to the atlas
   * 向图集添加帧
   *
   * @param frame Frame descriptor to add
   */
  addFrame(frame: AtlasFrame): void {
    this.frames.set(frame.name, frame);
    this.frameArray.push(frame);
  }

  /**
   * Get frame by name
   * 按名称获取帧
   *
   * @param name Frame name
   * @returns Frame descriptor or undefined
   */
  getFrame(name: string): AtlasFrame | undefined {
    return this.frames.get(name);
  }

  /**
   * Check if frame exists
   * 检查帧是否存在
   *
   * @param name Frame name
   * @returns True if frame exists
   */
  hasFrame(name: string): boolean {
    return this.frames.has(name);
  }

  /**
   * Get all frame names
   * 获取所有帧名称
   *
   * @returns Array of frame names
   */
  getFrameNames(): string[] {
    return Array.from(this.frames.keys());
  }

  /**
   * Clear all frames
   * 清除所有帧
   */
  clear(): void {
    this.frames.clear();
    this.frameArray.length = 0;
  }

  /**
   * Get memory usage estimate in bytes
   * 获取内存使用估计（字节）
   *
   * @returns Estimated memory usage
   */
  getMemoryUsage(): number {
    const [width, height] = this.metadata.size;
    const bytesPerPixel = this.metadata.format === 'RGBA8' ? 4 : 3;
    return width * height * bytesPerPixel;
  }
}

/**
 * Create texture atlas from JSON data (TexturePacker format)
 * 从JSON数据创建纹理图集（TexturePacker格式）
 *
 * @param atlasData JSON atlas data
 * @param textureName Base texture name
 * @returns Configured TextureAtlas
 */
export const createAtlasFromJSON = (
  atlasData: any,
  textureName: string
): TextureAtlas => {
  const metadata: AtlasMetadata = {
    name: textureName,
    size: [atlasData.meta.size.w, atlasData.meta.size.h],
    format: atlasData.meta.format || 'RGBA8',
    frameCount: Object.keys(atlasData.frames).length,
    created: Date.now(),
    version: 1,
  };

  const atlas = new TextureAtlas(metadata);

  // Parse frames from TexturePacker JSON format
  for (const [frameName, frameData] of Object.entries(atlasData.frames)) {
    const data = frameData as any;
    const frame = data.frame;
    const sourceSize = data.sourceSize;
    const spriteSourceSize = data.spriteSourceSize;

    const atlasFrame: AtlasFrame = {
      name: frameName,
      uv: [
        frame.x / metadata.size[0],
        frame.y / metadata.size[1],
        (frame.x + frame.w) / metadata.size[0],
        (frame.y + frame.h) / metadata.size[1],
      ],
      sourceSize: [sourceSize.w, sourceSize.h],
      frameSize: [frame.w, frame.h],
      offset: [spriteSourceSize.x, spriteSourceSize.y],
      rotated: data.rotated || false,
    };

    atlas.addFrame(atlasFrame);
  }

  return atlas;
};

/**
 * Create a simple texture atlas with uniform grid
 * 创建具有统一网格的简单纹理图集
 *
 * @param name Atlas name
 * @param textureSize Atlas texture size
 * @param frameSize Individual frame size
 * @param frameCount Number of frames
 * @returns Configured TextureAtlas
 */
export const createGridAtlas = (
  name: string,
  textureSize: [number, number],
  frameSize: [number, number],
  frameCount: number
): TextureAtlas => {
  const metadata: AtlasMetadata = {
    name,
    size: textureSize,
    format: 'RGBA8',
    frameCount,
    created: Date.now(),
    version: 1,
  };

  const atlas = new TextureAtlas(metadata);

  const framesPerRow = Math.floor(textureSize[0] / frameSize[0]);
  const framesPerCol = Math.floor(textureSize[1] / frameSize[1]);

  for (let i = 0; i < frameCount; i++) {
    const col = i % framesPerRow;
    const row = Math.floor(i / framesPerRow);

    if (row >= framesPerCol) break;

    const x = col * frameSize[0];
    const y = row * frameSize[1];

    const frame: AtlasFrame = {
      name: `frame_${i}`,
      uv: [
        x / textureSize[0],
        y / textureSize[1],
        (x + frameSize[0]) / textureSize[0],
        (y + frameSize[1]) / textureSize[1],
      ],
      sourceSize: frameSize,
      frameSize: frameSize,
      offset: [0, 0],
      rotated: false,
    };

    atlas.addFrame(frame);
  }

  return atlas;
};