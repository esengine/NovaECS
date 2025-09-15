import { World } from '../src/core/World';
import type { QueryChunkView } from '../src/core/Query';
import { describe, it, expect, beforeEach } from 'vitest';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

class Health {
  constructor(public value: number = 100) {}
}

class Mass {
  constructor(public value: number = 1.0) {}
}

describe('Query Parallel Chunks', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('toChunks() basic functionality', () => {
    beforeEach(() => {
      // Create test entities
      for (let i = 0; i < 10; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 5 });
        world.addComponent(entity, Velocity, { dx: i, dy: i * 2 });
      }
    });

    it('should generate chunks with default chunk size', () => {
      const chunks = world.query(Position, Velocity).toChunks();

      expect(chunks.length).toBeGreaterThan(0);

      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('archetypeKey');
        expect(chunk).toHaveProperty('entities');
        expect(chunk).toHaveProperty('cols');
        expect(chunk).toHaveProperty('startRow');
        expect(chunk).toHaveProperty('endRow');

        expect(Array.isArray(chunk.entities)).toBe(true);
        expect(Array.isArray(chunk.cols)).toBe(true);
        expect(chunk.cols.length).toBe(2); // Position + Velocity
        expect(chunk.startRow).toBeGreaterThanOrEqual(0);
        expect(chunk.endRow).toBeGreaterThan(chunk.startRow);
      });
    });

    it('should respect custom chunk size', () => {
      const smallChunkSize = 3;
      const chunks = world.query(Position, Velocity).toChunks(smallChunkSize);

      expect(chunks.length).toBeGreaterThan(1); // Should split into multiple chunks

      chunks.forEach(chunk => {
        expect(chunk.entities.length).toBeLessThanOrEqual(smallChunkSize);
      });

      // Total entities across chunks should match query count
      const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entities.length, 0);
      expect(totalEntities).toBe(10);
    });

    it('should handle empty queries', () => {
      const chunks = world.query(Health).toChunks();
      expect(chunks).toEqual([]);
    });

    it('should preserve data integrity in chunks', () => {
      const chunks = world.query(Position, Velocity).toChunks(5);

      chunks.forEach(chunk => {
        expect(chunk.entities.length).toBe(chunk.cols[0].length);
        expect(chunk.entities.length).toBe(chunk.cols[1].length);

        // Verify data consistency
        for (let i = 0; i < chunk.entities.length; i++) {
          const position = chunk.cols[0][i];
          const velocity = chunk.cols[1][i];

          expect(position).toHaveProperty('x');
          expect(position).toHaveProperty('y');
          expect(velocity).toHaveProperty('dx');
          expect(velocity).toHaveProperty('dy');
        }
      });
    });
  });

  describe('toChunks() with optional components', () => {
    beforeEach(() => {
      // Create entities with varying components
      for (let i = 0; i < 8; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 5 });

        // Only some entities have Health
        if (i % 3 === 0) {
          world.addComponent(entity, Health, { value: 100 + i });
        }
      }
    });

    it('should handle optional components correctly', () => {
      const chunks = world.query(Position)
        .optional(Health)
        .toChunks(4);

      expect(chunks.length).toBeGreaterThan(0);

      chunks.forEach(chunk => {
        expect(chunk.cols.length).toBe(1); // Only Position is required
        expect(chunk.optionalCols).toBeDefined();
        expect(chunk.optionalCols!.length).toBe(1); // Health is optional

        // Verify optional components structure
        for (let i = 0; i < chunk.entities.length; i++) {
          const position = chunk.cols[0][i];
          const health = chunk.optionalCols![0] ? chunk.optionalCols![0][i] : undefined;

          expect(position).toHaveProperty('x');
          expect(position).toHaveProperty('y');

          // Health can be undefined for some entities
          if (health !== undefined) {
            expect(health).toHaveProperty('value');
          }
        }
      });
    });

    it('should handle multiple optional components', () => {
      // Add more components to some entities
      const entities = world.query(Position).toArray();
      entities.forEach(([entity], index) => {
        if (index % 2 === 0) {
          world.addComponent(entity, Mass, { value: index + 1 });
        }
      });

      const chunks = world.query(Position)
        .optional(Health, Mass)
        .toChunks(3);

      chunks.forEach(chunk => {
        expect(chunk.cols.length).toBe(1); // Position
        expect(chunk.optionalCols).toBeDefined();
        expect(chunk.optionalCols!.length).toBe(2); // Health + Mass
      });
    });
  });

  describe('toChunks() with filtering', () => {
    beforeEach(() => {
      // Create entities with tags and varying components
      for (let i = 0; i < 12; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 5 });
        world.addComponent(entity, Velocity, { dx: i, dy: i });

        if (i % 2 === 0) {
          world.addTag(entity, 'Even');
        }

        if (i % 4 === 0) {
          world.addComponent(entity, Health, { value: 100 });
        }
      }
    });

    it('should work with tag filters', () => {
      const chunks = world.query(Position, Velocity)
        .where(['Even'], [])
        .toChunks(3);

      // Should only include even-tagged entities
      const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entities.length, 0);
      expect(totalEntities).toBe(6); // Half of the entities
    });

    it('should work with without filters', () => {
      const chunks = world.query(Position, Velocity)
        .without(Health)
        .toChunks(4);

      // Should exclude entities with Health component
      const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entities.length, 0);
      expect(totalEntities).toBe(9); // 12 - 3 entities with Health
    });

    it('should work with changed() filters', () => {
      world.beginFrame();

      // Modify some entities
      for (let i = 0; i < 6; i++) { // Modify half of the entities
        const entities = world.query(Position, Velocity).toArray();
        const entity = entities[i][0];
        world.setComponent(entity, Position, { x: i * 100, y: i * 50 });
      }

      const chunks = world.query(Position, Velocity)
        .changed(Position)
        .toChunks(5);

      // Should only include the modified entities
      const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entities.length, 0);
      expect(totalEntities).toBe(6);
    });
  });

  describe('Performance and large datasets', () => {
    it('should handle large datasets efficiently', () => {
      // Create many entities
      const entityCount = 10000;
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        world.addComponent(entity, Velocity, { dx: i % 100, dy: (i + 1) % 100 });
      }

      const start = performance.now();
      const chunks = world.query(Position, Velocity).toChunks(1000);
      const end = performance.now();

      expect(chunks.length).toBe(10); // 10000 / 1000 = 10 chunks
      expect(end - start).toBeLessThan(100); // Should be reasonably fast

      // Verify total entity count
      const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entities.length, 0);
      expect(totalEntities).toBe(entityCount);

      console.log(`toChunks() processed ${entityCount} entities into ${chunks.length} chunks in ${(end - start).toFixed(2)}ms`);
    });

    it('should optimize chunk sizes', () => {
      // Create entities
      for (let i = 0; i < 100; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
      }

      const smallChunks = world.query(Position).toChunks(10);
      const largeChunks = world.query(Position).toChunks(50);

      expect(smallChunks.length).toBe(10); // 100 / 10
      expect(largeChunks.length).toBe(2);  // 100 / 50

      // Verify all chunks have correct sizes (except possibly the last one)
      smallChunks.slice(0, -1).forEach(chunk => {
        expect(chunk.entities.length).toBe(10);
      });

      largeChunks.forEach(chunk => {
        expect(chunk.entities.length).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('Integration with existing parallel system', () => {
    it('should produce chunks compatible with forEachChunkParallel interface', () => {
      // Create test entities
      for (let i = 0; i < 20; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 5 });
        world.addComponent(entity, Velocity, { dx: i, dy: i * 2 });
      }

      const chunks = world.query(Position, Velocity).toChunks(8);

      // Simulate forEachChunkParallel consumption
      let totalProcessed = 0;
      chunks.forEach(chunk => {
        // Verify chunk structure matches expected interface
        expect(chunk).toHaveProperty('archetypeKey');
        expect(chunk).toHaveProperty('entities');
        expect(chunk).toHaveProperty('cols');
        expect(chunk).toHaveProperty('startRow');
        expect(chunk).toHaveProperty('endRow');

        // Process entities in chunk (simulating worker processing)
        for (let i = 0; i < chunk.entities.length; i++) {
          const entity = chunk.entities[i];
          const position = chunk.cols[0][i];
          const velocity = chunk.cols[1][i];

          expect(typeof entity).toBe('number');
          expect(position).toHaveProperty('x');
          expect(position).toHaveProperty('y');
          expect(velocity).toHaveProperty('dx');
          expect(velocity).toHaveProperty('dy');

          totalProcessed++;
        }
      });

      expect(totalProcessed).toBe(20);
    });

    it('should work with archetype keys for caching', () => {
      // Create entities that will be in different archetypes
      const entities1: number[] = [];
      const entities2: number[] = [];

      // Archetype 1: Position + Velocity
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        world.addComponent(entity, Velocity, { dx: i, dy: i });
        entities1.push(entity);
      }

      // Archetype 2: Position + Velocity + Health
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i + 10, y: i + 10 });
        world.addComponent(entity, Velocity, { dx: i + 10, dy: i + 10 });
        world.addComponent(entity, Health, { value: 100 + i });
        entities2.push(entity);
      }

      const chunks = world.query(Position, Velocity).toChunks(10);

      // Should have chunks from different archetypes
      const archetypeKeys = new Set(chunks.map(chunk => chunk.archetypeKey));
      expect(archetypeKeys.size).toBeGreaterThanOrEqual(1);

      // Each archetype key should be consistent
      chunks.forEach(chunk => {
        expect(typeof chunk.archetypeKey).toBe('string');
        expect(chunk.archetypeKey.length).toBeGreaterThan(0);
      });
    });
  });
});