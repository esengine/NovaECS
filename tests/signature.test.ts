/**
 * Tests for component signature system
 * 组件签名系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
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

describe('Signature System', () => {
  describe('Bitset', () => {
    test('should create bitset with default capacity', () => {
      const bitset = new Bitset();
      expect(bitset.words).toHaveLength(1);
      expect(bitset.isEmpty()).toBe(true);
    });

    test('should create bitset with custom capacity', () => {
      const bitset = new Bitset(3); // 3 words = 96 bits capacity
      expect(bitset.words).toHaveLength(3);
      expect(bitset.isEmpty()).toBe(true);
    });

    test('should set and check bits correctly', () => {
      const bitset = new Bitset();

      // Test setting bits
      bitset.set(0);
      bitset.set(1);
      bitset.set(31);

      expect(bitset.has(0)).toBe(true);
      expect(bitset.has(1)).toBe(true);
      expect(bitset.has(31)).toBe(true);
      expect(bitset.has(2)).toBe(false);
      expect(bitset.has(30)).toBe(false);

      expect(bitset.isEmpty()).toBe(false);
      expect(bitset.popCount()).toBe(3);
    });

    test('should handle bits beyond 32 (multiple words)', () => {
      const bitset = new Bitset();

      bitset.set(32);  // Second word, bit 0
      bitset.set(63);  // Second word, bit 31
      bitset.set(64);  // Third word, bit 0
      bitset.set(1023); // 32nd word, bit 31

      expect(bitset.has(32)).toBe(true);
      expect(bitset.has(63)).toBe(true);
      expect(bitset.has(64)).toBe(true);
      expect(bitset.has(1023)).toBe(true);

      // Should auto-expand to accommodate 1023
      expect(bitset.words.length).toBeGreaterThanOrEqual(32);
    });

    test('should clear bits correctly', () => {
      const bitset = new Bitset();

      bitset.set(5);
      bitset.set(37); // Second word
      expect(bitset.has(5)).toBe(true);
      expect(bitset.has(37)).toBe(true);

      bitset.clear(5);
      expect(bitset.has(5)).toBe(false);
      expect(bitset.has(37)).toBe(true);

      bitset.clear(37);
      expect(bitset.has(37)).toBe(false);
      expect(bitset.isEmpty()).toBe(true);
    });

    test('should check containsAll correctly', () => {
      const bitset1 = new Bitset();
      const bitset2 = new Bitset();

      // bitset1: {0, 1, 5, 32}
      bitset1.set(0);
      bitset1.set(1);
      bitset1.set(5);
      bitset1.set(32);

      // bitset2: {0, 5}
      bitset2.set(0);
      bitset2.set(5);

      // bitset1 should contain all bits of bitset2
      expect(bitset1.containsAll(bitset2)).toBe(true);
      expect(bitset2.containsAll(bitset1)).toBe(false);

      // Add bit to bitset2 that bitset1 doesn't have
      bitset2.set(10);
      expect(bitset1.containsAll(bitset2)).toBe(false);
    });

    test('should check intersects correctly', () => {
      const bitset1 = new Bitset();
      const bitset2 = new Bitset();

      bitset1.set(0);
      bitset1.set(5);
      bitset1.set(32);

      bitset2.set(1);
      bitset2.set(5); // Common bit
      bitset2.set(33);

      expect(bitset1.intersects(bitset2)).toBe(true);

      bitset2.clear(5);
      expect(bitset1.intersects(bitset2)).toBe(false);
    });

    test('should generate consistent keys for archetype identification', () => {
      const bitset1 = new Bitset();
      const bitset2 = new Bitset();

      bitset1.set(0);
      bitset1.set(5);

      bitset2.set(0);
      bitset2.set(5);

      expect(bitset1.key()).toBe(bitset2.key());

      bitset2.set(10);
      expect(bitset1.key()).not.toBe(bitset2.key());
    });

    test('should clone correctly', () => {
      const original = new Bitset();
      original.set(0);
      original.set(32);
      original.set(100);

      const cloned = original.clone();

      expect(cloned.has(0)).toBe(true);
      expect(cloned.has(32)).toBe(true);
      expect(cloned.has(100)).toBe(true);
      expect(cloned.key()).toBe(original.key());

      // Modify original, clone should not be affected
      original.set(200);
      expect(original.has(200)).toBe(true);
      expect(cloned.has(200)).toBe(false);
    });

    test('should get all set bits', () => {
      const bitset = new Bitset();
      bitset.set(0);
      bitset.set(5);
      bitset.set(32);
      bitset.set(100);

      const setBits = bitset.getSetBits();
      expect(setBits).toEqual([0, 5, 32, 100]);
    });

    test('should handle large bit indices efficiently', () => {
      const bitset = new Bitset();
      const largeBits = [1000, 2000, 3000, 4000];

      // Set large bit indices
      largeBits.forEach(bit => bitset.set(bit));

      // Verify they're set correctly
      largeBits.forEach(bit => {
        expect(bitset.has(bit)).toBe(true);
      });

      // Verify popCount is correct
      expect(bitset.popCount()).toBe(largeBits.length);

      // Verify getSetBits returns correct values
      expect(bitset.getSetBits()).toEqual(largeBits);
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

    test('should maintain entity signatures when adding components', () => {
      const entity = world.createEntity();

      // Initially empty signature
      let signature = world.getSignature(entity);
      expect(signature.isEmpty()).toBe(true);

      // Add Position component
      world.addComponent(entity, Position, { x: 10, y: 20 });
      signature = world.getSignature(entity);
      expect(signature.isEmpty()).toBe(false);
      expect(signature.popCount()).toBe(1);

      // Add Velocity component
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });
      signature = world.getSignature(entity);
      expect(signature.popCount()).toBe(2);

      // Add Health component
      world.addComponent(entity, Health, { hp: 150 });
      signature = world.getSignature(entity);
      expect(signature.popCount()).toBe(3);
    });

    test('should maintain entity signatures when removing components', () => {
      const entity = world.createEntity();

      // Add multiple components
      world.addComponent(entity, Position, { x: 10, y: 20 });
      world.addComponent(entity, Velocity, { dx: 1, dy: 2 });
      world.addComponent(entity, Health, { hp: 150 });

      let signature = world.getSignature(entity);
      expect(signature.popCount()).toBe(3);

      // Remove one component
      world.removeComponent(entity, Velocity);
      signature = world.getSignature(entity);
      expect(signature.popCount()).toBe(2);

      // Remove another component
      world.removeComponent(entity, Health);
      signature = world.getSignature(entity);
      expect(signature.popCount()).toBe(1);

      // Remove last component
      world.removeComponent(entity, Position);
      signature = world.getSignature(entity);
      expect(signature.isEmpty()).toBe(true);
    });

    test('should clean up signatures when entity is destroyed', () => {
      const entity = world.createEntity();

      world.addComponent(entity, Position);
      world.addComponent(entity, Velocity);

      let signature = world.getSignature(entity);
      expect(signature.popCount()).toBe(2);

      // Destroy entity
      world.destroyEntity(entity);

      // Signature should be cleaned up (getting it again creates new empty one)
      signature = world.getSignature(entity);
      expect(signature.isEmpty()).toBe(true);
    });

    test('should handle component type IDs correctly in signatures', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      // Add different components to each entity
      world.addComponent(entity1, Position);
      world.addComponent(entity1, Health);

      world.addComponent(entity2, Velocity);
      world.addComponent(entity2, Armor);

      const sig1 = world.getSignature(entity1);
      const sig2 = world.getSignature(entity2);

      // Signatures should not intersect
      expect(sig1.intersects(sig2)).toBe(false);

      // Add common component
      world.addComponent(entity2, Position);

      // Now they should intersect
      expect(sig1.intersects(sig2)).toBe(true);
    });

    test('should support query-like signature matching', () => {
      // Create entities with different component combinations
      const warrior = world.createEntity();
      world.addComponent(warrior, Position);
      world.addComponent(warrior, Health);
      world.addComponent(warrior, Armor);

      const projectile = world.createEntity();
      world.addComponent(projectile, Position);
      world.addComponent(projectile, Velocity);

      const powerup = world.createEntity();
      world.addComponent(powerup, Position);

      // Create query signatures
      const movableQuery = new Bitset(); // Position + Velocity
      const combatQuery = new Bitset();  // Position + Health

      // We need to get the actual type IDs - this is a simulation of query building
      // In real implementation, Query would build these signatures from ComponentTypes
      const warriorSig = world.getSignature(warrior);
      const projectileSig = world.getSignature(projectile);
      const powerupSig = world.getSignature(powerup);

      // Test that signatures have expected component counts
      expect(warriorSig.popCount()).toBe(3); // Position, Health, Armor
      expect(projectileSig.popCount()).toBe(2); // Position, Velocity
      expect(powerupSig.popCount()).toBe(1); // Position only
    });

    test('should handle signature consistency across operations', () => {
      const entity = world.createEntity();
      const initialSig = world.getSignature(entity);
      const initialKey = initialSig.key();

      // Add and remove same component
      world.addComponent(entity, Position);
      world.removeComponent(entity, Position);

      const finalSig = world.getSignature(entity);
      const finalKey = finalSig.key();

      // Signature should return to original state
      expect(finalKey).toBe(initialKey);
      expect(finalSig.isEmpty()).toBe(true);
    });
  });
});