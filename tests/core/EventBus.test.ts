import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { Event } from '../../src/core/Event';
import { EventPriority } from '../../src/utils/EventTypes';

class TestEvent extends Event {
  constructor(public readonly message: string) {
    super('TestEvent', EventPriority.Normal);
  }
}

class HighPriorityEvent extends Event {
  constructor(public readonly value: number) {
    super('HighPriorityEvent', EventPriority.High);
  }
}

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('String-based event subscription', () => {
    test('should subscribe to events by string type', () => {
      const listener = vi.fn();
      const listenerId = eventBus.on('TestEvent', listener);
      
      expect(typeof listenerId).toBe('string');
      expect(listenerId).toContain('listener_');
      expect(eventBus.hasListeners('TestEvent')).toBe(true);
      expect(eventBus.getListenerCount('TestEvent')).toBe(1);
    });

    test('should call listener when event is dispatched', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      const event = new TestEvent('hello');
      await eventBus.dispatch(event);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    test('should call multiple listeners in priority order', async () => {
      const calls: number[] = [];
      
      const listener1 = vi.fn(() => calls.push(1));
      const listener2 = vi.fn(() => calls.push(2));
      const listener3 = vi.fn(() => calls.push(3));
      
      eventBus.on('TestEvent', listener1, { priority: EventPriority.Low });
      eventBus.on('TestEvent', listener2, { priority: EventPriority.High });
      eventBus.on('TestEvent', listener3, { priority: EventPriority.Normal });
      
      const event = new TestEvent('test');
      await eventBus.dispatch(event);
      
      expect(calls).toEqual([2, 3, 1]); // High, Normal, Low
    });

    test('should handle once listeners', async () => {
      const listener = vi.fn();
      eventBus.once('TestEvent', listener);
      
      const event1 = new TestEvent('first');
      const event2 = new TestEvent('second');
      
      await eventBus.dispatch(event1);
      await eventBus.dispatch(event2);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event1);
      expect(eventBus.getListenerCount('TestEvent')).toBe(0);
    });

    test('should unsubscribe listeners', async () => {
      const listener = vi.fn();
      const listenerId = eventBus.on('TestEvent', listener);
      
      expect(eventBus.off(listenerId)).toBe(true);
      expect(eventBus.getListenerCount('TestEvent')).toBe(0);
      
      const event = new TestEvent('test');
      await eventBus.dispatch(event);
      
      expect(listener).not.toHaveBeenCalled();
    });

    test('should remove all listeners for event type', () => {
      eventBus.on('TestEvent', vi.fn());
      eventBus.on('TestEvent', vi.fn());
      eventBus.on('TestEvent', vi.fn());
      
      expect(eventBus.getListenerCount('TestEvent')).toBe(3);
      
      const removedCount = eventBus.offAll('TestEvent');
      expect(removedCount).toBe(3);
      expect(eventBus.getListenerCount('TestEvent')).toBe(0);
    });
  });

  describe('Type-based event subscription', () => {
    test('should subscribe to events by class type', () => {
      const listener = vi.fn();
      const listenerId = eventBus.onType(TestEvent, listener);
      
      expect(typeof listenerId).toBe('string');
      expect(listenerId).toContain('type_listener_');
      expect(eventBus.hasTypeListeners(TestEvent)).toBe(true);
      expect(eventBus.getTypeListenerCount(TestEvent)).toBe(1);
    });

    test('should call type listener when event is dispatched', async () => {
      const listener = vi.fn();
      eventBus.onType(TestEvent, listener);
      
      const event = new TestEvent('hello');
      await eventBus.dispatch(event);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    test('should handle once type listeners', async () => {
      const listener = vi.fn();
      eventBus.onceType(TestEvent, listener);
      
      const event1 = new TestEvent('first');
      const event2 = new TestEvent('second');
      
      await eventBus.dispatch(event1);
      await eventBus.dispatch(event2);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event1);
      expect(eventBus.getTypeListenerCount(TestEvent)).toBe(0);
    });

    test('should remove all type listeners', () => {
      eventBus.onType(TestEvent, vi.fn());
      eventBus.onType(TestEvent, vi.fn());
      
      expect(eventBus.getTypeListenerCount(TestEvent)).toBe(2);
      
      const removedCount = eventBus.offAllType(TestEvent);
      expect(removedCount).toBe(2);
      expect(eventBus.getTypeListenerCount(TestEvent)).toBe(0);
    });
  });

  describe('Event propagation', () => {
    test('should stop propagation when event.stopPropagation() is called', async () => {
      const listener1 = vi.fn((event: TestEvent) => {
        event.stopPropagation();
      });
      const listener2 = vi.fn();
      
      eventBus.on('TestEvent', listener1, { priority: EventPriority.High });
      eventBus.on('TestEvent', listener2, { priority: EventPriority.Low });
      
      const event = new TestEvent('test');
      await eventBus.dispatch(event, { stopPropagation: true });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
    });

    test('should consume event', async () => {
      const listener1 = vi.fn((event: TestEvent) => {
        event.consume();
      });
      const listener2 = vi.fn();
      
      eventBus.on('TestEvent', listener1, { priority: EventPriority.High });
      eventBus.on('TestEvent', listener2, { priority: EventPriority.Low });
      
      const event = new TestEvent('test');
      await eventBus.dispatch(event, { stopPropagation: true });
      
      expect(event.consumed).toBe(true);
      expect(event.propagationStopped).toBe(true);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle listener errors gracefully', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = vi.fn();
      
      eventBus.on('TestEvent', errorListener, { priority: EventPriority.High });
      eventBus.on('TestEvent', normalListener, { priority: EventPriority.Low });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const event = new TestEvent('test');
      await eventBus.dispatch(event);
      
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Statistics', () => {
    test('should track event statistics', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      const event = new TestEvent('test');
      await eventBus.dispatch(event);
      
      const stats = eventBus.getStatistics();
      expect(stats.totalDispatched).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    test('should update events per second', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      // Dispatch multiple events quickly
      for (let i = 0; i < 5; i++) {
        await eventBus.dispatch(new TestEvent(`test${i}`));
      }
      
      const stats = eventBus.getStatistics();
      expect(stats.totalDispatched).toBe(5);
    });
  });

  describe('Clear and cleanup', () => {
    test('should clear all listeners and reset statistics', () => {
      eventBus.on('TestEvent', vi.fn());
      eventBus.onType(TestEvent, vi.fn());
      
      expect(eventBus.getListenerCount('TestEvent')).toBe(1);
      expect(eventBus.getTypeListenerCount(TestEvent)).toBe(1);
      
      eventBus.clear();
      
      expect(eventBus.getListenerCount('TestEvent')).toBe(0);
      expect(eventBus.getTypeListenerCount(TestEvent)).toBe(0);
      
      const stats = eventBus.getStatistics();
      expect(stats.totalDispatched).toBe(0);
    });
  });

  describe('Async listeners', () => {
    test('should handle async listeners', async () => {
      const asyncListener = vi.fn(async (event: TestEvent) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed: ${event.message}`;
      });
      
      eventBus.on('TestEvent', asyncListener);
      
      const event = new TestEvent('async test');
      await eventBus.dispatch(event);
      
      expect(asyncListener).toHaveBeenCalledTimes(1);
      expect(asyncListener).toHaveBeenCalledWith(event);
    });
  });
});
