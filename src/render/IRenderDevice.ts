/**
 * Render Device Abstraction Interface
 * 渲染设备抽象接口
 *
 * Provides a unified interface for different graphics APIs (WebGL, WebGPU).
 * Abstracts device capabilities, resource management, and rendering operations.
 * 为不同的图形API（WebGL、WebGPU）提供统一接口。
 * 抽象设备功能、资源管理和渲染操作。
 */

import { RenderTexture } from '../resources/RenderTexture';
import { VertexBuffer, IndexBuffer } from '../resources/RenderBuffers';
import { ShaderProgram } from '../resources/ShaderProgram';

/**
 * Graphics API types
 * 图形API类型
 */
export enum GraphicsAPI {
  WebGL = 'webgl',
  WebGL2 = 'webgl2',
  WebGPU = 'webgpu',
}

/**
 * Device capabilities and limits
 * 设备功能和限制
 */
export interface DeviceCapabilities {
  /** Graphics API type API类型 */
  api: GraphicsAPI;
  /** API version string API版本字符串 */
  version: string;
  /** Maximum texture size 最大纹理大小 */
  maxTextureSize: number;
  /** Maximum number of texture units 最大纹理单元数 */
  maxTextureUnits: number;
  /** Maximum vertex attributes 最大顶点属性数 */
  maxVertexAttributes: number;
  /** Whether instanced rendering is supported 是否支持实例化渲染 */
  supportsInstancing: boolean;
  /** Whether depth textures are supported 是否支持深度纹理 */
  supportsDepthTexture: boolean;
  /** Whether floating point textures are supported 是否支持浮点纹理 */
  supportsFloatTextures: boolean;
  /** Whether compressed textures are supported 是否支持压缩纹理 */
  supportsCompressedTextures: boolean;
  /** Maximum uniform buffer size 最大uniform缓冲区大小 */
  maxUniformBufferSize: number;
  /** Vendor string 厂商字符串 */
  vendor: string;
  /** Renderer string 渲染器字符串 */
  renderer: string;
}

/**
 * Render pass descriptor
 * 渲染通道描述符
 */
export interface RenderPassDescriptor {
  /** Color attachments 颜色附件 */
  colorAttachments: (RenderTexture | null)[];
  /** Depth attachment 深度附件 */
  depthAttachment?: RenderTexture;
  /** Clear color values 清除颜色值 */
  clearColors: [number, number, number, number][];
  /** Clear depth value 清除深度值 */
  clearDepth?: number;
  /** Whether to clear color buffers 是否清除颜色缓冲区 */
  clearColor: boolean;
  /** Whether to clear depth buffer 是否清除深度缓冲区 */
  clearDepthBuffer: boolean;
}

/**
 * Draw call descriptor
 * 绘制调用描述符
 */
export interface DrawCallDescriptor {
  /** Shader program to use 使用的着色器程序 */
  shader: ShaderProgram;
  /** Vertex buffer 顶点缓冲区 */
  vertexBuffer: VertexBuffer;
  /** Index buffer (optional) 索引缓冲区（可选） */
  indexBuffer?: IndexBuffer;
  /** Number of vertices/indices to draw 要绘制的顶点/索引数 */
  count: number;
  /** Starting offset 起始偏移 */
  offset: number;
  /** Number of instances (for instanced rendering) 实例数（用于实例化渲染） */
  instanceCount: number;
  /** Textures to bind 要绑定的纹理 */
  textures: Map<number, RenderTexture>;
  /** Uniform values uniform值 */
  uniforms: Map<string, any>;
}

/**
 * Viewport descriptor
 * 视口描述符
 */
export interface ViewportDescriptor {
  /** X offset X偏移 */
  x: number;
  /** Y offset Y偏移 */
  y: number;
  /** Width 宽度 */
  width: number;
  /** Height 高度 */
  height: number;
  /** Near depth 近深度 */
  near: number;
  /** Far depth 远深度 */
  far: number;
}

/**
 * Render statistics for performance monitoring
 * 用于性能监控的渲染统计
 */
export interface RenderStats {
  /** Number of draw calls 绘制调用数 */
  drawCalls: number;
  /** Number of vertices processed 处理的顶点数 */
  vertices: number;
  /** Number of triangles rendered 渲染的三角形数 */
  triangles: number;
  /** Number of texture bindings 纹理绑定数 */
  textureBindings: number;
  /** Number of shader switches 着色器切换数 */
  shaderSwitches: number;
  /** Frame time in milliseconds 帧时间（毫秒） */
  frameTime: number;
  /** GPU memory usage estimate GPU内存使用估计 */
  gpuMemoryUsage: number;
}

/**
 * Render Device interface for graphics API abstraction
 * 用于图形API抽象的渲染设备接口
 */
export interface IRenderDevice {
  /**
   * Initialize the render device
   * 初始化渲染设备
   *
   * @param canvas Target canvas element
   * @returns Promise that resolves when initialization is complete
   */
  initialize(canvas: HTMLCanvasElement): Promise<void>;

  /**
   * Get device capabilities
   * 获取设备功能
   *
   * @returns Device capabilities object
   */
  getCapabilities(): DeviceCapabilities;

