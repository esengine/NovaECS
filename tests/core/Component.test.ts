import { Component } from '../../src/core/Component';

class TestComponent extends Component {
  constructor(public value: number = 0) {
    super();
  }
}

describe('Component', () => {
  let component: TestComponent;

  beforeEach(() => {
    component = new TestComponent(42);
  });

  test('should initialize with enabled state', () => {
    expect(component.enabled).toBe(true);
  });

  test('should allow setting enabled state', () => {
    component.enabled = false;
    expect(component.enabled).toBe(false);
    
    component.enabled = true;
    expect(component.enabled).toBe(true);
  });

  test('should preserve component data', () => {
    expect(component.value).toBe(42);
  });

  test('should call lifecycle methods if defined', () => {
    const spyOnAdded = jest.fn();
    const spyOnRemoved = jest.fn();
    const spyReset = jest.fn();

    component.onAdded = spyOnAdded;
    component.onRemoved = spyOnRemoved;
    component.reset = spyReset;

    component.onAdded?.();
    component.onRemoved?.();
    component.reset?.();

    expect(spyOnAdded).toHaveBeenCalledTimes(1);
    expect(spyOnRemoved).toHaveBeenCalledTimes(1);
    expect(spyReset).toHaveBeenCalledTimes(1);
  });
});