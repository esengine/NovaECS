/**
 * Render Texture Resource for GPU Texture Management
 * 用于GPU纹理管理的渲染纹理资源
 *
 * Manages 2D textures, render targets, and framebuffers for GPU rendering.
 * Supports various texture formats, filtering modes, and usage patterns.
 * 管理用于GPU渲染的2D纹理、渲染目标和帧缓冲区。
 * 支持各种纹理格式、过滤模式和使用模式。
 */

/**
 * Texture format enumeration
 * 纹理格式枚举
 */
export enum TextureFormat {
  RGB = 0,
  RGBA = 1,
  Alpha = 2,
  Luminance = 3,
  LuminanceAlpha = 4,
  Depth = 5,
  DepthStencil = 6,
}

/**
 * Texture filter modes
 * 纹理过滤模式
 */
export enum TextureFilter {
  Nearest = 0,
  Linear = 1,
  NearestMipmapNearest = 2,
  LinearMipmapNearest = 3,
  NearestMipmapLinear = 4,
  LinearMipmapLinear = 5,
}

/**
 * Texture wrap modes
 * 纹理包裹模式
 */
export enum TextureWrap {
  Clamp = 0,
  Repeat = 1,
  MirroredRepeat = 2,
}

/**
 * Texture usage patterns
 * 纹理使用模式
 */
export enum TextureUsage {
  Static = 0,      // Rarely updated 很少更新
  Dynamic = 1,     // Frequently updated 经常更新
  RenderTarget = 2, // Used as render target 用作渲染目标
  Streaming = 3,   // Updated every frame 每帧更新
}

/**
 * Render Texture resource for GPU texture management
 * 用于GPU纹理管理的渲染纹理资源
 */
export class RenderTexture {
  /**
   * Texture identifier
   * 纹理标识符
   */
  id: string;

  /**
   * Texture width in pixels
   * 纹理宽度（像素）
   */
  width: number;

  /**
   * Texture height in pixels
   * 纹理高度（像素）
   */
  height: number;

  /**
   * Texture format
   * 纹理格式
   */
  format: TextureFormat;

  /**
   * Texture usage pattern
   * 纹理使用模式
   */
  usage: TextureUsage;

  /**
   * WebGL texture object
   * WebGL纹理对象
   */
  texture: WebGLTexture | null = null;

  /**
   * Minification filter
   * 缩小过滤器
   */
  minFilter: TextureFilter = TextureFilter.Linear;

  /**
   * Magnification filter
   * 放大过滤器
   */
  magFilter: TextureFilter = TextureFilter.Linear;

  /**
   * Horizontal wrap mode
   * 水平包裹模式
   */
  wrapS: TextureWrap = TextureWrap.Clamp;

  /**
   * Vertical wrap mode
   * 垂直包裹模式
   */
  wrapT: TextureWrap = TextureWrap.Clamp;

  /**
   * Whether texture has mipmaps
   * 纹理是否有mipmap
   */
  hasMipmaps: boolean = false;

  /**
   * Whether texture is loaded
   * 纹理是否已加载
   */
  loaded: boolean = false;

  /**
   * Whether texture needs updating
   * 纹理是否需要更新
   */
  dirty: boolean = true;

  /**
   * Texture data (for dynamic textures)
   * 纹理数据（用于动态纹理）
   */
  data: ArrayBufferView | null = null;

  /**
   * Image source (for static textures)
   * 图像源（用于静态纹理）
   */
  image: HTMLImageElement | HTMLCanvasElement | ImageData | null = null;

  /**
   * Last frame the texture was used
   * 纹理最后使用的帧
   */
  lastUsedFrame: number = 0;

