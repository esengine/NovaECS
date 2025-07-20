import { Archetype } from '../../src/core/Archetype';
import { Component } from '../../src/core/Component';
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
  const componentTypes: ComponentType[] = [TestComponent, AnotherComponent];

  beforeEach(() => {
    archetype = new Archetype(componentTypes);
  });

  test('should create archetype with component types', () => {
    expect(archetype.componentTypes.size).toBe(2);
    expect(archetype.componentTypes.has(TestComponent)).toBe(true);
    expect(archetype.componentTypes.has(AnotherComponent)).toBe(true);
    expect(archetype.entityCount).toBe(0);
  });

  test('should generate consistent archetype ID', () => {
    const archetype1 = new Archetype([TestComponent, AnotherComponent]);
    const archetype2 = new Archetype([AnotherComponent, TestComponent]); // Different order
    
    // IDs should be the same regardless of order
    expect(archetype1.id).toBe(archetype2.id);
  });

  test('should check component existence', () => {
    expect(archetype.hasComponent(TestComponent)).toBe(true);
    expect(archetype.hasComponent(AnotherComponent)).toBe(true);
    expect(archetype.hasComponent(ThirdComponent)).toBe(false);
  });

  test('should add entity with components', () => {
    const entityId: EntityId = 1;
    const components = new Map<ComponentType, Component>([
      [TestComponent, new TestComponent(42)],
      [AnotherComponent, new AnotherComponent('test')]
    ]);

    const index = archetype.addEntity(entityId, components);

    expect(index).toBe(0);
    expect(archetype.entityCount).toBe(1);
    expect(archetype.entityIds).toContain(entityId);
  });

  test('should add multiple entities', () => {
    const components1 = new Map<ComponentType, Component>([
      [TestComponent, new TestComponent(1)],
      [AnotherComponent, new AnotherComponent('first')]
    ]);
    const components2 = new Map<ComponentType, Component>([
      [TestComponent, new TestComponent(2)],
      [AnotherComponent, new AnotherComponent('second')]
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
      [TestComponent, testComponent],
      [AnotherComponent, new AnotherComponent('test')]
    ]);

    archetype.addEntity(entityId, components);

    const retrievedComponent = archetype.getComponent(entityId, TestComponent);
    expect(retrievedComponent).toBe(testComponent);
    expect((retrievedComponent as TestComponent).value).toBe(42);
  });

  test('should return undefined for non-existent component', () => {
    const entityId: EntityId = 1;
    const components = new Map<ComponentType, Component>([
      [TestComponent, new TestComponent(42)]
    ]);

    archetype.addEntity(entityId, components);

    const component = archetype.getComponent(entityId, ThirdComponent);
    expect(component).toBeUndefined();
  });

  test('should return undefined for non-existent entity', () => {
    const component = archetype.getComponent(999, TestComponent);
    expect(component).toBeUndefined();
  });

  test('should remove entity and return components', () => {
    const entityId: EntityId = 1;
    const testComponent = new TestComponent(42);
    const anotherComponent = new AnotherComponent('test');
    const components = new Map<ComponentType, Component>([
      [TestComponent, testComponent],
      [AnotherComponent, anotherComponent]
    ]);

    archetype.addEntity(entityId, components);
    expect(archetype.entityCount).toBe(1);

    const removedComponents = archetype.removeEntity(entityId);

    expect(archetype.entityCount).toBe(0);
    expect(archetype.entityIds).toEqual([]);
    expect(removedComponents).toBeDefined();
    expect(removedComponents!.get(TestComponent)).toBe(testComponent);
    expect(removedComponents!.get(AnotherComponent)).toBe(anotherComponent);
  });

  test('should handle removing non-existent entity', () => {
    const removedComponents = archetype.removeEntity(999);
    expect(removedComponents).toBeUndefined();
  });

  test('should handle swap-remove correctly', () => {
    // Add multiple entities
    const components1 = new Map<ComponentType, Component>([[TestComponent, new TestComponent(1)]]);
    const components2 = new Map<ComponentType, Component>([[TestComponent, new TestComponent(2)]]);
    const components3 = new Map<ComponentType, Component>([[TestComponent, new TestComponent(3)]]);

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
      [TestComponent, testComponent],
      [AnotherComponent, anotherComponent]
    ]);

    archetype.addEntity(1, components);

    const componentsAtIndex = archetype.getComponentsAtIndex(0);
    expect(componentsAtIndex.size).toBe(2);
    expect(componentsAtIndex.get(TestComponent)).toBe(testComponent);
    expect(componentsAtIndex.get(AnotherComponent)).toBe(anotherComponent);
  });

  test('should return empty map for invalid index', () => {
    const components = archetype.getComponentsAtIndex(999);
    expect(components.size).toBe(0);
  });

  test('should iterate over entities with forEach', () => {
    const components1 = new Map<ComponentType, Component>([
      [TestComponent, new TestComponent(1)],
      [AnotherComponent, new AnotherComponent('first')]
    ]);
    const components2 = new Map<ComponentType, Component>([
      [TestComponent, new TestComponent(2)],
      [AnotherComponent, new AnotherComponent('second')]
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
      required: new Set([TestComponent])
    };

    expect(archetype.matchesQuery(query)).toBe(true);

    const query2 = {
      required: new Set([TestComponent, AnotherComponent])
    };

    expect(archetype.matchesQuery(query2)).toBe(true);

    const query3 = {
      required: new Set([TestComponent, AnotherComponent, ThirdComponent])
    };

    expect(archetype.matchesQuery(query3)).toBe(false);
  });

  test('should match query signature with excluded components', () => {
    const query = {
      required: new Set([TestComponent]),
      excluded: new Set([ThirdComponent])
    };

    expect(archetype.matchesQuery(query)).toBe(true);

    const query2 = {
      required: new Set([TestComponent]),
      excluded: new Set([AnotherComponent])
    };

    expect(archetype.matchesQuery(query2)).toBe(false);
  });

  test('should handle archetype edges', () => {
    archetype.addEdge(ThirdComponent, 'target-archetype-id', true);

    const edge = archetype.getEdge(ThirdComponent);
    expect(edge).toBeDefined();
    expect(edge!.targetArchetypeId).toBe('target-archetype-id');
    expect(edge!.componentType).toBe(ThirdComponent);
    expect(edge!.isAddition).toBe(true);
  });

  test('should return undefined for non-existent edge', () => {
    const edge = archetype.getEdge(ThirdComponent);
    expect(edge).toBeUndefined();
  });

  test('should detect transition possibilities', () => {
    const targetArchetype = new Archetype([TestComponent, AnotherComponent, ThirdComponent]);

    // Adding ThirdComponent
    const transition1 = archetype.canTransitionTo(targetArchetype, ThirdComponent);
    expect(transition1).toBe('add');

    // Removing AnotherComponent
    const sourceArchetype = new Archetype([TestComponent]);
    const transition2 = sourceArchetype.canTransitionTo(archetype, AnotherComponent);
    expect(transition2).toBe('add');

    // No valid transition
    const unrelatedArchetype = new Archetype([ThirdComponent]);
    const transition3 = archetype.canTransitionTo(unrelatedArchetype, TestComponent);
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
});
