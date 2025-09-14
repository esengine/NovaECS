/**
 * Tests for Query archetype optimization
 * Query 原型优化测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Query } from '../src/core/Query';
import { registerComponent } from '../src/core/ComponentRegistry';

// Test components
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

class Health {
  constructor(public hp = 100) {}
}

class Armor {
  constructor(public value = 0) {}
}

describe('Query Archetype Integration', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
    registerComponent(Armor);
  });

  test('should use archetype path for simple queries', () => {
    // Create entities with different component combinations
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

    const entity3 = world.createEntity();
    world.addComponent(entity3, Position, { x: 50, y: 60 });
    // No Velocity component

    // Query for Position + Velocity (should use archetype path)
    const results: Array<{ entity: number; pos: Position; vel: Velocity }> = [];
    world.query(Position, Velocity).forEach((entity, pos, vel) => {
      results.push({ entity, pos, vel });
    });

    expect(results).toHaveLength(2);
    expect(results[0].pos).toEqual({ x: 10, y: 20 });
    expect(results[0].vel).toEqual({ dx: 1, dy: 2 });
    expect(results[1].pos).toEqual({ x: 30, y: 40 });
    expect(results[1].vel).toEqual({ dx: 3, dy: 4 });
  });

  test('should use sparse store path for tag-filtered queries', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addTag(entity1, 'player');

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addTag(entity2, 'enemy');

    const entity3 = world.createEntity();
    world.addComponent(entity3, Position, { x: 50, y: 60 });
    // No tags

    // Query with tag filter (should use sparse store path)
    const results: Array<{ entity: number; pos: Position }> = [];
    world.query(Position).where(['player']).forEach((entity, pos) => {
      results.push({ entity, pos });
    });

    expect(results).toHaveLength(1);
    expect(results[0].pos).toEqual({ x: 10, y: 20 });
  });

  test('should handle without filter correctly in both paths', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });
    world.addComponent(entity2, Health, { hp: 100 });

    const entity3 = world.createEntity();
    world.addComponent(entity3, Position, { x: 50, y: 60 });

    // Query for Position + Velocity without Health
    const results: Array<{ entity: number; pos: Position; vel: Velocity }> = [];
    world.query(Position, Velocity).without(Health).forEach((entity, pos, vel) => {
      results.push({ entity, pos, vel });
    });

    expect(results).toHaveLength(1);
    expect(results[0].entity).toBe(entity1);
    expect(results[0].pos).toEqual({ x: 10, y: 20 });
    expect(results[0].vel).toEqual({ dx: 1, dy: 2 });
  });

  test('should allow manual archetype optimization toggle', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    // Force sparse store path even for simple query
    const results1: Array<{ entity: number; pos: Position; vel: Velocity }> = [];
    world.query(Position, Velocity)
      .useArchetypeOptimization(false)
      .forEach((entity, pos, vel) => {
        results1.push({ entity, pos, vel });
      });

    expect(results1).toHaveLength(1);
    expect(results1[0].pos).toEqual({ x: 10, y: 20 });

    // Force archetype path (should work normally)
    const results2: Array<{ entity: number; pos: Position; vel: Velocity }> = [];
    world.query(Position, Velocity)
      .useArchetypeOptimization(true)
      .forEach((entity, pos, vel) => {
        results2.push({ entity, pos, vel });
      });

    expect(results2).toHaveLength(1);
    expect(results2[0].pos).toEqual({ x: 10, y: 20 });
  });

  test('should handle complex scenarios with both paths', () => {
    // Create diverse entity set
    const entities = [];
    for (let i = 0; i < 10; i++) {
      const entity = world.createEntity();
      entities.push(entity);

      // All have Position
      world.addComponent(entity, Position, { x: i * 10, y: i * 10 });

      // Half have Velocity (0, 2, 4, 6, 8)
      if (i % 2 === 0) {
        world.addComponent(entity, Velocity, { dx: i, dy: i });
      }

      // Quarter have Health (0, 4, 8)
      if (i % 4 === 0) {
        world.addComponent(entity, Health, { hp: i * 10 });
      }

      // Some have tags
      if (i < 3) {
        world.addTag(entity, 'group1');
      }
      if (i >= 7) {
        world.addTag(entity, 'group2');
      }
    }

    // Debug: check actual entity configurations
    const entityInfo: any[] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const hasPos = world.hasComponent(entity, Position);
      const hasVel = world.hasComponent(entity, Velocity);
      const hasHealth = world.hasComponent(entity, Health);
      entityInfo.push({
        index: i,
        entity,
        pos: hasPos,
        vel: hasVel,
        health: hasHealth
      });
    }

    // Expected: entities with Velocity but without Health should be: 2, 6
    // Entity 0: has Pos, Vel, Health (excluded by without Health)
    // Entity 2: has Pos, Vel, no Health (included)
    // Entity 4: has Pos, Vel, Health (excluded by without Health)
    // Entity 6: has Pos, Vel, no Health (included)
    // Entity 8: has Pos, Vel, Health (excluded by without Health)

    // Test archetype path: Position + Velocity
    const archetypeResults: number[] = [];
    world.query(Position, Velocity).forEach((entity) => {
      archetypeResults.push(entity);
    });
    expect(archetypeResults).toHaveLength(5); // entities 0, 2, 4, 6, 8

    // Test sparse path: Position with tag filter
    const sparseResults: number[] = [];
    world.query(Position).where(['group1']).forEach((entity) => {
      sparseResults.push(entity);
    });
    expect(sparseResults).toHaveLength(3); // entities 0, 1, 2

    // Test complex without filter
    const withoutResults: number[] = [];
    world.query(Position, Velocity).without(Health).forEach((entity) => {
      withoutResults.push(entity);
    });
    expect(withoutResults).toHaveLength(2); // entities 2, 6 (have Vel but not Health)
    expect(withoutResults).toContain(entities[2]);
    expect(withoutResults).toContain(entities[6]);
  });

  test('should handle empty queries correctly in both paths', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Position, { x: 10, y: 20 });

    // Query for non-existent component combination
    let count = 0;
    world.query(Velocity, Health).forEach(() => {
      count++;
    });
    expect(count).toBe(0);

    // Query with impossible tag requirement
    let tagCount = 0;
    world.query(Position).where(['nonexistent']).forEach(() => {
      tagCount++;
    });
    expect(tagCount).toBe(0);
  });

  test('should maintain entity lifecycle consistency', () => {
    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, Position, { x: 30, y: 40 });
    world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

    // Disable entity1
    world.setEnabled(entity1, false);

    // Query should only return enabled entities
    const results: number[] = [];
    world.query(Position, Velocity).forEach((entity) => {
      results.push(entity);
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(entity2);

    // Re-enable entity1
    world.setEnabled(entity1, true);

    const results2: number[] = [];
    world.query(Position, Velocity).forEach((entity) => {
      results2.push(entity);
    });

    expect(results2).toHaveLength(2);
    expect(results2).toContain(entity1);
    expect(results2).toContain(entity2);
  });

  test('should handle component modifications during query', () => {
    const entities = [];
    for (let i = 0; i < 5; i++) {
      const entity = world.createEntity();
      entities.push(entity);
      world.addComponent(entity, Position, { x: i, y: i });
      world.addComponent(entity, Velocity, { dx: i, dy: i });
    }

    // Test that iteration protection works
    let iterationCount = 0;
    world.query(Position, Velocity).forEach((entity, pos, vel) => {
      iterationCount++;
      // This should not affect the current iteration
      if (entity === entities[0]) {
        pos.x = 999;
        vel.dx = 999;
      }
    });

    expect(iterationCount).toBe(5);

    // Verify modifications took effect
    const pos = world.getComponent(entities[0], Position);
    expect(pos?.x).toBe(999);
  });
});