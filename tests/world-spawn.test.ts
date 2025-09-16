import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { definePrefab } from '../src/prefab/Prefab';

class Position {
  constructor(public x = 0, public y = 0) {}
}

class Health {
  constructor(public value = 100) {}
}

describe('World.spawn', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it('should spawn multiple entities with prefab', () => {
    const prefab = definePrefab('TestPrefab', {
      comps: [
        { ctor: Position, defaults: { x: 10, y: 20 } },
        { ctor: Health, defaults: { value: 100 } }
      ],
      tags: ['Enemy']
    });

    const entities = world.spawn(prefab, { count: 5 });

    expect(entities).toHaveLength(5);

    entities.forEach(entity => {
      expect(world.hasComponent(entity, Position)).toBe(true);
      expect(world.hasComponent(entity, Health)).toBe(true);
      expect(world.hasTag(entity, 'Enemy')).toBe(true);

      const pos = world.getComponent(entity, Position);
      const health = world.getComponent(entity, Health);
      expect(pos?.x).toBe(10);
      expect(pos?.y).toBe(20);
      expect(health?.value).toBe(100);
    });
  });

  it('should apply overrides correctly', () => {
    const prefab = definePrefab('OverridePrefab', {
      comps: [
        { ctor: Position, defaults: { x: 0, y: 0 } }
      ]
    });

    const entities = world.spawn(prefab, {
      count: 3,
      overrides: {
        shared: { Position: { x: 100 } },
        perEntity: [
          { Position: { y: 1 } },
          { Position: { y: 2 } },
          { Position: { y: 3 } }
        ]
      }
    });

    entities.forEach((entity, i) => {
      const pos = world.getComponent(entity, Position);
      expect(pos?.x).toBe(100); // shared override
      expect(pos?.y).toBe(i + 1); // per-entity override
    });
  });

  it('should add additional tags', () => {
    const prefab = definePrefab('TagPrefab', {
      comps: [{ ctor: Position, defaults: {} }],
      tags: ['Base']
    });

    const entities = world.spawn(prefab, {
      count: 2,
      tags: ['Extra', 'Special']
    });

    entities.forEach(entity => {
      expect(world.hasTag(entity, 'Base')).toBe(true);
      expect(world.hasTag(entity, 'Extra')).toBe(true);
      expect(world.hasTag(entity, 'Special')).toBe(true);
    });
  });
});