  /**
   * Create a texture resource
   * 创建纹理资源
   *
   * @param texture Texture descriptor
   * @returns Promise that resolves when texture is created
   */
  createTexture(texture: RenderTexture): Promise<void>;

  /**
   * Update texture data
   * 更新纹理数据
   *
   * @param texture Texture to update
   * @returns Promise that resolves when update is complete
   */
  updateTexture(texture: RenderTexture): Promise<void>;

  /**
   * Destroy texture resource
   * 销毁纹理资源
   *
   * @param texture Texture to destroy
   */
  destroyTexture(texture: RenderTexture): void;

  /**
   * Create a vertex buffer
   * 创建顶点缓冲区
   *
   * @param buffer Buffer descriptor
   * @returns Promise that resolves when buffer is created
   */
  createVertexBuffer(buffer: VertexBuffer): Promise<void>;

  /**
   * Update vertex buffer data
   * 更新顶点缓冲区数据
   *
   * @param buffer Buffer to update
   * @returns Promise that resolves when update is complete
   */
  updateVertexBuffer(buffer: VertexBuffer): Promise<void>;

  /**
   * Destroy vertex buffer
   * 销毁顶点缓冲区
   *
   * @param buffer Buffer to destroy
   */
  destroyVertexBuffer(buffer: VertexBuffer): void;

  /**
   * Create an index buffer
   * 创建索引缓冲区
   *
   * @param buffer Buffer descriptor
   * @returns Promise that resolves when buffer is created
   */
  createIndexBuffer(buffer: IndexBuffer): Promise<void>;

  /**
   * Update index buffer data
   * 更新索引缓冲区数据
   *
   * @param buffer Buffer to update
   * @returns Promise that resolves when update is complete
   */
  updateIndexBuffer(buffer: IndexBuffer): Promise<void>;

  /**
   * Destroy index buffer
   * 销毁索引缓冲区
   *
   * @param buffer Buffer to destroy
   */
  destroyIndexBuffer(buffer: IndexBuffer): void;

  /**
   * Create a shader program
   * 创建着色器程序
   *
   * @param shader Shader descriptor
   * @returns Promise that resolves when shader is compiled and linked
   */
  createShader(shader: ShaderProgram): Promise<void>;

  /**
   * Destroy shader program
   * 销毁着色器程序
   *
   * @param shader Shader to destroy
   */
  destroyShader(shader: ShaderProgram): void;

  /**
   * Begin a render pass
   * 开始渲染通道
   *
   * @param descriptor Render pass configuration
   */
  beginRenderPass(descriptor: RenderPassDescriptor): void;

  /**
   * End the current render pass
   * 结束当前渲染通道
   */
  endRenderPass(): void;

  /**
   * Set the viewport
   * 设置视口
   *
   * @param viewport Viewport configuration
   */
  setViewport(viewport: ViewportDescriptor): void;

  /**
   * Execute a draw call
   * 执行绘制调用
   *
   * @param descriptor Draw call configuration
   */
  draw(descriptor: DrawCallDescriptor): void;

  /**
   * Present the rendered frame
   * 呈现渲染的帧
   */
  present(): void;

  /**
   * Resize the render target
   * 调整渲染目标大小
   *
   * @param width New width
   * @param height New height
   */
  resize(width: number, height: number): void;

  /**
   * Get current render statistics
   * 获取当前渲染统计
   *
   * @returns Render statistics object
   */
  getStats(): RenderStats;

  /**
   * Reset render statistics
   * 重置渲染统计
   */
  resetStats(): void;

  /**
   * Cleanup and destroy the device
   * 清理和销毁设备
   */
  destroy(): void;
}

/**
 * Create render device based on available APIs
 * 基于可用API创建渲染设备
 *
 * @param preferredAPI Preferred graphics API
 * @returns Promise that resolves to render device instance
 */
export async function createRenderDevice(
  _preferredAPI: GraphicsAPI = GraphicsAPI.WebGL2
): Promise<IRenderDevice> {
  // This will be implemented by specific device implementations
  // 这将由特定的设备实现来实现
  throw new Error('createRenderDevice must be implemented by device factory');
}

/**
 * Check if a graphics API is supported
 * 检查图形API是否受支持
 *
 * @param api Graphics API to check
 * @returns True if API is supported
 */
export function isAPISupported(api: GraphicsAPI): boolean {
  switch (api) {
    case GraphicsAPI.WebGL:
    case GraphicsAPI.WebGL2:
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext(api === GraphicsAPI.WebGL2 ? 'webgl2' : 'webgl');
        return context !== null;
      } catch {
        return false;
      }
    case GraphicsAPI.WebGPU:
      return 'gpu' in navigator;
    default:
      return false;
  }
}

/**
 * Get best available graphics API
 * 获取最佳可用图形API
 *
 * @returns Best available graphics API
 */
export function getBestAvailableAPI(): GraphicsAPI {
  if (isAPISupported(GraphicsAPI.WebGPU)) {
    return GraphicsAPI.WebGPU;
  }
  if (isAPISupported(GraphicsAPI.WebGL2)) {
    return GraphicsAPI.WebGL2;
  }
  if (isAPISupported(GraphicsAPI.WebGL)) {
    return GraphicsAPI.WebGL;
  }
  throw new Error('No supported graphics API found');
}