/**
 * Rendering Resources Unit Tests
 * 渲染资源单元测试
 *
 * Tests rendering resource classes for proper initialization,
 * data management, and resource lifecycle handling.
 * 测试渲染资源类的正确初始化、数据管理和资源生命周期处理。
 */

import { describe, test, expect, beforeEach } from 'vitest';

// Import rendering resources
import { TextureAtlas, createAtlasFromJSON, createGridAtlas } from '../src/resources/TextureAtlas';
import { ShaderProgram, ShaderType, createUnlitShader, createColorShader, preprocessShader } from '../src/resources/ShaderProgram';
import {
  RenderBuffer,
  VertexBuffer,
  IndexBuffer,
  UniformBuffer,
  BufferUsage,
  BufferType,
  VertexLayouts
} from '../src/resources/RenderBuffers';
import {
  RenderTexture,
  TextureFormat,
  TextureFilter,
  TextureWrap,
  TextureUsage,
  createRenderTarget,
  createColorTexture,
  isPowerOfTwo
} from '../src/resources/RenderTexture';

describe('TextureAtlas Resource', () => {
  test('should create texture atlas with metadata', () => {
    const metadata = {
      name: 'test_atlas',
      size: [512, 512] as [number, number],
      format: 'RGBA8',
      frameCount: 0,
      created: Date.now(),
      version: 1,
    };

    const atlas = new TextureAtlas(metadata);

    expect(atlas.metadata.name).toBe('test_atlas');
    expect(atlas.metadata.size).toEqual([512, 512]);
    expect(atlas.metadata.format).toBe('RGBA8');
    expect(atlas.frames.size).toBe(0);
    expect(atlas.frameArray).toHaveLength(0);
    expect(atlas.loaded).toBe(false);
  });

  test('should add and retrieve frames', () => {
    const metadata = {
      name: 'test',
      size: [256, 256] as [number, number],
      format: 'RGBA8',
      frameCount: 0,
      created: Date.now(),
      version: 1,
    };

    const atlas = new TextureAtlas(metadata);

    const frame = {
      name: 'sprite_01',
      uv: [0, 0, 0.5, 0.5] as [number, number, number, number],
      sourceSize: [64, 64] as [number, number],
      frameSize: [64, 64] as [number, number],
      offset: [0, 0] as [number, number],
      rotated: false,
    };

    atlas.addFrame(frame);

    expect(atlas.frames.size).toBe(1);
    expect(atlas.frameArray).toHaveLength(1);
    expect(atlas.hasFrame('sprite_01')).toBe(true);
    expect(atlas.getFrame('sprite_01')).toEqual(frame);
    expect(atlas.getFrameNames()).toContain('sprite_01');
  });

  test('should create grid atlas', () => {
    const atlas = createGridAtlas('grid_test', [256, 256], [32, 32], 16);

    expect(atlas.metadata.name).toBe('grid_test');
    expect(atlas.metadata.size).toEqual([256, 256]);
    expect(atlas.frameArray).toHaveLength(16);

    // Check first frame
    const firstFrame = atlas.getFrame('frame_0');
    expect(firstFrame).toBeDefined();
    expect(firstFrame!.uv).toEqual([0, 0, 0.125, 0.125]); // 32/256 = 0.125

    // Check frame in second row
    const secondRowFrame = atlas.getFrame('frame_8'); // First frame of second row
    expect(secondRowFrame).toBeDefined();
    expect(secondRowFrame!.uv).toEqual([0, 0.125, 0.125, 0.25]);
  });

  test('should calculate memory usage', () => {
    const metadata = {
      name: 'test',
      size: [512, 512] as [number, number],
      format: 'RGBA8',
      frameCount: 0,
      created: Date.now(),
      version: 1,
    };

    const atlas = new TextureAtlas(metadata);
    const memoryUsage = atlas.getMemoryUsage();

    expect(memoryUsage).toBe(512 * 512 * 4); // RGBA8 = 4 bytes per pixel
  });
});

