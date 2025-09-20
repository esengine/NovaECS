/**
 * Material2D Component Tests
 * Material2D组件测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  Material2D,
  createDefaultMaterial,
  createRubberMaterial,
  createIceMaterial,
  createBouncyMaterial,
  createMetalMaterial,
  createStoneMaterial,
  createWoodMaterial
} from '../src/components/Material2D';
import { f, toFloat } from '../src/math/fixed';

describe('Material2D Component', () => {
  test('should create material with default values', () => {
    const material = new Material2D();

    expect(material.id).toBe('default');
    expect(toFloat(material.muS)).toBeCloseTo(0.8, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.6, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.0, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.5, 2);
  });

  test('should create material with custom values', () => {
    const material = new Material2D(
      'custom',
      f(1.2),  // muS
      f(1.0),  // muD
      f(0.8),  // restitution
      f(0.2)   // bounceThreshold
    );

    expect(material.id).toBe('custom');
    expect(toFloat(material.muS)).toBeCloseTo(1.2, 2);
    expect(toFloat(material.muD)).toBeCloseTo(1.0, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.8, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.2, 2);
  });

  test('should create default material', () => {
    const material = createDefaultMaterial();

    expect(material.id).toBe('default');
    expect(toFloat(material.muS)).toBeCloseTo(0.8, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.6, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.0, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.5, 2);
  });

  test('should create rubber material with high friction and bounce', () => {
    const material = createRubberMaterial();

    expect(material.id).toBe('rubber');
    expect(toFloat(material.muS)).toBeCloseTo(1.2, 2);
    expect(toFloat(material.muD)).toBeCloseTo(1.0, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.7, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.2, 2);
  });

  test('should create ice material with low friction', () => {
    const material = createIceMaterial();

    expect(material.id).toBe('ice');
    expect(toFloat(material.muS)).toBeCloseTo(0.1, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.05, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.1, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.1, 2);
  });

  test('should create bouncy material with high restitution', () => {
    const material = createBouncyMaterial();

    expect(material.id).toBe('bouncy');
    expect(toFloat(material.muS)).toBeCloseTo(0.5, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.4, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.9, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(1.0, 2);
  });

  test('should create metal material with moderate properties', () => {
    const material = createMetalMaterial();

    expect(material.id).toBe('metal');
    expect(toFloat(material.muS)).toBeCloseTo(0.6, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.5, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.2, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.8, 2);
  });

  test('should create stone material with high friction, low restitution', () => {
    const material = createStoneMaterial();

    expect(material.id).toBe('stone');
    expect(toFloat(material.muS)).toBeCloseTo(0.9, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.7, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.1, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.3, 2);
  });

  test('should create wood material with moderate properties', () => {
    const material = createWoodMaterial();

    expect(material.id).toBe('wood');
    expect(toFloat(material.muS)).toBeCloseTo(0.7, 2);
    expect(toFloat(material.muD)).toBeCloseTo(0.5, 2);
    expect(toFloat(material.restitution)).toBeCloseTo(0.3, 2);
    expect(toFloat(material.bounceThreshold)).toBeCloseTo(0.4, 2);
  });

  test('material properties should follow physical constraints', () => {
    const materials = [
      createDefaultMaterial(),
      createRubberMaterial(),
      createIceMaterial(),
      createBouncyMaterial(),
      createMetalMaterial(),
      createStoneMaterial(),
      createWoodMaterial()
    ];

    for (const material of materials) {
      // Static friction should be >= dynamic friction
      expect(material.muS).toBeGreaterThanOrEqual(material.muD);

      // Restitution should be between 0 and 1
      expect(toFloat(material.restitution)).toBeGreaterThanOrEqual(0);
      expect(toFloat(material.restitution)).toBeLessThanOrEqual(1);

      // Friction should be non-negative
      expect(toFloat(material.muS)).toBeGreaterThanOrEqual(0);
      expect(toFloat(material.muD)).toBeGreaterThanOrEqual(0);

      // Bounce threshold should be non-negative
      expect(toFloat(material.bounceThreshold)).toBeGreaterThanOrEqual(0);
    }
  });

  test('material IDs should be unique and descriptive', () => {
    const materials = [
      createDefaultMaterial(),
      createRubberMaterial(),
      createIceMaterial(),
      createBouncyMaterial(),
      createMetalMaterial(),
      createStoneMaterial(),
      createWoodMaterial()
    ];

    const ids = materials.map(m => m.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique

    // All IDs should be non-empty strings
    for (const id of ids) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });
});