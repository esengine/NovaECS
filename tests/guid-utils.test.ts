/**
 * GUID Utils Tests
 * GUID工具测试
 *
 * Tests all utility functions for GUID management, comparison, and conversion.
 * 测试所有GUID管理、比较和转换的工具函数。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Guid, createGuid } from '../src/components/Guid';
import { PRNG } from '../src/determinism/PRNG';
import {
  ensureGuid,
  stableEntityKey,
  cmpStable,
  guidToString,
  stringToGuid,
  hasGuid,
  getGuid,
  type StableKey
} from '../src/determinism/GuidUtils';

describe('GUID Utils', () => {
  beforeEach(() => {
    registerComponent(Guid);
  });

  describe('ensureGuid', () => {
    test('should add GUID to entity without one', () => {
      const world = new World();
      const entity = world.createEntity();

      expect(hasGuid(world, entity)).toBe(false);

      ensureGuid(world, entity);

      expect(hasGuid(world, entity)).toBe(true);
      const guid = getGuid(world, entity);
      expect(guid?.hi).toBeDefined();
      expect(guid?.lo).toBeDefined();
    });

    test('should not modify entity that already has GUID', () => {
      const world = new World();
      const entity = world.createEntity();

      // Manually add a GUID first
      const originalGuid = createGuid(world);
      world.addComponent(entity, Guid, originalGuid);

      ensureGuid(world, entity);

      const currentGuid = getGuid(world, entity);
      expect(currentGuid?.hi).toBe(originalGuid.hi);
      expect(currentGuid?.lo).toBe(originalGuid.lo);
    });

    test('should use deterministic allocation', () => {
      const world = new World();
      const prng = new PRNG(12345);
      world.setResource(PRNG, prng);

      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      ensureGuid(world, entity1);
      ensureGuid(world, entity2);

      const guid1 = getGuid(world, entity1)!;
      const guid2 = getGuid(world, entity2)!;

      // Should be different
      expect(guid1.hi !== guid2.hi || guid1.lo !== guid2.lo).toBe(true);

      // Should be deterministic across runs
      const world2 = new World();
      const prng2 = new PRNG(12345);
      world2.setResource(PRNG, prng2);

      const entity1_2 = world2.createEntity();
      const entity2_2 = world2.createEntity();

      ensureGuid(world2, entity1_2);
      ensureGuid(world2, entity2_2);

      const guid1_2 = getGuid(world2, entity1_2)!;
      const guid2_2 = getGuid(world2, entity2_2)!;

      expect(guid1_2.hi).toBe(guid1.hi);
      expect(guid1_2.lo).toBe(guid1.lo);
      expect(guid2_2.hi).toBe(guid2.hi);
      expect(guid2_2.lo).toBe(guid2.lo);
    });
  });

  describe('stableEntityKey', () => {
    test('should return guid key for entity with GUID', () => {
      const world = new World();
      const entity = world.createEntity();
      const guid = new Guid(0x12345678, 0x9ABCDEF0);
      world.addComponent(entity, Guid, guid);

      const key = stableEntityKey(world, entity);

      expect(key).toEqual({
        kind: 'guid',
        hi: 0x12345678,
        lo: 0x9ABCDEF0
      });
    });

    test('should return id key for entity without GUID', () => {
      const world = new World();
      const entity = world.createEntity();

      const key = stableEntityKey(world, entity);

      expect(key).toEqual({
        kind: 'id',
        id: entity >>> 0
      });
    });

    test('should return id key for entity with zero GUID', () => {
      const world = new World();
      const entity = world.createEntity();
      const zeroGuid = new Guid(0, 0);
      world.addComponent(entity, Guid, zeroGuid);

      const key = stableEntityKey(world, entity);

      expect(key).toEqual({
        kind: 'id',
        id: entity >>> 0
      });
    });
  });

  describe('cmpStable', () => {
    test('should sort GUID keys before ID keys', () => {
      const guidKey: StableKey = { kind: 'guid', hi: 1, lo: 1 };
      const idKey: StableKey = { kind: 'id', id: 999999 };

      expect(cmpStable(guidKey, idKey)).toBeLessThan(0);
      expect(cmpStable(idKey, guidKey)).toBeGreaterThan(0);
    });

    test('should compare GUID keys by hi then lo', () => {
      const guid1: StableKey = { kind: 'guid', hi: 1, lo: 100 };
      const guid2: StableKey = { kind: 'guid', hi: 1, lo: 200 };
      const guid3: StableKey = { kind: 'guid', hi: 2, lo: 50 };

      // Same hi, compare by lo
      expect(cmpStable(guid1, guid2)).toBeLessThan(0);
      expect(cmpStable(guid2, guid1)).toBeGreaterThan(0);

      // Different hi, hi takes precedence
      expect(cmpStable(guid1, guid3)).toBeLessThan(0);
      expect(cmpStable(guid3, guid1)).toBeGreaterThan(0);
    });

    test('should compare ID keys numerically', () => {
      const id1: StableKey = { kind: 'id', id: 100 };
      const id2: StableKey = { kind: 'id', id: 200 };

      expect(cmpStable(id1, id2)).toBeLessThan(0);
      expect(cmpStable(id2, id1)).toBeGreaterThan(0);
      expect(cmpStable(id1, id1)).toBe(0);
    });

    test('should return 0 for identical keys', () => {
      const guid1: StableKey = { kind: 'guid', hi: 123, lo: 456 };
      const guid2: StableKey = { kind: 'guid', hi: 123, lo: 456 };
      const id1: StableKey = { kind: 'id', id: 789 };
      const id2: StableKey = { kind: 'id', id: 789 };

      expect(cmpStable(guid1, guid2)).toBe(0);
      expect(cmpStable(id1, id2)).toBe(0);
    });
  });

  describe('guidToString and stringToGuid', () => {
    test('should convert GUID to string and back', () => {
      const original = new Guid(0x12345678, 0x9ABCDEF0);
      const str = guidToString(original);
      const converted = stringToGuid(str);

      expect(converted.hi).toBe(original.hi);
      expect(converted.lo).toBe(original.lo);
    });

    test('should produce consistent string representation', () => {
      const guid1 = new Guid(0x12345678, 0x9ABCDEF0);
      const guid2 = new Guid(0x12345678, 0x9ABCDEF0);

      expect(guidToString(guid1)).toBe(guidToString(guid2));
    });

    test('should handle zero GUID', () => {
      const zeroGuid = new Guid(0, 0);
      const str = guidToString(zeroGuid);
      const converted = stringToGuid(str);

      expect(converted.hi).toBe(0);
      expect(converted.lo).toBe(0);
      expect(str).toBe('00000000-00000000');
    });

    test('should handle max values', () => {
      const maxGuid = new Guid(0xFFFFFFFF, 0xFFFFFFFF);
      const str = guidToString(maxGuid);
      const converted = stringToGuid(str);

      expect(converted.hi).toBe(0xFFFFFFFF);
      expect(converted.lo).toBe(0xFFFFFFFF);
    });
  });

  describe('hasGuid and getGuid', () => {
    test('should correctly detect presence of GUID', () => {
      const world = new World();
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      // Entity1 without GUID
      expect(hasGuid(world, entity1)).toBe(false);
      expect(getGuid(world, entity1)).toBeUndefined();

      // Entity2 with GUID
      const guid = new Guid(123, 456);
      world.addComponent(entity2, Guid, guid);

      expect(hasGuid(world, entity2)).toBe(true);
      const retrievedGuid = getGuid(world, entity2);
      expect(retrievedGuid?.hi).toBe(123);
      expect(retrievedGuid?.lo).toBe(456);
    });

    test('should handle non-existent entities gracefully', () => {
      const world = new World();
      const nonExistentEntity = 99999 as any; // Force invalid entity

      expect(hasGuid(world, nonExistentEntity)).toBe(false);
      expect(getGuid(world, nonExistentEntity)).toBeUndefined();
    });
  });

  describe('integration with existing systems', () => {
    test('should work with broadphase sorting', () => {
      const world = new World();
      const prng = new PRNG(54321);
      world.setResource(PRNG, prng);

      // Create entities, some with GUIDs, some without
      const entities = [];
      for (let i = 0; i < 5; i++) {
        entities.push(world.createEntity());
      }

      // Add GUIDs to first 3 entities
      for (let i = 0; i < 3; i++) {
        ensureGuid(world, entities[i]);
      }

      // Get stable keys for all entities
      const keys = entities.map(e => stableEntityKey(world, e));

      // Sort using cmpStable
      const sortedPairs = entities.map((e, i) => ({ entity: e, key: keys[i] }));
      sortedPairs.sort((a, b) => cmpStable(a.key, b.key));

      // GUID entities should come first
      expect(sortedPairs[0].key.kind).toBe('guid');
      expect(sortedPairs[1].key.kind).toBe('guid');
      expect(sortedPairs[2].key.kind).toBe('guid');
      expect(sortedPairs[3].key.kind).toBe('id');
      expect(sortedPairs[4].key.kind).toBe('id');
    });

    test('should maintain deterministic behavior across World instances', () => {
      const createSortedKeys = (seed: number) => {
        const world = new World();
        const prng = new PRNG(seed);
        world.setResource(PRNG, prng);

        const entities = [];
        for (let i = 0; i < 3; i++) {
          const entity = world.createEntity();
          ensureGuid(world, entity);
          entities.push(entity);
        }

        return entities.map(e => stableEntityKey(world, e));
      };

      const keys1 = createSortedKeys(99999);
      const keys2 = createSortedKeys(99999);

      expect(keys1).toEqual(keys2);
    });
  });
});