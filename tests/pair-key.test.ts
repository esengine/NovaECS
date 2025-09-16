/**
 * Pair Key Tests
 * 配对键测试
 *
 * Tests deterministic pair key generation based on GUID ordering.
 * 测试基于GUID排序的确定性配对键生成。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Guid, createGuid } from '../src/components/Guid';
import { PRNG } from '../src/determinism/PRNG';
import { makePairKey, makePairKeyOrdered, parsePairKey } from '../src/determinism/PairKey';

describe('Pair Key', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  test('should create consistent keys regardless of input order', () => {
    const world = new World();
    const prng = new PRNG(12345);
    world.setResource(PRNG, prng);

    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    // Add GUIDs
    const guid1 = createGuid(world);
    const guid2 = createGuid(world);
    world.addComponent(entity1, Guid, guid1);
    world.addComponent(entity2, Guid, guid2);

    // Test both orders
    const pair1 = makePairKey(world, entity1, entity2);
    const pair2 = makePairKey(world, entity2, entity1);

    // Should produce same key regardless of input order
    expect(pair1.key).toBe(pair2.key);

    // Should normalize entity order
    expect(pair1.a).toBe(pair2.a);
    expect(pair1.b).toBe(pair2.b);
  });

  test('should handle entities with and without GUIDs', () => {
    const world = new World();
    const entity1 = world.createEntity(); // No GUID
    const entity2 = world.createEntity(); // Will have GUID

    const guid2 = new Guid(0x12345678, 0x9ABCDEF0);
    world.addComponent(entity2, Guid, guid2);

    const pair = makePairKey(world, entity1, entity2);

    // Non-GUID entity should come first (key [0, id] < [hi, lo] where hi > 0)
    expect(pair.a).toBe(entity1); // Non-GUID entity
    expect(pair.b).toBe(entity2); // GUID entity

    // Key should reflect this ordering
    expect(pair.key).toBe('0:1|305419896:2596069104');
  });

  test('should handle entities without GUIDs', () => {
    const world = new World();
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    const pair = makePairKey(world, entity2, entity1);

    // Should order by entity ID when no GUIDs
    expect(pair.a).toBe(entity1); // Lower entity ID
    expect(pair.b).toBe(entity2); // Higher entity ID
    expect(pair.key).toBe('0:1|0:2');
  });

  test('should be deterministic across different World instances', () => {
    const createPair = (seed: number) => {
      const world = new World();
      const prng = new PRNG(seed);
      world.setResource(PRNG, prng);

      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      const guid1 = createGuid(world);
      const guid2 = createGuid(world);
      world.addComponent(entity1, Guid, guid1);
      world.addComponent(entity2, Guid, guid2);

      return makePairKey(world, entity1, entity2);
    };

    const pair1 = createPair(99999);
    const pair2 = createPair(99999);

    expect(pair1.key).toBe(pair2.key);
  });

  test('should handle identical GUIDs correctly', () => {
    const world = new World();
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    const guid1 = new Guid(0x12345678, 0x9ABCDEF0);
    const guid2 = new Guid(0x12345678, 0x9ABCDEF0);
    world.addComponent(entity1, Guid, guid1);
    world.addComponent(entity2, Guid, guid2);

    const pair = makePairKey(world, entity1, entity2);

    // Should still create valid key, order by entity ID as tiebreaker
    expect(pair.key).toMatch(/305419896:2596069104\|305419896:2596069104/);
    expect(pair.a).toBe(entity1); // Lower entity ID wins
    expect(pair.b).toBe(entity2);
  });

  test('makePairKeyOrdered should work for pre-ordered entities', () => {
    const world = new World();
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    const guid1 = new Guid(0x11111111, 0x11111111);
    const guid2 = new Guid(0x22222222, 0x22222222);
    world.addComponent(entity1, Guid, guid1);
    world.addComponent(entity2, Guid, guid2);

    // entity1 has smaller GUID, so it should come first
    const key = makePairKeyOrdered(world, entity1, entity2);
    const normalizedPair = makePairKey(world, entity1, entity2);

    expect(key).toBe(normalizedPair.key);
  });

  test('parsePairKey should correctly parse generated keys', () => {
    const world = new World();
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    const guid1 = new Guid(0x12345678, 0x9ABCDEF0);
    const guid2 = new Guid(0xAABBCCDD, 0xEEFF0011);
    world.addComponent(entity1, Guid, guid1);
    world.addComponent(entity2, Guid, guid2);

    const pair = makePairKey(world, entity1, entity2);
    const parsed = parsePairKey(pair.key);

    expect(parsed.k1).toEqual([0x12345678, 0x9ABCDEF0]);
    expect(parsed.k2).toEqual([0xAABBCCDD, 0xEEFF0011]);
  });

  test('should handle zero GUIDs as fallback to entity ID', () => {
    const world = new World();
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    // Add zero GUIDs (should be treated as no GUID)
    const zeroGuid1 = new Guid(0, 0);
    const zeroGuid2 = new Guid(0, 0);
    world.addComponent(entity1, Guid, zeroGuid1);
    world.addComponent(entity2, Guid, zeroGuid2);

    const pair = makePairKey(world, entity1, entity2);

    // Should fall back to entity ID ordering
    expect(pair.key).toBe('0:1|0:2');
    expect(pair.a).toBe(entity1);
    expect(pair.b).toBe(entity2);
  });

  test('should throw on invalid key format in parsePairKey', () => {
    expect(() => parsePairKey('invalid-key')).toThrow('Invalid pair key format');
    expect(() => parsePairKey('1:2')).toThrow('Invalid pair key format');
    expect(() => parsePairKey('1:2|3')).toThrow();
  });

  test('should maintain ordering consistency with mixed GUID types', () => {
    const world = new World();

    // Create entities with different GUID states
    const entityNoGuid = world.createEntity();
    const entityZeroGuid = world.createEntity();
    const entityValidGuid = world.createEntity();

    world.addComponent(entityZeroGuid, Guid, new Guid(0, 0));
    world.addComponent(entityValidGuid, Guid, new Guid(1, 1));

    // Test all combinations
    const pairs = [
      makePairKey(world, entityNoGuid, entityValidGuid),
      makePairKey(world, entityZeroGuid, entityValidGuid),
      makePairKey(world, entityNoGuid, entityZeroGuid)
    ];

    // Non-GUID/Zero-GUID entities should come first (lower key values)
    expect(pairs[0].a).toBe(entityNoGuid);    // [0, id] < [1, 1]
    expect(pairs[1].a).toBe(entityZeroGuid);  // [0, id] < [1, 1]

    // Between no-GUID and zero-GUID, should order by entity ID
    expect(pairs[2].a).toBe(entityNoGuid); // Lower entity ID
  });
});