  constructor(
    id: string,
    width: number,
    height: number,
    format: TextureFormat = TextureFormat.RGBA,
    usage: TextureUsage = TextureUsage.Static
  ) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.format = format;
    this.usage = usage;
  }

  /**
   * Set texture data from array
   * 从数组设置纹理数据
   *
   * @param data Texture data array
   */
  setData(data: ArrayBufferView): void {
    this.data = data;
    this.image = null;
    this.loaded = true;
    this.dirty = true;
  }

  /**
   * Set texture data from image
   * 从图像设置纹理数据
   *
   * @param image Image source
   */
  setImage(image: HTMLImageElement | HTMLCanvasElement | ImageData): void {
    this.image = image;
    this.data = null;

    if (image instanceof HTMLImageElement) {
      this.width = image.width;
      this.height = image.height;
    } else if (image instanceof HTMLCanvasElement) {
      this.width = image.width;
      this.height = image.height;
    } else if (image instanceof ImageData) {
      this.width = image.width;
      this.height = image.height;
    }

    this.loaded = true;
    this.dirty = true;
  }

  /**
   * Mark texture as used
   * 标记纹理为已使用
   *
   * @param frame Current frame number
   */
  markUsed(frame: number): void {
    this.lastUsedFrame = frame;
  }

  /**
   * Generate mipmaps for the texture
   * 为纹理生成mipmap
   */
  generateMipmaps(): void {
    this.hasMipmaps = true;
    this.dirty = true;
  }

  /**
   * Clean up GPU resources
   * 清理GPU资源
   *
   * @param gl WebGL context
   */
  dispose(gl: WebGLRenderingContext): void {
    if (this.texture) {
      gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.loaded = false;
    this.data = null;
    this.image = null;
  }

  /**
   * Get WebGL format constant
   * 获取WebGL格式常量
   *
   * @returns WebGL format
   */
  getGLFormat(): number {
    const GL_RGB = 6407;
    const GL_RGBA = 6408;
    const GL_ALPHA = 6406;
    const GL_LUMINANCE = 6409;
    const GL_LUMINANCE_ALPHA = 6410;
    const GL_DEPTH_COMPONENT = 6402;

    switch (this.format) {
      case TextureFormat.RGB:
        return GL_RGB;
      case TextureFormat.RGBA:
        return GL_RGBA;
      case TextureFormat.Alpha:
        return GL_ALPHA;
      case TextureFormat.Luminance:
        return GL_LUMINANCE;
      case TextureFormat.LuminanceAlpha:
        return GL_LUMINANCE_ALPHA;
      case TextureFormat.Depth:
        return GL_DEPTH_COMPONENT;
      default:
        return GL_RGBA;
    }
  }

  /**
   * Get WebGL internal format
   * 获取WebGL内部格式
   *
   * @returns WebGL internal format
   */
  getGLInternalFormat(): number {
    return this.getGLFormat(); // Same as format for WebGL 1.0
  }

  /**
   * Get WebGL data type
   * 获取WebGL数据类型
   *
   * @returns WebGL type constant
   */
  getGLType(): number {
    const GL_UNSIGNED_BYTE = 5121;
    const GL_UNSIGNED_SHORT = 5123;

    switch (this.format) {
      case TextureFormat.Depth:
        return GL_UNSIGNED_SHORT;
      default:
        return GL_UNSIGNED_BYTE;
    }
  }

  /**
   * Get memory usage estimate
   * 获取内存使用估计
   *
   * @returns Estimated memory usage in bytes
   */
  getMemoryUsage(): number {
    const bytesPerPixel = this.getBytesPerPixel();
    let size = this.width * this.height * bytesPerPixel;

    // Add mipmap memory if present
    if (this.hasMipmaps) {
      size *= 1.33; // Rough estimate for mipmap chain
    }

    return Math.ceil(size);
  }

  /**
   * Get bytes per pixel for the format
   * 获取格式的每像素字节数
   *
   * @returns Bytes per pixel
   */
  private getBytesPerPixel(): number {
    switch (this.format) {
      case TextureFormat.RGB:
        return 3;
      case TextureFormat.RGBA:
        return 4;
      case TextureFormat.Alpha:
      case TextureFormat.Luminance:
        return 1;
      case TextureFormat.LuminanceAlpha:
        return 2;
      case TextureFormat.Depth:
        return 2;
      case TextureFormat.DepthStencil:
        return 4;
      default:
        return 4;
    }
  }
}

/**
 * Create a render texture for use as render target
 * 创建用作渲染目标的渲染纹理
 *
 * @param id Texture identifier
 * @param width Width in pixels
 * @param height Height in pixels
 * @param format Texture format
 * @returns Configured RenderTexture
 */
export const createRenderTarget = (
  id: string,
  width: number,
  height: number,
  format: TextureFormat = TextureFormat.RGBA
): RenderTexture => {
  const texture = new RenderTexture(id, width, height, format, TextureUsage.RenderTarget);
  texture.minFilter = TextureFilter.Linear;
  texture.magFilter = TextureFilter.Linear;
  texture.wrapS = TextureWrap.Clamp;
  texture.wrapT = TextureWrap.Clamp;
  return texture;
};

/**
 * Create a texture from image data
 * 从图像数据创建纹理
 *
 * @param id Texture identifier
 * @param image Image source
 * @param generateMipmaps Whether to generate mipmaps
 * @returns Configured RenderTexture
 */
export const createTextureFromImage = (
  id: string,
  image: HTMLImageElement | HTMLCanvasElement | ImageData,
  generateMipmaps: boolean = true
): RenderTexture => {
  const width = image instanceof ImageData ? image.width : image.width;
  const height = image instanceof ImageData ? image.height : image.height;

  const texture = new RenderTexture(id, width, height, TextureFormat.RGBA, TextureUsage.Static);
  texture.setImage(image);

  if (generateMipmaps && isPowerOfTwo(width) && isPowerOfTwo(height)) {
    texture.generateMipmaps();
    texture.minFilter = TextureFilter.LinearMipmapLinear;
  }

  return texture;
};

/**
 * Create a solid color texture
 * 创建纯色纹理
 *
 * @param id Texture identifier
 * @param color Color values [r, g, b, a] (0-255)
 * @param size Texture size (power of 2)
 * @returns Configured RenderTexture
 */
export const createColorTexture = (
  id: string,
  color: [number, number, number, number],
  size: number = 1
): RenderTexture => {
  const texture = new RenderTexture(id, size, size, TextureFormat.RGBA, TextureUsage.Static);

  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0];     // R
    data[i + 1] = color[1]; // G
    data[i + 2] = color[2]; // B
    data[i + 3] = color[3]; // A
  }

  texture.setData(data);
  return texture;
};

/**
 * Check if a number is a power of two
 * 检查数字是否为2的幂
 *
 * @param value Number to check
 * @returns True if power of two
 */
export const isPowerOfTwo = (value: number): boolean => {
  return (value & (value - 1)) === 0 && value !== 0;
};