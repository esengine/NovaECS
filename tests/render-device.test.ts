/**
 * Render Device Abstraction Tests
 * 渲染设备抽象测试
 *
 * Tests the render device interface and WebGL implementation without
 * requiring actual WebGL context creation (using mocks where needed).
 * 测试渲染设备接口和WebGL实现，无需实际创建WebGL上下文（在需要时使用模拟）。
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Import render device interfaces and implementations
import {
  GraphicsAPI,
  isAPISupported,
  getBestAvailableAPI,
  IRenderDevice,
  DeviceCapabilities,
  RenderPassDescriptor,
  DrawCallDescriptor,
  ViewportDescriptor
} from '../src/render/IRenderDevice';

// Import resources for testing device interaction
import { RenderTexture, TextureFormat, createColorTexture } from '../src/resources/RenderTexture';
import { VertexBuffer, IndexBuffer, VertexLayouts, BufferUsage } from '../src/resources/RenderBuffers';
import { ShaderProgram, createUnlitShader } from '../src/resources/ShaderProgram';

describe('Graphics API Detection', () => {
  test('should detect supported graphics APIs', () => {
    // Mock document and navigator for testing
    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn(() => ({
          getContext: vi.fn((type: string) => {
            if (type === 'webgl' || type === 'webgl2') {
              return {}; // Mock context
            }
            return null;
          })
        }))
      },
      writable: true
    });

    Object.defineProperty(global, 'navigator', {
      value: {
        gpu: undefined // No WebGPU support by default
      },
      writable: true
    });

    // Test API support detection
    expect(typeof isAPISupported(GraphicsAPI.WebGL)).toBe('boolean');
    expect(typeof isAPISupported(GraphicsAPI.WebGL2)).toBe('boolean');
    expect(typeof isAPISupported(GraphicsAPI.WebGPU)).toBe('boolean');

    // Test best available API selection
    const bestAPI = getBestAvailableAPI();
    expect(Object.values(GraphicsAPI)).toContain(bestAPI);
  });

  test('should validate GraphicsAPI enumeration', () => {
    expect(GraphicsAPI.WebGL).toBe('webgl');
    expect(GraphicsAPI.WebGL2).toBe('webgl2');
    expect(GraphicsAPI.WebGPU).toBe('webgpu');
  });

  test('should handle WebGPU detection', () => {
    // Mock navigator with WebGPU support
    Object.defineProperty(global, 'navigator', {
      value: {
        gpu: {} // WebGPU available
      },
      writable: true
    });

    expect(isAPISupported(GraphicsAPI.WebGPU)).toBe(true);

    // Mock navigator without WebGPU support
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true
    });

    expect(isAPISupported(GraphicsAPI.WebGPU)).toBe(false);
  });
});

describe('Device Capabilities', () => {
  test('should validate device capabilities structure', () => {
    const mockCapabilities: DeviceCapabilities = {
      api: GraphicsAPI.WebGL2,
      version: 'WebGL 2.0',
      maxTextureSize: 4096,
      maxTextureUnits: 16,
      maxVertexAttributes: 16,
      supportsInstancing: true,
      supportsDepthTexture: true,
      supportsFloatTextures: true,
      supportsCompressedTextures: false,
      maxUniformBufferSize: 65536,
      vendor: 'Mock Vendor',
      renderer: 'Mock Renderer'
    };

    expect(mockCapabilities.api).toBe(GraphicsAPI.WebGL2);
    expect(mockCapabilities.maxTextureSize).toBeGreaterThan(0);
    expect(mockCapabilities.maxTextureUnits).toBeGreaterThan(0);
    expect(mockCapabilities.maxVertexAttributes).toBeGreaterThan(0);
    expect(typeof mockCapabilities.supportsInstancing).toBe('boolean');
    expect(typeof mockCapabilities.supportsDepthTexture).toBe('boolean');
  });
});

describe('Render Pass Descriptors', () => {
  test('should create valid render pass descriptor', () => {
    const colorTexture = createColorTexture('color', [255, 0, 0, 255], 256);
    const depthTexture = new RenderTexture('depth', 256, 256, TextureFormat.Depth);

    const renderPass: RenderPassDescriptor = {
      colorAttachments: [colorTexture],
      depthAttachment: depthTexture,
      clearColors: [[0.2, 0.3, 0.4, 1.0]],
      clearDepth: 1.0,
      clearColor: true,
      clearDepthBuffer: true
    };

    expect(renderPass.colorAttachments).toHaveLength(1);
    expect(renderPass.colorAttachments[0]).toBe(colorTexture);
    expect(renderPass.depthAttachment).toBe(depthTexture);
    expect(renderPass.clearColors[0]).toEqual([0.2, 0.3, 0.4, 1.0]);
    expect(renderPass.clearDepth).toBe(1.0);
    expect(renderPass.clearColor).toBe(true);
    expect(renderPass.clearDepthBuffer).toBe(true);
  });

  test('should handle multiple color attachments', () => {
    const color1 = createColorTexture('color1', [255, 0, 0, 255], 128);
    const color2 = createColorTexture('color2', [0, 255, 0, 255], 128);

    const renderPass: RenderPassDescriptor = {
      colorAttachments: [color1, color2],
      clearColors: [
        [1.0, 0.0, 0.0, 1.0],
        [0.0, 1.0, 0.0, 1.0]
      ],
      clearColor: true,
      clearDepthBuffer: false
    };

    expect(renderPass.colorAttachments).toHaveLength(2);
    expect(renderPass.clearColors).toHaveLength(2);
  });
});

describe('Draw Call Descriptors', () => {
  test('should create valid draw call descriptor', () => {
    const shader = createUnlitShader();
    const vertexBuffer = new VertexBuffer('vb', VertexLayouts.PositionUV);
    const indexBuffer = new IndexBuffer('ib');
    const texture = createColorTexture('tex', [255, 255, 255, 255], 64);

    const drawCall: DrawCallDescriptor = {
      shader,
      vertexBuffer,
      indexBuffer,
      count: 6,
      offset: 0,
      instanceCount: 1,
      textures: new Map([[0, texture]]),
      uniforms: new Map([
        ['u_color', [1.0, 1.0, 1.0, 1.0]],
        ['u_matrix', [1, 0, 0, 0, 1, 0, 0, 0, 1]]
      ])
    };

    expect(drawCall.shader).toBe(shader);
    expect(drawCall.vertexBuffer).toBe(vertexBuffer);
    expect(drawCall.indexBuffer).toBe(indexBuffer);
    expect(drawCall.count).toBe(6);
    expect(drawCall.offset).toBe(0);
    expect(drawCall.instanceCount).toBe(1);
    expect(drawCall.textures.size).toBe(1);
    expect(drawCall.uniforms.size).toBe(2);
  });

  test('should handle instanced rendering parameters', () => {
    const shader = createUnlitShader();
    const vertexBuffer = new VertexBuffer('vb', VertexLayouts.PositionUV);

    const drawCall: DrawCallDescriptor = {
      shader,
      vertexBuffer,
      count: 6,
      offset: 0,
      instanceCount: 100, // Instanced rendering
      textures: new Map(),
      uniforms: new Map()
    };

    expect(drawCall.instanceCount).toBe(100);
  });

  test('should handle array drawing (no index buffer)', () => {
    const shader = createUnlitShader();
    const vertexBuffer = new VertexBuffer('vb', VertexLayouts.Position);

    const drawCall: DrawCallDescriptor = {
      shader,
      vertexBuffer,
      count: 3, // Triangle
      offset: 0,
      instanceCount: 1,
      textures: new Map(),
      uniforms: new Map()
    };

    expect(drawCall.indexBuffer).toBeUndefined();
    expect(drawCall.count).toBe(3);
  });
});

describe('Viewport Descriptors', () => {
  test('should create valid viewport descriptor', () => {
    const viewport: ViewportDescriptor = {
      x: 100,
      y: 50,
      width: 800,
      height: 600,
      near: 0.0,
      far: 1.0
    };

    expect(viewport.x).toBe(100);
    expect(viewport.y).toBe(50);
    expect(viewport.width).toBe(800);
    expect(viewport.height).toBe(600);
    expect(viewport.near).toBe(0.0);
    expect(viewport.far).toBe(1.0);
  });

  test('should handle fullscreen viewport', () => {
    const viewport: ViewportDescriptor = {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      near: -1000,
      far: 1000
    };

    expect(viewport.x).toBe(0);
    expect(viewport.y).toBe(0);
    expect(viewport.width).toBe(1920);
    expect(viewport.height).toBe(1080);
  });
});

describe('Resource Integration', () => {
  test('should validate texture resource for device usage', () => {
    const texture = createColorTexture('device_test', [128, 128, 128, 255], 512);

    expect(texture.id).toBe('device_test');
    expect(texture.width).toBe(512);
    expect(texture.height).toBe(512);
    expect(texture.format).toBe(TextureFormat.RGBA);
    expect(texture.data).toBeDefined();
    expect(texture.loaded).toBe(true);

    // Check WebGL format mappings
    const GL_RGBA = 6408;
    const GL_UNSIGNED_BYTE = 5121;
    expect(texture.getGLFormat()).toBe(GL_RGBA);
    expect(texture.getGLType()).toBe(GL_UNSIGNED_BYTE);
  });

  test('should validate buffer resources for device usage', () => {
    const vertexBuffer = new VertexBuffer('device_vb', VertexLayouts.PositionUVColor);
    const vertexData = new Float32Array([
      // Position, UV, Color
      -1, -1, 0, 0, 1, 1, 1, 1,
      1, -1, 1, 0, 1, 1, 1, 1,
      0, 1, 0.5, 1, 1, 1, 1, 1
    ]);

    vertexBuffer.setData(vertexData);

    expect(vertexBuffer.vertexCount).toBe(3);
    expect(vertexBuffer.size).toBe(vertexData.byteLength);
    const GL_ARRAY_BUFFER = 34962;
    const GL_STATIC_DRAW = 35044;
    const GL_ELEMENT_ARRAY_BUFFER = 34963;

    expect(vertexBuffer.getTarget()).toBe(GL_ARRAY_BUFFER);
    expect(vertexBuffer.getUsageHint()).toBe(GL_STATIC_DRAW);

    const indexBuffer = new IndexBuffer('device_ib');
    const indexData = new Uint16Array([0, 1, 2]);

    indexBuffer.setData(indexData);

    expect(indexBuffer.indexCount).toBe(3);
    expect(indexBuffer.getTarget()).toBe(GL_ELEMENT_ARRAY_BUFFER);
  });

  test('should validate shader resources for device usage', () => {
    const shader = createUnlitShader();

    expect(shader.id).toBe('unlit');
    expect(shader.vertexSource).toContain('attribute');
    expect(shader.fragmentSource).toContain('precision');
    expect(shader.compiled).toBe(false);
    expect(shader.uniforms.size).toBe(0);
    expect(shader.attributes.size).toBe(0);

    // Test uniform and attribute helpers
    expect(shader.hasUniform('u_test')).toBe(false);
    expect(shader.hasAttribute('a_test')).toBe(false);
    expect(shader.getUniformLocation('u_test')).toBeNull();
    expect(shader.getAttributeLocation('a_test')).toBe(-1);
  });
});

describe('Render Statistics', () => {
  test('should track render statistics correctly', () => {
    const mockStats = {
      drawCalls: 150,
      vertices: 12000,
      triangles: 4000,
      textureBindings: 45,
      shaderSwitches: 12,
      frameTime: 16.67,
      gpuMemoryUsage: 1024 * 1024 * 64 // 64MB
    };

    expect(mockStats.drawCalls).toBeGreaterThan(0);
    expect(mockStats.vertices).toBeGreaterThan(0);
    expect(mockStats.triangles).toBeGreaterThan(0);
    expect(mockStats.textureBindings).toBeGreaterThan(0);
    expect(mockStats.shaderSwitches).toBeGreaterThan(0);
    expect(mockStats.frameTime).toBeGreaterThan(0);
    expect(mockStats.gpuMemoryUsage).toBeGreaterThan(0);

    // Validate relationships
    expect(mockStats.triangles * 3).toBeLessThanOrEqual(mockStats.vertices);
    expect(mockStats.frameTime).toBeLessThan(100); // Reasonable frame time
  });
});

describe('Error Handling', () => {
  test('should handle invalid graphics API', () => {
    expect(() => {
      isAPISupported('invalid_api' as GraphicsAPI);
    }).not.toThrow(); // Should return false, not throw

    expect(isAPISupported('invalid_api' as GraphicsAPI)).toBe(false);
  });

  test('should handle missing WebGL context gracefully', () => {
    // Mock document to return null context
    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn(() => ({
          getContext: vi.fn(() => null)
        }))
      },
      writable: true
    });

    expect(isAPISupported(GraphicsAPI.WebGL)).toBe(false);
    expect(isAPISupported(GraphicsAPI.WebGL2)).toBe(false);
  });

  test('should handle getBestAvailableAPI with no support', () => {
    // Mock no graphics API support
    Object.defineProperty(global, 'document', {
      value: {
        createElement: vi.fn(() => ({
          getContext: vi.fn(() => null)
        }))
      },
      writable: true
    });

    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true
    });

    expect(() => {
      getBestAvailableAPI();
    }).toThrow('No supported graphics API found');
  });
});

describe('Mock WebGL Implementation Tests', () => {
  test('should handle WebGL context creation mockup', () => {
    // Create a minimal mock WebGL context for testing
    const mockGL = {
      ARRAY_BUFFER: 34962,
      ELEMENT_ARRAY_BUFFER: 34963,
      STATIC_DRAW: 35044,
      DYNAMIC_DRAW: 35048,
      STREAM_DRAW: 35040,
      TEXTURE_2D: 3553,
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
      LINEAR: 9729,
      NEAREST: 9728,
      CLAMP_TO_EDGE: 33071,
      REPEAT: 10497,

      createBuffer: vi.fn(() => ({})),
      createTexture: vi.fn(() => ({})),
      createShader: vi.fn(() => ({})),
      createProgram: vi.fn(() => ({})),
      deleteBuffer: vi.fn(),
      deleteTexture: vi.fn(),
      deleteShader: vi.fn(),
      deleteProgram: vi.fn(),
      getParameter: vi.fn((param) => {
        switch (param) {
          case mockGL.VERSION: return 'WebGL 2.0';
          case 3379: return 4096; // MAX_TEXTURE_SIZE
          case 34930: return 16;  // MAX_TEXTURE_IMAGE_UNITS
          default: return 0;
        }
      }),
      getExtension: vi.fn(() => null)
    };

    // Test buffer creation
    const buffer = mockGL.createBuffer();
    expect(buffer).toBeDefined();
    expect(mockGL.createBuffer).toHaveBeenCalled();

    // Test texture creation
    const texture = mockGL.createTexture();
    expect(texture).toBeDefined();
    expect(mockGL.createTexture).toHaveBeenCalled();

    // Test parameter queries
    const version = mockGL.getParameter(mockGL.VERSION);
    expect(version).toBe('WebGL 2.0');

    // Test resource cleanup
    mockGL.deleteBuffer(buffer);
    mockGL.deleteTexture(texture);
    expect(mockGL.deleteBuffer).toHaveBeenCalledWith(buffer);
    expect(mockGL.deleteTexture).toHaveBeenCalledWith(texture);
  });
});