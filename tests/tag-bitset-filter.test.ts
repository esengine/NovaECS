import { World } from '../src/core/World';
import { TagBitSet, TagMaskManager } from '../src/core/TagBitSet';
import { describe, it, expect, beforeEach } from 'vitest';

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

describe('Tag BitSet Filtering', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('TagBitSet basic operations', () => {
    it('should set and clear bits correctly', () => {
      const bitSet = new TagBitSet();

      expect(bitSet.hasBit(0)).toBe(false);
      expect(bitSet.hasBit(5)).toBe(false);

      bitSet.setBit(0);
      bitSet.setBit(5);
      bitSet.setBit(63); // Cross word boundary

      expect(bitSet.hasBit(0)).toBe(true);
      expect(bitSet.hasBit(5)).toBe(true);
      expect(bitSet.hasBit(63)).toBe(true);
      expect(bitSet.hasBit(1)).toBe(false);

      bitSet.clearBit(5);
      expect(bitSet.hasBit(5)).toBe(false);
      expect(bitSet.hasBit(0)).toBe(true);
      expect(bitSet.hasBit(63)).toBe(true);
    });

    it('should handle containsAll correctly', () => {
      const entityBits = new TagBitSet();
      const requiredMask = new TagBitSet();

      entityBits.setBit(1);
      entityBits.setBit(3);
      entityBits.setBit(5);

      requiredMask.setBit(1);
      requiredMask.setBit(3);

      expect(entityBits.containsAll(requiredMask)).toBe(true);

      requiredMask.setBit(7); // Add bit not in entity
      expect(entityBits.containsAll(requiredMask)).toBe(false);
    });

    it('should handle hasAny correctly', () => {
      const entityBits = new TagBitSet();
      const forbiddenMask = new TagBitSet();

      entityBits.setBit(1);
      entityBits.setBit(3);

      forbiddenMask.setBit(2);
      forbiddenMask.setBit(4);

      expect(entityBits.hasAny(forbiddenMask)).toBe(false);

      forbiddenMask.setBit(3); // Add overlapping bit
      expect(entityBits.hasAny(forbiddenMask)).toBe(true);
    });
  });

  describe('TagMaskManager', () => {
    it('should assign unique bit indices for tags', () => {
      const manager = new TagMaskManager();

      const playerBit = manager.getBitIndex('Player');
      const enemyBit = manager.getBitIndex('Enemy');
      const activeBit = manager.getBitIndex('Active');

      expect(playerBit).not.toBe(enemyBit);
      expect(enemyBit).not.toBe(activeBit);
      expect(activeBit).not.toBe(playerBit);

      // Should return same bit for same tag
      expect(manager.getBitIndex('Player')).toBe(playerBit);
    });

    it('should create masks correctly', () => {
      const manager = new TagMaskManager();

      const mask = manager.createMask(['Player', 'Active']);
      const playerBit = manager.getBitIndex('Player');
      const activeBit = manager.getBitIndex('Active');
      const enemyBit = manager.getBitIndex('Enemy');

      expect(mask.hasBit(playerBit)).toBe(true);
      expect(mask.hasBit(activeBit)).toBe(true);
      expect(mask.hasBit(enemyBit)).toBe(false);
    });
  });

  describe('World tag bit set integration', () => {
    it('should maintain tag bit sets when adding/removing tags', () => {
      const entity = world.createEntity();

      // Initially no tags
      expect(world.getEntityTagBits(entity)).toBeUndefined();

      // Add tags
      world.addTag(entity, 'Player');
      world.addTag(entity, 'Active');

      const entityBits = world.getEntityTagBits(entity);
      expect(entityBits).toBeDefined();

      const manager = world.getTagMaskManager();
      const playerBit = manager.getBitIndex('Player');
      const activeBit = manager.getBitIndex('Active');
      const enemyBit = manager.getBitIndex('Enemy');

      expect(entityBits!.hasBit(playerBit)).toBe(true);
      expect(entityBits!.hasBit(activeBit)).toBe(true);
      expect(entityBits!.hasBit(enemyBit)).toBe(false);

      // Remove tag
      world.removeTag(entity, 'Active');
      expect(entityBits!.hasBit(playerBit)).toBe(true);
      expect(entityBits!.hasBit(activeBit)).toBe(false);

      // Clear all tags
      world.clearEntityTags(entity);
      expect(entityBits!.hasBit(playerBit)).toBe(false);
    });
  });

  describe('Query tag bit set filtering', () => {
    it('should filter entities using bit sets - required tags', () => {
      // Create entities with different tag combinations
      const player1 = world.createEntity();
      world.addComponent(player1, Position, { x: 10, y: 20 });
      world.addTag(player1, 'Player');
      world.addTag(player1, 'Active');

      const player2 = world.createEntity();
      world.addComponent(player2, Position, { x: 30, y: 40 });
      world.addTag(player2, 'Player');
      // No Active tag

      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 50, y: 60 });
      world.addTag(enemy, 'Enemy');
      world.addTag(enemy, 'Active');

      const results: number[] = [];

      // Query for Active Players only
      world.query(Position)
        .where(['Player', 'Active'], [])
        .forEach((entity) => {
          results.push(entity);
        });

      expect(results).toHaveLength(1);
      expect(results).toContain(player1);
      expect(results).not.toContain(player2);
      expect(results).not.toContain(enemy);
    });

    it('should filter entities using bit sets - forbidden tags', () => {
      const player = world.createEntity();
      world.addComponent(player, Position, { x: 10, y: 20 });
      world.addTag(player, 'Player');

      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 30, y: 40 });
      world.addTag(enemy, 'Enemy');

      const deadPlayer = world.createEntity();
      world.addComponent(deadPlayer, Position, { x: 50, y: 60 });
      world.addTag(deadPlayer, 'Player');
      world.addTag(deadPlayer, 'Dead');

      const results: number[] = [];

      // Query for entities without Dead tag
      world.query(Position)
        .where([], ['Dead'])
        .forEach((entity) => {
          results.push(entity);
        });

      expect(results).toHaveLength(2);
      expect(results).toContain(player);
      expect(results).toContain(enemy);
      expect(results).not.toContain(deadPlayer);
    });

    it('should handle complex tag combinations', () => {
      const alivePlayer = world.createEntity();
      world.addComponent(alivePlayer, Position, { x: 10, y: 20 });
      world.addTag(alivePlayer, 'Player');
      world.addTag(alivePlayer, 'Alive');

      const deadPlayer = world.createEntity();
      world.addComponent(deadPlayer, Position, { x: 30, y: 40 });
      world.addTag(deadPlayer, 'Player');
      world.addTag(deadPlayer, 'Dead');

      const aliveEnemy = world.createEntity();
      world.addComponent(aliveEnemy, Position, { x: 50, y: 60 });
      world.addTag(aliveEnemy, 'Enemy');
      world.addTag(aliveEnemy, 'Alive');

      const results: number[] = [];

      // Query for alive players (require Player + Alive, forbid Dead)
      world.query(Position)
        .where(['Player', 'Alive'], ['Dead'])
        .forEach((entity) => {
          results.push(entity);
        });

      expect(results).toHaveLength(1);
      expect(results).toContain(alivePlayer);
    });

    it('should work with forEachRaw and bit set filtering', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });
      world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });
      world.addTag(entity1, 'Moving');

      const entity2 = world.createEntity();
      world.addComponent(entity2, Position, { x: 30, y: 40 });
      world.addComponent(entity2, Velocity, { dx: 0, dy: 0 });
      world.addTag(entity2, 'Static');

      let movingEntityCount = 0;

      world.query(Position, Velocity)
        .where(['Moving'], [])
        .forEachRaw((row, entities, cols) => {
          movingEntityCount++;
          const entity = entities[row];
          const position = cols[0].readToObject(row);
          const velocity = cols[1].readToObject(row);

          expect(entity).toBe(entity1);
          expect(position.x).toBe(10);
          expect(velocity.dx).toBe(1);
        });

      expect(movingEntityCount).toBe(1);
    });

    it('should perform better than string-based tag filtering', () => {
      // Create many entities with tags
      const entityCount = 1000;
      const entities: number[] = [];

      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });

        if (i % 2 === 0) world.addTag(entity, 'Even');
        if (i % 3 === 0) world.addTag(entity, 'DivisibleBy3');
        if (i % 5 === 0) world.addTag(entity, 'DivisibleBy5');

        entities.push(entity);
      }

      // Measure query performance (entities divisible by 2 and 3, not by 5)
      const start = performance.now();

      const results: number[] = [];
      world.query(Position)
        .where(['Even', 'DivisibleBy3'], ['DivisibleBy5'])
        .forEach((entity) => {
          results.push(entity);
        });

      const end = performance.now();
      const duration = end - start;

      // Should find entities divisible by 6 but not by 5
      const expectedResults = entities.filter((_entity, i) =>
        i % 6 === 0 && i % 5 !== 0
      );

      expect(results).toHaveLength(expectedResults.length);
      expect(duration).toBeLessThan(50); // Should be fast with bit operations

      console.log(`Tag filtering took ${duration.toFixed(2)}ms for ${entityCount} entities`);
    });
  });
});