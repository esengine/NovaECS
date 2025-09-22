/**
 * Shader Program Resource for GPU Rendering
 * 用于GPU渲染的着色器程序资源
 *
 * Manages vertex and fragment shaders, uniform locations, attribute bindings,
 * and compilation/linking status for WebGL/WebGPU rendering pipelines.
 * 管理顶点和片段着色器、uniform位置、属性绑定，
 * 以及WebGL/WebGPU渲染管线的编译/链接状态。
 */

/**
 * Shader type enumeration
 * 着色器类型枚举
 */
export enum ShaderType {
  Vertex = 0,
  Fragment = 1,
  Compute = 2, // For future WebGPU support
}

/**
 * Uniform descriptor for shader parameters
 * 着色器参数的uniform描述符
 */
export interface UniformDescriptor {
  /** Uniform name in shader 着色器中的uniform名称 */
  name: string;
  /** WebGL uniform location WebGL uniform位置 */
  location: WebGLUniformLocation | null;
  /** GLSL type (e.g., 'float', 'vec3', 'mat4') GLSL类型 */
  type: string;
  /** Array size (1 for non-arrays) 数组大小（非数组为1） */
  size: number;
  /** Whether uniform is an array 是否为数组uniform */
  isArray: boolean;
}

/**
 * Vertex attribute descriptor
 * 顶点属性描述符
 */
export interface AttributeDescriptor {
  /** Attribute name in shader 着色器中的属性名称 */
  name: string;
  /** WebGL attribute location WebGL属性位置 */
  location: number;
  /** Component count (1-4) 组件数量 */
  size: number;
  /** Component type (e.g., GL_FLOAT) 组件类型 */
  type: number;
  /** Whether to normalize values 是否标准化值 */
  normalized: boolean;
}

/**
 * Shader compilation result
 * 着色器编译结果
 */
export interface ShaderCompileResult {
  /** Whether compilation succeeded 编译是否成功 */
  success: boolean;
  /** Error message if compilation failed 编译失败时的错误消息 */
  error?: string;
  /** Compiled shader object 编译的着色器对象 */
  shader?: WebGLShader;
  /** Preprocessed source code 预处理的源代码 */
  source?: string;
}

/**
 * Shader Program resource for GPU pipeline management
 * 用于GPU管线管理的着色器程序资源
 */
export class ShaderProgram {
  /**
   * Program identifier for caching and debugging
   * 用于缓存和调试的程序标识符
   */
  id: string;

  /**
   * Vertex shader source code
   * 顶点着色器源代码
   */
  vertexSource: string;

  /**
   * Fragment shader source code
   * 片段着色器源代码
   */
  fragmentSource: string;

  /**
   * WebGL program object
   * WebGL程序对象
   */
  program: WebGLProgram | null = null;

  /**
   * Compiled vertex shader
   * 编译的顶点着色器
   */
  vertexShader: WebGLShader | null = null;

  /**
   * Compiled fragment shader
   * 编译的片段着色器
   */
  fragmentShader: WebGLShader | null = null;

  /**
   * Uniform descriptors indexed by name
   * 按名称索引的uniform描述符
   */
  uniforms: Map<string, UniformDescriptor> = new Map();

  /**
   * Attribute descriptors indexed by name
   * 按名称索引的属性描述符
   */
  attributes: Map<string, AttributeDescriptor> = new Map();

  /**
   * Whether the program is compiled and linked
   * 程序是否已编译和链接
   */
  compiled: boolean = false;

  /**
   * Compilation/linking error messages
   * 编译/链接错误消息
   */
  errors: string[] = [];

  /**
   * Usage statistics for optimization
   * 用于优化的使用统计
   */
  usageCount: number = 0;

  /**
   * Last used frame for cache management
   * 用于缓存管理的最后使用帧
   */
  lastUsedFrame: number = 0;

  constructor(id: string, vertexSource: string, fragmentSource: string) {
    this.id = id;
    this.vertexSource = vertexSource;
    this.fragmentSource = fragmentSource;
  }

  /**
   * Get uniform location by name
   * 按名称获取uniform位置
   *
   * @param name Uniform name
   * @returns Uniform location or null
   */
  getUniformLocation(name: string): WebGLUniformLocation | null {
    const uniform = this.uniforms.get(name);
    return uniform ? uniform.location : null;
  }

  /**
   * Get attribute location by name
   * 按名称获取属性位置
   *
   * @param name Attribute name
   * @returns Attribute location or -1
   */
  getAttributeLocation(name: string): number {
    const attribute = this.attributes.get(name);
    return attribute ? attribute.location : -1;
  }

