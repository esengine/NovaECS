import { System } from '../../src/core/System';
import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import { World } from '../../src/core/World';
import { AccessType } from '../../src/utils/AccessType';
import { beforeEach, describe, expect, test, vi } from 'vitest';

class TestComponent extends Component {
  constructor(public value: number = 0) {
    super();
  }
}

class AnotherComponent extends Component {
  constructor(public name: string = '') {
    super();
  }
}

class TestSystem extends System {
  public updateCalled = false;
  public updatedEntities: Entity[] = [];

  constructor() {
    super([TestComponent]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    this.updateCalled = true;
    this.updatedEntities = [...entities];
  }
}

describe('System', () => {
  let system: TestSystem;
  let world: World;

  beforeEach(() => {
    system = new TestSystem();
    world = new World();
  });

  test('should initialize with correct required components', () => {
    expect(system.requiredComponents).toEqual([TestComponent]);
  });

  test('should be enabled by default', () => {
    expect(system.enabled).toBe(true);
  });

  test('should allow setting enabled state', () => {
    system.enabled = false;
    expect(system.enabled).toBe(false);
  });

  test('should have default priority of 0', () => {
    expect(system.priority).toBe(0);
  });

  test('should allow setting priority', () => {
    system.priority = 10;
    expect(system.priority).toBe(10);
  });

  test('should match entity with required components', () => {
    const entity = new Entity(1);
    entity.addComponent(new TestComponent(42));
    
    expect(system.matchesEntity(entity)).toBe(true);
  });

  test('should not match entity without required components', () => {
    const entity = new Entity(1);
    entity.addComponent(new AnotherComponent('test'));
    
    expect(system.matchesEntity(entity)).toBe(false);
  });

  test('should not match inactive entity', () => {
    const entity = new Entity(1);
    entity.addComponent(new TestComponent(42));
    entity.active = false;
    
    expect(system.matchesEntity(entity)).toBe(false);
  });

  test('should set world when added to world', () => {
    system.onAddedToWorld(world);
    expect(system['world']).toBe(world);
  });

  test('should clear world when removed from world', () => {
    system.onAddedToWorld(world);
    system.onRemovedFromWorld();
    expect(system['world']).toBeUndefined();
  });

  test('should call update with matching entities', () => {
    const entities = [new Entity(1), new Entity(2)];
    entities[0].addComponent(new TestComponent(1));
    entities[1].addComponent(new TestComponent(2));
    
    system.update(entities, 16);
    
    expect(system.updateCalled).toBe(true);
    expect(system.updatedEntities).toEqual(entities);
  });

  test('should support lifecycle methods', () => {
    const preUpdateSpy = vi.fn();
    const postUpdateSpy = vi.fn();

    system.preUpdate = preUpdateSpy;
    system.postUpdate = postUpdateSpy;

    system.preUpdate?.(16);
    system.postUpdate?.(16);

    expect(preUpdateSpy).toHaveBeenCalledWith(16);
    expect(postUpdateSpy).toHaveBeenCalledWith(16);
  });

  test('should handle componentAccess property', () => {
    // Test system with componentAccess defined in constructor
    class ComponentAccessSystem extends System {
      constructor() {
        const componentAccess = [
          { componentType: TestComponent as any, accessType: AccessType.Read }
        ];
        super([TestComponent], componentAccess);
      }

      update(_entities: Entity[], _deltaTime: number): void {
        // Test implementation
      }
    }

    const system = new ComponentAccessSystem();
    expect(system.componentAccess).toHaveLength(1);
    expect(system.componentAccess[0].componentType).toBe(TestComponent);
    expect(system.componentAccess[0].accessType).toBe(AccessType.Read);

    // Test system with default empty componentAccess
    const defaultSystem = new TestSystem();
    expect(defaultSystem.componentAccess).toEqual([]);
  });

  test('should handle systems with multiple required components', () => {
    class MultiComponentSystem extends System {
      public updateCalled = false;

      constructor() {
        super([TestComponent, AnotherComponent]);
      }

      update(_entities: Entity[], _deltaTime: number): void {
        this.updateCalled = true;
      }
    }

    const system = new MultiComponentSystem();
    const entity1 = new Entity(1);
    const entity2 = new Entity(2);
    const entity3 = new Entity(3);

    // Entity with only one component
    entity1.addComponent(new TestComponent(42));

    // Entity with both components
    entity2.addComponent(new TestComponent(42));
    entity2.addComponent(new AnotherComponent('test'));

    // Entity with different component
    entity3.addComponent(new AnotherComponent('test'));

    expect(system.matchesEntity(entity1)).toBe(false);
    expect(system.matchesEntity(entity2)).toBe(true);
    expect(system.matchesEntity(entity3)).toBe(false);
  });

  test('should handle system with no required components', () => {
    class NoComponentSystem extends System {
      public updateCalled = false;

      constructor() {
        super([]);
      }

      update(_entities: Entity[], _deltaTime: number): void {
        this.updateCalled = true;
      }
    }

    const system = new NoComponentSystem();
    const entity = new Entity(1);

    // Should match any active entity regardless of components
    expect(system.matchesEntity(entity)).toBe(true);

    entity.active = false;
    expect(system.matchesEntity(entity)).toBe(false);
  });

  test('should handle priority comparison edge cases', () => {
    const system1 = new TestSystem();
    const system2 = new TestSystem();

    // Test negative priorities
    system1.priority = -5;
    system2.priority = -10;

    expect(system1.priority).toBe(-5);
    expect(system2.priority).toBe(-10);

    // Test zero priority
    system1.priority = 0;
    expect(system1.priority).toBe(0);

    // Test large priorities
    system1.priority = 1000000;
    expect(system1.priority).toBe(1000000);
  });

  test('should handle world reference correctly', () => {
    const system = new TestSystem();

    // Initially no world
    expect(system['world']).toBeUndefined();

    // Add to world
    system.onAddedToWorld(world);
    expect(system['world']).toBe(world);

    // Remove from world
    system.onRemovedFromWorld();
    expect(system['world']).toBeUndefined();

    // Add to different world
    const world2 = new World();
    system.onAddedToWorld(world2);
    expect(system['world']).toBe(world2);
  });
});