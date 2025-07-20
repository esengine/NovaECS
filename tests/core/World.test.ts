import { describe, test, beforeEach, expect } from 'vitest';
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

  test('should support enhanced query builder API', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    const entity3 = world.createEntity();

    entity1.addComponent(new TestComponent(10));
    entity1.addComponent(new AnotherComponent('test1'));

    entity2.addComponent(new TestComponent(5));

    entity3.addComponent(new AnotherComponent('test3'));

    // Test fluent query API
    const result = world.query()
      .with(TestComponent)
      .without(AnotherComponent)
      .execute();

    expect(result).toHaveLength(1);
    expect(result).toContain(entity2);
  });

  test('should support query with criteria and options', () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    entity1.addComponent(new TestComponent(10));
    entity2.addComponent(new TestComponent(5));

    const result = world.queryWithCriteria(
      { all: [TestComponent] },
      {
        filter: entity => {
          const comp = entity.getComponent(TestComponent);
          return comp ? comp.value > 7 : false;
        }
      }
    );

    expect(result.entities).toHaveLength(1);
    expect(result.entities).toContain(entity1);
    expect(result.fromCache).toBe(false);
    expect(result.totalCount).toBe(1);
  });

  test('should provide query statistics', () => {
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(10));

    // Execute some queries
    world.query().with(TestComponent).execute();
    world.query().with(TestComponent).execute(); // Should be cached

    const stats = world.getQueryStatistics();
    expect(stats.totalQueries).toBeGreaterThan(0);
  });

  test('should support query cache management', () => {
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(10));

    // Execute query to populate cache
    world.query().with(TestComponent).execute();

    // Clear cache
    world.clearQueryCache();

    // Configure cache
    world.configureQueryCache({ maxSize: 50 });

    // These should not throw
    expect(() => world.clearQueryCache()).not.toThrow();
    expect(() => world.configureQueryCache({ ttl: 5000 })).not.toThrow();
  });

  test('should support performance monitoring', () => {
    world.setQueryPerformanceMonitoring(true);
    world.setQueryPerformanceMonitoring(false);

    // Should not throw
    expect(() => world.setQueryPerformanceMonitoring(true)).not.toThrow();
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

  test('should update systems with matching entities', async () => {
    const system = new TestSystem();
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));

    world.addSystem(system);
    world.update(16);

    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 10));

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

  test('should clean up destroyed entities', async () => {
    const entity = world.createEntity();
    entity.destroy();

    world.update(16);

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 10));

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

  test('should handle parallel execution by default', async () => {
    const system = new TestSystem();
    world.addSystem(system);

    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));

    world.update(16);

    // Wait a bit for async execution to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(system.updateCalled).toBe(true);
    expect(system.updatedEntities).toContain(entity);
  });



  test('should handle system lifecycle methods', async () => {
    class LifecycleSystem extends TestSystem {
      preUpdate(deltaTime: number): void {
        super.preUpdate(deltaTime);
      }

      postUpdate(deltaTime: number): void {
        super.postUpdate(deltaTime);
      }
    }

    const system = new LifecycleSystem();
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));

    world.addSystem(system);
    world.update(16);

    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(system.preUpdateCalled).toBe(true);
    expect(system.postUpdateCalled).toBe(true);
  });

  test('should handle addEntity method', () => {
    const entity = new Entity(999);
    world.addEntity(entity);

    expect(world.getEntity(999)).toBe(entity);
    expect(world.entities).toContain(entity);
  });

  test('should handle system removal by instance', () => {
    const system1 = new TestSystem();
    const system2 = new TestSystem();

    world.addSystem(system1);
    world.addSystem(system2);

    expect(world.systems).toHaveLength(2);

    world.removeSystem(system1);

    expect(world.systems).toHaveLength(1);
    expect(world.systems).toContain(system2);
    expect(world.systems).not.toContain(system1);
  });

  test('should handle system removal and cleanup', () => {
    const system = new TestSystem();
    world.addSystem(system);

    expect(world.systems).toContain(system);
    expect(world.getSystem(TestSystem)).toBe(system);

    world.removeSystem(system);

    expect(world.systems).not.toContain(system);
    expect(world.getSystem(TestSystem)).toBeUndefined();
  });

  test('should handle entity destruction during update', async () => {
    class DestroyingSystem extends System {
      constructor() {
        super([TestComponent]);
      }

      update(entities: Entity[], _deltaTime: number): void {
        for (const entity of entities) {
          entity.destroy();
        }
      }
    }

    const system = new DestroyingSystem();
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    entity1.addComponent(new TestComponent(1));
    entity2.addComponent(new TestComponent(2));

    world.addSystem(system);
    world.update(16);

    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(world.getEntity(entity1.id)).toBeUndefined();
    expect(world.getEntity(entity2.id)).toBeUndefined();
  });

  test('should handle paused state correctly', async () => {
    const system = new TestSystem();
    world.addSystem(system);

    world.paused = false;
    world.update(16);

    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(system.updateCalled).toBe(true);

    system.updateCalled = false;
    world.paused = true;
    world.update(16);

    // Wait a bit to ensure paused systems don't execute
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(system.updateCalled).toBe(false);
  });

  test('should handle empty world updates', () => {
    expect(() => world.update(16)).not.toThrow();
  });

  test('should handle systems without lifecycle methods', async () => {
    class SimpleSystem extends System {
      public updateCalled = false;

      constructor() {
        super([TestComponent]);
      }

      update(_entities: Entity[], _deltaTime: number): void {
        this.updateCalled = true;
      }
    }

    const system = new SimpleSystem();
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));

    world.addSystem(system);
    world.update(16);

    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(system.updateCalled).toBe(true);
  });

  test('should provide scheduler statistics', () => {
    const system1 = new TestSystem();
    const system2 = new TestSystem();

    world.addSystem(system1);
    world.addSystem(system2);

    const stats = world.getSchedulerStatistics();
    expect(stats.totalSystems).toBe(2);
    expect(stats.totalGroups).toBeGreaterThan(0);
    expect(stats.groupDetails).toBeDefined();
  });

  test('should provide execution groups for debugging', () => {
    const system = new TestSystem();
    world.addSystem(system);

    const groups = world.getExecutionGroups();
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveProperty('systems');
    expect(groups[0]).toHaveProperty('level');
  });

  test('should handle systems with dependencies correctly', async () => {
    class ReadSystem extends System {
      public updateCalled = false;
      public updatedEntities: Entity[] = [];

      constructor() {
        super([TestComponent], [
          { componentType: TestComponent as any, accessType: 'read' as any }
        ]);
      }

      update(entities: Entity[], _deltaTime: number): void {
        this.updateCalled = true;
        this.updatedEntities = entities;
      }
    }

    class WriteSystem extends System {
      public updateCalled = false;
      public updatedEntities: Entity[] = [];

      constructor() {
        super([TestComponent], [
          { componentType: TestComponent as any, accessType: 'write' as any }
        ]);
      }

      update(entities: Entity[], _deltaTime: number): void {
        this.updateCalled = true;
        this.updatedEntities = entities;
      }
    }

    const readSystem = new ReadSystem();
    const writeSystem = new WriteSystem();

    world.addSystem(readSystem);
    world.addSystem(writeSystem);

    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));

    world.update(16);

    // Wait for async execution
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(readSystem.updateCalled).toBe(true);
    expect(writeSystem.updateCalled).toBe(true);

    // Check that they were scheduled in different groups due to conflict
    const groups = world.getExecutionGroups();
    const readGroup = groups.find(g => g.systems.includes(readSystem));
    const writeGroup = groups.find(g => g.systems.includes(writeSystem));

    // They should be in different groups due to read/write conflict
    expect(readGroup).not.toBe(writeGroup);
  });

  test('should handle archetype storage correctly', async () => {
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();

    // Add different component combinations
    entity1.addComponent(new TestComponent(1));
    entity2.addComponent(new TestComponent(2));
    entity2.addComponent(new AnotherComponent('test'));

    // Verify entities are in different archetypes
    const stats = world.getArchetypeStatistics();
    expect(stats.archetypeCount).toBe(2);
    expect(stats.totalEntities).toBe(2);
  });

  test('should optimize queries with archetype storage', () => {
    // Create entities with different component combinations
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    const entity3 = world.createEntity();

    entity1.addComponent(new TestComponent(1));
    entity2.addComponent(new TestComponent(2));
    entity2.addComponent(new AnotherComponent('test'));
    entity3.addComponent(new AnotherComponent('test3'));

    // Query for entities with TestComponent
    const testEntities = world.queryEntities(TestComponent);
    expect(testEntities).toHaveLength(2);
    expect(testEntities).toContain(entity1);
    expect(testEntities).toContain(entity2);
    expect(testEntities).not.toContain(entity3);

    // Query for entities with both components
    const bothEntities = world.queryEntities(TestComponent, AnotherComponent);
    expect(bothEntities).toHaveLength(1);
    expect(bothEntities).toContain(entity2);
  });

  test('should handle entity component changes with archetype migration', () => {
    const entity = world.createEntity();
    entity.addComponent(new TestComponent(42));

    // Verify initial archetype
    let stats = world.getArchetypeStatistics();
    expect(stats.archetypeCount).toBe(1);

    // Add another component (should migrate to new archetype)
    entity.addComponent(new AnotherComponent('test'));

    // Verify new archetype
    stats = world.getArchetypeStatistics();
    expect(stats.archetypeCount).toBe(2);

    // Remove component (should migrate back)
    entity.removeComponent(AnotherComponent);

    // Verify archetype change
    const finalEntities = world.queryEntities(TestComponent);
    expect(finalEntities).toContain(entity);

    const bothEntities = world.queryEntities(TestComponent, AnotherComponent);
    expect(bothEntities).not.toContain(entity);
  });

  test('should handle addEntity with archetype configuration', () => {
    const externalEntity = new Entity(999);
    externalEntity.addComponent(new TestComponent(999));
    externalEntity.addComponent(new AnotherComponent('external'));

    world.addEntity(externalEntity);

    // Verify entity is properly configured for archetype storage
    const component = externalEntity.getComponent(TestComponent);
    expect(component).toBeDefined();
    expect((component as TestComponent).value).toBe(999);

    // Verify entity appears in queries
    const entities = world.queryEntities(TestComponent, AnotherComponent);
    expect(entities).toContain(externalEntity);
  });

  test('should provide detailed archetype statistics', () => {
    // Create entities with various component combinations
    for (let i = 1; i <= 5; i++) {
      const entity = world.createEntity();
      entity.addComponent(new TestComponent(i));
    }

    for (let i = 6; i <= 8; i++) {
      const entity = world.createEntity();
      entity.addComponent(new TestComponent(i));
      entity.addComponent(new AnotherComponent(`test${i}`));
    }

    const stats = world.getArchetypeStatistics();
    expect(stats.archetypeCount).toBe(2);
    expect(stats.totalEntities).toBe(8);
    expect(stats.averageEntitiesPerArchetype).toBe(4);
    expect(stats.largestArchetype).toBeDefined();
    expect(stats.largestArchetype!.entityCount).toBe(5);
  });

  test('should handle complex parallel execution with archetype queries', async () => {
    class ArchetypeTestSystem extends System {
      public processedEntities: Entity[] = [];

      constructor() {
        super([TestComponent]);
      }

      update(entities: Entity[], _deltaTime: number): void {
        this.processedEntities = [...entities];
      }
    }

    const system = new ArchetypeTestSystem();
    world.addSystem(system);

    // Create entities in different archetypes
    const entities: Entity[] = [];
    for (let i = 1; i <= 10; i++) {
      const entity = world.createEntity();
      entity.addComponent(new TestComponent(i));
      if (i % 2 === 0) {
        entity.addComponent(new AnotherComponent(`test${i}`));
      }
      entities.push(entity);
    }

    world.update(16);
    await new Promise(resolve => setTimeout(resolve, 20));

    // System should process all entities with TestComponent
    expect(system.processedEntities).toHaveLength(10);
    entities.forEach(entity => {
      expect(system.processedEntities).toContain(entity);
    });
  });

  test('should handle scheduler statistics with archetype systems', () => {
    class ArchetypeSystem1 extends System {
      constructor() {
        super([TestComponent]);
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    class ArchetypeSystem2 extends System {
      constructor() {
        super([AnotherComponent]);
      }
      update(_entities: Entity[], _deltaTime: number): void {}
    }

    world.addSystem(new ArchetypeSystem1());
    world.addSystem(new ArchetypeSystem2());

    const stats = world.getSchedulerStatistics();
    expect(stats.totalSystems).toBe(2);
    expect(stats.totalGroups).toBeGreaterThan(0);
    expect(stats.groupDetails).toHaveLength(stats.totalGroups);
  });
});