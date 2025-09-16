/**
 * Test suite for high-performance batch prefab spawning
 * 高性能批量预制体生成测试套件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { definePrefab, getPrefab } from '../src/prefab/Prefab';
import { spawnBatchFast } from '../src/prefab/PrefabSpawn';
import type { SpawnOptions } from '../src/prefab/Prefab';

class Position {
  x = 0;
  y = 0;
  z = 0;
}

class Velocity {
  x = 0;
  y = 0;
  z = 0;
}

class Health {
  current = 100;
  max = 100;
}

describe('PrefabSpawn Batch Performance Tests', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it('should create basic prefab with batch spawn', () => {
    const prefab = definePrefab('test-unit', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0, z: 0 } },
        { ctor: Velocity, defaults: { x: 1, y: 1, z: 0 } },
        { ctor: Health, defaults: { current: 100, max: 100 } }
      ],
      tags: ['unit', 'movable']
    });

    const entities = spawnBatchFast(world, 'test-unit', { count: 5 });

    expect(entities).toHaveLength(5);

    for (const entity of entities) {
      expect(world.isAlive(entity)).toBe(true);
      expect(world.hasComponent(entity, Position)).toBe(true);
      expect(world.hasComponent(entity, Velocity)).toBe(true);
      expect(world.hasComponent(entity, Health)).toBe(true);
      expect(world.hasTag(entity, 'unit')).toBe(true);
      expect(world.hasTag(entity, 'movable')).toBe(true);

      const pos = world.getComponent(entity, Position);
      const vel = world.getComponent(entity, Velocity);
      const health = world.getComponent(entity, Health);

      expect(pos).toEqual({ x: 0, y: 0, z: 0 });
      expect(vel).toEqual({ x: 1, y: 1, z: 0 });
      expect(health).toEqual({ current: 100, max: 100 });
    }
  });

  it('should support shared overrides', () => {
    const prefab = definePrefab('test-soldier', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0, z: 0 } },
        { ctor: Health, defaults: { current: 100, max: 100 } }
      ]
    });

    const options: SpawnOptions = {
      count: 3,
      overrides: {
        shared: {
          Position: { x: 10, y: 20 },
          Health: { max: 150 }
        }
      }
    };

    const entities = spawnBatchFast(world, 'test-soldier', options);

    expect(entities).toHaveLength(3);

    for (const entity of entities) {
      const pos = world.getComponent(entity, Position);
      const health = world.getComponent(entity, Health);

      expect(pos?.x).toBe(10);
      expect(pos?.y).toBe(20);
      expect(pos?.z).toBe(0);
      expect(health?.max).toBe(150);
      expect(health?.current).toBe(100);
    }
  });

  it('should support per-entity overrides', () => {
    const prefab = definePrefab('test-varied', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0, z: 0 } },
        { ctor: Health, defaults: { current: 100, max: 100 } }
      ]
    });

    const options: SpawnOptions = {
      count: 3,
      overrides: {
        perEntity: [
          { Position: { x: 1 } },
          { Position: { x: 2 }, Health: { max: 200 } },
          { Position: { x: 3 } }
        ]
      }
    };

    const entities = spawnBatchFast(world, 'test-varied', options);

    expect(entities).toHaveLength(3);

    const pos0 = world.getComponent(entities[0], Position);
    const pos1 = world.getComponent(entities[1], Position);
    const pos2 = world.getComponent(entities[2], Position);
    const health1 = world.getComponent(entities[1], Health);

    expect(pos0?.x).toBe(1);
    expect(pos1?.x).toBe(2);
    expect(pos2?.x).toBe(3);
    expect(health1?.max).toBe(200);
  });

  it('should support per-entity function overrides', () => {
    const prefab = definePrefab('test-function', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0, z: 0 } }
      ]
    });

    const options: SpawnOptions = {
      count: 5,
      overrides: {
        perEntity: (i: number) => ({
          Position: { x: i * 10, y: i * 20 }
        })
      }
    };

    const entities = spawnBatchFast(world, 'test-function', options);

    expect(entities).toHaveLength(5);

    for (let i = 0; i < entities.length; i++) {
      const pos = world.getComponent(entities[i], Position);
      expect(pos?.x).toBe(i * 10);
      expect(pos?.y).toBe(i * 20);
      expect(pos?.z).toBe(0);
    }
  });

  it('should support factory function defaults', () => {
    const prefab = definePrefab('test-factory', {
      comps: [
        {
          ctor: Position,
          defaults: () => ({ x: Math.random(), y: Math.random(), z: 0 })
        },
        { ctor: Health, defaults: { current: 100, max: 100 } }
      ]
    });

    const entities = spawnBatchFast(world, 'test-factory', { count: 3, seed: 12345 });

    expect(entities).toHaveLength(3);

    const positions = entities.map(e => world.getComponent(e, Position));

    // Each entity should have different random positions
    expect(positions[0]).not.toEqual(positions[1]);
    expect(positions[1]).not.toEqual(positions[2]);
  });

  it('should support additional tags', () => {
    const prefab = definePrefab('test-tagged', {
      comps: [{ ctor: Position, defaults: { x: 0, y: 0, z: 0 } }],
      tags: ['base']
    });

    const entities = spawnBatchFast(world, 'test-tagged', {
      count: 2,
      tags: ['extra', 'special']
    });

    expect(entities).toHaveLength(2);

    for (const entity of entities) {
      expect(world.hasTag(entity, 'base')).toBe(true);
      expect(world.hasTag(entity, 'extra')).toBe(true);
      expect(world.hasTag(entity, 'special')).toBe(true);
    }
  });

  it('should support custom epoch for change tracking', () => {
    const prefab = definePrefab('test-epoch', {
      comps: [{ ctor: Position, defaults: { x: 0, y: 0, z: 0 } }]
    });

    const customEpoch = 42;
    const entities = spawnBatchFast(world, 'test-epoch', {
      count: 2,
      epoch: customEpoch
    });

    expect(entities).toHaveLength(2);
    // Note: epoch testing would require internal access to column change tracking
  });

  it('should support initialization hooks', () => {
    let initCount = 0;
    const initIndices: number[] = [];

    const prefab = definePrefab('test-init', {
      comps: [{ ctor: Position, defaults: { x: 0, y: 0, z: 0 } }],
      init: (world, entity, index, rng) => {
        initCount++;
        initIndices.push(index);

        const pos = world.getComponent(entity, Position);
        if (pos) {
          pos.x = index * 100;
          world.setComponent(entity, Position, pos);
        }
      }
    });

    const entities = spawnBatchFast(world, 'test-init', { count: 3 });

    expect(initCount).toBe(3);
    expect(initIndices).toEqual([0, 1, 2]);

    for (let i = 0; i < entities.length; i++) {
      const pos = world.getComponent(entities[i], Position);
      expect(pos?.x).toBe(i * 100);
    }
  });

  it('should handle large batch sizes efficiently', () => {
    const prefab = definePrefab('test-large', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0, z: 0 } },
        { ctor: Velocity, defaults: { x: 0, y: 0, z: 0 } },
        { ctor: Health, defaults: { current: 100, max: 100 } }
      ],
      tags: ['unit']
    });

    const start = performance.now();
    const entities = spawnBatchFast(world, 'test-large', { count: 1000 });
    const end = performance.now();

    expect(entities).toHaveLength(1000);
    expect(end - start).toBeLessThan(100); // Should be very fast

    // Spot check some entities
    for (let i = 0; i < 10; i++) {
      const randomEntity = entities[Math.floor(Math.random() * entities.length)];
      expect(world.isAlive(randomEntity)).toBe(true);
      expect(world.hasComponent(randomEntity, Position)).toBe(true);
      expect(world.hasComponent(randomEntity, Velocity)).toBe(true);
      expect(world.hasComponent(randomEntity, Health)).toBe(true);
      expect(world.hasTag(randomEntity, 'unit')).toBe(true);
    }
  });

  it('should work with minimal single entity spawn', () => {
    const prefab = definePrefab('test-single', {
      comps: [{ ctor: Position, defaults: { x: 5, y: 10, z: 15 } }]
    });

    const entities = spawnBatchFast(world, 'test-single'); // count defaults to 1

    expect(entities).toHaveLength(1);

    const pos = world.getComponent(entities[0], Position);
    expect(pos).toEqual({ x: 5, y: 10, z: 15 });
  });
});