import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import { World } from '../../src/core/World';
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

  beforeEach(() => {
    entity = new Entity(1);
  });

  test('should initialize with correct id', () => {
    expect(entity.id).toBe(1);
  });

  test('should be active by default', () => {
    expect(entity.active).toBe(true);
  });

  test('should allow setting active state', () => {
    entity.active = false;
    expect(entity.active).toBe(false);
  });

  test('should add component', () => {
    const component = new TestComponent(42);
    entity.addComponent(component);
    
    expect(entity.hasComponent(TestComponent)).toBe(true);
    expect(entity.getComponent(TestComponent)).toBe(component);
  });

  test('should remove component', () => {
    const component = new TestComponent(42);
    entity.addComponent(component);
    entity.removeComponent(TestComponent);
    
    expect(entity.hasComponent(TestComponent)).toBe(false);
    expect(entity.getComponent(TestComponent)).toBeUndefined();
  });

  test('should check for multiple components', () => {
    entity.addComponent(new TestComponent(42));
    entity.addComponent(new AnotherComponent('test'));
    
    expect(entity.hasComponents(TestComponent, AnotherComponent)).toBe(true);
    expect(entity.hasComponents(TestComponent)).toBe(true);
    expect(entity.hasComponents(AnotherComponent)).toBe(true);
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

  test('should clear all components', () => {
    entity.addComponent(new TestComponent(42));
    entity.addComponent(new AnotherComponent('test'));
    
    entity.clear();
    
    expect(entity.getComponents()).toHaveLength(0);
    expect(entity.hasComponent(TestComponent)).toBe(false);
    expect(entity.hasComponent(AnotherComponent)).toBe(false);
  });

  test('should destroy entity', () => {
    entity.addComponent(new TestComponent(42));
    entity.destroy();
    
    expect(entity.active).toBe(false);
    expect(entity.getComponents()).toHaveLength(0);
  });

  test('should support method chaining', () => {
    const result = entity
      .addComponent(new TestComponent(42))
      .addComponent(new AnotherComponent('test'))
      .removeComponent(TestComponent)
      .clear();

    expect(result).toBe(entity);
  });

  test('should handle component lifecycle', () => {
    const component = new TestComponent(42);

    // Add lifecycle methods to the component
    component.onAdded = vi.fn();
    component.onRemoved = vi.fn();

    entity.addComponent(component);
    expect(component.onAdded).toHaveBeenCalled();

    entity.removeComponent(TestComponent);
    expect(component.onRemoved).toHaveBeenCalled();
  });

  test('should handle archetype storage with fallback', () => {
    // Test fallback to traditional storage when no providers are set
    expect(entity.hasComponent(TestComponent)).toBe(false);

    entity.addComponent(new TestComponent(42));
    expect(entity.hasComponent(TestComponent)).toBe(true);

    const component = entity.getComponent(TestComponent);
    expect(component).toBeDefined();
    expect((component as TestComponent).value).toBe(42);

    // Component should be accessible through traditional storage fallback
    expect(entity.hasComponent(TestComponent)).toBe(true);
    const fallbackComponent = entity.getComponent(TestComponent);
    expect(fallbackComponent).toBeDefined();
    expect((fallbackComponent as TestComponent).value).toBe(42);
  });

  test('should handle world-based component access', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    const component = new TestComponent(999);
    worldEntity.addComponent(component);

    const retrievedComponent = worldEntity.getComponent(TestComponent);
    expect(retrievedComponent).toBe(component);
    expect(retrievedComponent?.value).toBe(999);
  });

  test('should handle component lifecycle in world', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    const component = new TestComponent(42);
    worldEntity.addComponent(component);

    // Component should be accessible
    expect(worldEntity.hasComponent(TestComponent)).toBe(true);
    expect(worldEntity.getComponent(TestComponent)).toBe(component);

    worldEntity.removeComponent(TestComponent);

    // Component should be removed
    expect(worldEntity.hasComponent(TestComponent)).toBe(false);
    expect(worldEntity.getComponent(TestComponent)).toBeUndefined();
  });

  test('should handle world-based archetype operations', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    // Add component through world's archetype system
    const component = new TestComponent(42);
    worldEntity.addComponent(component);

    // Component should be accessible through archetype system
    const retrievedComponent = worldEntity.getComponent(TestComponent);
    expect(retrievedComponent).toBe(component);

    // hasComponent should work with archetype system
    expect(worldEntity.hasComponent(TestComponent)).toBe(true);

    // Remove component
    worldEntity.removeComponent(TestComponent);
    expect(worldEntity.hasComponent(TestComponent)).toBe(false);
  });

  test('should handle multiple components with world archetype storage', () => {
    const world = new World();
    const worldEntity = world.createEntity();

    const component1 = new TestComponent(1);
    const component2 = new AnotherComponent('test');

    worldEntity.addComponent(component1);
    worldEntity.addComponent(component2);

    expect(worldEntity.hasComponents(TestComponent)).toBe(true);
    expect(worldEntity.hasComponents(TestComponent, AnotherComponent)).toBe(true);

    // Add a third component class for testing
    class ThirdComponent extends Component {}
    expect(worldEntity.hasComponents(TestComponent, AnotherComponent, ThirdComponent)).toBe(false);

    expect(worldEntity.getComponent(TestComponent)).toBe(component1);
    expect(worldEntity.getComponent(AnotherComponent)).toBe(component2);
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
    // Without archetype provider, should use traditional storage
    const component = new TestComponent(42);
    entity.addComponent(component);

    const components = entity.getComponents();
    expect(components).toContain(component);
  });

  test('should handle internal component storage access', () => {
    const component = new TestComponent(42);
    entity.addComponent(component);

    const internalStorage = entity.getInternalComponentStorage();
    expect(internalStorage.has(TestComponent)).toBe(true);
    expect(internalStorage.get(TestComponent)).toBe(component);
  });

  test('should handle world integration priority over traditional storage', () => {
    // Add component to traditional storage (entity not in world)
    const traditionalComponent = new TestComponent(42);
    entity.addComponent(traditionalComponent);
    expect(entity.hasComponent(TestComponent)).toBe(true);
    expect(entity.getComponent(TestComponent)).toBe(traditionalComponent);

    // Now add entity to world - should use archetype storage
    const world = new World();
    world.addEntity(entity);

    // Add a different component through world's archetype system
    const worldComponent = new TestComponent(999);
    entity.addComponent(worldComponent);

    // Should now use world's archetype storage
    const component = entity.getComponent(TestComponent);
    expect(component).toBe(worldComponent);
    expect(component).not.toBe(traditionalComponent);
  });
});