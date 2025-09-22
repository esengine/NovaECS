/**
 * WebGL Render Device Implementation
 * WebGL渲染设备实现
 *
 * Concrete implementation of IRenderDevice for WebGL 1.0/2.0 APIs.
 * Provides efficient resource management, state tracking, and rendering operations.
 * IRenderDevice接口针对WebGL 1.0/2.0 API的具体实现。
 * 提供高效的资源管理、状态跟踪和渲染操作。
 */

import {
  IRenderDevice,
  GraphicsAPI,
  DeviceCapabilities,
  RenderPassDescriptor,
  DrawCallDescriptor,
  ViewportDescriptor,
  RenderStats,
} from './IRenderDevice';
import { RenderTexture } from '../resources/RenderTexture';
import { VertexBuffer, IndexBuffer } from '../resources/RenderBuffers';
import { ShaderProgram, ShaderCompileResult } from '../resources/ShaderProgram';

/**
 * WebGL render state for efficient state management
 * 用于高效状态管理的WebGL渲染状态
 */
interface WebGLRenderState {
  /** Currently bound shader program 当前绑定的着色器程序 */
  currentShader: ShaderProgram | null;
  /** Currently bound vertex buffer 当前绑定的顶点缓冲区 */
  currentVertexBuffer: VertexBuffer | null;
  /** Currently bound index buffer 当前绑定的索引缓冲区 */
  currentIndexBuffer: IndexBuffer | null;
  /** Currently bound textures by slot 按槽位当前绑定的纹理 */
  boundTextures: Map<number, RenderTexture>;
  /** Current viewport 当前视口 */
  viewport: ViewportDescriptor;
  /** Current blend state 当前混合状态 */
  blendEnabled: boolean;
  /** Current depth test state 当前深度测试状态 */
  depthTestEnabled: boolean;
  /** Current cull mode 当前剔除模式 */
  cullMode: number;
}

/**
 * WebGL Device implementation
 * WebGL设备实现
 */
export class WebGLDevice implements IRenderDevice {
  private gl!: WebGLRenderingContext | WebGL2RenderingContext;
  private canvas!: HTMLCanvasElement;
  private capabilities!: DeviceCapabilities;
  private renderState: WebGLRenderState;
  private stats: RenderStats;
  private isWebGL2: boolean = false;

  // Resource tracking for cleanup
  private createdTextures = new Set<RenderTexture>();
  private createdBuffers = new Set<VertexBuffer | IndexBuffer>();
  private createdShaders = new Set<ShaderProgram>();

