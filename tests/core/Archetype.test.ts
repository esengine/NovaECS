import { describe, beforeEach, test, expect } from 'vitest';
import { Archetype } from '../../src/core/Archetype';
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

describe('Archetype', () => {
  let archetype: Archetype;
  let registry: ComponentRegistry;
  let TestComponentType: ComponentType<TestComponent>;
  let AnotherComponentType: ComponentType<AnotherComponent>;
  let ThirdComponentType: ComponentType<ThirdComponent>;

  beforeEach(() => {
    registry = ComponentRegistry.getInstance();
    registry.clear();

    TestComponentType = registerComponent(TestComponent, 'TestComponent');
    AnotherComponentType = registerComponent(AnotherComponent, 'AnotherComponent');
    ThirdComponentType = registerComponent(ThirdComponent, 'ThirdComponent');

    archetype = new Archetype([TestComponentType, AnotherComponentType]);
  });

  test('should create archetype with component types', () => {
    expect(archetype.componentTypes.size).toBe(2);
    expect(archetype.componentTypes.has(TestComponentType)).toBe(true);
    expect(archetype.componentTypes.has(AnotherComponentType)).toBe(true);
    expect(archetype.entityCount).toBe(0);
  });

  test('should generate consistent archetype ID', () => {
    const archetype1 = new Archetype([TestComponentType, AnotherComponentType]);
    const archetype2 = new Archetype([AnotherComponentType, TestComponentType]); // Different order

    // IDs should be the same regardless of order
    expect(archetype1.id).toBe(archetype2.id);
  });

  test('should check component existence', () => {
    expect(archetype.hasComponent(TestComponentType)).toBe(true);
    expect(archetype.hasComponent(AnotherComponentType)).toBe(true);
    expect(archetype.hasComponent(ThirdComponentType)).toBe(false);
  });

  test('should add entity with components', () => {
    const entityId: EntityId = 1;
    const components = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(42)],
      [AnotherComponentType, new AnotherComponent('test')]
    ]);

    const index = archetype.addEntity(entityId, components);

    expect(index).toBe(0);
    expect(archetype.entityCount).toBe(1);
    expect(archetype.entityIds).toContain(entityId);
  });

  test('should add multiple entities', () => {
    const components1 = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(1)],
      [AnotherComponentType, new AnotherComponent('first')]
    ]);
    const components2 = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(2)],
      [AnotherComponentType, new AnotherComponent('second')]
    ]);

    archetype.addEntity(1, components1);
    archetype.addEntity(2, components2);

    expect(archetype.entityCount).toBe(2);
    expect(archetype.entityIds).toEqual([1, 2]);
  });

  test('should get component for entity', () => {
    const entityId: EntityId = 1;
    const testComponent = new TestComponent(42);
    const components = new Map<ComponentType, Component>([
      [TestComponentType, testComponent],
      [AnotherComponentType, new AnotherComponent('test')]
    ]);

    archetype.addEntity(entityId, components);

    const retrievedComponent = archetype.getComponent(entityId, TestComponentType);
    expect(retrievedComponent).toBe(testComponent);
    expect((retrievedComponent as TestComponent).value).toBe(42);
  });

  test('should return undefined for non-existent component', () => {
    const entityId: EntityId = 1;
    const components = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(42)]
    ]);

    archetype.addEntity(entityId, components);

    const component = archetype.getComponent(entityId, ThirdComponentType);
    expect(component).toBeUndefined();
  });

  test('should return undefined for non-existent entity', () => {
    const component = archetype.getComponent(999, TestComponentType);
    expect(component).toBeUndefined();
  });

  test('should remove entity and return components', () => {
    const entityId: EntityId = 1;
    const testComponent = new TestComponent(42);
    const anotherComponent = new AnotherComponent('test');
    const components = new Map<ComponentType, Component>([
      [TestComponentType, testComponent],
      [AnotherComponentType, anotherComponent]
    ]);

    archetype.addEntity(entityId, components);
    expect(archetype.entityCount).toBe(1);

    const result = archetype.removeEntity(entityId);

    expect(archetype.entityCount).toBe(0);
    expect(archetype.entityIds).toEqual([]);
    expect(result).toBeDefined();
    expect(result!.components.get(TestComponentType)).toBe(testComponent);
    expect(result!.components.get(AnotherComponentType)).toBe(anotherComponent);
  });

  test('should handle removing non-existent entity', () => {
    const result = archetype.removeEntity(999);
    expect(result).toBeUndefined();
  });

  test('should handle swap-remove correctly', () => {
    // Add multiple entities
    const components1 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]);
    const components2 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(2)]]);
    const components3 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(3)]]);

    archetype.addEntity(1, components1);
    archetype.addEntity(2, components2);
    archetype.addEntity(3, components3);

    expect(archetype.entityIds).toEqual([1, 2, 3]);

    // Remove middle entity
    archetype.removeEntity(2);

    expect(archetype.entityCount).toBe(2);
    expect(archetype.entityIds).toEqual([1, 3]); // Entity 3 should move to position 1
  });

  test('should get components at specific index', () => {
    const testComponent = new TestComponent(42);
    const anotherComponent = new AnotherComponent('test');
    const components = new Map<ComponentType, Component>([
      [TestComponentType, testComponent],
      [AnotherComponentType, anotherComponent]
    ]);

    archetype.addEntity(1, components);

    const componentsAtIndex = archetype.getComponentsAtIndex(0);
    expect(componentsAtIndex.size).toBe(2);
    expect(componentsAtIndex.get(TestComponentType)).toBe(testComponent);
    expect(componentsAtIndex.get(AnotherComponentType)).toBe(anotherComponent);
  });

  test('should return empty map for invalid index', () => {
    const components = archetype.getComponentsAtIndex(999);
    expect(components.size).toBe(0);
  });

  test('should iterate over entities with forEach', () => {
    const components1 = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(1)],
      [AnotherComponentType, new AnotherComponent('first')]
    ]);
    const components2 = new Map<ComponentType, Component>([
      [TestComponentType, new TestComponent(2)],
      [AnotherComponentType, new AnotherComponent('second')]
    ]);

    archetype.addEntity(1, components1);
    archetype.addEntity(2, components2);

    const visitedEntities: EntityId[] = [];
    const visitedIndices: number[] = [];

    archetype.forEach((entityId, index, components) => {
      visitedEntities.push(entityId);
      visitedIndices.push(index);
      expect(components.size).toBe(2);
    });

    expect(visitedEntities).toEqual([1, 2]);
    expect(visitedIndices).toEqual([0, 1]);
  });

  test('should match query signature with required components', () => {
    const query = {
      required: new Set([TestComponentType.typeId])
    };

    expect(archetype.matchesQuery(query)).toBe(true);

    const query2 = {
      required: new Set([TestComponentType.typeId, AnotherComponentType.typeId])
    };

    expect(archetype.matchesQuery(query2)).toBe(true);

    const query3 = {
      required: new Set([TestComponentType.typeId, AnotherComponentType.typeId, ThirdComponentType.typeId])
    };

    expect(archetype.matchesQuery(query3)).toBe(false);
  });

  test('should match query signature with excluded components', () => {
    const query = {
      required: new Set([TestComponentType.typeId]),
      excluded: new Set([ThirdComponentType.typeId])
    };

    expect(archetype.matchesQuery(query)).toBe(true);

    const query2 = {
      required: new Set([TestComponentType.typeId]),
      excluded: new Set([AnotherComponentType.typeId])
    };

    expect(archetype.matchesQuery(query2)).toBe(false);
  });

  test('should match query signature with optional components', () => {
    // Archetype has TestComponentType and AnotherComponentType

    // Query with optional components - should match if at least one optional is present
    const query1 = {
      required: new Set([TestComponentType.typeId]),
      optional: new Set([AnotherComponentType.typeId])
    };
    expect(archetype.matchesQuery(query1)).toBe(true);

    // Query with optional components - should fail if none of optional are present
    const query2 = {
      required: new Set([TestComponentType.typeId]),
      optional: new Set([ThirdComponentType.typeId])
    };
    expect(archetype.matchesQuery(query2)).toBe(false);

    // Query with multiple optional components - should match if at least one is present
    const query3 = {
      required: new Set([TestComponentType.typeId]),
      optional: new Set([AnotherComponentType.typeId, ThirdComponentType.typeId])
    };
    expect(archetype.matchesQuery(query3)).toBe(true);

    // Query with only optional components (no required) - should match if at least one optional is present
    const query4 = {
      required: new Set(),
      optional: new Set([AnotherComponentType.typeId])
    };
    expect(archetype.matchesQuery(query4)).toBe(true);
  });

  test('should handle query with undefined required field', () => {
    const query = {
      excluded: new Set([ThirdComponentType.typeId])
    } as any; // Cast to bypass TypeScript check for testing

    expect(archetype.matchesQuery(query)).toBe(true);
  });

  test('should handle complex query with all fields', () => {
    // Archetype has TestComponentType and AnotherComponentType

    const query = {
      required: new Set([TestComponentType.typeId]),
      optional: new Set([AnotherComponentType.typeId]),
      excluded: new Set([ThirdComponentType.typeId])
    };

    expect(archetype.matchesQuery(query)).toBe(true);

    // Fail if excluded component is present in archetype
    const query2 = {
      required: new Set([TestComponentType.typeId]),
      optional: new Set([AnotherComponentType.typeId]),
      excluded: new Set([AnotherComponentType.typeId])
    };

    expect(archetype.matchesQuery(query2)).toBe(false);
  });

  test('should handle archetype edges', () => {
    const typeId = ThirdComponentType.typeId;
    archetype.addEdge(ThirdComponentType, 'target-archetype-id', true);

    expect(archetype.getAddEdge(typeId)).toBe('target-archetype-id');
    expect(archetype.getRemoveEdge(typeId)).toBeUndefined();
  });

  test('should return undefined for non-existent edge', () => {
    const typeId = ThirdComponentType.typeId;
    expect(archetype.getAddEdge(typeId)).toBeUndefined();
    expect(archetype.getRemoveEdge(typeId)).toBeUndefined();
  });

  test('should handle edge pairs for same component type', () => {
    const typeId = ThirdComponentType.typeId;

    // Add both add and remove edges for the same component type
    archetype.addEdge(ThirdComponentType, 'add-target-id', true);
    archetype.addEdge(ThirdComponentType, 'remove-target-id', false);

    // Test edge pair access
    const edgePair = archetype.getEdgePair(typeId);
    expect(edgePair).toBeDefined();
    expect(edgePair!.add).toBe('add-target-id');
    expect(edgePair!.remove).toBe('remove-target-id');

    // Test individual edge access
    expect(archetype.getAddEdge(typeId)).toBe('add-target-id');
    expect(archetype.getRemoveEdge(typeId)).toBe('remove-target-id');

  });

  test('should overwrite edges of same type correctly', () => {
    const typeId = ThirdComponentType.typeId;

    // Add initial edges
    archetype.addEdge(ThirdComponentType, 'initial-add', true);
    archetype.addEdge(ThirdComponentType, 'initial-remove', false);

    // Verify initial state
    expect(archetype.getAddEdge(typeId)).toBe('initial-add');
    expect(archetype.getRemoveEdge(typeId)).toBe('initial-remove');

    // Overwrite add edge
    archetype.addEdge(ThirdComponentType, 'new-add', true);
    expect(archetype.getAddEdge(typeId)).toBe('new-add');
    expect(archetype.getRemoveEdge(typeId)).toBe('initial-remove'); // Should remain unchanged

    // Overwrite remove edge
    archetype.addEdge(ThirdComponentType, 'new-remove', false);
    expect(archetype.getAddEdge(typeId)).toBe('new-add'); // Should remain unchanged
    expect(archetype.getRemoveEdge(typeId)).toBe('new-remove');
  });

  test('should return undefined for non-existent edge pairs', () => {
    const typeId = ThirdComponentType.typeId;

    expect(archetype.getEdgePair(typeId)).toBeUndefined();
    expect(archetype.getAddEdge(typeId)).toBeUndefined();
    expect(archetype.getRemoveEdge(typeId)).toBeUndefined();
  });

  test('should handle partial edge pairs', () => {
    const typeId = ThirdComponentType.typeId;

    // Add only add edge
    archetype.addEdge(ThirdComponentType, 'only-add', true);

    const edgePair1 = archetype.getEdgePair(typeId);
    expect(edgePair1).toBeDefined();
    expect(edgePair1!.add).toBe('only-add');
    expect(edgePair1!.remove).toBeUndefined();

    // Clear and add only remove edge
    archetype.addEdge(ThirdComponentType, 'only-remove', false);

    const edgePair2 = archetype.getEdgePair(typeId);
    expect(edgePair2).toBeDefined();
    expect(edgePair2!.add).toBe('only-add'); // Previous add should still be there
    expect(edgePair2!.remove).toBe('only-remove');
  });

  test('should detect transition possibilities', () => {
    const targetArchetype = new Archetype([TestComponentType, AnotherComponentType, ThirdComponentType]);

    // Adding ThirdComponent
    const transition1 = archetype.canTransitionTo(targetArchetype, ThirdComponentType);
    expect(transition1).toBe('add');

    // Removing AnotherComponent
    const sourceArchetype = new Archetype([TestComponentType]);
    const transition2 = sourceArchetype.canTransitionTo(archetype, AnotherComponentType);
    expect(transition2).toBe('add');

    // No valid transition
    const unrelatedArchetype = new Archetype([ThirdComponentType]);
    const transition3 = archetype.canTransitionTo(unrelatedArchetype, TestComponentType);
    expect(transition3).toBeNull();
  });

  test('should handle empty archetype', () => {
    const emptyArchetype = new Archetype([]);
    
    expect(emptyArchetype.componentTypes.size).toBe(0);
    expect(emptyArchetype.entityCount).toBe(0);
    expect(emptyArchetype.hasComponent(TestComponent)).toBe(false);
  });

  test('should handle archetype with single component', () => {
    const singleArchetype = new Archetype([TestComponent]);

    expect(singleArchetype.componentTypes.size).toBe(1);
    expect(singleArchetype.hasComponent(TestComponent)).toBe(true);
    expect(singleArchetype.hasComponent(AnotherComponent)).toBe(false);
  });

  test('should return swapped entity info when swap-remove occurs', () => {
    // Add 3 entities
    const components1 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]);
    const components2 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(2)]]);
    const components3 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(3)]]);

    archetype.addEntity(1, components1);
    archetype.addEntity(2, components2);
    archetype.addEntity(3, components3);

    expect(archetype.entityIds).toEqual([1, 2, 3]);

    // Remove middle entity (should cause swap with last entity)
    const result = archetype.removeEntity(2);

    expect(result).toBeDefined();
    expect(result!.components.get(TestComponentType)).toBeInstanceOf(TestComponent);
    expect((result!.components.get(TestComponentType) as TestComponent).value).toBe(2);

    // Should return swapped entity info
    expect(result!.swappedEntity).toBeDefined();
    expect(result!.swappedEntity!.entityId).toBe(3);
    expect(result!.swappedEntity!.newIndex).toBe(1);

    // Entity 3 should now be at index 1
    expect(archetype.entityIds).toEqual([1, 3]);
  });

  test('should not return swapped entity info when removing last entity', () => {
    // Add 2 entities
    const components1 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(1)]]);
    const components2 = new Map<ComponentType, Component>([[TestComponentType, new TestComponent(2)]]);

    archetype.addEntity(1, components1);
    archetype.addEntity(2, components2);

    // Remove last entity (no swap needed)
    const result = archetype.removeEntity(2);

    expect(result).toBeDefined();
    expect(result!.swappedEntity).toBeUndefined();
    expect(archetype.entityIds).toEqual([1]);
  });
});
