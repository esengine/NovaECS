/**
 * Rendering Components Unit Tests
 * 渲染组件单元测试
 *
 * Tests individual rendering components for correct initialization,
 * data integrity, and component-specific functionality.
 * 测试各个渲染组件的正确初始化、数据完整性和组件特定功能。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { registerComponent } from '../src';

// Import rendering components
import { Camera2D, createCamera2D, createViewportCamera } from '../src/components/Camera2D';
import { Sprite, BlendMode, createSprite, createAtlasSprite, createColorSprite } from '../src/components/Sprite';
import {
  RenderLayer,
  RenderLayers,
  createRenderLayer,
  createBackgroundLayer,
  createUILayer,
  isLayerVisible,
  createLayerMask,
  LayerMasks
} from '../src/components/RenderLayer';
import {
  RenderMaterial,
  WrapMode,
  FilterMode,
  CullMode,
  DepthFunc,
  createUnlitMaterial,
  createTransparentMaterial,
  createAdditiveMaterial
} from '../src/components/RenderMaterial';

describe('Camera2D Component', () => {
  beforeEach(() => {
    registerComponent(Camera2D);
  });

  test('should create camera with default values', () => {
    const camera = new Camera2D();

    expect(camera.width).toBe(800);
    expect(camera.height).toBe(600);
    expect(camera.zoom).toBe(1.0);
    expect(camera.near).toBe(-1000);
    expect(camera.far).toBe(1000);
    expect(camera.priority).toBe(0);
    expect(camera.layerMask).toBe(0xFFFFFFFF);
    expect(camera.clearColor).toEqual([0, 0, 0, 1]);
    expect(camera.dirty).toBe(true);
  });

  test('should create camera with helper functions', () => {
    const camera1 = createCamera2D(1024, 768, 2.0);
    expect(camera1.width).toBe(1024);
    expect(camera1.height).toBe(768);
    expect(camera1.zoom).toBe(2.0);

    const camera2 = createViewportCamera(100, 50, 800, 600);
    expect(camera2.viewport).toEqual([100, 50, 800, 600]);
    expect(camera2.width).toBe(800);
    expect(camera2.height).toBe(600);
  });

  test('should have correct matrix dimensions', () => {
    const camera = new Camera2D();

    expect(camera.projectionMatrix).toHaveLength(9);
    expect(camera.viewMatrix).toHaveLength(9);
    expect(camera.viewProjectionMatrix).toHaveLength(9);
  });
});

describe('Sprite Component', () => {
  beforeEach(() => {
    registerComponent(Sprite);
  });

  test('should create sprite with default values', () => {
    const sprite = new Sprite();

    expect(sprite.textureId).toBe('');
    expect(sprite.width).toBe(1.0);
    expect(sprite.height).toBe(1.0);
    expect(sprite.uv).toEqual([0, 0, 1, 1]);
    expect(sprite.color).toEqual([1, 1, 1, 1]);
    expect(sprite.blendMode).toBe(BlendMode.Normal);
    expect(sprite.anchor).toEqual([0.5, 0.5]);
    expect(sprite.flipX).toBe(false);
    expect(sprite.flipY).toBe(false);
    expect(sprite.smoothing).toBe(true);
  });

  test('should create sprite with helper functions', () => {
    const sprite1 = createSprite('test_texture', 64, 32);
    expect(sprite1.textureId).toBe('test_texture');
    expect(sprite1.width).toBe(64);
    expect(sprite1.height).toBe(32);

    const sprite2 = createAtlasSprite('atlas', 0.1, 0.2, 0.3, 0.4, 16, 16);
    expect(sprite2.textureId).toBe('atlas');
    expect(sprite2.uv).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(sprite2.width).toBe(16);
    expect(sprite2.height).toBe(16);

    const sprite3 = createColorSprite(1, 0.5, 0.2, 0.8, 8, 8);
    expect(sprite3.color).toEqual([1, 0.5, 0.2, 0.8]);
    expect(sprite3.width).toBe(8);
    expect(sprite3.height).toBe(8);
    expect(sprite3.textureId).toBe(''); // No texture for color sprite
  });

  test('should validate blend modes', () => {
    expect(BlendMode.Normal).toBe(0);
    expect(BlendMode.Additive).toBe(1);
    expect(BlendMode.Multiply).toBe(2);
    expect(BlendMode.Screen).toBe(3);
    expect(BlendMode.Overlay).toBe(4);
  });
});

describe('RenderLayer Component', () => {
  beforeEach(() => {
    registerComponent(RenderLayer);
  });

  test('should create render layer with default values', () => {
    const layer = new RenderLayer();

    expect(layer.layer).toBe(RenderLayers.Default);
    expect(layer.sortingOrder).toBe(0);
    expect(layer.depth).toBe(0);
    expect(layer.visible).toBe(true);
    expect(layer.castShadows).toBe(false);
    expect(layer.receiveShadows).toBe(false);
    expect(layer.name).toBe('Default');
  });

  test('should create specialized layers', () => {
    const background = createBackgroundLayer(5);
    expect(background.layer).toBe(RenderLayers.Background);
    expect(background.sortingOrder).toBe(5);
    expect(background.depth).toBe(-100);
    expect(background.name).toBe('Background');

    const ui = createUILayer(10);
    expect(ui.layer).toBe(RenderLayers.UI);
    expect(ui.sortingOrder).toBe(10);
    expect(ui.depth).toBe(100);
    expect(ui.name).toBe('UI');
  });

  test('should handle layer visibility correctly', () => {
    // Test individual layer visibility
    expect(isLayerVisible(0, 0xFFFFFFFF)).toBe(true);  // All layers
    expect(isLayerVisible(5, 0xFFFFFFFF)).toBe(true);  // All layers
    expect(isLayerVisible(0, 0x00000001)).toBe(true);  // Only layer 0
    expect(isLayerVisible(1, 0x00000001)).toBe(false); // Only layer 0
    expect(isLayerVisible(1, 0x00000002)).toBe(true);  // Only layer 1
    expect(isLayerVisible(0, 0x00000002)).toBe(false); // Only layer 1
  });

  test('should create layer masks correctly', () => {
    const mask1 = createLayerMask([0, 2, 4]);
    expect(mask1).toBe(0x15); // Binary: 10101

    const mask2 = createLayerMask([1, 3, 5]);
    expect(mask2).toBe(0x2A); // Binary: 101010

    // Test predefined masks
    expect(LayerMasks.All).toBe(0xFFFFFFFF);
    expect(LayerMasks.UIOnly).toBe(createLayerMask([RenderLayers.UI]));
  });

  test('should validate layer enumeration', () => {
    expect(RenderLayers.Background).toBe(0);
    expect(RenderLayers.Default).toBe(1);
    expect(RenderLayers.UI).toBe(2);
    expect(RenderLayers.Effects).toBe(3);
    expect(RenderLayers.Overlay).toBe(4);
    expect(RenderLayers.Debug).toBe(5);
  });
});

describe('RenderMaterial Component', () => {
  beforeEach(() => {
    registerComponent(RenderMaterial);
  });

  test('should create material with default values', () => {
    const material = new RenderMaterial();

    expect(material.id).toBe('default');
    expect(material.shaderId).toBe('default');
    expect(material.textures).toHaveLength(0);
    expect(material.uniforms.size).toBe(0);
    expect(material.renderQueue).toBe(2000);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(true);
    expect(material.depthFunc).toBe(DepthFunc.LessEqual);
    expect(material.cullMode).toBe(CullMode.Back);
    expect(material.blend).toBe(false);
    expect(material.transparent).toBe(false);
  });

  test('should create specialized materials', () => {
    const unlit = createUnlitMaterial('test_texture', [0.8, 0.6, 0.4, 1.0]);
    expect(unlit.id).toBe('unlit');
    expect(unlit.shaderId).toBe('unlit');
    expect(unlit.uniforms.get('u_color')).toEqual([0.8, 0.6, 0.4, 1.0]);
    expect(unlit.textures).toHaveLength(1);
    expect(unlit.textures[0].textureId).toBe('test_texture');

    const transparent = createTransparentMaterial('alpha_texture', 0.5);
    expect(transparent.transparent).toBe(true);
    expect(transparent.blend).toBe(true);
    expect(transparent.depthWrite).toBe(false);
    expect(transparent.renderQueue).toBe(3000);

    const additive = createAdditiveMaterial('effect_texture');
    expect(additive.id).toBe('additive');
    expect(additive.blend).toBe(true);
    expect(additive.blendSrc).toBe(1); // GL_ONE
    expect(additive.blendDst).toBe(1); // GL_ONE
    expect(additive.renderQueue).toBe(3100);
  });

  test('should validate enumerations', () => {
    expect(WrapMode.Clamp).toBe(0);
    expect(WrapMode.Repeat).toBe(1);
    expect(WrapMode.MirroredRepeat).toBe(2);

    expect(FilterMode.Nearest).toBe(0);
    expect(FilterMode.Linear).toBe(1);
    expect(FilterMode.LinearMipmapLinear).toBe(5);

    expect(CullMode.None).toBe(0);
    expect(CullMode.Front).toBe(1);
    expect(CullMode.Back).toBe(2);

    expect(DepthFunc.Never).toBe(0);
    expect(DepthFunc.Less).toBe(1);
    expect(DepthFunc.LessEqual).toBe(3);
    expect(DepthFunc.Always).toBe(7);
  });

  test('should handle texture bindings', () => {
    const material = new RenderMaterial();

    material.textures.push({
      textureId: 'diffuse',
      uniformName: 'u_diffuse',
      slot: 0,
      wrapU: WrapMode.Repeat,
      wrapV: WrapMode.Repeat,
      minFilter: FilterMode.Linear,
      magFilter: FilterMode.Linear,
    });

    expect(material.textures).toHaveLength(1);
    expect(material.textures[0].textureId).toBe('diffuse');
    expect(material.textures[0].slot).toBe(0);
  });

  test('should handle uniform values', () => {
    const material = new RenderMaterial();

    // Test different uniform types
    material.uniforms.set('u_float', 3.14);
    material.uniforms.set('u_vec2', [1.0, 2.0]);
    material.uniforms.set('u_vec3', [1.0, 2.0, 3.0]);
    material.uniforms.set('u_vec4', [1.0, 2.0, 3.0, 4.0]);
    material.uniforms.set('u_matrix', [1, 0, 0, 0, 1, 0, 0, 0, 1]);

    expect(material.uniforms.get('u_float')).toBe(3.14);
    expect(material.uniforms.get('u_vec2')).toEqual([1.0, 2.0]);
    expect(material.uniforms.get('u_vec3')).toEqual([1.0, 2.0, 3.0]);
    expect(material.uniforms.get('u_vec4')).toEqual([1.0, 2.0, 3.0, 4.0]);
    expect(material.uniforms.get('u_matrix')).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});