  constructor() {
    this.renderState = {
      currentShader: null,
      currentVertexBuffer: null,
      currentIndexBuffer: null,
      boundTextures: new Map(),
      viewport: { x: 0, y: 0, width: 800, height: 600, near: 0, far: 1 },
      blendEnabled: false,
      depthTestEnabled: true,
      cullMode: WebGLRenderingContext.BACK,
    };

    this.stats = {
      drawCalls: 0,
      vertices: 0,
      triangles: 0,
      textureBindings: 0,
      shaderSwitches: 0,
      frameTime: 0,
      gpuMemoryUsage: 0,
    };
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    // Try WebGL2 first, fallback to WebGL1
    let gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: true,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext;

    if (!gl) {
      gl = canvas.getContext('webgl', {
        alpha: false,
        depth: true,
        stencil: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      }) as WebGL2RenderingContext;

      if (!gl) {
        throw new Error('WebGL not supported');
      }
      this.isWebGL2 = false;
    } else {
      this.isWebGL2 = true;
    }

    this.gl = gl;

    // Initialize capabilities
    this.capabilities = this.detectCapabilities();

    // Set initial state
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    // Clear to black
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1.0);
  }

  getCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }

  async createTexture(texture: RenderTexture): Promise<void> {
    const gl = this.gl;
    const glTexture = gl.createTexture();

    if (!glTexture) {
      throw new Error(`Failed to create WebGL texture: ${texture.id}`);
    }

    texture.texture = glTexture;
    this.createdTextures.add(texture);

    gl.bindTexture(gl.TEXTURE_2D, glTexture);

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.getGLWrap(texture.wrapS));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.getGLWrap(texture.wrapT));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.getGLFilter(texture.minFilter));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.getGLFilter(texture.magFilter));

    // Upload texture data
    await this.updateTexture(texture);

    // Generate mipmaps if requested
    if (texture.hasMipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    texture.dirty = false;
  }

  async updateTexture(texture: RenderTexture): Promise<void> {
    if (!texture.texture) {
      throw new Error(`Texture not created: ${texture.id}`);
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture.texture);

    const format = texture.getGLFormat();
    const internalFormat = texture.getGLInternalFormat();
    const type = texture.getGLType();

    if (texture.data) {
      // Upload from array data
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        texture.width,
        texture.height,
        0,
        format,
        type,
        texture.data
      );
    } else if (texture.image) {
      // Upload from image
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, type, texture.image);
    } else {
      // Create empty texture
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        texture.width,
        texture.height,
        0,
        format,
        type,
        null
      );
    }

    texture.dirty = false;
  }

  destroyTexture(texture: RenderTexture): void {
    if (texture.texture) {
      this.gl.deleteTexture(texture.texture);
      texture.texture = null;
      this.createdTextures.delete(texture);
    }
  }

  async createVertexBuffer(buffer: VertexBuffer): Promise<void> {
    const gl = this.gl;
    const glBuffer = gl.createBuffer();

    if (!glBuffer) {
      throw new Error(`Failed to create vertex buffer: ${buffer.id}`);
    }

    buffer.buffer = glBuffer;
    this.createdBuffers.add(buffer);

    await this.updateVertexBuffer(buffer);
  }

  async updateVertexBuffer(buffer: VertexBuffer): Promise<void> {
    if (!buffer.buffer) {
      throw new Error(`Vertex buffer not created: ${buffer.id}`);
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, buffer.data, buffer.getUsageHint());

    buffer.dirty = false;
  }

  destroyVertexBuffer(buffer: VertexBuffer): void {
    if (buffer.buffer) {
      this.gl.deleteBuffer(buffer.buffer);
      buffer.buffer = null;
      this.createdBuffers.delete(buffer);
    }
  }

  async createIndexBuffer(buffer: IndexBuffer): Promise<void> {
    const gl = this.gl;
    const glBuffer = gl.createBuffer();

    if (!glBuffer) {
      throw new Error(`Failed to create index buffer: ${buffer.id}`);
    }

    buffer.buffer = glBuffer;
    this.createdBuffers.add(buffer);

    await this.updateIndexBuffer(buffer);
  }

  async updateIndexBuffer(buffer: IndexBuffer): Promise<void> {
    if (!buffer.buffer) {
      throw new Error(`Index buffer not created: ${buffer.id}`);
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buffer.data, buffer.getUsageHint());

    buffer.dirty = false;
  }

  destroyIndexBuffer(buffer: IndexBuffer): void {
    if (buffer.buffer) {
      this.gl.deleteBuffer(buffer.buffer);
      buffer.buffer = null;
      this.createdBuffers.delete(buffer);
    }
  }

  async createShader(shader: ShaderProgram): Promise<void> {
    const gl = this.gl;

    // Compile vertex shader
    const vertexResult = this.compileShader(gl.VERTEX_SHADER, shader.vertexSource);
    if (!vertexResult.success) {
      shader.errors.push(`Vertex shader: ${vertexResult.error}`);
      throw new Error(`Failed to compile vertex shader: ${vertexResult.error}`);
    }

    // Compile fragment shader
    const fragmentResult = this.compileShader(gl.FRAGMENT_SHADER, shader.fragmentSource);
    if (!fragmentResult.success) {
      shader.errors.push(`Fragment shader: ${fragmentResult.error}`);
      throw new Error(`Failed to compile fragment shader: ${fragmentResult.error}`);
    }

    // Create and link program
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    gl.attachShader(program, vertexResult.shader!);
    gl.attachShader(program, fragmentResult.shader!);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vertexResult.shader!);
      gl.deleteShader(fragmentResult.shader!);
      throw new Error(`Failed to link shader program: ${error}`);
    }

    shader.program = program;
    shader.vertexShader = vertexResult.shader!;
    shader.fragmentShader = fragmentResult.shader!;
    shader.compiled = true;

    // Extract uniforms and attributes
    this.extractShaderInfo(shader);
    this.createdShaders.add(shader);
  }

  destroyShader(shader: ShaderProgram): void {
    shader.dispose(this.gl);
    this.createdShaders.delete(shader);
  }

  beginRenderPass(descriptor: RenderPassDescriptor): void {
    const gl = this.gl;

    // Set viewport if color attachment exists
    if (descriptor.colorAttachments[0]) {
      const attachment = descriptor.colorAttachments[0];
      this.setViewport({
        x: 0,
        y: 0,
        width: attachment.width,
        height: attachment.height,
        near: 0,
        far: 1,
      });
    }

    // Clear buffers
    let clearMask = 0;

    if (descriptor.clearColor) {
      const clearColor = descriptor.clearColors[0] || [0, 0, 0, 1];
      gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
      clearMask |= gl.COLOR_BUFFER_BIT;
    }

    if (descriptor.clearDepthBuffer) {
      gl.clearDepth(descriptor.clearDepth ?? 1.0);
      clearMask |= gl.DEPTH_BUFFER_BIT;
    }

    if (clearMask !== 0) {
      gl.clear(clearMask);
    }
  }

  endRenderPass(): void {
    // No-op for WebGL (no explicit render passes)
  }

  setViewport(viewport: ViewportDescriptor): void {
    this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    this.renderState.viewport = viewport;
  }

  draw(descriptor: DrawCallDescriptor): void {
    const gl = this.gl;

    // Bind shader
    if (this.renderState.currentShader !== descriptor.shader) {
      gl.useProgram(descriptor.shader.program);
      this.renderState.currentShader = descriptor.shader;
      this.stats.shaderSwitches++;
    }

    // Bind vertex buffer and attributes
    if (this.renderState.currentVertexBuffer !== descriptor.vertexBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, descriptor.vertexBuffer.buffer);
      this.bindVertexAttributes(descriptor.vertexBuffer, descriptor.shader);
      this.renderState.currentVertexBuffer = descriptor.vertexBuffer;
    }

    // Bind textures
    for (const [slot, texture] of descriptor.textures) {
      if (this.renderState.boundTextures.get(slot) !== texture) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        this.renderState.boundTextures.set(slot, texture);
        this.stats.textureBindings++;
      }
    }

    // Set uniforms
    this.setUniforms(descriptor.shader, descriptor.uniforms);

    // Draw
    if (descriptor.indexBuffer) {
      // Indexed draw
      if (this.renderState.currentIndexBuffer !== descriptor.indexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, descriptor.indexBuffer.buffer);
        this.renderState.currentIndexBuffer = descriptor.indexBuffer;
      }

      if (descriptor.instanceCount > 1 && this.isWebGL2) {
        // Instanced indexed draw (WebGL2)
        (gl as WebGL2RenderingContext).drawElementsInstanced(
          gl.TRIANGLES,
          descriptor.count,
          gl.UNSIGNED_SHORT,
          descriptor.offset * 2, // Convert to bytes
          descriptor.instanceCount
        );
      } else {
        // Regular indexed draw
        gl.drawElements(
          gl.TRIANGLES,
          descriptor.count,
          gl.UNSIGNED_SHORT,
          descriptor.offset * 2 // Convert to bytes
        );
      }
    } else {
      // Array draw
      if (descriptor.instanceCount > 1 && this.isWebGL2) {
        // Instanced array draw (WebGL2)
        (gl as WebGL2RenderingContext).drawArraysInstanced(
          gl.TRIANGLES,
          descriptor.offset,
          descriptor.count,
          descriptor.instanceCount
        );
      } else {
        // Regular array draw
        gl.drawArrays(gl.TRIANGLES, descriptor.offset, descriptor.count);
      }
    }

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += descriptor.count;
    this.stats.triangles += Math.floor(descriptor.count / 3);
  }

  present(): void {
    // No explicit present needed for WebGL
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.setViewport({
      x: 0,
      y: 0,
      width,
      height,
      near: 0,
      far: 1,
    });
  }

  getStats(): RenderStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      drawCalls: 0,
      vertices: 0,
      triangles: 0,
      textureBindings: 0,
      shaderSwitches: 0,
      frameTime: 0,
      gpuMemoryUsage: 0,
    };
  }

  destroy(): void {
    // Clean up all resources
    for (const texture of this.createdTextures) {
      this.destroyTexture(texture);
    }
    for (const buffer of this.createdBuffers) {
      if (buffer instanceof VertexBuffer) {
        this.destroyVertexBuffer(buffer);
      } else {
        this.destroyIndexBuffer(buffer);
      }
    }
    for (const shader of this.createdShaders) {
      this.destroyShader(shader);
    }

    this.createdTextures.clear();
    this.createdBuffers.clear();
    this.createdShaders.clear();
  }

  // Private helper methods

  private detectCapabilities(): DeviceCapabilities {
    const gl = this.gl;

    return {
      api: this.isWebGL2 ? GraphicsAPI.WebGL2 : GraphicsAPI.WebGL,
      version: gl.getParameter(gl.VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      supportsInstancing: this.isWebGL2,
      supportsDepthTexture: this.checkExtension('WEBGL_depth_texture'),
      supportsFloatTextures: this.checkExtension('OES_texture_float'),
      supportsCompressedTextures: this.checkExtension('WEBGL_compressed_texture_s3tc'),
      maxUniformBufferSize: this.isWebGL2
        ? (gl as WebGL2RenderingContext).getParameter((gl as WebGL2RenderingContext).MAX_UNIFORM_BLOCK_SIZE)
        : 16384,
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
    };
  }

  private checkExtension(name: string): boolean {
    return this.gl.getExtension(name) !== null;
  }

  private compileShader(type: number, source: string): ShaderCompileResult {
    const gl = this.gl;
    const shader = gl.createShader(type);

    if (!shader) {
      return { success: false, error: 'Failed to create shader object' };
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      return { success: false, error: error || 'Unknown compilation error' };
    }

    return { success: true, shader, source };
  }

  private extractShaderInfo(shader: ShaderProgram): void {
    const gl = this.gl;
    const program = shader.program!;

    // Extract uniforms
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const location = gl.getUniformLocation(program, info.name);
        shader.uniforms.set(info.name, {
          name: info.name,
          location,
          type: this.getGLSLTypeName(info.type),
          size: info.size,
          isArray: info.size > 1,
        });
      }
    }

    // Extract attributes
    const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < attributeCount; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        const location = gl.getAttribLocation(program, info.name);
        shader.attributes.set(info.name, {
          name: info.name,
          location,
          size: this.getAttributeSize(info.type),
          type: gl.FLOAT, // Assume float for now
          normalized: false,
        });
      }
    }
  }

  private bindVertexAttributes(buffer: VertexBuffer, shader: ShaderProgram): void {
    const gl = this.gl;

    for (const attr of buffer.layout.attributes) {
      const attribLocation = shader.getAttributeLocation(attr.name);
      if (attribLocation >= 0) {
        gl.enableVertexAttribArray(attribLocation);
        gl.vertexAttribPointer(
          attribLocation,
          attr.size,
          attr.type,
          attr.normalized,
          buffer.layout.stride,
          attr.offset
        );
      }
    }
  }

  private setUniforms(shader: ShaderProgram, uniforms: Map<string, any>): void {

    for (const [name, value] of uniforms) {
      const location = shader.getUniformLocation(name);
      if (location) {
        this.setUniform(location, value);
      }
    }
  }

  private setUniform(location: WebGLUniformLocation, value: any): void {
    const gl = this.gl;

    if (typeof value === 'number') {
      gl.uniform1f(location, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2:
          gl.uniform2fv(location, value);
          break;
        case 3:
          gl.uniform3fv(location, value);
          break;
        case 4:
          gl.uniform4fv(location, value);
          break;
        case 9:
          gl.uniformMatrix3fv(location, false, value);
          break;
        case 16:
          gl.uniformMatrix4fv(location, false, value);
          break;
      }
    }
  }

  private getGLWrap(wrap: number): number {
    const gl = this.gl;
    switch (wrap) {
      case 0: return gl.CLAMP_TO_EDGE;
      case 1: return gl.REPEAT;
      case 2: return gl.MIRRORED_REPEAT;
      default: return gl.CLAMP_TO_EDGE;
    }
  }

  private getGLFilter(filter: number): number {
    const gl = this.gl;
    switch (filter) {
      case 0: return gl.NEAREST;
      case 1: return gl.LINEAR;
      case 2: return gl.NEAREST_MIPMAP_NEAREST;
      case 3: return gl.LINEAR_MIPMAP_NEAREST;
      case 4: return gl.NEAREST_MIPMAP_LINEAR;
      case 5: return gl.LINEAR_MIPMAP_LINEAR;
      default: return gl.LINEAR;
    }
  }

  private getGLSLTypeName(glType: number): string {
    const gl = this.gl;
    switch (glType) {
      case gl.FLOAT: return 'float';
      case gl.FLOAT_VEC2: return 'vec2';
      case gl.FLOAT_VEC3: return 'vec3';
      case gl.FLOAT_VEC4: return 'vec4';
      case gl.FLOAT_MAT3: return 'mat3';
      case gl.FLOAT_MAT4: return 'mat4';
      case gl.SAMPLER_2D: return 'sampler2D';
      default: return 'unknown';
    }
  }

  private getAttributeSize(glType: number): number {
    const gl = this.gl;
    switch (glType) {
      case gl.FLOAT: return 1;
      case gl.FLOAT_VEC2: return 2;
      case gl.FLOAT_VEC3: return 3;
      case gl.FLOAT_VEC4: return 4;
      default: return 1;
    }
  }
}