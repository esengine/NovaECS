import { describe, beforeEach, test, expect } from 'vitest';
import { ArchetypeManager } from '../../src/core/ArchetypeManager';
import { Component } from '../../src/core/Component';
import { ComponentRegistry, registerComponent } from '../../src/core/ComponentRegistry';
import type { ComponentType, EntityId } from '../../src/utils/Types';

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

class ThirdComponent extends Component {
  constructor(public flag: boolean = false) {
    super();
  }
}

describe('ArchetypeManager', () => {
  let manager: ArchetypeManager;
  let registry: ComponentRegistry;
  let TestComponentType: ComponentType<TestComponent>;
  let AnotherComponentType: ComponentType<AnotherComponent>;
  let ThirdComponentType: ComponentType<ThirdComponent>;

  beforeEach(() => {
    registry = ComponentRegistry.getInstance();
    registry.clear();
    manager = new ArchetypeManager();

    TestComponentType = registerComponent(TestComponent, 'Test');
    AnotherComponentType = registerComponent(AnotherComponent, 'Another');
    ThirdComponentType = registerComponent(ThirdComponent, 'Third');
  });

  test('should create and retrieve archetypes', () => {
    const componentTypes = [TestComponentType, AnotherComponentType];
    const archetype = manager.getOrCreateArchetype(componentTypes);

    expect(archetype).toBeDefined();
    expect(archetype.componentTypes.size).toBe(2);
    expect(archetype.componentTypes.has(TestComponentType)).toBe(true);
    expect(archetype.componentTypes.has(AnotherComponentType)).toBe(true);
  });

  test('should return same archetype for same component types', () => {
    const componentTypes1 = [TestComponentType, AnotherComponentType];
    const componentTypes2 = [AnotherComponentType, TestComponentType]; // Different order

    const archetype1 = manager.getOrCreateArchetype(componentTypes1);
    const archetype2 = manager.getOrCreateArchetype(componentTypes2);

    expect(archetype1).toBe(archetype2);
  });

  test('should get archetype by ID', () => {
    const componentTypes = [TestComponentType];
    const archetype = manager.getOrCreateArchetype(componentTypes);
    const archetypeId = archetype.id;

    const retrievedArchetype = manager.getArchetype(archetypeId);
    expect(retrievedArchetype).toBe(archetype);
  });

  test('should return undefined for non-existent archetype ID', () => {
    const archetype = manager.getArchetype('non-existent-id');
    expect(archetype).toBeUndefined();
  });

  test('should get all archetypes', () => {
    const archetype1 = manager.getOrCreateArchetype([TestComponentType]);
    const archetype2 = manager.getOrCreateArchetype([AnotherComponentType]);
    const archetype3 = manager.getOrCreateArchetype([TestComponentType, AnotherComponentType]);

    const allArchetypes = manager.getAllArchetypes();
    expect(allArchetypes).toHaveLength(3);
    expect(allArchetypes).toContain(archetype1);
    expect(allArchetypes).toContain(archetype2);
    expect(allArchetypes).toContain(archetype3);
  });

  test('should add entity to appropriate archetype', () => {
    const entityId: EntityId = 1;
    const components = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(42)],
      [AnotherComponentType, new AnotherComponent('test')]
    ]);

    manager.addEntity(entityId, components);

    const archetype = manager.getEntityArchetype(entityId);
    expect(archetype).toBeDefined();
    expect(archetype!.componentTypes.size).toBe(2);
    expect(archetype!.entityCount).toBe(1);
  });

  test('should remove entity from archetype', () => {
    const entityId: EntityId = 1;
    const testComponent = new TestComponent(42);
    const anotherComponent = new AnotherComponent('test');
    const components = new Map<ComponentType, Component>([
      [TestComponentType, testComponent],
      [AnotherComponentType, anotherComponent]
    ]);

    manager.addEntity(entityId, components);

    const archetype = manager.getEntityArchetype(entityId);
    expect(archetype!.entityCount).toBe(1);

    const removedComponents = manager.removeEntity(entityId);

    expect(removedComponents).toBeDefined();
    expect(removedComponents!.get(TestComponentType)).toBe(testComponent);
    expect(removedComponents!.get(AnotherComponentType)).toBe(anotherComponent);
    expect(archetype!.entityCount).toBe(0);
    expect(manager.getEntityArchetype(entityId)).toBeUndefined();
  });

  test('should return undefined when removing non-existent entity', () => {
    const removedComponents = manager.removeEntity(999);
    expect(removedComponents).toBeUndefined();
  });

  test('should move entity to new archetype', () => {
    const entityId: EntityId = 1;
    const originalComponents = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(42)]
    ]);

    manager.addEntity(entityId, originalComponents);
    const originalArchetype = manager.getEntityArchetype(entityId);

    const newComponents = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(42)],
      [AnotherComponentType, new AnotherComponent('test')]
    ]);

    const success = manager.moveEntity(entityId, newComponents);
    const newArchetype = manager.getEntityArchetype(entityId);

    expect(success).toBe(true);
    expect(newArchetype).not.toBe(originalArchetype);
    expect(newArchetype!.componentTypes.size).toBe(2);
    expect(originalArchetype!.entityCount).toBe(0);
    expect(newArchetype!.entityCount).toBe(1);
  });

  test('should fail to move non-existent entity', () => {
    const newComponents = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(42)]
    ]);

    const success = manager.moveEntity(999, newComponents);
    expect(success).toBe(false);
  });

  test('should get entity component from archetype', () => {
    const entityId: EntityId = 1;
    const testComponent = new TestComponent(42);
    const components = new Map<ComponentType, Component>([
      [TestComponentType, testComponent],
      [AnotherComponentType, new AnotherComponent('test')]
    ]);

    manager.addEntity(entityId, components);

    const retrievedComponent = manager.getEntityComponent(entityId, TestComponentType);
    expect(retrievedComponent).toBe(testComponent);
    expect((retrievedComponent as TestComponent).value).toBe(42);
  });

  test('should return undefined for non-existent entity component', () => {
    const component = manager.getEntityComponent(999, TestComponentType);
    expect(component).toBeUndefined();
  });

  test('should query archetypes by component types', () => {
    // Create archetypes
    manager.getOrCreateArchetype([TestComponentType]);
    manager.getOrCreateArchetype([AnotherComponentType]);
    manager.getOrCreateArchetype([TestComponentType, AnotherComponentType]);
    manager.getOrCreateArchetype([TestComponentType, ThirdComponentType]);

    // Query for TestComponent
    const archetypes = manager.queryArchetypes([TestComponentType]);
    expect(archetypes).toHaveLength(3); // Should match 3 archetypes containing TestComponent

    // Query for TestComponent AND AnotherComponent
    const archetypes2 = manager.queryArchetypes([TestComponentType, AnotherComponentType]);
    expect(archetypes2).toHaveLength(1); // Should match only the archetype with both components
  });

  test('should cache query results', () => {
    // Create archetypes
    manager.getOrCreateArchetype([TestComponentType]);
    manager.getOrCreateArchetype([TestComponentType, AnotherComponentType]);

    // First query
    const archetypes1 = manager.queryArchetypes([TestComponentType]);

    // Second query (should use cache)
    const archetypes2 = manager.queryArchetypes([TestComponentType]);

    expect(archetypes1).toBe(archetypes2); // Should be the same array reference (cached)
  });

  test('should invalidate cache when new archetype is created', () => {
    // Initial query
    const archetypes1 = manager.queryArchetypes([TestComponentType]);
    expect(archetypes1).toHaveLength(0);

    // Create new archetype
    manager.getOrCreateArchetype([TestComponentType]);

    // Query again (cache should be invalidated)
    const archetypes2 = manager.queryArchetypes([TestComponentType]);
    expect(archetypes2).toHaveLength(1);
  });

  test('should query entities by component types', () => {
    // Add entities
    manager.addEntity(1, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]));
    manager.addEntity(2, new Map<ComponentType, Component>([[AnotherComponentType, new AnotherComponent('test')]]));
    manager.addEntity(3, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(3)],
      [AnotherComponentType, new AnotherComponent('test3')]
    ]));

    // Query for TestComponent
    const entities = manager.queryEntities([TestComponentType]);
    expect(entities).toHaveLength(2);
    expect(entities).toContain(1);
    expect(entities).toContain(3);
    expect(entities).not.toContain(2);
  });

  test('should query archetypes with advanced filtering', () => {
    // Create archetypes
    const archetype1 = manager.getOrCreateArchetype([TestComponentType]);
    const archetype2 = manager.getOrCreateArchetype([TestComponentType, AnotherComponentType]);
    const archetype3 = manager.getOrCreateArchetype([AnotherComponentType, ThirdComponentType]);

    // Query with required and excluded components using typeIds
    const query = {
      required: new Set([TestComponentType.typeId]),
      excluded: new Set([ThirdComponentType.typeId])
    };

    const matchingArchetypes = manager.queryArchetypesAdvanced(query);
    expect(matchingArchetypes).toHaveLength(2);
    expect(matchingArchetypes).toContain(archetype1);
    expect(matchingArchetypes).toContain(archetype2);
    expect(matchingArchetypes).not.toContain(archetype3);
  });

  test('should provide statistics', () => {
    // Add some entities to create archetypes
    manager.addEntity(1, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]));
    manager.addEntity(2, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(2)]]));
    manager.addEntity(3, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(3)],
      [AnotherComponentType, new AnotherComponent('test')]
    ]));

    const stats = manager.getStatistics();

    expect(stats.archetypeCount).toBe(2);
    expect(stats.totalEntities).toBe(3);
    expect(stats.averageEntitiesPerArchetype).toBe(1.5);
    expect(stats.largestArchetype).toBeDefined();
    expect(stats.largestArchetype!.entityCount).toBe(2);
  });

  test('should handle empty statistics', () => {
    const stats = manager.getStatistics();

    expect(stats.archetypeCount).toBe(0);
    expect(stats.totalEntities).toBe(0);
    expect(stats.averageEntitiesPerArchetype).toBe(0);
    expect(stats.largestArchetype).toBeNull();
  });

  test('should clear all data', () => {
    // Add some data
    manager.addEntity(1, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]));
    manager.addEntity(2, new Map<ComponentType, Component>([[AnotherComponentType, new AnotherComponent('test')]]));

    expect(manager.getAllArchetypes()).toHaveLength(2);

    // Clear
    manager.clear();

    expect(manager.getAllArchetypes()).toHaveLength(0);
    expect(manager.getEntityArchetype(1)).toBeUndefined();
    expect(manager.getEntityArchetype(2)).toBeUndefined();

    // Query cache should also be cleared
    const archetypes = manager.queryArchetypes([TestComponentType]);
    expect(archetypes).toHaveLength(0);
  });

  test('should build archetype edges correctly', () => {
    // Create related archetypes
    const archetype1 = manager.getOrCreateArchetype([TestComponentType]);
    const archetype2 = manager.getOrCreateArchetype([TestComponentType, AnotherComponentType]);

    // Check if edges are built
    const edge = archetype1.getEdge(AnotherComponentType);
    expect(edge).toBeDefined();
    expect(edge!.targetArchetypeId).toBe(archetype2.id);
    expect(edge!.isAddition).toBe(true);

    const reverseEdge = archetype2.getEdge(AnotherComponentType);
    expect(reverseEdge).toBeDefined();
    expect(reverseEdge!.targetArchetypeId).toBe(archetype1.id);
    expect(reverseEdge!.isAddition).toBe(false);
  });

  test('should handle complex entity movements', () => {
    const entityId: EntityId = 1;

    // Start with TestComponent only
    manager.addEntity(entityId, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]));
    let archetype = manager.getEntityArchetype(entityId);
    expect(archetype!.componentTypes.size).toBe(1);

    // Add AnotherComponent
    manager.moveEntity(entityId, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(1)],
      [AnotherComponentType, new AnotherComponent('test')]
    ]));
    archetype = manager.getEntityArchetype(entityId);
    expect(archetype!.componentTypes.size).toBe(2);

    // Add ThirdComponent
    manager.moveEntity(entityId, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(1)],
      [AnotherComponentType, new AnotherComponent('test')],
      [ThirdComponentType, new ThirdComponent(true)]
    ]));
    archetype = manager.getEntityArchetype(entityId);
    expect(archetype!.componentTypes.size).toBe(3);

    // Remove AnotherComponent
    manager.moveEntity(entityId, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(1)],
      [ThirdComponentType, new ThirdComponent(true)]
    ]));
    archetype = manager.getEntityArchetype(entityId);
    expect(archetype!.componentTypes.size).toBe(2);
    expect(archetype!.hasComponent(TestComponentType)).toBe(true);
    expect(archetype!.hasComponent(ThirdComponentType)).toBe(true);
    expect(archetype!.hasComponent(AnotherComponentType)).toBe(false);
  });

  test('should handle concurrent entity operations', () => {
    // Simulate concurrent operations
    const entities = [1, 2, 3, 4, 5];

    // Add entities concurrently
    entities.forEach(id => {
      manager.addEntity(id, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(id)]]));
    });

    expect(manager.queryEntities([TestComponentType])).toHaveLength(5);

    // Move some entities to different archetypes
    manager.moveEntity(2, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(2)],
      [AnotherComponentType, new AnotherComponent('test2')]
    ]));
    manager.moveEntity(4, new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(4)],
      [AnotherComponentType, new AnotherComponent('test4')]
    ]));

    const singleComponentEntities = manager.queryEntities([TestComponentType]);
    const dualComponentEntities = manager.queryEntities([TestComponentType, AnotherComponentType]);

    expect(singleComponentEntities).toHaveLength(5); // All entities have TestComponent
    expect(dualComponentEntities).toHaveLength(2); // Only entities 2 and 4 have both
  });

  test('should maintain data integrity during operations', () => {
    const entityId: EntityId = 1;
    const originalComponent = new TestComponent(42);

    manager.addEntity(entityId, new Map<ComponentType, Component>([[TestComponentType, originalComponent]]));

    // Verify component is stored correctly
    const retrievedComponent = manager.getEntityComponent(entityId, TestComponentType);
    expect(retrievedComponent).toBe(originalComponent);
    expect((retrievedComponent as TestComponent).value).toBe(42);

    // Move entity and verify component is preserved
    const newComponent = new AnotherComponent('test');
    manager.moveEntity(entityId, new Map<ComponentType, Component>([
      [TestComponentType, originalComponent],
      [AnotherComponentType, newComponent]
    ]));

    const retrievedTestComponent = manager.getEntityComponent(entityId, TestComponentType);
    const retrievedAnotherComponent = manager.getEntityComponent(entityId, AnotherComponentType);

    expect(retrievedTestComponent).toBe(originalComponent);
    expect(retrievedAnotherComponent).toBe(newComponent);
  });

  test('should handle edge cases with empty component maps', () => {
    const entityId: EntityId = 1;

    // Try to add entity with empty components
    manager.addEntity(entityId, new Map());

    const archetype = manager.getEntityArchetype(entityId);
    expect(archetype).toBeDefined();
    expect(archetype!.componentTypes.size).toBe(0);
  });

  test('should optimize memory usage', () => {
    // Add many entities to test memory efficiency
    const entityCount = 1000;

    for (let i = 1; i <= entityCount; i++) {
      manager.addEntity(i, new Map<ComponentType, Component>([[TestComponentType, new TestComponent(i)]]));
    }

    const stats = manager.getStatistics();
    expect(stats.totalEntities).toBe(entityCount);
    expect(stats.archetypeCount).toBe(1); // All entities should be in the same archetype

    // Remove half the entities
    for (let i = 1; i <= entityCount / 2; i++) {
      manager.removeEntity(i);
    }

    const newStats = manager.getStatistics();
    expect(newStats.totalEntities).toBe(entityCount / 2);
  });
});
