import { World } from '../../src/core/World';
import { Entity } from '../../src/core/Entity';
import { System } from '../../src/core/System';
import { Component } from '../../src/core/Component';

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
  public preUpdateCalled = false;
  public postUpdateCalled = false;

  constructor() {
    super([TestComponent]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    this.updateCalled = true;
    this.updatedEntities = [...entities];
  }

  preUpdate(_deltaTime: number): void {
    this.preUpdateCalled = true;
  }

  postUpdate(_deltaTime: number): void {
    this.postUpdateCalled = true;
  }
}

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  test('should create entities with incrementing IDs', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    
    expect(entity1.id).toBe(1);
    expect(entity2.id).toBe(2);
  });

  test('should add and retrieve entities', () => {
    const entity = world.createEntity();
    
    expect(world.getEntity(entity.id)).toBe(entity);
    expect(world.entities).toContain(entity);
  });

  test('should remove entities', () => {
    const entity = world.createEntity();
    world.removeEntity(entity);
    
    expect(world.getEntity(entity.id)).toBeUndefined();
    expect(world.entities).not.toContain(entity);
    expect(entity.active).toBe(false);
  });

  test('should remove entities by ID', () => {
    const entity = world.createEntity();
    const id = entity.id;
    world.removeEntity(id);
    
    expect(world.getEntity(id)).toBeUndefined();
  });

  test('should query entities with components', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    const entity3 = world.createEntity();
    
    entity1.addComponent(new TestComponent(1));
    entity2.addComponent(new TestComponent(2));
    entity3.addComponent(new AnotherComponent('test'));
    
    const result = world.queryEntities(TestComponent);
    
    expect(result).toHaveLength(2);
    expect(result).toContain(entity1);
    expect(result).toContain(entity2);
    expect(result).not.toContain(entity3);
  });

  test('should query entities with multiple components', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    
    entity1.addComponent(new TestComponent(1));
    entity1.addComponent(new AnotherComponent('test1'));
    entity2.addComponent(new TestComponent(2));
    
    const result = world.queryEntities(TestComponent, AnotherComponent);
    
    expect(result).toHaveLength(1);
    expect(result).toContain(entity1);
  });

  test('should query entities with filter', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    
    entity1.addComponent(new TestComponent(10));
    entity2.addComponent(new TestComponent(5));
    
    const result = world.queryEntitiesWithFilter(entity => {
      const comp = entity.getComponent(TestComponent);
      return comp ? comp.value > 7 : false;
    });
    
    expect(result).toHaveLength(1);
    expect(result).toContain(entity1);
  });

  test('should add and retrieve systems', () => {
    const system = new TestSystem();
    world.addSystem(system);
    
    expect(world.systems).toContain(system);
    expect(world.getSystem(TestSystem)).toBe(system);
  });

  test('should remove systems', () => {
    const system = new TestSystem();
    world.addSystem(system);
    world.removeSystem(system);
    
    expect(world.systems).not.toContain(system);
    expect(world.getSystem(TestSystem)).toBeUndefined();
  });

  test('should sort systems by priority', () => {
    const system1 = new TestSystem();
    const system2 = new TestSystem();
    
    system1.priority = 5;
    system2.priority = 10;
    
    world.addSystem(system1);
    world.addSystem(system2);
    
    expect(world.systems[0]).toBe(system2);
    expect(world.systems[1]).toBe(system1);
  });

  test('should update systems with matching entities', () => {
    const system = new TestSystem();
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));
    
    world.addSystem(system);
    world.update(16);
    
    expect(system.updateCalled).toBe(true);
    expect(system.updatedEntities).toContain(entity);
    expect(system.preUpdateCalled).toBe(true);
    expect(system.postUpdateCalled).toBe(true);
  });

  test('should not update disabled systems', () => {
    const system = new TestSystem();
    system.enabled = false;
    
    world.addSystem(system);
    world.update(16);
    
    expect(system.updateCalled).toBe(false);
  });

  test('should not update when paused', () => {
    const system = new TestSystem();
    world.addSystem(system);
    world.paused = true;
    
    world.update(16);
    
    expect(system.updateCalled).toBe(false);
  });

  test('should clean up destroyed entities', () => {
    const entity = world.createEntity();
    entity.destroy();
    
    world.update(16);
    
    expect(world.getEntity(entity.id)).toBeUndefined();
  });

  test('should clear all entities and systems', () => {
    const entity = world.createEntity();
    const system = new TestSystem();
    
    world.addSystem(system);
    world.clear();
    
    expect(world.entities).toHaveLength(0);
    expect(world.systems).toHaveLength(0);
    expect(entity.active).toBe(false);
  });

  test('should return correct counts', () => {
    world.createEntity();
    world.createEntity();
    world.addSystem(new TestSystem());
    
    expect(world.getEntityCount()).toBe(2);
    expect(world.getSystemCount()).toBe(1);
  });
});