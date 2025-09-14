import { describe, beforeEach, test, expect } from 'vitest';
import { ComponentRegistry, registerComponent } from '../../src/core/ComponentRegistry';
import { ArchetypeManager } from '../../src/core/ArchetypeManager';
import { QueryManager } from '../../src/core/QueryManager';
import { Component } from '../../src/core/Component';

// Test components
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

class RenderComponent extends Component {
  constructor(public sprite: string = '') {
    super();
  }
}

describe('Stable Signatures Across Systems', () => {
  let registry: ComponentRegistry;
  let archetypeManager: ArchetypeManager;
  let queryManager: QueryManager;

  beforeEach(() => {
    registry = ComponentRegistry.getInstance();
    registry.clear();

    archetypeManager = new ArchetypeManager();
    queryManager = new QueryManager(
      archetypeManager,
      () => [] // Empty entity getter for testing
    );
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
    const renderType = registerComponent(RenderComponent, 'Render');

    // Create archetype with components in different orders
    const archetype1 = archetypeManager.getOrCreateArchetype([renderType, positionType, velocityType]);
    const archetype2 = archetypeManager.getOrCreateArchetype([velocityType, renderType, positionType]);
    const archetype3 = archetypeManager.getOrCreateArchetype([positionType, velocityType, renderType]);

    // All should result in the same archetype
    expect(archetype1).toBe(archetype2);
    expect(archetype2).toBe(archetype3);
    expect(archetype1.id).toBe('archetype:1|2|3'); // Sorted by typeId
  });

  test('should generate consistent archetype IDs regardless of registration order', () => {
    // Test 1: Register in order A, B, C
    registry.clear();
    archetypeManager.clear();
    const positionType1 = registerComponent(PositionComponent, 'Position');
    const velocityType1 = registerComponent(VelocityComponent, 'Velocity');
    const renderType1 = registerComponent(RenderComponent, 'Render');

    const archetype1 = archetypeManager.getOrCreateArchetype([positionType1, velocityType1, renderType1]);
    const id1 = archetype1.id;

    // Test 2: Register in different order C, A, B
    registry.clear();
    archetypeManager.clear();
    const renderType2 = registerComponent(RenderComponent, 'Render');
    const positionType2 = registerComponent(PositionComponent, 'Position');
    const velocityType2 = registerComponent(VelocityComponent, 'Velocity');

    const archetype2 = archetypeManager.getOrCreateArchetype([renderType2, positionType2, velocityType2]);
    const id2 = archetype2.id;

    // The IDs should be the same because they're based on sorted typeId values
    expect(id1).toBe(id2);
  });

  test('should generate stable query cache keys based on typeId', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');
    const renderType = registerComponent(RenderComponent, 'Render');

    const criteria1 = {
      all: [positionType, velocityType],
      none: [renderType]
    };

    const criteria2 = {
      all: [velocityType, positionType], // Different order
      none: [renderType]
    };

    // Use QueryBuilder's signature generation to test stability
    const builder1 = queryManager.createBuilder().all(...criteria1.all).none(...criteria1.none);
    const builder2 = queryManager.createBuilder().all(...criteria2.all).none(...criteria2.none);

    const signature1 = builder1.getSignature();
    const signature2 = builder2.getSignature();

    expect(signature1).toBe(signature2);
    expect(signature1).toContain('1'); // Position typeId
    expect(signature1).toContain('2'); // Velocity typeId
    expect(signature1).toContain('3'); // Render typeId
    expect(signature1).not.toContain('Position');
    expect(signature1).not.toContain('Velocity');
    expect(signature1).not.toContain('Render');
  });

  test('should create stable archetype IDs that survive minification', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    // Create archetype
    const archetype = archetypeManager.getOrCreateArchetype([positionType, velocityType]);

    // The ID should be based on numeric typeIds, not function names
    expect(archetype.id).toBe('archetype:1|2');

    // Verify it doesn't contain constructor names that could be minified
    expect(archetype.id).not.toContain('PositionComponent');
    expect(archetype.id).not.toContain('VelocityComponent');
  });

  test('should handle complex query signatures consistently', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');
    const renderType = registerComponent(RenderComponent, 'Render');

    const criteria = {
      all: [positionType],
      any: [velocityType, renderType],
      none: [renderType],
      with: [positionType, velocityType],
      without: [renderType]
    };

    const builder = queryManager.createBuilder()
      .all(...criteria.all)
      .any(...criteria.any)
      .none(...criteria.none)
      .with(...criteria.with)
      .without(...criteria.without);

    const signature = builder.getSignature();

    // Verify it contains sorted typeIds
    expect(signature).toContain('1'); // Position typeId
    expect(signature).toContain('2'); // Velocity typeId
    expect(signature).toContain('3'); // Render typeId

    // Should not contain component names
    expect(signature).not.toContain('Position');
    expect(signature).not.toContain('Velocity');
    expect(signature).not.toContain('Render');
  });

  test('should sort typeIds numerically for consistent ordering', () => {
    // Register components to get specific typeIds
    const type1 = registerComponent(PositionComponent, 'Position'); // typeId: 1

    // Register more components to get higher typeIds
    for (let i = 0; i < 8; i++) {
      registerComponent(class extends Component {}, `Component${i}`);
    }
    const type10 = registerComponent(class Component10 extends Component {}, 'Component10'); // typeId: 10

    // Create archetype with typeIds 1 and 10
    const archetype = archetypeManager.getOrCreateArchetype([type10, type1]);

    // Should sort numerically (1, 10) not lexicographically
    expect(archetype.id).toBe('archetype:1|10');
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

  test('should demonstrate signature stability across different environments', () => {
    // This test simulates what would happen in different environments
    // where constructor names might be different due to minification

    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    // Create signatures using the stable system
    const archetypeId = archetypeManager.getOrCreateArchetype([positionType, velocityType]).id;
    const queryBuilder = queryManager.createBuilder().with(positionType, velocityType);
    const querySignature = queryBuilder.getSignature();

    // These should be stable numeric-based signatures
    expect(archetypeId).toBe('archetype:1|2');
    expect(querySignature).toBe('all:1,2');

    // Even if constructor names change (simulated), the signatures remain stable
    // because they're based on registered typeIds, not constructor.name
  });

  test('should validate archetype signature format', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');
    const renderType = registerComponent(RenderComponent, 'Render');

    const archetype = archetypeManager.getOrCreateArchetype([renderType, positionType, velocityType]);

    // Format should be: archetype:{sorted typeIds separated by |}
    expect(archetype.id).toMatch(/^archetype:\d+(\|\d+)*$/);
    expect(archetype.id).toBe('archetype:1|2|3');
  });

  test('should validate query signature format', () => {
    const positionType = registerComponent(PositionComponent, 'Position');
    const velocityType = registerComponent(VelocityComponent, 'Velocity');

    const criteria = {
      all: [velocityType, positionType], // Unsorted input
      any: [positionType],
      none: [velocityType]
    };

    const builder = queryManager.createBuilder()
      .all(...criteria.all)
      .any(...criteria.any)
      .none(...criteria.none);

    const signature = builder.getSignature();

    // Should contain sorted typeIds within each section
    expect(signature).toContain('all:1,2'); // Sorted: Position(1), Velocity(2)
    expect(signature).toContain('any:1'); // Position(1)
    expect(signature).toContain('none:2'); // Velocity(2)
  });
});