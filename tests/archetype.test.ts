/**
 * Tests for archetype system
 * 原型系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { Archetype, ArchetypeIndex } from '../src/archetype';
import { Bitset } from '../src/signature/Bitset';
import { World } from '../src/core/World';
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

describe('Archetype System', () => {
  describe('Archetype', () => {
    test('should create empty archetype', () => {
      const archetype = new Archetype('0', []);

      expect(archetype.key).toBe('0');
      expect(archetype.types).toEqual([]);
      expect(archetype.size()).toBe(0);
      expect(archetype.isEmpty()).toBe(true);
      expect(archetype.getEntities()).toEqual([]);
    });

    test('should add entities with default components', () => {
      const archetype = new Archetype('key1', [1, 2]); // Position and Velocity type IDs

      const makeDefault = (typeId: number) => {
        if (typeId === 1) return new Position(10, 20);
        if (typeId === 2) return new Velocity(1, 2);
        return {};
      };

      archetype.push(1, makeDefault);
      archetype.push(2, makeDefault);

      expect(archetype.size()).toBe(2);
      expect(archetype.isEmpty()).toBe(false);
      expect(archetype.getEntities()).toEqual([1, 2]);

      // Check component data
      const pos1 = archetype.getComponent<Position>(1, 1);
      expect(pos1).toEqual({ x: 10, y: 20 });

      const vel2 = archetype.getComponent<Velocity>(2, 2);
      expect(vel2).toEqual({ dx: 1, dy: 2 });
    });

    test('should handle swap remove correctly', () => {
      const archetype = new Archetype('key1', [1, 2]);

      const makeDefault = (typeId: number) => {
        if (typeId === 1) return new Position(typeId * 10, typeId * 20);
        if (typeId === 2) return new Velocity(typeId, typeId * 2);
        return {};
      };

      // Add entities 10, 20, 30
      archetype.push(10, makeDefault);
      archetype.push(20, makeDefault);
      archetype.push(30, makeDefault);

      expect(archetype.size()).toBe(3);
      expect(archetype.getEntities()).toEqual([10, 20, 30]);

      // Remove middle entity (20)
      const row = archetype.getRow(20);
      expect(row).toBe(1);

      archetype.swapRemove(row!);

      expect(archetype.size()).toBe(2);
      expect(archetype.getEntities()).toEqual([10, 30]); // 30 moved to position 1

      // Check that entity 30 is now in row 1
      expect(archetype.getRow(30)).toBe(1);
      expect(archetype.getRow(20)).toBeUndefined();

      // Check component data integrity
      const pos30 = archetype.getComponent<Position>(30, 1);
      expect(pos30).toEqual({ x: 10, y: 20 }); // Default values based on typeId=1
    });

    test('should handle removal of last entity', () => {
      const archetype = new Archetype('key1', [1]);

      archetype.push(100, () => new Position(5, 5));

      expect(archetype.size()).toBe(1);

      // Remove the only entity
      archetype.swapRemove(0);

      expect(archetype.size()).toBe(0);
      expect(archetype.isEmpty()).toBe(true);
      expect(archetype.hasEntity(100)).toBe(false);
    });

    test('should set and get components correctly', () => {
      const archetype = new Archetype('key1', [1, 2]);

      archetype.push(1, () => ({}));

      // Set components
      archetype.setComponent(1, 1, new Position(100, 200));
      archetype.setComponent(1, 2, new Velocity(5, 10));

      // Get components
      const pos = archetype.getComponent<Position>(1, 1);
      const vel = archetype.getComponent<Velocity>(1, 2);

      expect(pos).toEqual({ x: 100, y: 200 });
      expect(vel).toEqual({ dx: 5, dy: 10 });
    });

    test('should verify archetype integrity', () => {
      const archetype = new Archetype('key1', [1, 2]);

      archetype.push(1, () => new Position());
      archetype.push(2, () => new Position());
      archetype.push(3, () => new Position());

      expect(archetype.verify()).toBe(true);

      // Remove middle entity
      archetype.swapRemove(1);

      expect(archetype.verify()).toBe(true);
    });

    test('should clear archetype correctly', () => {
      const archetype = new Archetype('key1', [1, 2]);

      archetype.push(1, () => new Position());
      archetype.push(2, () => new Position());

      expect(archetype.size()).toBe(2);

      archetype.clear();

      expect(archetype.size()).toBe(0);
      expect(archetype.isEmpty()).toBe(true);
      expect(archetype.getEntities()).toEqual([]);
    });
  });

  describe('ArchetypeIndex', () => {
    let index: ArchetypeIndex;

    beforeEach(() => {
      index = new ArchetypeIndex();
    });

    test('should create archetypes from signatures', () => {
      const sig1 = new Bitset();
      sig1.set(1); // Position
      sig1.set(2); // Velocity

      const archetype1 = index.getOrCreate(sig1);

      expect(archetype1.types).toEqual([1, 2]);
      expect(archetype1.key).toBe(sig1.key());

      // Getting same signature should return same archetype
      const archetype2 = index.getOrCreate(sig1);
      expect(archetype2).toBe(archetype1);

      expect(index.size()).toBe(1);
    });

    test('should match archetypes by query requirements', () => {
      // Create archetype with Position + Velocity
      const sig1 = new Bitset();
      sig1.set(1); // Position
      sig1.set(2); // Velocity
      const arch1 = index.getOrCreate(sig1);

      // Create archetype with Position + Health
      const sig2 = new Bitset();
      sig2.set(1); // Position
      sig2.set(3); // Health
      const arch2 = index.getOrCreate(sig2);

      // Create archetype with Position only
      const sig3 = new Bitset();
      sig3.set(1); // Position
      const arch3 = index.getOrCreate(sig3);

      // Query for Position only
      const posQuery = new Bitset();
      posQuery.set(1);

      const posResults = Array.from(index.match(posQuery));
      expect(posResults).toHaveLength(3);
      expect(posResults).toContain(arch1);
      expect(posResults).toContain(arch2);
      expect(posResults).toContain(arch3);

      // Query for Position + Velocity
      const posVelQuery = new Bitset();
      posVelQuery.set(1);
      posVelQuery.set(2);

      const posVelResults = Array.from(index.match(posVelQuery));
      expect(posVelResults).toHaveLength(1);
      expect(posVelResults).toContain(arch1);
    });

    test('should exclude archetypes with forbidden components', () => {
      // Create archetype with Position + Health
      const sig1 = new Bitset();
      sig1.set(1); // Position
      sig1.set(3); // Health
      const arch1 = index.getOrCreate(sig1);

      // Create archetype with Position + Health + Armor
      const sig2 = new Bitset();
      sig2.set(1); // Position
      sig2.set(3); // Health
      sig2.set(4); // Armor
      const arch2 = index.getOrCreate(sig2);

      // Query for Position + Health but without Armor
      const required = new Bitset();
      required.set(1); // Position
      required.set(3); // Health

      const without = new Bitset();
      without.set(4); // Armor

      const results = Array.from(index.match(required, without));
      expect(results).toHaveLength(1);
      expect(results).toContain(arch1);
      expect(results).not.toContain(arch2);
    });

    test('should provide statistics', () => {
      const sig1 = new Bitset();
      sig1.set(1);
      const arch1 = index.getOrCreate(sig1);

      const sig2 = new Bitset();
      sig2.set(1);
      sig2.set(2);
      const arch2 = index.getOrCreate(sig2);

      // Add entities to archetypes
      arch1.push(1, () => ({}));
      arch1.push(2, () => ({}));
      arch2.push(3, () => ({}));

      const stats = index.getStats();

      expect(stats.archetypeCount).toBe(2);
      expect(stats.totalEntities).toBe(3);
      expect(stats.averageEntitiesPerArchetype).toBe(1.5);
      expect(stats.largestArchetypeSize).toBe(2);
      expect(stats.emptyArchetypes).toBe(0);
    });

    test('should cleanup empty archetypes', () => {
      const sig1 = new Bitset();
      sig1.set(1);
      const arch1 = index.getOrCreate(sig1);

      const sig2 = new Bitset();
      sig2.set(2);
      const arch2 = index.getOrCreate(sig2);

      // Add entities only to first archetype
      arch1.push(1, () => ({}));

      expect(index.size()).toBe(2);

      index.cleanup();

      expect(index.size()).toBe(1);
      expect(index.get(sig1.key())).toBe(arch1);
      expect(index.get(sig2.key())).toBeUndefined();
    });

    test('should find archetype containing specific entity', () => {
      const sig1 = new Bitset();
      sig1.set(1);
      const arch1 = index.getOrCreate(sig1);

      const sig2 = new Bitset();
      sig2.set(2);
      const arch2 = index.getOrCreate(sig2);

      arch1.push(100, () => ({}));
      arch2.push(200, () => ({}));

      expect(index.findArchetypeWithEntity(100)).toBe(arch1);
      expect(index.findArchetypeWithEntity(200)).toBe(arch2);
      expect(index.findArchetypeWithEntity(300)).toBeUndefined();
    });
  });

  describe('World Integration', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
      registerComponent(Position);
      registerComponent(Velocity);
      registerComponent(Health);
      registerComponent(Armor);
    });

    test('should migrate entities to appropriate archetypes', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      // Initially both entities should be in empty archetype
      expect(world.hasComponent(entity1, Position)).toBe(false);

      // Add components to entity1
      world.addComponent(entity1, Position, { x: 10, y: 20 });
      expect(world.hasComponent(entity1, Position)).toBe(true);

      world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });
      expect(world.hasComponent(entity1, Velocity)).toBe(true);

      // Add different components to entity2
      world.addComponent(entity2, Position, { x: 30, y: 40 });
      world.addComponent(entity2, Health, { hp: 150 });

      // Verify components are accessible
      const pos1 = world.getComponent(entity1, Position);
      expect(pos1).toEqual({ x: 10, y: 20 });

      const vel1 = world.getComponent(entity1, Velocity);
      expect(vel1).toEqual({ dx: 1, dy: 2 });

      const pos2 = world.getComponent(entity2, Position);
      expect(pos2).toEqual({ x: 30, y: 40 });

      const health2 = world.getComponent(entity2, Health);
      expect(health2).toEqual({ hp: 150 });
    });

    test('should handle component removal with archetype migration', () => {
      const entity = world.createEntity();

      // Add multiple components
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });
      world.addComponent(entity, Health, { hp: 100 });

      expect(world.hasComponent(entity, Position)).toBe(true);
      expect(world.hasComponent(entity, Velocity)).toBe(true);
      expect(world.hasComponent(entity, Health)).toBe(true);

      // Remove one component
      world.removeComponent(entity, Velocity);

      expect(world.hasComponent(entity, Position)).toBe(true);
      expect(world.hasComponent(entity, Velocity)).toBe(false);
      expect(world.hasComponent(entity, Health)).toBe(true);

      // Verify remaining components are still accessible
      const pos = world.getComponent(entity, Position);
      expect(pos).toEqual({ x: 10, y: 20 });

      const health = world.getComponent(entity, Health);
      expect(health).toEqual({ hp: 100 });
    });

    test('should handle entity destruction', () => {
      const entity = world.createEntity();

      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });

      expect(world.hasComponent(entity, Position)).toBe(true);
      expect(world.hasComponent(entity, Velocity)).toBe(true);

      world.destroyEntity(entity);

      expect(world.hasComponent(entity, Position)).toBe(false);
      expect(world.hasComponent(entity, Velocity)).toBe(false);
      expect(world.getComponent(entity, Position)).toBeUndefined();
    });

    test('should preserve component data across archetype migrations', () => {
      const entity = world.createEntity();

      // Start with Position
      world.addComponent(entity, Position, { x: 100, y: 200 });

      let pos = world.getComponent(entity, Position);
      expect(pos).toEqual({ x: 100, y: 200 });

      // Add Velocity (should migrate to new archetype)
      world.addComponent(entity, Velocity, { dx: 5, dy: 10 });

      // Both components should still be accessible
      pos = world.getComponent(entity, Position);
      expect(pos).toEqual({ x: 100, y: 200 });

      const vel = world.getComponent(entity, Velocity);
      expect(vel).toEqual({ dx: 5, dy: 10 });

      // Add Health (migrate again)
      world.addComponent(entity, Health, { hp: 75 });

      // All components should still be accessible
      pos = world.getComponent(entity, Position);
      expect(pos).toEqual({ x: 100, y: 200 });

      const vel2 = world.getComponent(entity, Velocity);
      expect(vel2).toEqual({ dx: 5, dy: 10 });

      const health = world.getComponent(entity, Health);
      expect(health).toEqual({ hp: 75 });
    });

    test('should handle multiple entities with same components', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();

      // Add same components to multiple entities
      world.addComponent(entity1, Position, { x: 1, y: 1 });
      world.addComponent(entity1, Velocity, { dx: 1, dy: 1 });

      world.addComponent(entity2, Position, { x: 2, y: 2 });
      world.addComponent(entity2, Velocity, { dx: 2, dy: 2 });

      world.addComponent(entity3, Position, { x: 3, y: 3 });
      world.addComponent(entity3, Velocity, { dx: 3, dy: 3 });

      // All should have same components
      expect(world.hasComponent(entity1, Position)).toBe(true);
      expect(world.hasComponent(entity1, Velocity)).toBe(true);
      expect(world.hasComponent(entity2, Position)).toBe(true);
      expect(world.hasComponent(entity2, Velocity)).toBe(true);
      expect(world.hasComponent(entity3, Position)).toBe(true);
      expect(world.hasComponent(entity3, Velocity)).toBe(true);

      // But different values
      expect(world.getComponent(entity1, Position)).toEqual({ x: 1, y: 1 });
      expect(world.getComponent(entity2, Position)).toEqual({ x: 2, y: 2 });
      expect(world.getComponent(entity3, Position)).toEqual({ x: 3, y: 3 });
    });
  });
});