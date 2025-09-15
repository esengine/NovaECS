import { World } from '../src/core/World';
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

class Name {
  constructor(public value: string = '') {}
}

describe('Query Convenience APIs', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('count() method', () => {
    it('should count entities with fast path (no filtering)', () => {
      // Create entities
      for (let i = 0; i < 10; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        world.addComponent(entity, Velocity, { dx: i, dy: i });
      }

      // Create entities that don't match
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        // No Velocity component
      }

      const count = world.query(Position, Velocity).count();
      expect(count).toBe(10);
    });

    it('should count entities with slow path (with filtering)', () => {
      // Create entities with different tags
      for (let i = 0; i < 8; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        if (i % 2 === 0) {
          world.addTag(entity, 'Even');
        }
      }

      const count = world.query(Position).where(['Even'], []).count();
      expect(count).toBe(4); // Only even entities
    });

    it('should return 0 for empty query', () => {
      const count = world.query(Position).count();
      expect(count).toBe(0);
    });

    it('should work with without filters', () => {
      // Create entities
      for (let i = 0; i < 6; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        if (i < 3) {
          world.addComponent(entity, Health, { value: 100 });
        }
      }

      const count = world.query(Position).without(Health).count();
      expect(count).toBe(3); // Entities without Health
    });
  });

  describe('some() method', () => {
    beforeEach(() => {
      // Create test entities
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 10 });
        world.addComponent(entity, Velocity, { dx: i, dy: i });
      }
    });

    it('should return true when entities exist', () => {
      const hasAny = world.query(Position, Velocity).some();
      expect(hasAny).toBe(true);
    });

    it('should return false when no entities exist', () => {
      const hasAny = world.query(Health).some();
      expect(hasAny).toBe(false);
    });

    it('should work with predicate function', () => {
      // Check if any entity has x > 20
      const hasLargeX = world.query(Position).some((entity, position) => position.x > 20);
      expect(hasLargeX).toBe(true);

      // Check if any entity has x > 100
      const hasVeryLargeX = world.query(Position).some((entity, position) => position.x > 100);
      expect(hasVeryLargeX).toBe(false);
    });

    it('should work with multiple components', () => {
      const hasFastEntity = world.query(Position, Velocity).some(
        (entity, position, velocity) => velocity.dx > 2
      );
      expect(hasFastEntity).toBe(true);
    });

    it('should stop at first match for efficiency', () => {
      let callCount = 0;
      const hasAny = world.query(Position).some((entity) => {
        callCount++;
        return true; // Always true, should stop at first
      });

      expect(hasAny).toBe(true);
      expect(callCount).toBe(1); // Should only call once
    });
  });

  describe('first() method', () => {
    beforeEach(() => {
      // Create test entities in specific order
      for (let i = 0; i < 3; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 10 });
        world.addComponent(entity, Name, { value: `Entity${i}` });
      }
    });

    it('should return first matching entity', () => {
      const result = world.query(Position, Name).first();
      expect(result).toBeDefined();

      if (result) {
        const [entity, position, name] = result;
        expect(typeof entity).toBe('number');
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(name.value).toMatch(/Entity\d/);
      }
    });

    it('should return undefined when no entities match', () => {
      const result = world.query(Health).first();
      expect(result).toBeUndefined();
    });

    it('should work with optional components', () => {
      const result = world.query(Position).optional(Health).first();
      expect(result).toBeDefined();

      if (result) {
        const [entity, position, health] = result;
        expect(position).toBeDefined();
        expect(health).toBeUndefined(); // No Health component added
      }
    });

    it('should return consistent first entity', () => {
      const result1 = world.query(Position).first();
      const result2 = world.query(Position).first();

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1![0]).toBe(result2![0]); // Same entity
    });
  });

  describe('map() method', () => {
    beforeEach(() => {
      // Create test entities
      for (let i = 0; i < 4; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 5 });
        world.addComponent(entity, Name, { value: `Item${i}` });
      }
    });

    it('should map entities to simple values', () => {
      const xValues = world.query(Position).map((entity, position) => position.x);
      expect(xValues).toEqual([0, 10, 20, 30]);
    });

    it('should map entities to objects', () => {
      const items = world.query(Position, Name).map((entity, position, name) => ({
        id: entity,
        name: name.value,
        x: position.x,
        y: position.y
      }));

      expect(items).toHaveLength(4);
      expect(items[0]).toMatchObject({
        id: expect.any(Number),
        name: 'Item0',
        x: 0,
        y: 0
      });
    });

    it('should handle empty queries', () => {
      const results = world.query(Health).map((entity, health) => health.value);
      expect(results).toEqual([]);
    });

    it('should work with complex transformations', () => {
      const distances = world.query(Position).map((entity, position) =>
        Math.sqrt(position.x * position.x + position.y * position.y)
      );

      expect(distances).toHaveLength(4);
      expect(distances[0]).toBe(0); // Origin
      expect(distances[1]).toBeCloseTo(Math.sqrt(100 + 25)); // (10,5)
    });
  });

  describe('toArray() method', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        world.addComponent(entity, Velocity, { dx: i, dy: i });
      }
    });

    it('should collect all entities into array', () => {
      const entities = world.query(Position, Velocity).toArray();

      expect(entities).toHaveLength(3);
      entities.forEach(([entity, position, velocity]) => {
        expect(typeof entity).toBe('number');
        expect(position).toHaveProperty('x');
        expect(position).toHaveProperty('y');
        expect(velocity).toHaveProperty('dx');
        expect(velocity).toHaveProperty('dy');
      });
    });

    it('should return empty array for no matches', () => {
      const entities = world.query(Health).toArray();
      expect(entities).toEqual([]);
    });

    it('should work with optional components', () => {
      const entities = world.query(Position).optional(Health).toArray();

      expect(entities).toHaveLength(3);
      entities.forEach(([entity, position, health]) => {
        expect(position).toBeDefined();
        expect(health).toBeUndefined();
      });
    });
  });

  describe('Performance characteristics', () => {
    it('should have efficient count() for simple queries', () => {
      // Create many entities
      for (let i = 0; i < 1000; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
      }

      const start = performance.now();
      const count = world.query(Position).count();
      const end = performance.now();

      expect(count).toBe(1000);
      expect(end - start).toBeLessThan(5); // Should be very fast (fast path)

      console.log(`Fast count() took ${(end - start).toFixed(3)}ms for ${count} entities`);
    });

    it('should handle filtered count() reasonably', () => {
      // Create entities with tags
      for (let i = 0; i < 500; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        if (i % 3 === 0) {
          world.addTag(entity, 'Special');
        }
      }

      const start = performance.now();
      const count = world.query(Position).where(['Special'], []).count();
      const end = performance.now();

      expect(count).toBeCloseTo(500 / 3, 0);
      expect(end - start).toBeLessThan(50); // Should be reasonable (slow path)

      console.log(`Filtered count() took ${(end - start).toFixed(3)}ms for ${count} matching entities`);
    });

    it('should handle some() efficiently with early exit', () => {
      // Create many entities
      for (let i = 0; i < 1000; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
      }

      let checkCount = 0;
      const start = performance.now();
      const hasLargeX = world.query(Position).some((entity, position) => {
        checkCount++;
        return position.x > 10; // Should find this quickly
      });
      const end = performance.now();

      expect(hasLargeX).toBe(true);
      expect(checkCount).toBeLessThan(100); // Should exit early
      expect(end - start).toBeLessThan(10);

      console.log(`some() checked ${checkCount} entities in ${(end - start).toFixed(3)}ms`);
    });
  });

  describe('Integration with other query features', () => {
    beforeEach(() => {
      // Create diverse entities
      for (let i = 0; i < 6; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i * 10, y: i * 10 });

        if (i % 2 === 0) {
          world.addComponent(entity, Velocity, { dx: i, dy: i });
        }

        if (i % 3 === 0) {
          world.addComponent(entity, Health, { value: 100 + i });
          world.addTag(entity, 'Alive');
        }

        if (i > 3) {
          world.addTag(entity, 'Special');
        }
      }
    });

    it('should work with without() filters', () => {
      const count = world.query(Position)
        .without(Health)
        .count();

      expect(count).toBe(4); // Entities without Health
    });

    it('should work with tag filters', () => {
      const aliveEntities = world.query(Position)
        .where(['Alive'], [])
        .toArray();

      expect(aliveEntities).toHaveLength(2); // Entities 0 and 3
    });

    it('should work with optional components', () => {
      const firstWithHealth = world.query(Position)
        .optional(Health)
        .first();

      expect(firstWithHealth).toBeDefined();
      if (firstWithHealth) {
        const [entity, position, health] = firstWithHealth;
        expect(position).toBeDefined();
        // health could be defined or undefined
      }
    });

    it('should chain multiple conditions', () => {
      const specialAliveCount = world.query(Position)
        .where(['Special', 'Alive'], [])
        .count();

      // Only entities that have both Special AND Alive tags
      expect(specialAliveCount).toBe(0); // No entity has both tags in our setup

      const specialCount = world.query(Position)
        .where(['Special'], [])
        .count();

      expect(specialCount).toBe(2); // Entities 4 and 5
    });
  });
});