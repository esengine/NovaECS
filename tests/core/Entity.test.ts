import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import { World } from '../../src/core/World';
import { ComponentRegistry, registerComponent } from '../../src/core/ComponentRegistry';
import type { ComponentType } from '../../src/utils/Types';
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

describe('Entity', () => {
  let entity: Entity;
  let world: World;
  let registry: ComponentRegistry;
  let TestComponentType: ComponentType<TestComponent>;
  let AnotherComponentType: ComponentType<AnotherComponent>;

  beforeEach(() => {
    registry = ComponentRegistry.getInstance();
    registry.clear();
    world = new World();

    TestComponentType = registerComponent(TestComponent, 'Test');
    AnotherComponentType = registerComponent(AnotherComponent, 'Another');

    entity = world.createEntity();
  });

  test('should initialize with correct id', () => {
    expect(entity.id).toBe(1);
  });

  test('should be enabled by default', () => {
    expect(entity.enabled).toBe(true);
  });

  test('should allow setting enabled state', () => {
    entity.enabled = false;
    expect(entity.enabled).toBe(false);
  });

  test('should add component', () => {
    const component = new TestComponent(42);
    entity.addComponent(component);

    expect(entity.hasComponent(TestComponentType)).toBe(true);
    expect(entity.getComponent(TestComponentType)).toBe(component);
  });

  test('should remove component', () => {
    const component = new TestComponent(42);
    entity.addComponent(component);
    entity.removeComponent(TestComponentType);

    expect(entity.hasComponent(TestComponentType)).toBe(false);
    expect(entity.getComponent(TestComponentType)).toBeUndefined();
  });

  test('should check for multiple components', () => {
    entity.addComponent(new TestComponent(42));
    entity.addComponent(new AnotherComponent('test'));

    expect(entity.hasComponents(TestComponentType, AnotherComponentType)).toBe(true);
    expect(entity.hasComponents(TestComponentType)).toBe(true);
    expect(entity.hasComponents(AnotherComponentType)).toBe(true);
  });

  test('should return all components', () => {
    const comp1 = new TestComponent(42);
    const comp2 = new AnotherComponent('test');
    
    entity.addComponent(comp1);
    entity.addComponent(comp2);
    
    const components = entity.getComponents();
    expect(components).toHaveLength(2);
    expect(components).toContain(comp1);
    expect(components).toContain(comp2);
  });

  test('should return component types', () => {
    entity.addComponent(new TestComponent(42));
    entity.addComponent(new AnotherComponent('test'));

    const types = entity.getComponentTypes();
    expect(types).toHaveLength(2);
    expect(types).toContain(TestComponent);
    expect(types).toContain(AnotherComponent);
  });

  test('should remove all components individually', () => {
    entity.addComponent(new TestComponent(42));
    entity.addComponent(new AnotherComponent('test'));

    entity.removeComponent(TestComponentType);
    entity.removeComponent(AnotherComponentType);

    expect(entity.getComponents()).toHaveLength(0);
    expect(entity.hasComponent(TestComponentType)).toBe(false);
    expect(entity.hasComponent(AnotherComponentType)).toBe(false);
  });

  test('should destroy entity', () => {
    entity.addComponent(new TestComponent(42));
    entity.destroy();

    expect(entity.alive).toBe(false);
    expect(entity.getComponents()).toHaveLength(0);
  });

  test('should support method chaining', () => {
    const result = entity
      .addComponent(new TestComponent(42))
      .addComponent(new AnotherComponent('test'))
      .removeComponent(TestComponentType);

    expect(result).toBe(entity);
  });

  test('should handle component lifecycle', () => {
    const component = new TestComponent(42);

    // Add lifecycle methods to the component
    component.onAdded = vi.fn();
    component.onRemoved = vi.fn();

    entity.addComponent(component);
    expect(component.onAdded).toHaveBeenCalled();

    entity.removeComponent(TestComponentType);
    expect(component.onRemoved).toHaveBeenCalled();
  });

  test('should handle archetype storage with fallback', () => {
    // Test world-based storage (our entity is created through world)
    expect(entity.hasComponent(TestComponentType)).toBe(false);

    entity.addComponent(new TestComponent(42));
    expect(entity.hasComponent(TestComponentType)).toBe(true);

    const component = entity.getComponent(TestComponentType);
    expect(component).toBeDefined();
    expect((component as TestComponent).value).toBe(42);

    // Component should be accessible through world's archetype storage
    expect(entity.hasComponent(TestComponentType)).toBe(true);
    const retrievedComponent = entity.getComponent(TestComponentType);
    expect(retrievedComponent).toBeDefined();
    expect((retrievedComponent as TestComponent).value).toBe(42);
  });

  test('should handle world-based component access', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    const component = new TestComponent(999);
    worldEntity.addComponent(component);

    const retrievedComponent = worldEntity.getComponent(TestComponentType);
    expect(retrievedComponent).toBe(component);
    expect(retrievedComponent?.value).toBe(999);
  });

  test('should handle component lifecycle in world', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    const component = new TestComponent(42);
    worldEntity.addComponent(component);

    // Component should be accessible
    expect(worldEntity.hasComponent(TestComponentType)).toBe(true);
    expect(worldEntity.getComponent(TestComponentType)).toBe(component);

    worldEntity.removeComponent(TestComponentType);

    // Component should be removed
    expect(worldEntity.hasComponent(TestComponentType)).toBe(false);
    expect(worldEntity.getComponent(TestComponentType)).toBeUndefined();
  });

  test('should handle world-based archetype operations', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    // Add component through world's archetype system
    const component = new TestComponent(42);
    worldEntity.addComponent(component);

    // Component should be accessible through archetype system
    const retrievedComponent = worldEntity.getComponent(TestComponentType);
    expect(retrievedComponent).toBe(component);

    // hasComponent should work with archetype system
    expect(worldEntity.hasComponent(TestComponentType)).toBe(true);

    // Remove component
    worldEntity.removeComponent(TestComponentType);
    expect(worldEntity.hasComponent(TestComponentType)).toBe(false);
  });

  test('should handle multiple components with world archetype storage', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    const component1 = new TestComponent(1);
    const component2 = new AnotherComponent('test');

    worldEntity.addComponent(component1);
    worldEntity.addComponent(component2);

    expect(worldEntity.hasComponents(TestComponentType)).toBe(true);
    expect(worldEntity.hasComponents(TestComponentType, AnotherComponentType)).toBe(true);

    // Add a third component class for testing
    class ThirdComponent extends Component {}
    const ThirdComponentType = registerComponent(ThirdComponent, 'Third');
    expect(worldEntity.hasComponents(TestComponentType, AnotherComponentType, ThirdComponentType)).toBe(false);

    expect(worldEntity.getComponent(TestComponentType)).toBe(component1);
    expect(worldEntity.getComponent(AnotherComponentType)).toBe(component2);
  });

  test('should handle getComponents with world integration', () => {
    // This test now requires a World instance since Entity uses World directly
    const world = new World();

    const worldEntity = world.createEntity();
    const component1 = new TestComponent(1);
    const component2 = new AnotherComponent('test');

    worldEntity.addComponent(component1);
    worldEntity.addComponent(component2);

    const components = worldEntity.getComponents();
    expect(components).toHaveLength(2);
    expect(components).toContain(component1);
    expect(components).toContain(component2);
  });

  test('should fallback to traditional storage for getComponents', () => {
    // With world-based archetype storage
    const component = new TestComponent(42);
    entity.addComponent(component);

    const components = entity.getComponents();
    expect(components).toContain(component);
  });


  test('should handle world integration priority over traditional storage', () => {
    // Entity is already in world, so test world integration
    const firstComponent = new TestComponent(42);
    entity.addComponent(firstComponent);
    expect(entity.hasComponent(TestComponentType)).toBe(true);
    expect(entity.getComponent(TestComponentType)).toBe(firstComponent);

    // Update with a different component through world's archetype system
    const updatedComponent = new TestComponent(999);
    entity.removeComponent(TestComponentType);
    entity.addComponent(updatedComponent);

    // Should now use the updated component
    const component = entity.getComponent(TestComponentType);
    expect(component).toBe(updatedComponent);
    expect(component).not.toBe(firstComponent);
  });
});