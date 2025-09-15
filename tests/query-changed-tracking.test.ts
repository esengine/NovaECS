import { World } from '../src/core/World';
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

describe('Query Change Tracking', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('changed() filtering with real change detection', () => {
    it('should only return entities with changed components', () => {
      // Create test entities
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });
      world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

      const entity2 = world.createEntity();
      world.addComponent(entity2, Position, { x: 30, y: 40 });
      world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

      const entity3 = world.createEntity();
      world.addComponent(entity3, Position, { x: 50, y: 60 });
      world.addComponent(entity3, Velocity, { dx: 5, dy: 6 });

      // Begin new frame to reset change tracking
      world.beginFrame();

      // Modify only entity2's position
      world.setComponent(entity2, Position, { x: 35, y: 45 });

      // Query for entities with changed Position
      const changedEntities: number[] = [];
      world.query(Position, Velocity)
        .changed(Position)
        .forEach((entity) => {
          changedEntities.push(entity);
        });

      // Only entity2 should be returned since only its position changed
      expect(changedEntities).toHaveLength(1);
      expect(changedEntities).toContain(entity2);
    });

    it('should handle multiple changed components', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });
      world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

      const entity2 = world.createEntity();
      world.addComponent(entity2, Position, { x: 30, y: 40 });
      world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

      world.beginFrame();

      // Modify both Position and Velocity for entity1
      world.setComponent(entity1, Position, { x: 15, y: 25 });
      world.setComponent(entity1, Velocity, { dx: 2, dy: 3 });

      // Modify only Velocity for entity2
      world.setComponent(entity2, Velocity, { dx: 4, dy: 5 });

      // Query for entities with changed Position OR Velocity (ANY semantic)
      const changedEntities: number[] = [];
      world.query(Position, Velocity)
        .changed(Position, Velocity)
        .forEach((entity) => {
          changedEntities.push(entity);
        });

      // Both entities should be returned
      expect(changedEntities).toHaveLength(2);
      expect(changedEntities).toContain(entity1);
      expect(changedEntities).toContain(entity2);
    });

    it('should work with chunk processing', () => {
      // Create many entities
      const entities: number[] = [];
      for (let i = 0; i < 100; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, Position, { x: i, y: i });
        world.addComponent(entity, Velocity, { dx: i, dy: i });
        entities.push(entity);
      }

      world.beginFrame();

      // Modify every 10th entity's position
      const modifiedEntities: number[] = [];
      for (let i = 0; i < entities.length; i += 10) {
        world.setComponent(entities[i], Position, { x: i + 1000, y: i + 1000 });
        modifiedEntities.push(entities[i]);
      }

      // Use toChunks with changed filter
      const chunks = world.query(Position, Velocity)
        .changed(Position)
        .toChunks(20);

      // Count entities in chunks
      const chunkEntities: number[] = [];
      chunks.forEach(chunk => {
        chunk.entities.forEach(entity => chunkEntities.push(entity));
      });

      // Should only have the modified entities
      expect(chunkEntities).toHaveLength(modifiedEntities.length);
      modifiedEntities.forEach(entity => {
        expect(chunkEntities).toContain(entity);
      });
    });

    it('should return empty result when no changes', () => {
      const entity1 = world.createEntity();
      world.addComponent(entity1, Position, { x: 10, y: 20 });
      world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

      const entity2 = world.createEntity();
      world.addComponent(entity2, Position, { x: 30, y: 40 });
      world.addComponent(entity2, Velocity, { dx: 3, dy: 4 });

      world.beginFrame();

      // Don't modify anything

      const changedEntities: number[] = [];
      world.query(Position, Velocity)
        .changed(Position)
        .forEach((entity) => {
          changedEntities.push(entity);
        });

      // Should be empty
      expect(changedEntities).toHaveLength(0);
    });

    it('should handle frame transitions correctly', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Position, { x: 10, y: 20 });

      world.beginFrame();
      world.setComponent(entity, Position, { x: 15, y: 25 });

      // Should find changed entity in current frame
      let changedEntities: number[] = [];
      world.query(Position)
        .changed(Position)
        .forEach((e) => changedEntities.push(e));
      expect(changedEntities).toHaveLength(1);

      world.beginFrame();

      // Should be empty in next frame (no new changes)
      changedEntities = [];
      world.query(Position)
        .changed(Position)
        .forEach((e) => changedEntities.push(e));
      expect(changedEntities).toHaveLength(0);

      // Make another change
      world.setComponent(entity, Position, { x: 20, y: 30 });

      // Should find changed entity again
      changedEntities = [];
      world.query(Position)
        .changed(Position)
        .forEach((e) => changedEntities.push(e));
      expect(changedEntities).toHaveLength(1);
    });
  });
});