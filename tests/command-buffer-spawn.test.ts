import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { CommandBuffer } from '../src/core/CommandBuffer';
import { definePrefab } from '../src/prefab/Prefab';

class Position {
  constructor(public x = 0, public y = 0) {}
}

class Health {
  constructor(public value = 100) {}
}

describe('CommandBuffer spawn integration', () => {
  let world: World;
  let cmdBuffer: CommandBuffer;

  beforeEach(() => {
    world = new World();
    cmdBuffer = new CommandBuffer(world);
  });

  it('should defer spawn commands until flush', () => {
    const prefab = definePrefab('TestPrefab', {
      comps: [
        { ctor: Position, defaults: { x: 10, y: 20 } },
        { ctor: Health, defaults: { value: 100 } }
      ],
      tags: ['Enemy']
    });

    // Before flush, no entities should exist
    expect(world.query(Position).count()).toBe(0);

    // Queue spawn command
    cmdBuffer.spawn(prefab, { count: 3 });

    // Still no entities before flush
    expect(world.query(Position).count()).toBe(0);

    // Flush commands
    cmdBuffer.flush();

    // Now entities should exist
    expect(world.query(Position).count()).toBe(3);
    expect(world.query(Health).count()).toBe(3);

    // Verify component values
    world.query(Position, Health).forEach((entity, pos, health) => {
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);
      expect(health.value).toBe(100);
      expect(world.hasTag(entity, 'Enemy')).toBe(true);
    });
  });

  it('should handle multiple spawn commands in batch', () => {
    const prefab1 = definePrefab('Prefab1', {
      comps: [{ ctor: Position, defaults: { x: 1, y: 1 } }],
      tags: ['Type1']
    });

    const prefab2 = definePrefab('Prefab2', {
      comps: [{ ctor: Health, defaults: { value: 50 } }],
      tags: ['Type2']
    });

    // Queue multiple spawn commands
    cmdBuffer.spawn(prefab1, { count: 2 });
    cmdBuffer.spawn(prefab2, { count: 3 });

    cmdBuffer.flush();

    // Verify counts
    expect(world.query(Position).count()).toBe(2);
    expect(world.query(Health).count()).toBe(3);

    // Verify tags by checking entities with components
    let type1Count = 0;
    let type2Count = 0;

    world.query(Position).forEach((entity) => {
      if (world.hasTag(entity, 'Type1')) type1Count++;
    });

    world.query(Health).forEach((entity) => {
      if (world.hasTag(entity, 'Type2')) type2Count++;
    });

    expect(type1Count).toBe(2);
    expect(type2Count).toBe(3);
  });

  it('should apply spawns before other operations', () => {
    const prefab = definePrefab('BaseEntity', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0 } },
        { ctor: Health, defaults: { value: 100 } }
      ]
    });

    // Create an entity manually first
    const existingEntity = world.createEntity();
    world.addComponent(existingEntity, Position, { x: 999, y: 999 });

    // Queue spawn command and entity operation
    cmdBuffer.spawn(prefab, { count: 2 });
    cmdBuffer.add(existingEntity, Health, { value: 50 });

    cmdBuffer.flush();

    // Should have 3 entities total (1 existing + 2 spawned)
    expect(world.query(Position).count()).toBe(3);

    // Existing entity should have health added
    expect(world.hasComponent(existingEntity, Health)).toBe(true);
    expect(world.getComponent(existingEntity, Health)?.value).toBe(50);
  });

  it('should support spawn with overrides through command buffer', () => {
    const prefab = definePrefab('OverridePrefab', {
      comps: [{ ctor: Position, defaults: { x: 0, y: 0 } }]
    });

    cmdBuffer.spawn(prefab, {
      count: 2,
      overrides: {
        shared: { Position: { x: 100 } }
      },
      tags: ['Buffered']
    });

    cmdBuffer.flush();

    world.query(Position).forEach((entity, pos) => {
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(0);
      expect(world.hasTag(entity, 'Buffered')).toBe(true);
    });
  });

  it('should clear spawn commands after flush', () => {
    const prefab = definePrefab('ClearTest', {
      comps: [{ ctor: Position, defaults: {} }]
    });

    cmdBuffer.spawn(prefab, { count: 1 });
    cmdBuffer.flush();

    expect(world.query(Position).count()).toBe(1);

    // Second flush should not spawn more entities
    cmdBuffer.flush();
    expect(world.query(Position).count()).toBe(1);
  });
});