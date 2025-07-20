import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventPool, EventPoolManager, globalEventPoolManager, DEFAULT_EVENT_POOL_CONFIG } from '../../src/core/EventPool';
import { Event } from '../../src/core/Event';
import { EventPriority } from '../../src/utils/EventTypes';

// Test event classes
class TestEvent extends Event {
  public value: number = 0;

  constructor(...args: unknown[]) {
    super('TestEvent', EventPriority.Normal);
    if (args.length > 0 && typeof args[0] === 'number') {
      this.value = args[0];
    }
  }

  reset(): void {
    super.reset();
    this.value = 0;
  }

  initialize(...args: unknown[]): void {
    if (args.length > 0 && typeof args[0] === 'number') {
      this.value = args[0];
    }
  }
}

class AnotherTestEvent extends Event {
  public message: string = '';
  public count: number = 0;

  constructor(...args: unknown[]) {
    super('AnotherTestEvent', EventPriority.High);
    if (args.length > 0 && typeof args[0] === 'string') {
      this.message = args[0];
    }
    if (args.length > 1 && typeof args[1] === 'number') {
      this.count = args[1];
    }
  }

  reset(): void {
    super.reset();
    this.message = '';
    this.count = 0;
  }

  initialize(...args: unknown[]): void {
    if (args.length > 0 && typeof args[0] === 'string') {
      this.message = args[0];
    }
    if (args.length > 1 && typeof args[1] === 'number') {
      this.count = args[1];
    }
  }
}

class CustomTestEvent extends Event {
  public data: { x: number; y: number } = { x: 0, y: 0 };

  constructor(...args: unknown[]) {
    super('CustomTestEvent', EventPriority.Low);
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      const data = args[0] as { x: number; y: number };
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        this.data = data;
      }
    }
  }

  reset(): void {
    super.reset();
    this.data = { x: 0, y: 0 };
  }

  initialize(...args: unknown[]): void {
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      const data = args[0] as { x: number; y: number };
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        this.data = data;
      }
    }
  }
}

