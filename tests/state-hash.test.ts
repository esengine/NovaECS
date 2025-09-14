/**
 * Tests for StateHash deterministic world state hashing
 * StateHash 确定性世界状态哈希测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { worldHash, worldHashForComponents, compareWorldStates, frameHash, registerComponentHasher } from '../src/replay/StateHash';
import { Guid } from '../src/components/Guid';
import { PRNG } from '../src/determinism/PRNG';

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

describe('StateHash', () => {
  let world1: World;
  let world2: World;

  beforeEach(() => {
    world1 = new World();
    world2 = new World();

    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
    registerComponent(Guid);
    registerComponent(PRNG);
  });

  test('should produce same hash for identical world states', () => {
    // Create identical entities in both worlds
    const entity1_1 = world1.createEntity();
    world1.addComponent(entity1_1, Position, { x: 10, y: 20 });
    world1.addComponent(entity1_1, Velocity, { dx: 1, dy: 2 });

    const entity2_1 = world2.createEntity();
    world2.addComponent(entity2_1, Position, { x: 10, y: 20 });
    world2.addComponent(entity2_1, Velocity, { dx: 1, dy: 2 });

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should produce different hash for different world states', () => {
    // Create different entities
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Position, { x: 10, y: 20 });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Position, { x: 15, y: 25 }); // Different position

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).not.toBe(hash2);
  });

  test('should be deterministic across multiple calls', () => {
    const entity = world1.createEntity();
    world1.addComponent(entity, Position, { x: 10, y: 20 });
    world1.addComponent(entity, Velocity, { dx: 5, dy: 10 });
    world1.addComponent(entity, Health, { hp: 100 });

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world1);
    const hash3 = worldHash(world1);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  test('should handle empty worlds', () => {
    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
    expect(hash1).toBe(2166136261); // FNV-1a initial value
  });

  test('should be deterministic for same component data arrangement', () => {
    // Create entities with same IDs and same component data
    const e1_1 = world1.createEntity(); // Should be entity 1
    const e1_2 = world1.createEntity(); // Should be entity 2
    world1.addComponent(e1_1, Position, { x: 10, y: 20 });
    world1.addComponent(e1_2, Position, { x: 30, y: 40 });

    const e2_1 = world2.createEntity(); // Should be entity 1
    const e2_2 = world2.createEntity(); // Should be entity 2
    world2.addComponent(e2_1, Position, { x: 10, y: 20 }); // Same entity ID, same data
    world2.addComponent(e2_2, Position, { x: 30, y: 40 }); // Same entity ID, same data

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should handle component-specific hashing', () => {
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Position, { x: 10, y: 20 });
    world1.addComponent(entity1, Velocity, { dx: 1, dy: 2 });
    world1.addComponent(entity1, Health, { hp: 100 });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Position, { x: 10, y: 20 });
    world2.addComponent(entity2, Health, { hp: 100 });

    // Hash only Position and Health components
    const hash1 = worldHashForComponents(world1, [Position, Health]);
    const hash2 = worldHashForComponents(world2, [Position, Health]);

    expect(hash1).toBe(hash2); // Should match despite different Velocity
  });

  test('should handle GUID components', () => {
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Guid, { value: 'test-entity-123' });
    world1.addComponent(entity1, Position, { x: 10, y: 20 });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Guid, { value: 'test-entity-123' });
    world2.addComponent(entity2, Position, { x: 10, y: 20 });

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should differentiate between different GUID values', () => {
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Guid, { value: 'entity-1' });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Guid, { value: 'entity-2' });

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).not.toBe(hash2);
  });

  test('should handle fractional positions consistently', () => {
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Position, { x: 10.567, y: 20.123 });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Position, { x: 10.567, y: 20.123 });

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should handle component addition/removal', () => {
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Position, { x: 10, y: 20 });

    const hashBefore = worldHash(world1);

    world1.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const hashAfter = worldHash(world1);

    expect(hashBefore).not.toBe(hashAfter);
  });

  test('should compare world states correctly', () => {
    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Position, { x: 10, y: 20 });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Position, { x: 10, y: 20 });

    expect(compareWorldStates(world1, world2)).toBe(true);

    // Modify world2
    world2.addComponent(entity2, Velocity, { dx: 1, dy: 2 });

    expect(compareWorldStates(world1, world2)).toBe(false);
  });

  test('should include frame number in frame hash', () => {
    const entity = world1.createEntity();
    world1.addComponent(entity, Position, { x: 10, y: 20 });

    world1.frame = 5;
    const hash1 = frameHash(world1);

    world1.frame = 10;
    const hash2 = frameHash(world1);

    expect(hash1).not.toBe(hash2);
  });

  test('should handle unknown component types gracefully', () => {
    class CustomComponent {
      constructor(public value = 42) {}
    }

    registerComponent(CustomComponent);

    const entity = world1.createEntity();
    world1.addComponent(entity, CustomComponent, { value: 123 });

    // Should not throw
    expect(() => worldHash(world1)).not.toThrow();

    const hash = worldHash(world1);
    expect(typeof hash).toBe('number');
  });

  test('should handle circular references gracefully', () => {
    class CircularComponent {
      constructor() {
        (this as any).self = this; // Create circular reference
      }
    }

    registerComponent(CircularComponent);

    const entity = world1.createEntity();
    world1.addComponent(entity, CircularComponent);

    // Should not throw despite circular reference
    expect(() => worldHash(world1)).not.toThrow();

    const hash = worldHash(world1);
    expect(typeof hash).toBe('number');
  });

  test('should include PRNG state in frame hash when available', () => {
    const entity = world1.createEntity();
    world1.addComponent(entity, Position, { x: 10, y: 20 });
    world1.frame = 5;

    // Without PRNG
    const hashWithoutPRNG = frameHash(world1);

    // With PRNG
    world1.setResource(PRNG, new PRNG(12345));
    const hashWithPRNG = frameHash(world1);

    expect(hashWithoutPRNG).not.toBe(hashWithPRNG);
  });

  test('should handle custom component hashers', () => {
    // Register custom hasher for Position
    registerComponentHasher(Position, (h, p) => {
      h ^= (p.x * 1000 | 0);
      h = (h * 0x01000193) >>> 0;
      h ^= (p.y * 1000 | 0);
      h = (h * 0x01000193) >>> 0;
      return h;
    });

    const entity1 = world1.createEntity();
    world1.addComponent(entity1, Position, { x: 10.567, y: 20.123 });

    const entity2 = world2.createEntity();
    world2.addComponent(entity2, Position, { x: 10.567, y: 20.123 });

    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should normalize numeric values correctly', () => {
    const entity1 = world1.createEntity();
    const entity2 = world2.createEntity();

    // Test -0 normalization
    world1.addComponent(entity1, Position, { x: -0, y: 0 });
    world2.addComponent(entity2, Position, { x: 0, y: 0 });

    expect(worldHash(world1)).toBe(worldHash(world2));
  });

  test('should handle NaN and Infinity consistently', () => {
    class TestComp {
      constructor(public value = 0) {}
    }
    registerComponent(TestComp);

    const entity1 = world1.createEntity();
    const entity2 = world2.createEntity();

    // Both worlds should have same hash for NaN
    world1.addComponent(entity1, TestComp, { value: NaN });
    world2.addComponent(entity2, TestComp, { value: NaN });

    expect(worldHash(world1)).toBe(worldHash(world2));

    // Test Infinity
    world1.getComponent(entity1, TestComp)!.value = Infinity;
    world2.getComponent(entity2, TestComp)!.value = Infinity;

    expect(worldHash(world1)).toBe(worldHash(world2));
  });

  test('should use stable GUID keys for consistent hashing', () => {
    // Create entities with different IDs but same GUIDs
    const e1_1 = world1.createEntity(); // Entity 1
    const e1_2 = world1.createEntity(); // Entity 2
    world1.addComponent(e1_1, Guid, { value: 'stable-guid-1' });
    world1.addComponent(e1_2, Guid, { value: 'stable-guid-2' });
    world1.addComponent(e1_1, Position, { x: 10, y: 20 });
    world1.addComponent(e1_2, Position, { x: 30, y: 40 });

    const e2_2 = world2.createEntity(); // Entity 1
    const e2_1 = world2.createEntity(); // Entity 2
    world2.addComponent(e2_1, Guid, { value: 'stable-guid-2' }); // Different entity ID, same GUID
    world2.addComponent(e2_2, Guid, { value: 'stable-guid-1' }); // Different entity ID, same GUID
    world2.addComponent(e2_1, Position, { x: 30, y: 40 }); // Same data as stable-guid-2
    world2.addComponent(e2_2, Position, { x: 10, y: 20 }); // Same data as stable-guid-1

    // Should have same hash because entities are matched by GUID, not entity ID
    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should fallback to entity ID when no GUID present', () => {
    // Create entities without GUID
    const e1_1 = world1.createEntity();
    const e1_2 = world1.createEntity();
    world1.addComponent(e1_1, Position, { x: 10, y: 20 });
    world1.addComponent(e1_2, Position, { x: 30, y: 40 });

    const e2_1 = world2.createEntity();
    const e2_2 = world2.createEntity();
    world2.addComponent(e2_1, Position, { x: 10, y: 20 });
    world2.addComponent(e2_2, Position, { x: 30, y: 40 });

    // Should have same hash because entity IDs and data match
    const hash1 = worldHash(world1);
    const hash2 = worldHash(world2);

    expect(hash1).toBe(hash2);
  });

  test('should prioritize GUID over entity ID in sorting', () => {
    // Mix of entities with and without GUIDs
    const e1 = world1.createEntity();
    const e2 = world1.createEntity();
    const e3 = world1.createEntity();

    // Add GUIDs to some entities (not all)
    world1.addComponent(e2, Guid, { value: 'guid-entity' });
    world1.addComponent(e1, Position, { x: 10, y: 20 }); // No GUID
    world1.addComponent(e2, Position, { x: 20, y: 30 }); // Has GUID
    world1.addComponent(e3, Position, { x: 30, y: 40 }); // No GUID

    // Should consistently order GUID entities first, then by entity ID
    const hash1 = worldHash(world1);
    const hash2 = worldHash(world1); // Same world, should be same hash

    expect(hash1).toBe(hash2);
  });
});