describe('ShaderProgram Resource', () => {
  test('should create shader program', () => {
    const vertexSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;

    const shader = new ShaderProgram('test_shader', vertexSource, fragmentSource);

    expect(shader.id).toBe('test_shader');
    expect(shader.vertexSource).toBe(vertexSource);
    expect(shader.fragmentSource).toBe(fragmentSource);
    expect(shader.compiled).toBe(false);
    expect(shader.program).toBeNull();
    expect(shader.uniforms.size).toBe(0);
    expect(shader.attributes.size).toBe(0);
  });

  test('should create predefined shaders', () => {
    const unlitShader = createUnlitShader();
    expect(unlitShader.id).toBe('unlit');
    expect(unlitShader.vertexSource).toContain('a_position');
    expect(unlitShader.vertexSource).toContain('a_texCoord');
    expect(unlitShader.fragmentSource).toContain('u_mainTexture');

    const colorShader = createColorShader();
    expect(colorShader.id).toBe('color');
    expect(colorShader.vertexSource).toContain('a_position');
    expect(colorShader.fragmentSource).toContain('u_color');
  });

  test('should preprocess shader source', () => {
    const source = `
      #version 300 es
      precision mediump float;
      uniform float u_value;
      void main() {
        gl_FragColor = vec4(u_value);
      }
    `;

    const defines = new Map([
      ['USE_TEXTURE', true],
      ['MAX_LIGHTS', 4],
      ['PI', 3.14159],
    ]);

    const processed = preprocessShader(source, defines);

    expect(processed).toContain('#define USE_TEXTURE true');
    expect(processed).toContain('#define MAX_LIGHTS 4');
    expect(processed).toContain('#define PI 3.14159');
    // The preprocessor adds defines at the top for sources without #version
    expect(processed).toContain('#define');
  });

  test('should manage uniform and attribute locations', () => {
    const shader = new ShaderProgram('test', '', '');

    expect(shader.hasUniform('u_test')).toBe(false);
    expect(shader.hasAttribute('a_test')).toBe(false);
    expect(shader.getUniformLocation('u_test')).toBeNull();
    expect(shader.getAttributeLocation('a_test')).toBe(-1);
  });

  test('should track usage statistics', () => {
    const shader = new ShaderProgram('test', '', '');

    expect(shader.usageCount).toBe(0);
    expect(shader.lastUsedFrame).toBe(0);

    shader.markUsed(5);
    expect(shader.usageCount).toBe(1);
    expect(shader.lastUsedFrame).toBe(5);

    shader.markUsed(10);
    expect(shader.usageCount).toBe(2);
    expect(shader.lastUsedFrame).toBe(10);
  });
});

