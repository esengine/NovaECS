/**
 * GUID Allocator Tests
 * GUID分配器测试
 *
 * Tests the deterministic behavior of GUID allocation across
 * different runs and scenarios.
 * 测试GUID分配在不同运行和场景下的确定性行为。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { GuidAllocator, getGuidAllocator, PRNG } from '../src/determinism';
import { Guid } from '../src/components/Guid';

describe('GUID Allocator', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('should allocate GUIDs deterministically', () => {
    const allocator = new GuidAllocator(12345);

    // Generate sequence of GUIDs
    const guids1 = [];
    for (let i = 0; i < 10; i++) {
      guids1.push(allocator.issue());
    }

    // Reset with same seed
    const allocator2 = new GuidAllocator(12345);
    const guids2 = [];
    for (let i = 0; i < 10; i++) {
      guids2.push(allocator2.issue());
    }

    // Should produce identical sequences
    expect(guids2).toEqual(guids1);
  });

  test('should handle overflow correctly', () => {
    const allocator = new GuidAllocator(1);

    // Set to near overflow condition
    allocator.setState({ hi: 0x12345678, lo: 0xFFFFFFFE });

    const guid1 = allocator.issue(); // Should be { hi: 0x12345678, lo: 0xFFFFFFFF }
    const guid2 = allocator.issue(); // Should overflow to { hi: 0x12345679, lo: 0x00000000 }

    expect(guid1).toEqual({ hi: 0x12345678, lo: 0xFFFFFFFF });
    expect(guid2).toEqual({ hi: 0x12345679, lo: 0x00000000 });
  });

  test('should maintain state consistency', () => {
    const allocator = new GuidAllocator(42);

    // Generate some GUIDs
    for (let i = 0; i < 5; i++) {
      allocator.issue();
    }

    const state = allocator.getState();
    const nextGuid = allocator.issue();

    // Reset to saved state
    allocator.setState(state);
    const restoredNextGuid = allocator.issue();

    expect(restoredNextGuid).toEqual(nextGuid);
  });

  test('should work with World and PRNG integration', () => {
    const world1 = new World();
    const world2 = new World();

    // Setup same PRNG seed
    const prng1 = new PRNG(54321);
    const prng2 = new PRNG(54321);
    world1.setResource(PRNG, prng1);
    world2.setResource(PRNG, prng2);

    // Get allocators (should use PRNG state for seed)
    const allocator1 = getGuidAllocator(world1);
    const allocator2 = getGuidAllocator(world2);

    // Generate GUIDs from both allocators
    const guids1 = [];
    const guids2 = [];
    for (let i = 0; i < 5; i++) {
      guids1.push(allocator1.issue());
      guids2.push(allocator2.issue());
    }

    // Should produce identical sequences
    expect(guids2).toEqual(guids1);
  });

  test('should work without PRNG (fallback to seed=1)', () => {
    const world1 = new World();
    const world2 = new World();

    const allocator1 = getGuidAllocator(world1);
    const allocator2 = getGuidAllocator(world2);

    const guids1 = [];
    const guids2 = [];
    for (let i = 0; i < 5; i++) {
      guids1.push(allocator1.issue());
      guids2.push(allocator2.issue());
    }

    // Should produce identical sequences (fallback seed)
    expect(guids2).toEqual(guids1);
  });

  test('should integrate with Guid component', () => {
    const world = new World();
    const prng = new PRNG(99999);
    world.setResource(PRNG, prng);

    const allocator = getGuidAllocator(world);

    // Create entities with deterministic GUIDs
    const entities = [];
    for (let i = 0; i < 3; i++) {
      const entity = world.createEntity();
      const guidData = allocator.issue();
      const guid = new Guid(guidData.hi, guidData.lo);
      world.addComponent(entity, Guid, guid);
      entities.push(entity);
    }

    // Verify GUIDs are properly assigned
    const guid1 = world.getComponent(entities[0], Guid);
    const guid2 = world.getComponent(entities[1], Guid);
    const guid3 = world.getComponent(entities[2], Guid);

    expect(guid1?.hi).toBeDefined();
    expect(guid1?.lo).toBeDefined();
    expect(guid2?.hi).toBeDefined();
    expect(guid2?.lo).toBeDefined();
    expect(guid3?.hi).toBeDefined();
    expect(guid3?.lo).toBeDefined();

    // Each should be different
    expect(guid1).not.toEqual(guid2);
    expect(guid2).not.toEqual(guid3);
    expect(guid1).not.toEqual(guid3);
  });

  test('should produce different sequences for different seeds', () => {
    const allocator1 = new GuidAllocator(1111);
    const allocator2 = new GuidAllocator(2222);

    const guids1 = [];
    const guids2 = [];
    for (let i = 0; i < 5; i++) {
      guids1.push(allocator1.issue());
      guids2.push(allocator2.issue());
    }

    // Should produce different sequences
    expect(guids2).not.toEqual(guids1);
  });

  test('should maintain monotonic ordering within same hi value', () => {
    const allocator = new GuidAllocator(1);

    const guid1 = allocator.issue();
    const guid2 = allocator.issue();
    const guid3 = allocator.issue();

    // Same hi value, increasing lo values
    expect(guid1.hi).toBe(guid2.hi);
    expect(guid2.hi).toBe(guid3.hi);
    expect(guid2.lo).toBeGreaterThan(guid1.lo);
    expect(guid3.lo).toBeGreaterThan(guid2.lo);
  });

  test('should create resource in World when first accessed', () => {
    const world = new World();

    expect(world.getResource(GuidAllocator)).toBeUndefined();

    const allocator = getGuidAllocator(world);

    expect(world.getResource(GuidAllocator)).toBe(allocator);
  });
});