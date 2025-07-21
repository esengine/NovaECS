import { ComponentPool, ComponentPoolManager } from '../../src/core/ComponentPool';
import { Component } from '../../src/core/Component';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

class TestComponent extends Component {
  constructor(public value: number = 0) {
    super();
  }

  reset(): void {
    this.value = 0;
    this.enabled = true;
  }
}

class AnotherComponent extends Component {
  constructor(public name: string = '') {
    super();
  }

  reset(): void {
    this.name = '';
    this.enabled = true;
  }
}

describe('ComponentPool', () => {
  let pool: ComponentPool<TestComponent>;

  beforeEach(() => {
    pool = new ComponentPool(TestComponent, {
      initialSize: 5,
      maxSize: 20,
      autoCleanup: false,
      cleanupInterval: 1000,
      maxIdleTime: 500
    });
  });

  afterEach(() => {
    pool.destroy();
  });

  test('should initialize with correct configuration', () => {
    expect(pool.componentType).toBe(TestComponent);
    expect(pool.config.initialSize).toBe(5);
    expect(pool.config.maxSize).toBe(20);
    expect(pool.config.autoCleanup).toBe(false);
  });

  test('should preload initial components', () => {
    const stats = pool.statistics;
    expect(stats.poolSize).toBe(5);
    expect(stats.totalCreated).toBe(5);
    expect(stats.inUse).toBe(0);
  });

  test('should acquire components from pool', () => {
    const component1 = pool.acquire();
    const component2 = pool.acquire();

    expect(component1).toBeInstanceOf(TestComponent);
    expect(component2).toBeInstanceOf(TestComponent);
    expect(component1).not.toBe(component2);

    const stats = pool.statistics;
    expect(stats.inUse).toBe(2);
    expect(stats.poolSize).toBe(3); // 5 initial - 2 acquired
  });

  test('should create new components when pool is empty', () => {
    // Acquire all preloaded components
    const components: TestComponent[] = [];
    for (let i = 0; i < 5; i++) {
      components.push(pool.acquire());
    }

    // Acquire one more (should create new)
    const newComponent = pool.acquire();
    expect(newComponent).toBeInstanceOf(TestComponent);

    const stats = pool.statistics;
    expect(stats.totalCreated).toBe(6); // 5 initial + 1 new
    expect(stats.inUse).toBe(6);
    expect(stats.poolSize).toBe(0);
  });

  test('should release components back to pool', () => {
    const component = pool.acquire();
    component.value = 42;

    pool.release(component);

    const stats = pool.statistics;
    expect(stats.inUse).toBe(0);
    expect(stats.poolSize).toBe(5); // Back to initial size

    // Verify component was reset
    expect(component.value).toBe(0);
    expect(component.enabled).toBe(true);
  });

  test('should not exceed max pool size', () => {
    // Fill pool to max capacity
    const components: TestComponent[] = [];
    for (let i = 0; i < 20; i++) {
      components.push(pool.acquire());
    }

    // Release all components
    for (const component of components) {
      pool.release(component);
    }

    const stats = pool.statistics;
    expect(stats.poolSize).toBe(20); // Should not exceed maxSize
  });

  test('should warn when releasing non-acquired component', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const component = new TestComponent();

    pool.release(component);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Attempting to release component that was not acquired from this pool'
    );

    consoleSpy.mockRestore();
  });

  test('should preload additional components', () => {
    pool.preload(10);

    const stats = pool.statistics;
    expect(stats.poolSize).toBe(10); // Should have 10 total (5 initial + 5 more, limited by preload)
    expect(stats.totalCreated).toBe(10);
  });

  test('should clear all components', () => {
    const component = pool.acquire();
    const onRemovedSpy = vi.fn();
    component.onRemoved = onRemovedSpy;

    pool.release(component);
    pool.clear();

    const stats = pool.statistics;
    expect(stats.poolSize).toBe(0);
    expect(onRemovedSpy).toHaveBeenCalled();
  });

  test('should cleanup idle components when enabled', () => {
    const poolWithCleanup = new ComponentPool(TestComponent, {
      initialSize: 3,
      maxSize: 10,
      autoCleanup: true,
      cleanupInterval: 100,
      maxIdleTime: 50
    });

    const component = poolWithCleanup.acquire();
    poolWithCleanup.release(component);

    // Wait for cleanup
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        poolWithCleanup.cleanup();
        const stats = poolWithCleanup.statistics;
        expect(stats.poolSize).toBeLessThan(3); // Some components should be cleaned up
        poolWithCleanup.destroy();
        resolve();
      }, 100);
    });
  });

  test('should calculate hit rate correctly', () => {
    // Acquire and release to generate hits
    const component1 = pool.acquire();
    const component2 = pool.acquire();
    pool.release(component1);
    pool.release(component2);

    // Acquire again (should be hits)
    pool.acquire();
    pool.acquire();

    const stats = pool.statistics;
    expect(stats.hitRate).toBeGreaterThan(0);
  });
});

describe('ComponentPoolManager', () => {
  let manager: ComponentPoolManager;

  beforeEach(() => {
    manager = new ComponentPoolManager({
      initialSize: 3,
      maxSize: 15,
      autoCleanup: false
    });
  });

  afterEach(() => {
    manager.destroyAll();
  });

  test('should create and manage multiple pools', () => {
    const testPool = manager.getPool(TestComponent);
    const anotherPool = manager.getPool(AnotherComponent);

    expect(testPool).toBeInstanceOf(ComponentPool);
    expect(anotherPool).toBeInstanceOf(ComponentPool);
    expect(testPool).not.toBe(anotherPool);
  });

  test('should return same pool for same component type', () => {
    const pool1 = manager.getPool(TestComponent);
    const pool2 = manager.getPool(TestComponent);

    expect(pool1).toBe(pool2);
  });

  test('should use custom config for specific pools', () => {
    const pool = manager.getPool(TestComponent, {
      initialSize: 10,
      maxSize: 50
    });

    expect(pool.config.initialSize).toBe(10);
    expect(pool.config.maxSize).toBe(50);
  });

  test('should get statistics for all pools', () => {
    manager.getPool(TestComponent);
    manager.getPool(AnotherComponent);

    const allStats = manager.getAllStatistics();

    expect(allStats.size).toBe(2);
    expect(allStats.has('TestComponent')).toBe(true);
    expect(allStats.has('AnotherComponent')).toBe(true);
  });

  test('should cleanup all pools', () => {
    const testPool = manager.getPool(TestComponent);
    const anotherPool = manager.getPool(AnotherComponent);

    const cleanupSpy1 = vi.spyOn(testPool, 'cleanup');
    const cleanupSpy2 = vi.spyOn(anotherPool, 'cleanup');

    manager.cleanupAll();

    expect(cleanupSpy1).toHaveBeenCalled();
    expect(cleanupSpy2).toHaveBeenCalled();
  });

  test('should destroy all pools', () => {
    const testPool = manager.getPool(TestComponent);
    const destroySpy = vi.spyOn(testPool, 'destroy');

    manager.destroyAll();

    expect(destroySpy).toHaveBeenCalled();
    expect(manager.getAllStatistics().size).toBe(0);
  });
});