describe('RenderBuffer Resources', () => {
  test('should create vertex buffer', () => {
    const layout = VertexLayouts.PositionUV;
    const buffer = new VertexBuffer('test_vb', layout, BufferUsage.Static);

    expect(buffer.id).toBe('test_vb');
    expect(buffer.type).toBe(BufferType.Vertex);
    expect(buffer.usage).toBe(BufferUsage.Static);
    expect(buffer.layout).toBe(layout);
    expect(buffer.vertexCount).toBe(0);
    expect(buffer.dirty).toBe(true);
  });

  test('should handle vertex data', () => {
    const layout = VertexLayouts.PositionUV;
    const buffer = new VertexBuffer('test', layout);

    const vertexData = new Float32Array([
      // Position, UV
      -1, -1, 0, 0,
      1, -1, 1, 0,
      1, 1, 1, 1,
      -1, 1, 0, 1,
    ]);

    buffer.setData(vertexData);

    expect(buffer.data).toBe(vertexData);
    expect(buffer.vertexCount).toBe(4);
    expect(buffer.size).toBe(vertexData.byteLength);
    expect(buffer.dirty).toBe(true);
  });

  test('should resize vertex buffer', () => {
    const layout = VertexLayouts.Position;
    const buffer = new VertexBuffer('test', layout);

    buffer.resize(100);

    expect(buffer.vertexCount).toBe(100);
    expect(buffer.data.length).toBe(100 * 2); // Position layout has 2 components
  });

  test('should create index buffer', () => {
    const buffer = new IndexBuffer('test_ib', BufferUsage.Static);

    expect(buffer.id).toBe('test_ib');
    expect(buffer.type).toBe(BufferType.Index);
    expect(buffer.indexCount).toBe(0);

    const indices = new Uint16Array([0, 1, 2, 2, 3, 0]);
    buffer.setData(indices);

    expect(buffer.indexCount).toBe(6);
    expect(buffer.size).toBe(indices.byteLength);
  });

  test('should create uniform buffer', () => {
    const buffer = new UniformBuffer('test_ub', 256);

    expect(buffer.id).toBe('test_ub');
    expect(buffer.type).toBe(BufferType.Uniform);
    expect(buffer.size).toBe(256);

    buffer.setFloat(0, 3.14);
    buffer.setVector(16, [1, 2, 3, 4]);
    buffer.setMatrix(32, [1, 0, 0, 0, 1, 0, 0, 0, 1]);

    expect(buffer.dirty).toBe(true);
  });

  test('should validate vertex layouts', () => {
    const posLayout = VertexLayouts.Position;
    expect(posLayout.id).toBe('position');
    expect(posLayout.stride).toBe(8); // 2 floats * 4 bytes
    expect(posLayout.attributes).toHaveLength(1);

    const posUVLayout = VertexLayouts.PositionUV;
    expect(posUVLayout.id).toBe('position_uv');
    expect(posUVLayout.stride).toBe(16); // 4 floats * 4 bytes
    expect(posUVLayout.attributes).toHaveLength(2);

    const posUVColorLayout = VertexLayouts.PositionUVColor;
    expect(posUVColorLayout.id).toBe('position_uv_color');
    expect(posUVColorLayout.stride).toBe(32); // 8 floats * 4 bytes
    expect(posUVColorLayout.attributes).toHaveLength(3);
  });

  test('should get correct usage hints', () => {
    const staticBuffer = new VertexBuffer('static', VertexLayouts.Position, BufferUsage.Static);
    const dynamicBuffer = new VertexBuffer('dynamic', VertexLayouts.Position, BufferUsage.Dynamic);
    const streamBuffer = new VertexBuffer('stream', VertexLayouts.Position, BufferUsage.Stream);

    // These are WebGL constants
    const GL_STATIC_DRAW = 35044;
    const GL_DYNAMIC_DRAW = 35048;
    const GL_STREAM_DRAW = 35040;

    expect(staticBuffer.getUsageHint()).toBe(GL_STATIC_DRAW);
    expect(dynamicBuffer.getUsageHint()).toBe(GL_DYNAMIC_DRAW);
    expect(streamBuffer.getUsageHint()).toBe(GL_STREAM_DRAW);
  });
});

