/**
 * Render Buffer Resources for GPU Memory Management
 * 用于GPU内存管理的渲染缓冲区资源
 *
 * Manages vertex buffers, index buffers, and uniform buffers for efficient
 * GPU data storage and rendering. Supports dynamic and static buffer usage patterns.
 * 管理顶点缓冲区、索引缓冲区和uniform缓冲区，以实现高效的
 * GPU数据存储和渲染。支持动态和静态缓冲区使用模式。
 */

/**
 * Buffer usage patterns for optimization
 * 用于优化的缓冲区使用模式
 */
export enum BufferUsage {
  Static = 0,    // Data rarely changes 数据很少改变
  Dynamic = 1,   // Data changes frequently 数据经常改变
  Stream = 2,    // Data changes every frame 数据每帧都改变
}

/**
 * Buffer types for different GPU pipeline stages
 * 不同GPU管线阶段的缓冲区类型
 */
export enum BufferType {
  Vertex = 0,    // Vertex data 顶点数据
  Index = 1,     // Index data 索引数据
  Uniform = 2,   // Uniform data uniform数据
  Instance = 3,  // Instance data 实例数据
}

/**
 * Vertex attribute layout descriptor
 * 顶点属性布局描述符
 */
export interface VertexAttribute {
  /** Attribute name 属性名称 */
  name: string;
  /** Component count (1-4) 组件数量 */
  size: number;
  /** Component type (GL_FLOAT, GL_INT, etc.) 组件类型 */
  type: number;
  /** Whether to normalize values 是否标准化值 */
  normalized: boolean;
  /** Offset in vertex structure 顶点结构中的偏移 */
  offset: number;
}

/**
 * Vertex layout descriptor
 * 顶点布局描述符
 */
export interface VertexLayout {
  /** Layout identifier 布局标识符 */
  id: string;
  /** Vertex attributes 顶点属性 */
  attributes: VertexAttribute[];
  /** Stride in bytes 字节步长 */
  stride: number;
}

/**
 * Base buffer resource class
 * 基础缓冲区资源类
 */
export abstract class RenderBuffer {
  /**
   * Buffer identifier
   * 缓冲区标识符
   */
  id: string;

  /**
   * Buffer type
   * 缓冲区类型
   */
  type: BufferType;

  /**
   * Usage pattern
   * 使用模式
   */
  usage: BufferUsage;

  /**
   * WebGL buffer object
   * WebGL缓冲区对象
   */
  buffer: WebGLBuffer | null = null;

  /**
   * Buffer size in bytes
   * 缓冲区大小（字节）
   */
  size: number = 0;

  /**
   * Whether buffer is bound to GPU
   * 缓冲区是否绑定到GPU
   */
  bound: boolean = false;

  /**
   * Whether buffer needs updating
   * 缓冲区是否需要更新
   */
  dirty: boolean = true;

  /**
   * Last frame the buffer was used
   * 缓冲区最后使用的帧
   */
  lastUsedFrame: number = 0;

  constructor(id: string, type: BufferType, usage: BufferUsage) {
    this.id = id;
    this.type = type;
    this.usage = usage;
  }

  /**
   * Mark buffer as used
   * 标记缓冲区为已使用
   *
   * @param frame Current frame number
   */
  markUsed(frame: number): void {
    this.lastUsedFrame = frame;
  }

  /**
   * Mark buffer as dirty (needs updating)
   * 标记缓冲区为脏（需要更新）
   */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * Clean up GPU resources
   * 清理GPU资源
   *
   * @param gl WebGL context
   */
  dispose(gl: WebGLRenderingContext): void {
    if (this.buffer) {
      gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
    this.bound = false;
    this.size = 0;
  }

  /**
   * Get WebGL buffer target for binding
   * 获取用于绑定的WebGL缓冲区目标
   *
   * @returns WebGL buffer target
   */
  getTarget(): number {
    switch (this.type) {
      case BufferType.Vertex:
      case BufferType.Instance:
        return GL_ARRAY_BUFFER;
      case BufferType.Index:
        return GL_ELEMENT_ARRAY_BUFFER;
      default:
        return GL_ARRAY_BUFFER;
    }
  }

  /**
   * Get WebGL usage hint
   * 获取WebGL使用提示
   *
   * @returns WebGL usage constant
   */
  getUsageHint(): number {
    switch (this.usage) {
      case BufferUsage.Static:
        return GL_STATIC_DRAW;
      case BufferUsage.Dynamic:
        return GL_DYNAMIC_DRAW;
      case BufferUsage.Stream:
        return GL_STREAM_DRAW;
      default:
        return GL_STATIC_DRAW;
    }
  }
}

/**
 * Vertex buffer for storing vertex data
 * 用于存储顶点数据的顶点缓冲区
 */
export class VertexBuffer extends RenderBuffer {
  /**
   * Vertex layout descriptor
   * 顶点布局描述符
   */
  layout: VertexLayout;

  /**
   * Raw vertex data
   * 原始顶点数据
   */
  data: Float32Array;

  /**
   * Number of vertices
   * 顶点数量
   */
  vertexCount: number = 0;

  constructor(id: string, layout: VertexLayout, usage: BufferUsage = BufferUsage.Static) {
    super(id, BufferType.Vertex, usage);
    this.layout = layout;
    this.data = new Float32Array(0);
  }