  /**
   * Check if uniform exists
   * 检查uniform是否存在
   *
   * @param name Uniform name
   * @returns True if uniform exists
   */
  hasUniform(name: string): boolean {
    return this.uniforms.has(name);
  }

  /**
   * Check if attribute exists
   * 检查属性是否存在
   *
   * @param name Attribute name
   * @returns True if attribute exists
   */
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  /**
   * Mark program as used for cache management
   * 标记程序为已使用以进行缓存管理
   *
   * @param frame Current frame number
   */
  markUsed(frame: number): void {
    this.usageCount++;
    this.lastUsedFrame = frame;
  }

  /**
   * Clean up WebGL resources
   * 清理WebGL资源
   *
   * @param gl WebGL context
   */
  dispose(gl: WebGLRenderingContext): void {
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.vertexShader) {
      gl.deleteShader(this.vertexShader);
      this.vertexShader = null;
    }
    if (this.fragmentShader) {
      gl.deleteShader(this.fragmentShader);
      this.fragmentShader = null;
    }
    this.compiled = false;
  }

  /**
   * Get memory usage estimate
   * 获取内存使用估计
   *
   * @returns Estimated memory usage in bytes
   */
  getMemoryUsage(): number {
    // Rough estimate: source code + compiled bytecode
    const sourceSize = this.vertexSource.length + this.fragmentSource.length;
    const uniformsSize = this.uniforms.size * 64; // Rough estimate
    const attributesSize = this.attributes.size * 32;
    return sourceSize + uniformsSize + attributesSize + 1024; // Extra for compiled program
  }
}

/**
 * Create a basic unlit shader program
 * 创建基本无光照着色器程序
 *
 * @returns Configured ShaderProgram
 */
export const createUnlitShader = (): ShaderProgram => {
  const vertexSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    attribute vec4 a_color;

    uniform mat3 u_viewProjection;
    uniform mat3 u_model;

    varying vec2 v_texCoord;
    varying vec4 v_color;

    void main() {
      vec3 position = u_viewProjection * u_model * vec3(a_position, 1.0);
      gl_Position = vec4(position.xy, 0.0, 1.0);
      v_texCoord = a_texCoord;
      v_color = a_color;
    }
  `;

  const fragmentSource = `
    precision mediump float;

    uniform sampler2D u_mainTexture;
    uniform vec4 u_color;

    varying vec2 v_texCoord;
    varying vec4 v_color;

    void main() {
      vec4 texColor = texture2D(u_mainTexture, v_texCoord);
      gl_FragColor = texColor * v_color * u_color;
    }
  `;

  return new ShaderProgram('unlit', vertexSource, fragmentSource);
};

/**
 * Create a solid color shader program (no texture)
 * 创建纯色着色器程序（无纹理）
 *
 * @returns Configured ShaderProgram
 */
export const createColorShader = (): ShaderProgram => {
  const vertexSource = `
    attribute vec2 a_position;
    attribute vec4 a_color;

    uniform mat3 u_viewProjection;
    uniform mat3 u_model;

    varying vec4 v_color;

    void main() {
      vec3 position = u_viewProjection * u_model * vec3(a_position, 1.0);
      gl_Position = vec4(position.xy, 0.0, 1.0);
      v_color = a_color;
    }
  `;

  const fragmentSource = `
    precision mediump float;

    uniform vec4 u_color;
    varying vec4 v_color;

    void main() {
      gl_FragColor = v_color * u_color;
    }
  `;

  return new ShaderProgram('color', vertexSource, fragmentSource);
};

/**
 * Preprocess shader source with define substitutions
 * 使用定义替换预处理着色器源代码
 *
 * @param source Original shader source
 * @param defines Map of define values
 * @returns Preprocessed source
 */
export const preprocessShader = (
  source: string,
  defines: Map<string, string | number | boolean> = new Map()
): string => {
  let processed = source;

  // Add defines at the top
  let definesString = '';
  for (const [key, value] of defines) {
    definesString += `#define ${key} ${value}\n`;
  }

  // Insert after #version if present, otherwise at the beginning
  const versionMatch = processed.match(/^#version\s+\d+.*$/m);
  if (versionMatch) {
    processed = processed.replace(versionMatch[0], versionMatch[0] + '\n' + definesString);
  } else {
    processed = definesString + processed;
  }

  return processed;
};