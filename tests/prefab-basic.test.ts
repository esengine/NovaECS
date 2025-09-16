import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { definePrefab, getPrefab, spawnBatch } from '../src/prefab/Prefab';
import { PRNG } from '../src/determinism/PRNG';

// Test components
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

class Health {
  constructor(public max = 100, public current = 100) {}
}

describe('Prefab System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('Basic prefab definition and registration', () => {
    it('should define and register a simple prefab', () => {
      const prefab = definePrefab('SimpleEntity', {
        comps: [
          { ctor: Position, defaults: { x: 10, y: 20 } },
          { ctor: Velocity, defaults: { dx: 1, dy: 2 } }
        ]
      });

      expect(prefab.id).toBe('SimpleEntity');
      expect(prefab.comps).toHaveLength(2);
      expect(getPrefab('SimpleEntity')).toBe(prefab);
    });

    it('should precompile type information', () => {
      const prefab = definePrefab('TypedEntity', {
        comps: [
          { ctor: Position, defaults: {} },
          { ctor: Health, defaults: {} }
        ]
      });

      expect(prefab._types).toBeDefined();
      expect(prefab._types!.sorted).toHaveLength(2);
      expect(prefab._types!.typeIds).toHaveLength(2);
    });

    it('should support factory function defaults', () => {
      const prefab = definePrefab('RandomEntity', {
        comps: [
          { ctor: Position, defaults: () => ({ x: Math.random() * 100, y: Math.random() * 100 }) },
          { ctor: Health, defaults: { max: 50, current: 50 } }
        ]
      });

      expect(prefab.comps[0].defaults).toBeTypeOf('function');
      expect(prefab.comps[1].defaults).toBeTypeOf('object');
    });
  });

  describe('Batch entity creation', () => {
    it('should create multiple entities with same prefab', () => {
      definePrefab('BatchTest', {
        comps: [
          { ctor: Position, defaults: { x: 5, y: 10 } },
          { ctor: Velocity, defaults: { dx: 2, dy: 3 } }
        ],
        tags: ['Enemy', 'Mobile']
      });

      const entities = spawnBatch(world, 'BatchTest', 10);

      expect(entities).toHaveLength(10);

      // Verify all entities have the components
      entities.forEach(entity => {
        expect(world.hasComponent(entity, Position)).toBe(true);
        expect(world.hasComponent(entity, Velocity)).toBe(true);
        expect(world.hasTag(entity, 'Enemy')).toBe(true);
        expect(world.hasTag(entity, 'Mobile')).toBe(true);

        const pos = world.getComponent(entity, Position);
        const vel = world.getComponent(entity, Velocity);
        expect(pos.x).toBe(5);
        expect(pos.y).toBe(10);
        expect(vel.dx).toBe(2);
        expect(vel.dy).toBe(3);
      });
    });

    it('should support deterministic generation with seeds', () => {
      definePrefab('RandomTest', {
        comps: [
          { ctor: Position, defaults: { x: 0, y: 0 } }
        ],
        init: (world, entity, index, rng) => {
          // Use PRNG for deterministic random values
          const x = rng.nextFloat() * 100;
          const y = rng.nextFloat() * 100;
          world.setComponent(entity, Position, { x, y });
        }
      });

      const entities1 = spawnBatch(world, 'RandomTest', 5, 12345);

      // Create a new world for second batch to avoid interference
      const world2 = new World();
      const entities2 = spawnBatch(world2, 'RandomTest', 5, 12345);

      // Same seed should produce same results
      for (let i = 0; i < 5; i++) {
        const pos1 = world.getComponent(entities1[i], Position);
        const pos2 = world2.getComponent(entities2[i], Position);
        expect(pos1.x).toBe(pos2.x);
        expect(pos1.y).toBe(pos2.y);
      }
    });

    it('should execute initialization hooks', () => {
      definePrefab('InitTest', {
        comps: [
          { ctor: Position, defaults: { x: 0, y: 0 } },
          { ctor: Health, defaults: { max: 100, current: 100 } }
        ],
        init: (world, entity, index, rng) => {
          // Set position based on index
          world.setComponent(entity, Position, { x: index * 10, y: index * 5 });

          // Set random health
          const randomHealth = rng.nextInt(50, 100);
          world.setComponent(entity, Health, { max: randomHealth, current: randomHealth });
        }
      });

      const entities = spawnBatch(world, 'InitTest', 3, 54321);

      // Verify initialization was applied
      entities.forEach((entity, index) => {
        const pos = world.getComponent(entity, Position);
        const health = world.getComponent(entity, Health);

        expect(pos.x).toBe(index * 10);
        expect(pos.y).toBe(index * 5);
        expect(health.max).toBeGreaterThanOrEqual(50);
        expect(health.max).toBeLessThanOrEqual(100);
        expect(health.current).toBe(health.max);
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for unknown prefab', () => {
      expect(() => getPrefab('NonExistent')).toThrow('Prefab not found: NonExistent');
    });

    it('should throw error when spawning unknown prefab', () => {
      expect(() => spawnBatch(world, 'Unknown', 5)).toThrow('Prefab not found: Unknown');
    });
  });

  describe('Performance characteristics', () => {
    it('should efficiently create large batches', () => {
      definePrefab('LargeBatch', {
        comps: [
          { ctor: Position, defaults: { x: 0, y: 0 } },
          { ctor: Velocity, defaults: { dx: 1, dy: 1 } },
          { ctor: Health, defaults: { max: 100, current: 100 } }
        ],
        tags: ['Unit']
      });

      const start = performance.now();
      const entities = spawnBatch(world, 'LargeBatch', 10000);
      const end = performance.now();

      expect(entities).toHaveLength(10000);
      console.log(`Created 10000 entities in ${(end - start).toFixed(2)}ms`);

      // Should be reasonably fast (allow more time for large batch creation)
      expect(end - start).toBeLessThan(1000);
    });
  });
});