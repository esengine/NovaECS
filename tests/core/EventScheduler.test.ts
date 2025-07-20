import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { EventScheduler } from '../../src/core/EventScheduler';
import { Event } from '../../src/core/Event';
import { EventPriority, EventProcessingMode } from '../../src/utils/EventTypes';

class TestEvent extends Event {
  constructor(public readonly message: string, priority = EventPriority.Normal) {
    super('TestEvent', priority);
  }
}

class DelayedEvent extends Event {
  constructor(public readonly value: number) {
    super('DelayedEvent', EventPriority.Normal, EventProcessingMode.Delayed);
  }
}

describe('EventScheduler', () => {
  let eventBus: EventBus;
  let scheduler: EventScheduler;

  beforeEach(() => {
    eventBus = new EventBus();
    scheduler = new EventScheduler(eventBus);
  });

  describe('Immediate events', () => {
    test('should process immediate events', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      const event = new TestEvent('immediate');
      scheduler.schedule(event, { processingMode: EventProcessingMode.Immediate });
      
      await scheduler.update(16);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    test('should process immediate events by priority', async () => {
      const calls: string[] = [];
      
      const listener1 = vi.fn((event: TestEvent) => calls.push(event.message));
      const listener2 = vi.fn((event: TestEvent) => calls.push(event.message));
      
      eventBus.on('TestEvent', listener1);
      eventBus.on('TestEvent', listener2);
      
      const lowEvent = new TestEvent('low', EventPriority.Low);
      const highEvent = new TestEvent('high', EventPriority.High);
      
      scheduler.schedule(lowEvent, { processingMode: EventProcessingMode.Immediate });
      scheduler.schedule(highEvent, { processingMode: EventProcessingMode.Immediate });
      
      await scheduler.update(16);
      
      // High priority should be processed first
      expect(calls).toEqual(['high', 'high', 'low', 'low']);
    });
  });

  describe('End of frame events', () => {
    test('should queue end of frame events', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      const event = new TestEvent('end of frame');
      scheduler.schedule(event, { processingMode: EventProcessingMode.EndOfFrame });
      
      await scheduler.update(16);
      
      // Should not be processed during update
      expect(listener).not.toHaveBeenCalled();
      
      await scheduler.processEndOfFrame();
      
      // Should be processed during end of frame
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('Next frame events', () => {
    test('should move next frame events to end of frame queue', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      const event = new TestEvent('next frame');
      scheduler.schedule(event, { processingMode: EventProcessingMode.NextFrame });
      
      await scheduler.update(16);
      
      // Should not be processed during first update
      expect(listener).not.toHaveBeenCalled();
      
      await scheduler.processEndOfFrame();
      
      // Should be processed during end of frame (moved from next frame queue)
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('Delayed events', () => {
    test('should process delayed events after delay', async () => {
      const listener = vi.fn();
      eventBus.on('DelayedEvent', listener);
      
      const event = new DelayedEvent(42);
      scheduler.schedule(event, { 
        processingMode: EventProcessingMode.Delayed,
        delay: 50 // 50ms delay
      });
      
      // Should not be processed immediately
      await scheduler.update(16);
      expect(listener).not.toHaveBeenCalled();
      
      // Wait for delay and process again
      await new Promise(resolve => setTimeout(resolve, 60));
      await scheduler.update(16);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    test('should not process delayed events before delay expires', async () => {
      const listener = vi.fn();
      eventBus.on('DelayedEvent', listener);
      
      const event = new DelayedEvent(42);
      scheduler.schedule(event, { 
        processingMode: EventProcessingMode.Delayed,
        delay: 100 // 100ms delay
      });
      
      // Process multiple times before delay expires
      await scheduler.update(16);
      await scheduler.update(16);
      await scheduler.update(16);
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Queue management', () => {
    test('should report queue sizes', () => {
      const immediateEvent = new TestEvent('immediate');
      const endOfFrameEvent = new TestEvent('end of frame');
      const nextFrameEvent = new TestEvent('next frame');
      const delayedEvent = new DelayedEvent(42);
      
      scheduler.schedule(immediateEvent, { processingMode: EventProcessingMode.Immediate });
      scheduler.schedule(endOfFrameEvent, { processingMode: EventProcessingMode.EndOfFrame });
      scheduler.schedule(nextFrameEvent, { processingMode: EventProcessingMode.NextFrame });
      scheduler.schedule(delayedEvent, { processingMode: EventProcessingMode.Delayed, delay: 100 });
      
      const sizes = scheduler.getQueueSizes();
      
      expect(sizes.immediate).toBe(1);
      expect(sizes.endOfFrame).toBe(1);
      expect(sizes.nextFrame).toBe(1);
      expect(sizes.delayed).toBe(1);
    });

    test('should clear all queues', () => {
      scheduler.schedule(new TestEvent('test1'), { processingMode: EventProcessingMode.Immediate });
      scheduler.schedule(new TestEvent('test2'), { processingMode: EventProcessingMode.EndOfFrame });
      scheduler.schedule(new TestEvent('test3'), { processingMode: EventProcessingMode.NextFrame });
      
      let sizes = scheduler.getQueueSizes();
      expect(sizes.immediate + sizes.endOfFrame + sizes.nextFrame).toBe(3);
      
      scheduler.clear();
      
      sizes = scheduler.getQueueSizes();
      expect(sizes.immediate).toBe(0);
      expect(sizes.endOfFrame).toBe(0);
      expect(sizes.nextFrame).toBe(0);
      expect(sizes.delayed).toBe(0);
    });
  });

  describe('Performance limits', () => {
    test('should respect max events per frame', async () => {
      const listener = vi.fn();
      eventBus.on('TestEvent', listener);
      
      scheduler.setMaxEventsPerFrame(2);
      
      // Schedule 5 immediate events
      for (let i = 0; i < 5; i++) {
        scheduler.schedule(new TestEvent(`event${i}`), { processingMode: EventProcessingMode.Immediate });
      }
      
      await scheduler.update(16);
      
      // Should only process 2 events
      expect(listener).toHaveBeenCalledTimes(2);
      
      // Remaining events should still be in queue
      const sizes = scheduler.getQueueSizes();
      expect(sizes.immediate).toBe(3);
    });

    test('should respect max processing time per frame', async () => {
      const slowListener = vi.fn(async () => {
        // Simulate slow processing
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      eventBus.on('TestEvent', slowListener);
      
      scheduler.setMaxProcessingTimePerFrame(5); // Very short time limit
      
      // Schedule multiple events
      for (let i = 0; i < 10; i++) {
        scheduler.schedule(new TestEvent(`event${i}`), { processingMode: EventProcessingMode.Immediate });
      }
      
      await scheduler.update(16);
      
      // Should not process all events due to time limit
      expect(slowListener).toHaveBeenCalledTimes(1);
      
      // Remaining events should still be in queue
      const sizes = scheduler.getQueueSizes();
      expect(sizes.immediate).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    test('should handle errors in scheduled events', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = vi.fn();
      
      eventBus.on('TestEvent', errorListener);
      eventBus.on('TestEvent', normalListener);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      scheduler.schedule(new TestEvent('error test'), { processingMode: EventProcessingMode.Immediate });
      
      await scheduler.update(16);
      
      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event processing modes from event', () => {
    test('should use event processing mode when no option provided', async () => {
      const listener = vi.fn();
      eventBus.on('DelayedEvent', listener);

      const delayedEvent = new DelayedEvent(42); // Has Delayed processing mode by default

      // Record the time before scheduling to ensure proper timing
      const beforeSchedule = Date.now();
      scheduler.schedule(delayedEvent); // No options provided

      // Immediately check - should not be processed yet
      await scheduler.update(16);

      // Should not be processed immediately due to event's processing mode
      expect(listener).not.toHaveBeenCalled();

      // Should be in delayed queue
      const sizes = scheduler.getQueueSizes();
      expect(sizes.delayed).toBe(1);

      // Wait for the delay to pass and then process
      const afterSchedule = Date.now();
      const waitTime = Math.max(2, beforeSchedule + 2 - afterSchedule); // Ensure at least 2ms have passed
      await new Promise(resolve => setTimeout(resolve, waitTime));

      await scheduler.update(16);

      // Now it should be processed
      expect(listener).toHaveBeenCalledWith(delayedEvent);
      expect(scheduler.getQueueSizes().delayed).toBe(0);
    });
  });
});
