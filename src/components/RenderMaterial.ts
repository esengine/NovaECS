/**
 * Render Material Component for Shader-based Rendering
 * 用于基于着色器渲染的渲染材质组件
 *
 * Defines rendering properties including shader programs, textures, uniforms,
 * and render state settings. Materials control how surfaces appear during rendering.
 * 定义渲染属性，包括着色器程序、纹理、uniform变量和渲染状态设置。
 * 材质控制表面在渲染期间的外观。
 */

/**
 * Texture wrap modes for UV coordinates
 * UV坐标的纹理包裹模式
 */
export enum WrapMode {
  Clamp = 0,
  Repeat = 1,
  MirroredRepeat = 2,
}

/**
 * Texture filtering modes
 * 纹理过滤模式
 */
export enum FilterMode {
  Nearest = 0,
  Linear = 1,
  NearestMipmapNearest = 2,
  LinearMipmapNearest = 3,
  NearestMipmapLinear = 4,
  LinearMipmapLinear = 5,
}

/**
 * Face culling modes
 * 面剔除模式
 */
export enum CullMode {
  None = 0,
  Front = 1,
  Back = 2,
}

/**
 * Depth test comparison functions
 * 深度测试比较函数
 */
export enum DepthFunc {
  Never = 0,
  Less = 1,
  Equal = 2,
  LessEqual = 3,
  Greater = 4,
  NotEqual = 5,
  GreaterEqual = 6,
  Always = 7,
}

/**
 * Texture binding descriptor
 * 纹理绑定描述符
 */
export interface TextureBinding {
  /** Texture resource identifier 纹理资源标识符 */
  textureId: string;
  /** Sampler uniform name in shader 着色器中的采样器uniform名称 */
  uniformName: string;
  /** Texture unit slot (0-31) 纹理单元槽位 */
  slot: number;
  /** Wrap mode for U coordinate U坐标的包裹模式 */
  wrapU: WrapMode;
  /** Wrap mode for V coordinate V坐标的包裹模式 */
  wrapV: WrapMode;
  /** Minification filter 缩小过滤器 */
  minFilter: FilterMode;
  /** Magnification filter 放大过滤器 */
  magFilter: FilterMode;
}

/**
 * Shader uniform value (supports common GLSL types)
 * 着色器uniform值（支持常见的GLSL类型）
 */
export type UniformValue =
  | number                    // float
  | [number, number]          // vec2
  | [number, number, number]  // vec3
  | [number, number, number, number] // vec4
  | number[]                  // matrix (4, 9, or 16 elements)
  | Int32Array               // int array
  | Float32Array;            // float array

/**
 * Render Material component for advanced shader-based rendering
 * 用于高级基于着色器渲染的渲染材质组件
 */
export class RenderMaterial {
  /**
   * Material identifier for debugging and caching
   * 用于调试和缓存的材质标识符
   */
  id: string = 'default';

  /**
   * Shader program resource identifier
   * 着色器程序资源标识符
   */
  shaderId: string = 'default';

  /**
   * Texture bindings for the material
   * 材质的纹理绑定
   */
  textures: TextureBinding[] = [];

  /**
   * Shader uniform values
   * 着色器uniform值
   */
  uniforms: Map<string, UniformValue> = new Map();

  /**
   * Render queue priority (lower values render first)
   * 渲染队列优先级（较低值先渲染）
   */
  renderQueue: number = 2000;

  /**
   * Whether to enable depth testing
   * 是否启用深度测试
   */
  depthTest: boolean = true;

  /**
   * Whether to write to depth buffer
   * 是否写入深度缓冲区
   */
  depthWrite: boolean = true;

  /**
   * Depth comparison function
   * 深度比较函数
   */
  depthFunc: DepthFunc = DepthFunc.LessEqual;

  /**
   * Face culling mode
   * 面剔除模式
   */
  cullMode: CullMode = CullMode.Back;

  /**
   * Whether to enable alpha blending
   * 是否启用alpha混合
   */
  blend: boolean = false;

  /**
   * Source blend factor
   * 源混合因子
   */
  blendSrc: number = 1; // GL_ONE

  /**
   * Destination blend factor
   * 目标混合因子
   */
  blendDst: number = 0; // GL_ZERO

  /**
   * Blend equation
   * 混合方程
   */
  blendEquation: number = 0; // GL_FUNC_ADD

  /**
   * Whether the material is transparent
   * 材质是否透明
   */
  transparent: boolean = false;

  /**
   * Alpha cutoff threshold for alpha testing
   * alpha测试的alpha截止阈值
   */
  alphaCutoff: number = 0.5;

  /**
   * Whether to enable alpha testing
   * 是否启用alpha测试
   */
  alphaTest: boolean = false;
}

/**
 * Create a basic unlit material
 * 创建基本无光照材质
 *
 * @param textureId Main texture identifier
 * @param color Base color multiplier
 * @returns Configured RenderMaterial instance
 */
export const createUnlitMaterial = (
  textureId: string = '',
  color: [number, number, number, number] = [1, 1, 1, 1]
): RenderMaterial => {
  const material = new RenderMaterial();
  material.id = 'unlit';
  material.shaderId = 'unlit';

  if (textureId) {
    material.textures.push({
      textureId,
      uniformName: 'u_mainTexture',
      slot: 0,
      wrapU: WrapMode.Repeat,
      wrapV: WrapMode.Repeat,
      minFilter: FilterMode.Linear,
      magFilter: FilterMode.Linear,
    });
  }

  material.uniforms.set('u_color', color);
  return material;
};

/**
 * Create a transparent material with alpha blending
 * 创建具有alpha混合的透明材质
 *
 * @param textureId Main texture identifier
 * @param alpha Alpha transparency value
 * @returns Configured RenderMaterial instance
 */
export const createTransparentMaterial = (
  textureId: string = '',
  alpha: number = 0.5
): RenderMaterial => {
  const material = createUnlitMaterial(textureId, [1, 1, 1, alpha]);
  material.id = 'transparent';
  material.transparent = true;
  material.blend = true;
  material.blendSrc = 1;    // GL_ONE
  material.blendDst = 771;  // GL_ONE_MINUS_SRC_ALPHA
  material.depthWrite = false;
  material.renderQueue = 3000; // Render after opaque objects
  return material;
};

/**
 * Create an additive blend material for effects
 * 创建用于效果的加法混合材质
 *
 * @param textureId Effect texture identifier
 * @returns Configured RenderMaterial instance
 */
export const createAdditiveMaterial = (
  textureId: string = ''
): RenderMaterial => {
  const material = createUnlitMaterial(textureId);
  material.id = 'additive';
  material.transparent = true;
  material.blend = true;
  material.blendSrc = 1;    // GL_ONE
  material.blendDst = 1;    // GL_ONE
  material.depthWrite = false;
  material.renderQueue = 3100;
  return material;
};