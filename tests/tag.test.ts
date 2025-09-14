/**
 * Tests for tag system
 * 标签系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { tagId, getAllTags, __resetTagRegistry } from '../src/tag/TagRegistry';
import { TagStore } from '../src/tag/TagStore';

// Test components
class Position {
  x: number = 0;
  y: number = 0;
}

class Velocity {
  vx: number = 0;
  vy: number = 0;
}

describe('Tag System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    __resetTagRegistry();

    // Register components
    registerComponent(Position);
    registerComponent(Velocity);
  });

  describe('TagRegistry', () => {
    test('should assign unique IDs to tag names', () => {
      const id1 = tagId('enemy');
      const id2 = tagId('player');
      const id3 = tagId('enemy'); // Same name should return same ID

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(1); // Same as first
      expect(id1).not.toBe(id2);
    });

    test('should list all registered tags', () => {
      tagId('enemy');
      tagId('player');
      tagId('npc');

      const tags = getAllTags();
      expect(tags).toHaveLength(3);
      expect(tags).toContainEqual({ name: 'enemy', id: 1 });
      expect(tags).toContainEqual({ name: 'player', id: 2 });
      expect(tags).toContainEqual({ name: 'npc', id: 3 });
    });

    test('should reset registry', () => {
      tagId('enemy');
      tagId('player');

      expect(getAllTags()).toHaveLength(2);

      __resetTagRegistry();
      expect(getAllTags()).toHaveLength(0);

      // Next tag should start from 1 again
      const newId = tagId('newTag');
      expect(newId).toBe(1);
    });
  });

  describe('TagStore', () => {
    let store: TagStore;

    beforeEach(() => {
      store = new TagStore();
    });

    test('should add and check tags', () => {
      const entity = 1;
      const enemyTag = tagId('enemy');

      store.add(entity, enemyTag);
      expect(store.has(entity, enemyTag)).toBe(true);
      expect(store.has(entity, tagId('player'))).toBe(false);
    });

    test('should remove tags', () => {
      const entity = 1;
      const enemyTag = tagId('enemy');

      store.add(entity, enemyTag);
      expect(store.has(entity, enemyTag)).toBe(true);

      store.remove(entity, enemyTag);
      expect(store.has(entity, enemyTag)).toBe(false);
    });

    test('should handle multiple tags per entity', () => {
      const entity = 1;
      const enemyTag = tagId('enemy');
      const bossTag = tagId('boss');
      const flyingTag = tagId('flying');

      store.add(entity, enemyTag);
      store.add(entity, bossTag);
      store.add(entity, flyingTag);

      expect(store.has(entity, enemyTag)).toBe(true);
      expect(store.has(entity, bossTag)).toBe(true);
      expect(store.has(entity, flyingTag)).toBe(true);
    });

    test('should get all entity tags', () => {
      const entity = 1;
      const enemyTag = tagId('enemy');
      const bossTag = tagId('boss');

      store.add(entity, enemyTag);
      store.add(entity, bossTag);

      const tags = store.getEntityTags(entity);
      expect(tags).toHaveLength(2);
      expect(tags).toContain(enemyTag);
      expect(tags).toContain(bossTag);
    });

    test('should clear all entity tags', () => {
      const entity = 1;
      store.add(entity, tagId('enemy'));
      store.add(entity, tagId('boss'));

      expect(store.getEntityTags(entity)).toHaveLength(2);

      store.clearEntity(entity);
      expect(store.getEntityTags(entity)).toHaveLength(0);
    });

    test('should get entities with specific tag', () => {
      const entity1 = 1;
      const entity2 = 2;
      const entity3 = 3;
      const enemyTag = tagId('enemy');
      const playerTag = tagId('player');

      store.add(entity1, enemyTag);
      store.add(entity2, enemyTag);
      store.add(entity3, playerTag);

      const enemies = store.getEntitiesWithTag(enemyTag);
      expect(enemies).toHaveLength(2);
      expect(enemies).toContain(entity1);
      expect(enemies).toContain(entity2);
      expect(enemies).not.toContain(entity3);
    });
  });

  describe('World Tag Integration', () => {
    test('should add and check tags on entities', () => {
      const entity = world.createEntity();

      world.addTag(entity, 'enemy');
      expect(world.hasTag(entity, 'enemy')).toBe(true);
      expect(world.hasTag(entity, 'player')).toBe(false);
    });

    test('should remove tags from entities', () => {
      const entity = world.createEntity();

      world.addTag(entity, 'enemy');
      expect(world.hasTag(entity, 'enemy')).toBe(true);

      world.removeTag(entity, 'enemy');
      expect(world.hasTag(entity, 'enemy')).toBe(false);
    });

    test('should get all entity tag names', () => {
      const entity = world.createEntity();

      world.addTag(entity, 'enemy');
      world.addTag(entity, 'boss');
      world.addTag(entity, 'flying');

      const tags = world.getEntityTags(entity);
      expect(tags).toHaveLength(3);
      expect(tags).toContain('enemy');
      expect(tags).toContain('boss');
      expect(tags).toContain('flying');
    });

    test('should clear all entity tags', () => {
      const entity = world.createEntity();

      world.addTag(entity, 'enemy');
      world.addTag(entity, 'boss');

      expect(world.getEntityTags(entity)).toHaveLength(2);

      world.clearEntityTags(entity);
      expect(world.getEntityTags(entity)).toHaveLength(0);
    });

    test('should get entities with specific tag', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      const entity3 = world.createEntity();

      world.addTag(entity1, 'enemy');
      world.addTag(entity2, 'enemy');
      world.addTag(entity3, 'player');

      const enemies = world.getEntitiesWithTag('enemy');
      expect(enemies).toHaveLength(2);
      expect(enemies).toContain(entity1);
      expect(enemies).toContain(entity2);
      expect(enemies).not.toContain(entity3);
    });
  });

  describe('Query with Tag Filtering', () => {
    test('should filter by required tags', () => {
      const enemy1 = world.createEntity();
      const enemy2 = world.createEntity();
      const player = world.createEntity();

      // Add components
      world.addComponent(enemy1, Position, { x: 10, y: 20 });
      world.addComponent(enemy2, Position, { x: 30, y: 40 });
      world.addComponent(player, Position, { x: 50, y: 60 });

      // Add tags
      world.addTag(enemy1, 'enemy');
      world.addTag(enemy2, 'enemy');
      world.addTag(player, 'player');

      // Query entities with Position component and 'enemy' tag
      const results: Array<{ entity: number; pos: Position }> = [];
      world.query(Position).where(['enemy']).forEach((entity, pos) => {
        results.push({ entity, pos: pos as Position });
      });

      expect(results).toHaveLength(2);
      expect(results.some(r => r.entity === enemy1)).toBe(true);
      expect(results.some(r => r.entity === enemy2)).toBe(true);
      expect(results.some(r => r.entity === player)).toBe(false);
    });

    test('should filter by forbidden tags', () => {
      const enemy1 = world.createEntity();
      const boss = world.createEntity();
      const player = world.createEntity();

      // Add components
      world.addComponent(enemy1, Position);
      world.addComponent(boss, Position);
      world.addComponent(player, Position);

      // Add tags
      world.addTag(enemy1, 'enemy');
      world.addTag(boss, 'enemy');
      world.addTag(boss, 'boss');
      world.addTag(player, 'player');

      // Query entities with Position but forbid 'boss' tag
      const results: number[] = [];
      world.query(Position).where([], ['boss']).forEach((entity) => {
        results.push(entity);
      });

      expect(results).toHaveLength(2);
      expect(results).toContain(enemy1);
      expect(results).toContain(player);
      expect(results).not.toContain(boss);
    });

    test('should combine required and forbidden tag filters', () => {
      const regularEnemy = world.createEntity();
      const bossEnemy = world.createEntity();
      const flyingEnemy = world.createEntity();
      const player = world.createEntity();

      // Add components
      world.addComponent(regularEnemy, Position);
      world.addComponent(bossEnemy, Position);
      world.addComponent(flyingEnemy, Position);
      world.addComponent(player, Position);

      // Add tags
      world.addTag(regularEnemy, 'enemy');
      world.addTag(bossEnemy, 'enemy');
      world.addTag(bossEnemy, 'boss');
      world.addTag(flyingEnemy, 'enemy');
      world.addTag(flyingEnemy, 'flying');
      world.addTag(player, 'player');

      // Query enemies that are not bosses
      const results: number[] = [];
      world.query(Position).where(['enemy'], ['boss']).forEach((entity) => {
        results.push(entity);
      });

      expect(results).toHaveLength(2);
      expect(results).toContain(regularEnemy);
      expect(results).toContain(flyingEnemy);
      expect(results).not.toContain(bossEnemy);
      expect(results).not.toContain(player);
    });

    test('should work with component filters and tag filters together', () => {
      const movingEnemy = world.createEntity();
      const staticEnemy = world.createEntity();
      const movingPlayer = world.createEntity();

      // Add components
      world.addComponent(movingEnemy, Position);
      world.addComponent(movingEnemy, Velocity);
      world.addComponent(staticEnemy, Position);
      world.addComponent(movingPlayer, Position);
      world.addComponent(movingPlayer, Velocity);

      // Add tags
      world.addTag(movingEnemy, 'enemy');
      world.addTag(staticEnemy, 'enemy');
      world.addTag(movingPlayer, 'player');

      // Query moving enemies (have both Position and Velocity, and 'enemy' tag)
      const results: Array<{ entity: number; pos: Position; vel: Velocity }> = [];
      world.query(Position, Velocity).where(['enemy']).forEach((entity, pos, vel) => {
        results.push({ entity, pos: pos as Position, vel: vel as Velocity });
      });

      expect(results).toHaveLength(1);
      expect(results[0].entity).toBe(movingEnemy);
    });

    test('should handle empty tag filters', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();

      world.addComponent(entity1, Position);
      world.addComponent(entity2, Position);
      world.addTag(entity1, 'enemy');

      // Query with empty tag filters should behave like normal query
      const results: number[] = [];
      world.query(Position).where().forEach((entity) => {
        results.push(entity);
      });

      expect(results).toHaveLength(2);
      expect(results).toContain(entity1);
      expect(results).toContain(entity2);
    });
  });
});