describe('RenderTexture Resource', () => {
  test('should create render texture', () => {
    const texture = new RenderTexture('test_texture', 256, 256, TextureFormat.RGBA, TextureUsage.Static);

    expect(texture.id).toBe('test_texture');
    expect(texture.width).toBe(256);
    expect(texture.height).toBe(256);
    expect(texture.format).toBe(TextureFormat.RGBA);
    expect(texture.usage).toBe(TextureUsage.Static);
    expect(texture.loaded).toBe(false);
    expect(texture.dirty).toBe(true);
  });

  test('should set texture data', () => {
    const texture = new RenderTexture('test', 2, 2, TextureFormat.RGBA);
    const data = new Uint8Array([
      255, 0, 0, 255,    // Red
      0, 255, 0, 255,    // Green
      0, 0, 255, 255,    // Blue
      255, 255, 255, 255, // White
    ]);

    texture.setData(data);

    expect(texture.data).toBe(data);
    expect(texture.loaded).toBe(true);
    expect(texture.dirty).toBe(true);
    expect(texture.image).toBeNull();
  });

  test('should create specialized textures', () => {
    const renderTarget = createRenderTarget('rt', 512, 512, TextureFormat.RGB);
    expect(renderTarget.usage).toBe(TextureUsage.RenderTarget);
    expect(renderTarget.wrapS).toBe(TextureWrap.Clamp);
    expect(renderTarget.wrapT).toBe(TextureWrap.Clamp);

    const colorTexture = createColorTexture('white', [255, 255, 255, 255], 4);
    expect(colorTexture.width).toBe(4);
    expect(colorTexture.height).toBe(4);
    expect(colorTexture.data).toHaveLength(4 * 4 * 4); // 4x4 RGBA
  });

  test('should calculate memory usage', () => {
    const texture = new RenderTexture('test', 256, 256, TextureFormat.RGBA);
    const memoryUsage = texture.getMemoryUsage();

    expect(memoryUsage).toBe(256 * 256 * 4); // RGBA = 4 bytes per pixel

    texture.generateMipmaps();
    const mipmapMemoryUsage = texture.getMemoryUsage();
    expect(mipmapMemoryUsage).toBeGreaterThan(memoryUsage); // Should include mipmap memory
  });

  test('should validate WebGL format mappings', () => {
    const texture = new RenderTexture('test', 1, 1, TextureFormat.RGBA);

    const GL_RGBA = 6408;
    const GL_UNSIGNED_BYTE = 5121;
    const GL_DEPTH_COMPONENT = 6402;
    const GL_UNSIGNED_SHORT = 5123;

    expect(texture.getGLFormat()).toBe(GL_RGBA);
    expect(texture.getGLInternalFormat()).toBe(GL_RGBA);
    expect(texture.getGLType()).toBe(GL_UNSIGNED_BYTE);

    const depthTexture = new RenderTexture('depth', 1, 1, TextureFormat.Depth);
    expect(depthTexture.getGLFormat()).toBe(GL_DEPTH_COMPONENT);
    expect(depthTexture.getGLType()).toBe(GL_UNSIGNED_SHORT);
  });

  test('should check power of two utility', () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(4)).toBe(true);
    expect(isPowerOfTwo(8)).toBe(true);
    expect(isPowerOfTwo(16)).toBe(true);
    expect(isPowerOfTwo(32)).toBe(true);
    expect(isPowerOfTwo(64)).toBe(true);
    expect(isPowerOfTwo(128)).toBe(true);
    expect(isPowerOfTwo(256)).toBe(true);
    expect(isPowerOfTwo(512)).toBe(true);
    expect(isPowerOfTwo(1024)).toBe(true);

    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(5)).toBe(false);
    expect(isPowerOfTwo(6)).toBe(false);
    expect(isPowerOfTwo(7)).toBe(false);
    expect(isPowerOfTwo(9)).toBe(false);
    expect(isPowerOfTwo(15)).toBe(false);
    expect(isPowerOfTwo(17)).toBe(false);
    expect(isPowerOfTwo(100)).toBe(false);
    expect(isPowerOfTwo(255)).toBe(false);
    expect(isPowerOfTwo(513)).toBe(false);
  });

  test('should handle texture usage patterns', () => {
    expect(TextureUsage.Static).toBe(0);
    expect(TextureUsage.Dynamic).toBe(1);
    expect(TextureUsage.RenderTarget).toBe(2);
    expect(TextureUsage.Streaming).toBe(3);
  });

  test('should validate texture formats', () => {
    expect(TextureFormat.RGB).toBe(0);
    expect(TextureFormat.RGBA).toBe(1);
    expect(TextureFormat.Alpha).toBe(2);
    expect(TextureFormat.Luminance).toBe(3);
    expect(TextureFormat.LuminanceAlpha).toBe(4);
    expect(TextureFormat.Depth).toBe(5);
    expect(TextureFormat.DepthStencil).toBe(6);
  });
});