/**
 * Rendering Engine Integration Tests
 * 渲染引擎集成测试
 *
 * Tests the core functionality of the rendering engine including
 * component creation, system execution, and basic rendering operations.
 * 测试渲染引擎的核心功能，包括组件创建、系统执行和基本渲染操作。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World, registerComponent } from '../src';
import { Camera2D, createCamera2D } from '../src/components/Camera2D';
import { Sprite, createSprite } from '../src/components/Sprite';
import { RenderLayer, createRenderLayer } from '../src/components/RenderLayer';
import { LocalTransform } from '../src/components/Transform';
import { initializeCamera, setCameraZoom, resizeCamera } from '../src/systems/CameraUpdateSystem';
import { isAPISupported, GraphicsAPI } from '../src/render/IRenderDevice';
import { isLayerVisible, createLayerMask } from '../src/components/RenderLayer';

describe('Rendering Components', () => {
  beforeEach(() => {
    registerComponent(Camera2D);
    registerComponent(Sprite);
    registerComponent(RenderLayer);
    registerComponent(LocalTransform);
  });

  test('should create Camera2D component with default values', () => {
    const camera = new Camera2D();

    expect(camera.width).toBe(800);
    expect(camera.height).toBe(600);
    expect(camera.zoom).toBe(1.0);
    expect(camera.dirty).toBe(true);
    expect(camera.layerMask).toBe(0xFFFFFFFF);
  });

  test('should create camera with helper function', () => {
    const camera = createCamera2D(1024, 768, 2.0);

    expect(camera.width).toBe(1024);
    expect(camera.height).toBe(768);
    expect(camera.zoom).toBe(2.0);
    expect(camera.viewport).toEqual([0, 0, 1024, 768]);
  });

  test('should create Sprite component with texture', () => {
    const sprite = createSprite('test_texture', 64, 64);

    expect(sprite.textureId).toBe('test_texture');
    expect(sprite.width).toBe(64);
    expect(sprite.height).toBe(64);
    expect(sprite.color).toEqual([1, 1, 1, 1]);
    expect(sprite.anchor).toEqual([0.5, 0.5]);
  });

  test('should create RenderLayer with correct settings', () => {
    const layer = createRenderLayer(2, 10, 5);

    expect(layer.layer).toBe(2);
    expect(layer.sortingOrder).toBe(10);
    expect(layer.depth).toBe(5);
    expect(layer.visible).toBe(true);
  });
});

describe('Camera Utilities', () => {
  test('should initialize camera with default settings', () => {
    const camera = new Camera2D();
    initializeCamera(camera, 1920, 1080);

    expect(camera.width).toBe(1920);
    expect(camera.height).toBe(1080);
    expect(camera.viewport).toEqual([0, 0, 1920, 1080]);
    expect(camera.dirty).toBe(true);
  });

  test('should set camera zoom correctly', () => {
    const camera = new Camera2D();
    camera.dirty = false;

    setCameraZoom(camera, 2.5);

    expect(camera.zoom).toBe(2.5);
    expect(camera.dirty).toBe(true);
  });

  test('should prevent invalid zoom values', () => {
    const camera = new Camera2D();

    setCameraZoom(camera, -1);
    expect(camera.zoom).toBe(0.01); // Minimum zoom

    setCameraZoom(camera, 0);
    expect(camera.zoom).toBe(0.01); // Minimum zoom
  });

  test('should resize camera viewport', () => {
    const camera = new Camera2D();
    camera.dirty = false;

    resizeCamera(camera, 1280, 720);

    expect(camera.width).toBe(1280);
    expect(camera.height).toBe(720);
    expect(camera.viewport[2]).toBe(1280);
    expect(camera.viewport[3]).toBe(720);
    expect(camera.dirty).toBe(true);
  });
});

describe('Layer Visibility', () => {
  test('should check layer visibility with camera mask', () => {

    // Create mask that includes layers 0, 1, and 3
    const mask = createLayerMask([0, 1, 3]);

    expect(isLayerVisible(0, mask)).toBe(true);
    expect(isLayerVisible(1, mask)).toBe(true);
    expect(isLayerVisible(2, mask)).toBe(false);
    expect(isLayerVisible(3, mask)).toBe(true);
    expect(isLayerVisible(4, mask)).toBe(false);
  });

  test('should create layer masks correctly', () => {

    const mask = createLayerMask([0, 2, 4]);

    // Check bit representation
    expect(mask & (1 << 0)).toBeTruthy(); // Layer 0 included
    expect(mask & (1 << 1)).toBeFalsy();  // Layer 1 not included
    expect(mask & (1 << 2)).toBeTruthy(); // Layer 2 included
    expect(mask & (1 << 3)).toBeFalsy();  // Layer 3 not included
    expect(mask & (1 << 4)).toBeTruthy(); // Layer 4 included
  });
});

describe('Graphics API Support', () => {
  test('should check API support correctly', () => {
    // Note: These tests may fail in headless environments
    // They're primarily for browser testing

    // WebGL support check (should work in most environments)
    const webglSupported = isAPISupported(GraphicsAPI.WebGL);
    expect(typeof webglSupported).toBe('boolean');

    // WebGL2 support check
    const webgl2Supported = isAPISupported(GraphicsAPI.WebGL2);
    expect(typeof webgl2Supported).toBe('boolean');

    // WebGPU support check (may not be available)
    const webgpuSupported = isAPISupported(GraphicsAPI.WebGPU);
    expect(typeof webgpuSupported).toBe('boolean');
  });
});

describe('ECS Integration', () => {
  test('should create entities with rendering components', () => {
    const world = new World();

    // Create camera entity
    const cameraEntity = world.createEntity();
    const camera = createCamera2D();
    const cameraTransform = new LocalTransform();

    world.addComponent(cameraEntity, Camera2D, camera);
    world.addComponent(cameraEntity, LocalTransform, cameraTransform);

    // Verify components are attached
    expect(world.hasComponent(cameraEntity, Camera2D)).toBe(true);
    expect(world.hasComponent(cameraEntity, LocalTransform)).toBe(true);

    // Create sprite entity
    const spriteEntity = world.createEntity();
    const sprite = createSprite('test', 32, 32);
    const spriteTransform = new LocalTransform();
    const renderLayer = createRenderLayer();

    spriteTransform.x = 100;
    spriteTransform.y = 50;

    world.addComponent(spriteEntity, Sprite, sprite);
    world.addComponent(spriteEntity, LocalTransform, spriteTransform);
    world.addComponent(spriteEntity, RenderLayer, renderLayer);

    // Verify sprite components
    expect(world.hasComponent(spriteEntity, Sprite)).toBe(true);
    expect(world.hasComponent(spriteEntity, LocalTransform)).toBe(true);
    expect(world.hasComponent(spriteEntity, RenderLayer)).toBe(true);

    // Test component data
    const retrievedSprite = world.getComponent(spriteEntity, Sprite);
    const retrievedTransform = world.getComponent(spriteEntity, LocalTransform);

    expect(retrievedSprite?.width).toBe(32);
    expect(retrievedSprite?.height).toBe(32);
    expect(retrievedTransform?.x).toBe(100);
    expect(retrievedTransform?.y).toBe(50);
  });

  test('should query entities with rendering components', () => {
    const world = new World();

    // Create multiple sprite entities
    for (let i = 0; i < 5; i++) {
      const entity = world.createEntity();
      const sprite = createSprite(`texture_${i}`, 16, 16);
      const transform = new LocalTransform();
      const layer = createRenderLayer();

      transform.x = i * 20;
      transform.y = 0;

      world.addComponent(entity, Sprite, sprite);
      world.addComponent(entity, LocalTransform, transform);
      world.addComponent(entity, RenderLayer, layer);
    }

    // Query sprites with transforms
    const spriteQuery = world.query(Sprite, LocalTransform);
    expect(spriteQuery.count()).toBe(5);

    // Verify query results
    let count = 0;
    spriteQuery.forEach((entity, sprite, transform) => {
      expect(sprite.width).toBe(16);
      expect(sprite.height).toBe(16);
      expect(transform.x).toBe(count * 20);
      count++;
    });

    expect(count).toBe(5);
  });
});

describe('Performance Tests', () => {
  test('should handle many sprite entities efficiently', () => {
    const world = new World();
    const entityCount = 1000;

    const startTime = performance.now();

    // Create many sprite entities
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity();
      const sprite = createSprite('texture', 1, 1);
      const transform = new LocalTransform();
      const layer = createRenderLayer();

      transform.x = Math.random() * 100;
      transform.y = Math.random() * 100;

      world.addComponent(entity, Sprite, sprite);
      world.addComponent(entity, LocalTransform, transform);
      world.addComponent(entity, RenderLayer, layer);
    }

    const createTime = performance.now() - startTime;

    // Query all sprites
    const queryStartTime = performance.now();
    const spriteQuery = world.query(Sprite, LocalTransform, RenderLayer);
    expect(spriteQuery.count()).toBe(entityCount);

    let queryCount = 0;
    spriteQuery.forEach(() => {
      queryCount++;
    });

    const queryTime = performance.now() - queryStartTime;

    expect(queryCount).toBe(entityCount);

    // Performance should be reasonable (adjust thresholds as needed)
    expect(createTime).toBeLessThan(100); // Less than 100ms to create 1000 entities
    expect(queryTime).toBeLessThan(50);   // Less than 50ms to query 1000 entities

    console.log(`Created ${entityCount} entities in ${createTime.toFixed(2)}ms`);
    console.log(`Queried ${entityCount} entities in ${queryTime.toFixed(2)}ms`);
  });
});