  /**
   * Set vertex data
   * 设置顶点数据
   *
   * @param data Vertex data array
   */
  setData(data: Float32Array): void {
    this.data = data;
    this.vertexCount = data.length / (this.layout.stride / 4); // stride is in bytes, data is Float32
    this.size = data.byteLength;
    this.markDirty();
  }

  /**
   * Resize buffer to accommodate more vertices
   * 调整缓冲区大小以容纳更多顶点
   *
   * @param vertexCount New vertex count
   */
  resize(vertexCount: number): void {
    const elementCount = vertexCount * (this.layout.stride / 4);
    if (this.data.length < elementCount) {
      const newData = new Float32Array(elementCount);
      newData.set(this.data);
      this.data = newData;
      this.size = newData.byteLength;
      this.markDirty();
    }
    this.vertexCount = vertexCount;
  }
}

/**
 * Index buffer for storing vertex indices
 * 用于存储顶点索引的索引缓冲区
 */
export class IndexBuffer extends RenderBuffer {
  /**
   * Raw index data
   * 原始索引数据
   */
  data: Uint16Array;

  /**
   * Number of indices
   * 索引数量
   */
  indexCount: number = 0;

  constructor(id: string, usage: BufferUsage = BufferUsage.Static) {
    super(id, BufferType.Index, usage);
    this.data = new Uint16Array(0);
  }

  /**
   * Set index data
   * 设置索引数据
   *
   * @param data Index data array
   */
  setData(data: Uint16Array): void {
    this.data = data;
    this.indexCount = data.length;
    this.size = data.byteLength;
    this.markDirty();
  }

  /**
   * Resize buffer to accommodate more indices
   * 调整缓冲区大小以容纳更多索引
   *
   * @param indexCount New index count
   */
  resize(indexCount: number): void {
    if (this.data.length < indexCount) {
      const newData = new Uint16Array(indexCount);
      newData.set(this.data);
      this.data = newData;
      this.size = newData.byteLength;
      this.markDirty();
    }
    this.indexCount = indexCount;
  }
}

/**
 * Uniform buffer for storing shader uniforms
 * 用于存储着色器uniform的uniform缓冲区
 */
export class UniformBuffer extends RenderBuffer {
  /**
   * Raw uniform data
   * 原始uniform数据
   */
  data: ArrayBuffer;

  /**
   * Data view for manipulation
   * 用于操作的数据视图
   */
  view: DataView;

  constructor(id: string, size: number, usage: BufferUsage = BufferUsage.Dynamic) {
    super(id, BufferType.Uniform, usage);
    this.data = new ArrayBuffer(size);
    this.view = new DataView(this.data);
    this.size = size;
  }

  /**
   * Set float value at offset
   * 在偏移位置设置浮点值
   *
   * @param offset Byte offset
   * @param value Float value
   */
  setFloat(offset: number, value: number): void {
    this.view.setFloat32(offset, value, true); // little endian
    this.markDirty();
  }

  /**
   * Set vector values at offset
   * 在偏移位置设置向量值
   *
   * @param offset Byte offset
   * @param values Vector components
   */
  setVector(offset: number, values: number[]): void {
    for (let i = 0; i < values.length; i++) {
      this.view.setFloat32(offset + i * 4, values[i], true);
    }
    this.markDirty();
  }

  /**
   * Set matrix values at offset
   * 在偏移位置设置矩阵值
   *
   * @param offset Byte offset
   * @param matrix Matrix values (column-major)
   */
  setMatrix(offset: number, matrix: number[]): void {
    for (let i = 0; i < matrix.length; i++) {
      this.view.setFloat32(offset + i * 4, matrix[i], true);
    }
    this.markDirty();
  }
}

// WebGL constants for environments where WebGLRenderingContext is not available
const GL_FLOAT = 5126;
const GL_ARRAY_BUFFER = 34962;
const GL_ELEMENT_ARRAY_BUFFER = 34963;
const GL_STATIC_DRAW = 35044;
const GL_DYNAMIC_DRAW = 35048;
const GL_STREAM_DRAW = 35040;

/**
 * Standard vertex layouts for common use cases
 * 常见用例的标准顶点布局
 */
export const VertexLayouts = {
  /**
   * Position + UV layout for sprites
   * 精灵的位置+UV布局
   */
  PositionUV: {
    id: 'position_uv',
    attributes: [
      { name: 'a_position', size: 2, type: GL_FLOAT, normalized: false, offset: 0 },
      { name: 'a_texCoord', size: 2, type: GL_FLOAT, normalized: false, offset: 8 },
    ],
    stride: 16,
  } as VertexLayout,

  /**
   * Position + UV + Color layout for colored sprites
   * 彩色精灵的位置+UV+颜色布局
   */
  PositionUVColor: {
    id: 'position_uv_color',
    attributes: [
      { name: 'a_position', size: 2, type: GL_FLOAT, normalized: false, offset: 0 },
      { name: 'a_texCoord', size: 2, type: GL_FLOAT, normalized: false, offset: 8 },
      { name: 'a_color', size: 4, type: GL_FLOAT, normalized: false, offset: 16 },
    ],
    stride: 32,
  } as VertexLayout,

  /**
   * Position only layout for solid colors
   * 纯色的仅位置布局
   */
  Position: {
    id: 'position',
    attributes: [
      { name: 'a_position', size: 2, type: GL_FLOAT, normalized: false, offset: 0 },
    ],
    stride: 8,
  } as VertexLayout,
};