describe('EventPool', () => {
  let pool: EventPool<TestEvent>;

  beforeEach(() => {
    pool = new EventPool(TestEvent, {
      initialSize: 5,
      maxSize: 10,
      autoCleanup: false,
      cleanupInterval: 1000,
      maxIdleTime: 2000
    });
  });

  afterEach(() => {
    pool.dispose();
  });

  describe('Construction and Configuration', () => {
    it('should create pool with default configuration', () => {
      const defaultPool = new EventPool(TestEvent);
      
      expect(defaultPool.eventType).toBe(TestEvent);
      expect(defaultPool.config.initialSize).toBe(DEFAULT_EVENT_POOL_CONFIG.initialSize);
      expect(defaultPool.config.maxSize).toBe(DEFAULT_EVENT_POOL_CONFIG.maxSize);
      expect(defaultPool.size()).toBe(DEFAULT_EVENT_POOL_CONFIG.initialSize);
      
      defaultPool.dispose();
    });

    it('should create pool with custom configuration', () => {
      expect(pool.eventType).toBe(TestEvent);
      expect(pool.config.initialSize).toBe(5);
      expect(pool.config.maxSize).toBe(10);
      expect(pool.config.autoCleanup).toBe(false);
      expect(pool.size()).toBe(5);
    });

    it('should initialize pool with correct number of events', () => {
      expect(pool.size()).toBe(5);
      expect(pool.inUseCount()).toBe(0);
      
      const stats = pool.statistics;
      expect(stats.totalCreated).toBe(5);
      expect(stats.poolSize).toBe(5);
      expect(stats.inUse).toBe(0);
    });
  });

  describe('Acquire and Release Operations', () => {
    it('should acquire event from pool', () => {
      const initialSize = pool.size();
      const event = pool.acquire(42);
      
      expect(event).toBeInstanceOf(TestEvent);
      expect(event.value).toBe(42);
      expect(pool.size()).toBe(initialSize - 1);
      expect(pool.inUseCount()).toBe(1);
      expect(pool.isInUse(event)).toBe(true);
    });

    it('should release event back to pool', () => {
      const event = pool.acquire(100);
      const sizeAfterAcquire = pool.size();
      
      pool.release(event);
      
      expect(pool.size()).toBe(sizeAfterAcquire + 1);
      expect(pool.inUseCount()).toBe(0);
      expect(pool.isInUse(event)).toBe(false);
    });

    it('should reset event when acquired from pool', () => {
      const event = pool.acquire(123);
      event.value = 999;
      event.consume();
      
      pool.release(event);
      
      const reusedEvent = pool.acquire(456);
      expect(reusedEvent).toBe(event); // Should be same object
      expect(reusedEvent.value).toBe(456);
      expect(reusedEvent.consumed).toBe(false);
      expect(reusedEvent.propagationStopped).toBe(false);
    });

    it('should create new event when pool is empty', () => {
      // Acquire all events from pool
      const events: TestEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events.push(pool.acquire(i));
      }
      
      expect(pool.size()).toBe(0);
      
      // Acquire one more should create new event
      const newEvent = pool.acquire(999);
      expect(newEvent).toBeInstanceOf(TestEvent);
      expect(newEvent.value).toBe(999);
      expect(pool.inUseCount()).toBe(11);
      
      // Clean up
      events.forEach(e => pool.release(e));
      pool.release(newEvent);
    });

    it('should not release event not in use', () => {
      const event = new TestEvent(123);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      pool.release(event);
      
      expect(consoleSpy).toHaveBeenCalledWith('Attempting to release event that is not in use');
      
      consoleSpy.mockRestore();
    });

    it('should not add event to pool when at max capacity', () => {
      // Fill pool to max capacity
      const events: TestEvent[] = [];
      for (let i = 0; i < 15; i++) { // More than maxSize (10)
        events.push(pool.acquire(i));
      }
      
      expect(pool.inUseCount()).toBe(15);
      
      // Release all events
      events.forEach(e => pool.release(e));
      
      // Pool should not exceed max size
      expect(pool.size()).toBeLessThanOrEqual(10);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track correct statistics', () => {
      const event1 = pool.acquire(1);
      const event2 = pool.acquire(2);
      
      const stats = pool.statistics;
      expect(stats.totalCreated).toBe(5); // Initial pool size
      expect(stats.poolSize).toBe(3); // 5 - 2 acquired
      expect(stats.inUse).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      pool.release(event1);
      
      const updatedStats = pool.statistics;
      expect(updatedStats.poolSize).toBe(4);
      expect(updatedStats.inUse).toBe(1);
      
      pool.release(event2);
    });

    it('should calculate hit rate correctly', () => {
      // Acquire from pool (hit)
      const event1 = pool.acquire(1);
      pool.release(event1);
      
      // Acquire same event again (hit)
      const event2 = pool.acquire(2);
      
      const stats = pool.statistics;
      expect(stats.hitRate).toBeGreaterThan(0);
      
      pool.release(event2);
    });

    it('should track memory usage estimation', () => {
      const stats = pool.statistics;
      expect(stats.memoryUsage).toBe((stats.poolSize + stats.inUse) * 64);
    });
  });

  describe('Pool Management', () => {
    it('should clear pool correctly', () => {
      const event = pool.acquire(123);
      
      pool.clear();
      
      expect(pool.size()).toBe(0);
      expect(pool.inUseCount()).toBe(0);
      expect(pool.isInUse(event)).toBe(false);
      
      const stats = pool.statistics;
      expect(stats.poolSize).toBe(0);
      expect(stats.inUse).toBe(0);
    });

    it('should dispose pool correctly', () => {
      pool.acquire(123);

      pool.dispose();
      
      expect(pool.size()).toBe(0);
      expect(pool.inUseCount()).toBe(0);
    });
  });

  describe('Cleanup Operations', () => {
    it('should perform manual cleanup', () => {
      const cleanupPool = new EventPool(TestEvent, {
        initialSize: 3,
        maxSize: 10,
        autoCleanup: true,
        maxIdleTime: 100 // Very short for testing
      });
      
      const event = cleanupPool.acquire(1);
      cleanupPool.release(event);
      
      // Wait for idle time to pass
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const initialSize = cleanupPool.size();
          cleanupPool.cleanup();
          
          // Size might be reduced after cleanup
          expect(cleanupPool.size()).toBeLessThanOrEqual(initialSize);
          
          cleanupPool.dispose();
          resolve();
        }, 150);
      });
    }, 1000);

    it('should handle cleanup with auto cleanup disabled', () => {
      const event = pool.acquire(1);
      pool.release(event);
      
      const initialSize = pool.size();
      pool.cleanup();
      
      // Size should not change when auto cleanup is disabled
      expect(pool.size()).toBe(initialSize);
    });
  });
});

