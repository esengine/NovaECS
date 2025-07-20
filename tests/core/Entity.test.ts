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
});