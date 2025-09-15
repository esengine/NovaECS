import { World } from '../src/core/World';
import { QueryDelta } from '../src/core/Query';
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

describe('Query Delta Subscription', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('Basic delta subscription', () => {
    it('should track entity additions', () => {
      const query = world.query(Position, Velocity).enableDelta();

      // Create entity that matches query
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });
      world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

      const delta = query.consumeDelta();
      expect(delta.added).toContain(entity1);
      expect(delta.removed).toHaveLength(0);
      expect(delta.changed).toHaveLength(0);

      // Second consumption should be empty
      const delta2 = query.consumeDelta();
      expect(delta2.added).toHaveLength(0);
      expect(delta2.removed).toHaveLength(0);
      expect(delta2.changed).toHaveLength(0);
    });

    it('should track entity removals', () => {
      const query = world.query(Position, Velocity).enableDelta();

      // Create entity that matches query
      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });

      // Clear initial delta
      query.consumeDelta();

      // Remove component so entity no longer matches
      world.removeComponent(entity, Position);

      const delta = query.consumeDelta();
      expect(delta.added).toHaveLength(0);
      expect(delta.removed).toContain(entity);
      expect(delta.changed).toHaveLength(0);
    });

    it('should track component changes', () => {
      const query = world.query(Position, Velocity).enableDelta();

      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });

      // Clear initial delta
      query.consumeDelta();

      // Mark component as changed
      world.markChanged(entity, Position);

      const delta = query.consumeDelta();
      expect(delta.added).toHaveLength(0);
      expect(delta.removed).toHaveLength(0);
      expect(delta.changed).toContain(entity);
    });

    it('should not track entities that do not match query', () => {
      const query = world.query(Position, Velocity).enableDelta();

      // Create entity that doesn't match (missing Velocity)
      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 10, y: 20 });

      const delta = query.consumeDelta();
      expect(delta.added).toHaveLength(0);
      expect(delta.removed).toHaveLength(0);
      expect(delta.changed).toHaveLength(0);
    });

    it('should work with without filters', () => {
      const query = world.query(Position)
        .without(Health)
        .enableDelta();

      // Create entity that matches (has Position, no Health)
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });

      let delta = query.consumeDelta();
      expect(delta.added).toContain(entity1);

      // Clear delta
      query.consumeDelta();

      // Add Health component - should trigger removal
      world.addComponent(entity1, Health, { value: 100 });

      delta = query.consumeDelta();
      expect(delta.removed).toContain(entity1);
    });

    it('should work with tag filters', () => {
      const query = world.query(Position)
        .where(['Player'], ['Dead'])
        .enableDelta();

      // Create entity that matches
      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addTag(entity, 'Player');

      let delta = query.consumeDelta();
      expect(delta.added).toContain(entity);

      // Clear delta
      query.consumeDelta();

      // Add forbidden tag - should trigger removal
      world.addTag(entity, 'Dead');

      delta = query.consumeDelta();
      expect(delta.removed).toContain(entity);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple queries with different filters', () => {
      const playerQuery = world.query(Position)
        .where(['Player'], [])
        .enableDelta();

      const enemyQuery = world.query(Position)
        .where(['Enemy'], [])
        .enableDelta();

      // Create player entity
      const player = world.createEntity();
      world.addComponent(player, Position, { x: 10, y: 20 });
      world.addTag(player, 'Player');

      // Create enemy entity
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 30, y: 40 });
      world.addTag(enemy, 'Enemy');

      const playerDelta = playerQuery.consumeDelta();
      const enemyDelta = enemyQuery.consumeDelta();

      expect(playerDelta.added).toContain(player);
      expect(playerDelta.added).not.toContain(enemy);

      expect(enemyDelta.added).toContain(enemy);
      expect(enemyDelta.added).not.toContain(player);
    });

    it('should handle query with optional components', () => {
      const query = world.query(Position)
        .optional(Health)
        .enableDelta();

      // Create entity with only required component
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });

      let delta = query.consumeDelta();
      expect(delta.added).toContain(entity1);

      // Clear delta
      query.consumeDelta();

      // Add optional component - should trigger change
      world.addComponent(entity1, Health, { value: 100 });

      delta = query.consumeDelta();
      expect(delta.changed).toContain(entity1);
    });

    it('should handle entity lifecycle transitions', () => {
      const query = world.query(Position, Velocity).enableDelta();

      const entity = world.createEntity();

      // Add first component - no match yet
      world.addComponent(entity, Position, { x: 10, y: 20 });

      let delta = query.consumeDelta();
      expect(delta.added).toHaveLength(0);

      // Add second component - now matches
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });

      delta = query.consumeDelta();
      expect(delta.added).toContain(entity);

      // Clear delta
      query.consumeDelta();

      // Remove one component - no longer matches
      world.removeComponent(entity, Velocity);

      delta = query.consumeDelta();
      expect(delta.removed).toContain(entity);
    });

    it('should handle disabled delta subscription', () => {
      const query = world.query(Position, Velocity);
      // Note: not calling enableDelta()

      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });

      const delta = query.consumeDelta();
      expect(delta.added).toHaveLength(0);
      expect(delta.removed).toHaveLength(0);
      expect(delta.changed).toHaveLength(0);
    });

    it('should provide correct isEmpty() status', () => {
      const query = world.query(Position).enableDelta();

      expect(query.isDeltaEnabled()).toBe(true);

      const regularQuery = world.query(Velocity);
      expect(regularQuery.isDeltaEnabled()).toBe(false);
    });
  });

  describe('Performance considerations', () => {
    it('should efficiently handle large numbers of entities', () => {
      const query = world.query(Position).enableDelta();

      const entityCount = 1000;
      const entities: number[] = [];

      const start = performance.now();

      // Create many entities
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        entities.push(entity);
      }

      const delta = query.consumeDelta();
      const end = performance.now();

      expect(delta.added).toHaveLength(entityCount);
      expect(end - start).toBeLessThan(100); // Should be reasonably fast

      console.log(`Delta tracking for ${entityCount} entities took ${(end - start).toFixed(2)}ms`);
    });

    it('should not affect regular query performance', () => {
      // Create entities
      const entityCount = 1000;
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
      }

      const regularQuery = world.query(Position);
      const deltaQuery = world.query(Position).enableDelta();

      // Time regular query
      const start1 = performance.now();
      let count1 = 0;
      regularQuery.forEach(() => count1++);
      const end1 = performance.now();

      // Time delta query
      const start2 = performance.now();
      let count2 = 0;
      deltaQuery.forEach(() => count2++);
      const end2 = performance.now();

      expect(count1).toBe(entityCount);
      expect(count2).toBe(entityCount);

      const regularTime = end1 - start1;
      const deltaTime = end2 - start2;

      console.log(`Regular query: ${regularTime.toFixed(2)}ms, Delta query: ${deltaTime.toFixed(2)}ms`);

      // Delta query shouldn't be significantly slower
      expect(deltaTime).toBeLessThan(regularTime * 2);
    });
  });
});