describe('EventPoolManager', () => {
  let manager: EventPoolManager;

  beforeEach(() => {
    manager = new EventPoolManager({
      initialSize: 3,
      maxSize: 8,
      autoCleanup: false
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Pool Management', () => {
    it('should create and manage pools automatically', () => {
      const pool1 = manager.getPool(TestEvent);
      const pool2 = manager.getPool(TestEvent);
      
      expect(pool1).toBe(pool2); // Should return same pool
      expect(pool1.eventType).toBe(TestEvent);
      expect(pool1.config.initialSize).toBe(3);
    });

    it('should create pools with custom configuration', () => {
      const customPool = manager.createPool(AnotherTestEvent, {
        initialSize: 10,
        maxSize: 20
      });
      
      expect(customPool.eventType).toBe(AnotherTestEvent);
      expect(customPool.config.initialSize).toBe(10);
      expect(customPool.config.maxSize).toBe(20);
    });

    it('should remove pools correctly', () => {
      const pool = manager.getPool(TestEvent);
      const disposeSpy = vi.spyOn(pool, 'dispose');
      
      const removed = manager.removePool(TestEvent);
      
      expect(removed).toBe(true);
      expect(disposeSpy).toHaveBeenCalled();
      
      // Getting pool again should create new one
      const newPool = manager.getPool(TestEvent);
      expect(newPool).not.toBe(pool);
      
      disposeSpy.mockRestore();
    });

    it('should return false when removing non-existent pool', () => {
      const removed = manager.removePool(CustomTestEvent);
      expect(removed).toBe(false);
    });
  });

  describe('Event Operations', () => {
    it('should acquire events through manager', () => {
      const event1 = manager.acquire(TestEvent, 123);
      const event2 = manager.acquire(AnotherTestEvent, 'test', 456);
      
      expect(event1).toBeInstanceOf(TestEvent);
      expect(event1.value).toBe(123);
      
      expect(event2).toBeInstanceOf(AnotherTestEvent);
      expect(event2.message).toBe('test');
      expect(event2.count).toBe(456);
      
      manager.release(event1);
      manager.release(event2);
    });

    it('should release events to correct pools', () => {
      const event = manager.acquire(TestEvent, 789);
      const pool = manager.getPool(TestEvent);
      const initialSize = pool.size();
      
      manager.release(event);
      
      expect(pool.size()).toBe(initialSize + 1);
    });

    it('should handle release of unknown event type', () => {
      const event = new CustomTestEvent();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      manager.release(event);
      
      expect(consoleSpy).toHaveBeenCalledWith('No pool found for event type:', 'CustomTestEvent');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide statistics for all pools', () => {
      const event1 = manager.acquire(TestEvent, 1);
      const event2 = manager.acquire(AnotherTestEvent, 'hello', 2);
      
      const stats = manager.getStatistics();
      
      expect(stats.has('TestEvent')).toBe(true);
      expect(stats.has('AnotherTestEvent')).toBe(true);
      
      const testEventStats = stats.get('TestEvent')!;
      expect(testEventStats.inUse).toBe(1);
      
      manager.release(event1);
      manager.release(event2);
    });

    it('should calculate total memory usage', () => {
      manager.acquire(TestEvent, 1);
      manager.acquire(AnotherTestEvent, 'test', 2);
      
      const totalMemory = manager.getTotalMemoryUsage();
      expect(totalMemory).toBeGreaterThan(0);
    });

    it('should track pool count', () => {
      expect(manager.getPoolCount()).toBe(0);
      
      manager.getPool(TestEvent);
      expect(manager.getPoolCount()).toBe(1);
      
      manager.getPool(AnotherTestEvent);
      expect(manager.getPoolCount()).toBe(2);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup all pools', () => {
      const pool1 = manager.getPool(TestEvent);
      const pool2 = manager.getPool(AnotherTestEvent);
      
      const cleanup1Spy = vi.spyOn(pool1, 'cleanup');
      const cleanup2Spy = vi.spyOn(pool2, 'cleanup');
      
      manager.cleanup();
      
      expect(cleanup1Spy).toHaveBeenCalled();
      expect(cleanup2Spy).toHaveBeenCalled();
      
      cleanup1Spy.mockRestore();
      cleanup2Spy.mockRestore();
    });

    it('should clear all pools', () => {
      const pool1 = manager.getPool(TestEvent);
      const pool2 = manager.getPool(AnotherTestEvent);
      
      const clear1Spy = vi.spyOn(pool1, 'clear');
      const clear2Spy = vi.spyOn(pool2, 'clear');
      
      manager.clear();
      
      expect(clear1Spy).toHaveBeenCalled();
      expect(clear2Spy).toHaveBeenCalled();
      
      clear1Spy.mockRestore();
      clear2Spy.mockRestore();
    });

    it('should dispose all pools', () => {
      const pool1 = manager.getPool(TestEvent);
      const pool2 = manager.getPool(AnotherTestEvent);
      
      const dispose1Spy = vi.spyOn(pool1, 'dispose');
      const dispose2Spy = vi.spyOn(pool2, 'dispose');
      
      manager.dispose();
      
      expect(dispose1Spy).toHaveBeenCalled();
      expect(dispose2Spy).toHaveBeenCalled();
      expect(manager.getPoolCount()).toBe(0);
      
      dispose1Spy.mockRestore();
      dispose2Spy.mockRestore();
    });
  });
});

describe('Global Event Pool Manager', () => {
  beforeEach(() => {
    globalEventPoolManager.clear();
  });

  afterEach(() => {
    globalEventPoolManager.clear();
  });

  it('should provide global access to event pools', () => {
    const event1 = globalEventPoolManager.acquire(TestEvent, 999);
    const event2 = globalEventPoolManager.acquire(TestEvent, 888);
    
    expect(event1).toBeInstanceOf(TestEvent);
    expect(event2).toBeInstanceOf(TestEvent);
    expect(event1.value).toBe(999);
    expect(event2.value).toBe(888);
    
    globalEventPoolManager.release(event1);
    globalEventPoolManager.release(event2);
  });

  it('should maintain separate pools for different event types', () => {
    const testEvent = globalEventPoolManager.acquire(TestEvent, 111);
    const anotherEvent = globalEventPoolManager.acquire(AnotherTestEvent, 'global', 222);
    
    const stats = globalEventPoolManager.getStatistics();
    expect(stats.size).toBe(2);
    expect(stats.has('TestEvent')).toBe(true);
    expect(stats.has('AnotherTestEvent')).toBe(true);
    
    globalEventPoolManager.release(testEvent);
    globalEventPoolManager.release(anotherEvent);
  });

  it('should provide global statistics', () => {
    globalEventPoolManager.acquire(TestEvent, 1);
    globalEventPoolManager.acquire(AnotherTestEvent, 'test', 2);
    
    const totalMemory = globalEventPoolManager.getTotalMemoryUsage();
    const poolCount = globalEventPoolManager.getPoolCount();
    
    expect(totalMemory).toBeGreaterThan(0);
    expect(poolCount).toBe(2);
  });
});

describe('Performance Tests', () => {
  it('should demonstrate performance benefits of pooling', async () => {
    const pool = new EventPool(TestEvent, { initialSize: 50, maxSize: 200 });

    // Test pool reuse by acquiring and releasing events in cycles
    const cycleSize = 100;
    const cycles = 10;

    for (let cycle = 0; cycle < cycles; cycle++) {
      const events: TestEvent[] = [];

      // Acquire events
      for (let i = 0; i < cycleSize; i++) {
        events.push(pool.acquire(cycle * cycleSize + i));
      }

      // Release events back to pool
      events.forEach(e => pool.release(e));
    }

    const stats = pool.statistics;
    const totalOperations = cycleSize * cycles;

    // After the first cycle, subsequent cycles should reuse events
    expect(stats.totalCreated).toBeLessThan(totalOperations); // Should reuse events
    expect(stats.hitRate).toBeGreaterThan(0); // Should have cache hits

    // Verify that we created significantly fewer events than total operations
    expect(stats.totalCreated).toBeLessThanOrEqual(cycleSize + 50); // Should be close to initial size

    pool.dispose();
  }, 5000);

  it('should handle high-frequency acquire/release cycles', () => {
    const pool = new EventPool(TestEvent, { initialSize: 10, maxSize: 50 });
    const cycles = 100;
    
    for (let i = 0; i < cycles; i++) {
      const events: TestEvent[] = [];
      
      // Acquire multiple events
      for (let j = 0; j < 10; j++) {
        events.push(pool.acquire(i * 10 + j));
      }
      
      // Release all events
      events.forEach(e => pool.release(e));
    }
    
    const stats = pool.statistics;
    expect(stats.totalCreated).toBeLessThan(cycles * 10); // Should reuse many events
    expect(stats.poolSize).toBeGreaterThan(0); // Should have events available
    expect(stats.inUse).toBe(0); // No events should be in use
    
    pool.dispose();
  });
});