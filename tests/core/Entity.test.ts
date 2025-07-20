import { Entity } from '../../src/core/Entity';
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
    component.onAdded = jest.fn();
    component.onRemoved = jest.fn();

    entity.addComponent(component);
    expect(component.onAdded).toHaveBeenCalled();

    entity.removeComponent(TestComponent);
    expect(component.onRemoved).toHaveBeenCalled();
  });

  test('should handle archetype storage mode', () => {
    // Test traditional storage mode (default)
    expect(entity.hasComponent(TestComponent)).toBe(false);

    entity.addComponent(new TestComponent(42));
    expect(entity.hasComponent(TestComponent)).toBe(true);

    const component = entity.getComponent(TestComponent);
    expect(component).toBeDefined();
    expect((component as TestComponent).value).toBe(42);

    // Switch to archetype storage mode
    entity.setArchetypeStorageMode(true);

    // Component should still be accessible
    expect(entity.hasComponent(TestComponent)).toBe(true);
    const archetypeComponent = entity.getComponent(TestComponent);
    expect(archetypeComponent).toBeDefined();
  });

  test('should handle external component provider', () => {
    const externalComponent = new TestComponent(999);
    const provider = jest.fn().mockReturnValue(externalComponent);

    entity.setExternalComponentProvider(provider);
    entity.setArchetypeStorageMode(true);

    const component = entity.getComponent(TestComponent);
    expect(provider).toHaveBeenCalledWith(entity.id, TestComponent);
    expect(component).toBe(externalComponent);
  });

  test('should handle change callbacks', () => {
    const changeCallback = jest.fn();
    entity.setChangeCallback(changeCallback);
    entity.setArchetypeStorageMode(true); // Enable archetype mode for callbacks

    const component = new TestComponent(42);
    entity.addComponent(component);

    expect(changeCallback).toHaveBeenCalledWith(
      entity.id,
      TestComponent,
      component,
      true
    );

    entity.removeComponent(TestComponent);

    // In archetype mode, removed components are passed as null
    expect(changeCallback).toHaveBeenLastCalledWith(
      entity.id,
      TestComponent,
      null,
      false
    );
  });

  test('should handle archetype mode component operations', () => {
    const changeCallback = jest.fn();
    const externalProvider = jest.fn();

    entity.setArchetypeStorageMode(true);
    entity.setChangeCallback(changeCallback);
    entity.setExternalComponentProvider(externalProvider);

    // Add component in archetype mode
    const component = new TestComponent(42);
    entity.addComponent(component);

    expect(changeCallback).toHaveBeenCalledWith(
      entity.id,
      TestComponent,
      component,
      true
    );

    // Get component should use external provider
    externalProvider.mockReturnValue(component);
    const retrievedComponent = entity.getComponent(TestComponent);
    expect(externalProvider).toHaveBeenCalledWith(entity.id, TestComponent);
    expect(retrievedComponent).toBe(component);

    // hasComponent should also use external provider
    externalProvider.mockReturnValue(component);
    expect(entity.hasComponent(TestComponent)).toBe(true);

    externalProvider.mockReturnValue(undefined);
    expect(entity.hasComponent(TestComponent)).toBe(false);
  });

  test('should handle hasComponents with archetype storage', () => {
    const component1 = new TestComponent(1);
    const component2 = new AnotherComponent('test');
    const externalProvider = jest.fn();

    entity.setArchetypeStorageMode(true);
    entity.setExternalComponentProvider(externalProvider);

    // Mock provider to return components
    externalProvider.mockImplementation((_id, componentType) => {
      if (componentType === TestComponent) return component1;
      if (componentType === AnotherComponent) return component2;
      return undefined;
    });

    expect(entity.hasComponents(TestComponent)).toBe(true);
    expect(entity.hasComponents(TestComponent, AnotherComponent)).toBe(true);

    // Add a third component class for testing
    class ThirdComponent extends Component {}
    expect(entity.hasComponents(TestComponent, AnotherComponent, ThirdComponent)).toBe(false);
  });

  test('should handle getComponents in archetype mode', () => {
    entity.setArchetypeStorageMode(true);

    // In archetype mode, getComponents returns empty array since components are stored externally
    const components = entity.getComponents();
    expect(components).toEqual([]);
  });

  test('should handle getComponentTypes in archetype mode', () => {
    entity.setArchetypeStorageMode(true);

    // In archetype mode, getComponentTypes returns empty array since components are stored externally
    const componentTypes = entity.getComponentTypes();
    expect(componentTypes).toEqual([]);
  });

  test('should handle internal component storage access', () => {
    const component = new TestComponent(42);
    entity.addComponent(component);

    const internalStorage = entity.getInternalComponentStorage();
    expect(internalStorage.has(TestComponent)).toBe(true);
    expect(internalStorage.get(TestComponent)).toBe(component);
  });

  test('should handle mixed storage modes', () => {
    // Start in traditional mode
    entity.addComponent(new TestComponent(42));
    expect(entity.hasComponent(TestComponent)).toBe(true);

    // Switch to archetype mode
    entity.setArchetypeStorageMode(true);

    // Component should still be accessible from internal storage
    expect(entity.hasComponent(TestComponent)).toBe(true);

    // Switch back to traditional mode
    entity.setArchetypeStorageMode(false);

    // Component should still be accessible
    expect(entity.hasComponent(TestComponent)).toBe(true);
  });
});