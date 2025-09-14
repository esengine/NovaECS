import { describe, beforeEach, test, expect } from 'vitest';
import { ComponentRegistry, registerComponent, getComponentType } from '../../src/core/ComponentRegistry';
import { ArchetypeManager } from '../../src/core/ArchetypeManager';
import { Component } from '../../src/core/Component';

// Test components for signature stability testing
class PositionComponent extends Component {
  constructor(public x: number = 0, public y: number = 0) {
    super();
  }
}

class VelocityComponent extends Component {
  constructor(public dx: number = 0, public dy: number = 0) {
    super();
  }
}

class HealthComponent extends Component {
  constructor(public value: number = 100) {
    super();
  }
}

describe('ComponentRegistry and Stable Signatures', () => {
  let registry: ComponentRegistry;
  let archetypeManager: ArchetypeManager;

  beforeEach(() => {
    registry = ComponentRegistry.getInstance();
    registry.clear(); // Clear for each test
    archetypeManager = new ArchetypeManager();
  });

  test('should register components with stable type IDs', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    expect(positionType.typeId).toBe(1);
    expect(velocityType.typeId).toBe(2);
    expect(positionType.name).toBe('Position');
    expect(velocityType.name).toBe('Velocity');
    expect(positionType.ctor).toBe(PositionComponent);
    expect(velocityType.ctor).toBe(VelocityComponent);
  });

  test('should generate consistent archetype IDs regardless of registration order', () => {
    // Test 1: Register in order A, B, C
    registry.clear();
    const positionType1 = registerComponent(PositionComponent, 'Position');
    const velocityType1 = registerComponent(VelocityComponent, 'Velocity');
    const healthType1 = registerComponent(HealthComponent, 'Health');

    const archetype1 = archetypeManager.getOrCreateArchetype([positionType1, velocityType1, healthType1]);
    const id1 = archetype1.id;

    // Test 2: Register in different order C, A, B
    registry.clear();
    archetypeManager.clear();
    const healthType2 = registerComponent(HealthComponent, 'Health');
    const positionType2 = registerComponent(PositionComponent, 'Position');
    const velocityType2 = registerComponent(VelocityComponent, 'Velocity');

    const archetype2 = archetypeManager.getOrCreateArchetype([healthType2, positionType2, velocityType2]);
    const id2 = archetype2.id;

    // The IDs should be the same because they're based on sorted typeId values
    expect(id1).toBe(id2);
  });

  test('should generate stable archetype IDs based on typeId instead of name', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    // Create archetype with these components
    const archetype = archetypeManager.getOrCreateArchetype([positionType, velocityType]);

    // The ID should be based on typeIds (1|2), not names
    expect(archetype.id).toBe('archetype:1|2');
  });

  test('should sort components by typeId for consistent archetype creation', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');
    const healthType = registerComponent(HealthComponent, 'Health');

    // Create archetype with components in different orders
    const archetype1 = archetypeManager.getOrCreateArchetype([healthType, positionType, velocityType]);
    const archetype2 = archetypeManager.getOrCreateArchetype([velocityType, healthType, positionType]);
    const archetype3 = archetypeManager.getOrCreateArchetype([positionType, velocityType, healthType]);

    // All should result in the same archetype
    expect(archetype1).toBe(archetype2);
    expect(archetype2).toBe(archetype3);
    expect(archetype1.id).toBe('archetype:1|2|3'); // Sorted by typeId
  });

  test('should prevent duplicate registration', () => {
    const positionType1 = registerComponent(PositionComponent, 'Position');
    const positionType2 = registerComponent(PositionComponent, 'Position');

    // Should return the same type object
    expect(positionType1).toBe(positionType2);
    expect(positionType1.typeId).toBe(positionType2.typeId);
  });

  test('should handle name conflicts', () => {
    registerComponent(PositionComponent, 'TestName');

    expect(() => {
      registerComponent(VelocityComponent, 'TestName');
    }).toThrow('Component type name \'TestName\' already registered');
  });

  test('should generate different typeIds for different components', () => {
    const type1 = registerComponent(PositionComponent, 'Position');
    const type2 = registerComponent(VelocityComponent, 'Velocity');
    const type3 = registerComponent(HealthComponent, 'Health');

    expect(type1.typeId).not.toBe(type2.typeId);
    expect(type2.typeId).not.toBe(type3.typeId);
    expect(type1.typeId).not.toBe(type3.typeId);

    // Should be sequential
    expect(type1.typeId).toBe(1);
    expect(type2.typeId).toBe(2);
    expect(type3.typeId).toBe(3);
  });

  test('should retrieve component types by various methods', () => {
    const positionType = registerComponent(PositionComponent, 'Position');

    // By constructor
    const byConstructor = registry.getByConstructor(PositionComponent);
    expect(byConstructor).toBe(positionType);

    // By name
    const byName = registry.getByName('Position');
    expect(byName).toBe(positionType);

    // By typeId
    const byId = registry.getById(positionType.typeId);
    expect(byId).toBe(positionType);
  });

  test('should work with getComponentType helper', () => {
    registerComponent(PositionComponent, 'Position');

    const type = getComponentType(PositionComponent);
    expect(type.name).toBe('Position');
    expect(type.typeId).toBe(1);
  });

  test('should throw error for unregistered component', () => {
    expect(() => {
      getComponentType(PositionComponent);
    }).toThrow('Component type not registered: PositionComponent');
  });

  test('should maintain consistency across multiple archetype managers', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    const manager1 = new ArchetypeManager();
    const manager2 = new ArchetypeManager();

    const archetype1 = manager1.getOrCreateArchetype([positionType, velocityType]);
    const archetype2 = manager2.getOrCreateArchetype([velocityType, positionType]); // Different order

    // Both should generate the same ID because it's based on typeId
    expect(archetype1.id).toBe(archetype2.id);
    expect(archetype1.id).toBe('archetype:1|2');
  });

  test('should be resilient to name changes', () => {
    // Register components
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    // Create archetype
    const archetype1 = archetypeManager.getOrCreateArchetype([positionType, velocityType]);
    const originalId = archetype1.id;

    // Even if we could change names (which we can't in this design),
    // the ID should remain stable because it's based on typeId
    expect(originalId).toBe('archetype:1|2');

    // Create another archetype with the same components
    const archetype2 = archetypeManager.getOrCreateArchetype([velocityType, positionType]);
    expect(archetype2.id).toBe(originalId);
    expect(archetype2).toBe(archetype1); // Same archetype object
  });

  test('should handle component registration edge cases', () => {
    // Register without explicit name
    const type1 = registerComponent(PositionComponent);
    expect(type1.name).toBe('PositionComponent'); // Uses constructor name

    // Register with empty name should use constructor name
    registry.clear();
    const type2 = registerComponent(PositionComponent, '');
    expect(type2.name).toBe('PositionComponent');
  });
});