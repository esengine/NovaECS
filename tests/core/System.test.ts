import { System } from '../../src/core/System';
import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import { World } from '../../src/core/World';

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

  update(entities: Entity[], deltaTime: number): void {
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
    const preUpdateSpy = jest.fn();
    const postUpdateSpy = jest.fn();
    
    system.preUpdate = preUpdateSpy;
    system.postUpdate = postUpdateSpy;
    
    system.preUpdate?.(16);
    system.postUpdate?.(16);
    
    expect(preUpdateSpy).toHaveBeenCalledWith(16);
    expect(postUpdateSpy).toHaveBeenCalledWith(16);
  });
});