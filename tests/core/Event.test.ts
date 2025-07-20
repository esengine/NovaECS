import { beforeEach, describe, expect, test } from 'vitest';
import { 
  Event, 
  TypedEvent, 
  EntityCreatedEvent, 
  EntityDestroyedEvent,
  ComponentAddedEvent,
  ComponentRemovedEvent 
} from '../../src/core/Event';
import { EventPriority, EventProcessingMode } from '../../src/utils/EventTypes';

class TestEvent extends Event {
  constructor(public readonly message: string) {
    super('TestEvent', EventPriority.Normal);
  }
}

class HighPriorityEvent extends Event {
  constructor() {
    super('HighPriorityEvent', EventPriority.High);
  }
}

describe('Event', () => {
  let event: TestEvent;

  beforeEach(() => {
    event = new TestEvent('test message');
  });

  test('should create event with correct properties', () => {
    expect(event.type).toBe('TestEvent');
    expect(event.priority).toBe(EventPriority.Normal);
    expect(event.processingMode).toBe(EventProcessingMode.Immediate);
    expect(event.message).toBe('test message');
    expect(event.id).toContain('TestEvent_');
    expect(event.timestamp).toBeGreaterThan(0);
  });

  test('should have unique IDs', () => {
    const event1 = new TestEvent('message1');
    const event2 = new TestEvent('message2');
    
    expect(event1.id).not.toBe(event2.id);
  });

  test('should start with propagation not stopped', () => {
    expect(event.propagationStopped).toBe(false);
    expect(event.consumed).toBe(false);
  });

  test('should stop propagation', () => {
    event.stopPropagation();
    expect(event.propagationStopped).toBe(true);
    expect(event.consumed).toBe(false);
  });

  test('should consume event', () => {
    event.consume();
    expect(event.consumed).toBe(true);
    expect(event.propagationStopped).toBe(true);
  });

  test('should reset event state', () => {
    event.stopPropagation();
    event.consume();
    
    event.reset();
    
    expect(event.propagationStopped).toBe(false);
    expect(event.consumed).toBe(false);
  });

  test('should calculate age correctly', () => {
    const age1 = event.getAge();
    expect(age1).toBeGreaterThanOrEqual(0);
    
    // Wait a bit and check age increased
    setTimeout(() => {
      const age2 = event.getAge();
      expect(age2).toBeGreaterThan(age1);
    }, 10);
  });

  test('should create string representation', () => {
    const str = event.toString();
    expect(str).toContain('TestEvent');
    expect(str).toContain(event.id);
    expect(str).toContain('priority: 50');
  });
});

describe('TypedEvent', () => {
  interface TestData {
    value: number;
    name: string;
  }

  test('should create typed event with data', () => {
    const data: TestData = { value: 42, name: 'test' };
    const event = new TypedEvent('TypedTest', data, EventPriority.High);
    
    expect(event.type).toBe('TypedTest');
    expect(event.data).toBe(data);
    expect(event.data.value).toBe(42);
    expect(event.data.name).toBe('test');
    expect(event.priority).toBe(EventPriority.High);
  });
});

describe('System Events', () => {
  test('should create EntityCreatedEvent', () => {
    const event = new EntityCreatedEvent(123);
    
    expect(event.type).toBe('EntityCreated');
    expect(event.entityId).toBe(123);
    expect(event.priority).toBe(EventPriority.Normal);
  });

  test('should create EntityDestroyedEvent', () => {
    const event = new EntityDestroyedEvent(456);
    
    expect(event.type).toBe('EntityDestroyed');
    expect(event.entityId).toBe(456);
    expect(event.priority).toBe(EventPriority.Normal);
  });

  test('should create ComponentAddedEvent', () => {
    const event = new ComponentAddedEvent(789, 'TestComponent');
    
    expect(event.type).toBe('ComponentAdded');
    expect(event.entityId).toBe(789);
    expect(event.componentType).toBe('TestComponent');
    expect(event.priority).toBe(EventPriority.Normal);
  });

  test('should create ComponentRemovedEvent', () => {
    const event = new ComponentRemovedEvent(101, 'TestComponent');
    
    expect(event.type).toBe('ComponentRemoved');
    expect(event.entityId).toBe(101);
    expect(event.componentType).toBe('TestComponent');
    expect(event.priority).toBe(EventPriority.Normal);
  });
});

describe('Event Priority', () => {
  test('should create events with different priorities', () => {
    const lowEvent = new TestEvent('low');
    lowEvent.priority = EventPriority.Low;
    
    const highEvent = new HighPriorityEvent();
    
    expect(lowEvent.priority).toBe(EventPriority.Low);
    expect(highEvent.priority).toBe(EventPriority.High);
    expect(highEvent.priority).toBeGreaterThan(lowEvent.priority);
  });
});

describe('Event Processing Mode', () => {
  test('should create events with different processing modes', () => {
    const immediateEvent = new TestEvent('immediate');
    const delayedEvent = new TypedEvent('delayed', {}, EventPriority.Normal, EventProcessingMode.Delayed);
    
    expect(immediateEvent.processingMode).toBe(EventProcessingMode.Immediate);
    expect(delayedEvent.processingMode).toBe(EventProcessingMode.Delayed);
  });
});
