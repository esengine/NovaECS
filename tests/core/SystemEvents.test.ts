import { beforeEach, describe, expect, test, vi } from 'vitest';
import { World } from '../../src/core/World';
import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import { System } from '../../src/core/System';
import { Event, EntityCreatedEvent } from '../../src/core/Event';
import { EventPriority } from '../../src/utils/EventTypes';

class TestComponent extends Component {
  constructor(public value: number = 0) {
    super();
  }
}

class TestEvent extends Event {
  constructor(public readonly message: string) {
    super('TestEvent', EventPriority.Normal);
  }
}

class EventListeningSystem extends System {
  public receivedEvents: TestEvent[] = [];
  public receivedEntityEvents: EntityCreatedEvent[] = [];

  constructor() {
    super([TestComponent]);
  }

  onAddedToWorld(world: World): void {
    super.onAddedToWorld(world);
    
    // Subscribe to custom events
    this.subscribeToEvent('TestEvent', (event: TestEvent) => {
      this.receivedEvents.push(event);
    });
    
    // Subscribe to system events
    this.subscribeToEventType(EntityCreatedEvent, (event: EntityCreatedEvent) => {
      this.receivedEntityEvents.push(event);
    });
  }

  update(entities: Entity[], _deltaTime: number): void {
    // Dispatch an event for each entity processed
    for (const entity of entities) {
      this.dispatchEvent(new TestEvent(`Processed entity ${entity.id}`));
    }
  }
}

class EventDispatchingSystem extends System {
  public eventsDispatched = 0;

  constructor() {
    super([TestComponent]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    if (entities.length > 0) {
      this.dispatchEvent(new TestEvent('System update completed'));
      this.eventsDispatched++;
    }
  }
}

describe('System Events Integration', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  afterEach(() => {
    world.destroy();
  });

  describe('Event subscription', () => {
    test('should allow systems to subscribe to events', async () => {
      const system = new EventListeningSystem();
      world.addSystem(system);
      
      // Dispatch a test event
      await world.eventBus.dispatch(new TestEvent('Hello from test'));
      
      expect(system.receivedEvents).toHaveLength(1);
      expect(system.receivedEvents[0].message).toBe('Hello from test');
    });

    test('should allow systems to subscribe to typed events', async () => {
      const system = new EventListeningSystem();
      world.addSystem(system);
      
      // Create an entity (should trigger EntityCreatedEvent)
      world.createEntity();
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(system.receivedEntityEvents).toHaveLength(1);
      expect(system.receivedEntityEvents[0].type).toBe('EntityCreated');
    });

    test('should throw error when subscribing before added to world', () => {
      const system = new EventListeningSystem();
      
      expect(() => {
        system.subscribeToEvent('TestEvent', () => {});
      }).toThrow('System must be added to world before subscribing to events');
    });
  });

  describe('Event dispatching', () => {
    test('should allow systems to dispatch events', async () => {
      const listeningSystem = new EventListeningSystem();
      const dispatchingSystem = new EventDispatchingSystem();
      
      world.addSystem(listeningSystem);
      world.addSystem(dispatchingSystem);
      
      // Create entity with component to trigger system update
      const entity = world.createEntity();
      entity.addComponent(new TestComponent(42));
      
      // Update world to trigger system execution
      world.update(16);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should have received events from both systems
      expect(listeningSystem.receivedEvents.length).toBeGreaterThan(0);
      expect(dispatchingSystem.eventsDispatched).toBe(1);
    });

    test('should throw error when dispatching before added to world', () => {
      const system = new EventDispatchingSystem();
      
      expect(() => {
        system.dispatchEvent(new TestEvent('test'));
      }).toThrow('System must be added to world before dispatching events');
    });
  });

  describe('Event unsubscription', () => {
    test('should unsubscribe from events when system is removed', async () => {
      const system = new EventListeningSystem();
      world.addSystem(system);
      
      // Verify subscription works
      await world.eventBus.dispatch(new TestEvent('Before removal'));
      expect(system.receivedEvents).toHaveLength(1);
      
      // Remove system
      world.removeSystem(system);
      
      // Dispatch another event
      await world.eventBus.dispatch(new TestEvent('After removal'));
      
      // Should not receive the second event
      expect(system.receivedEvents).toHaveLength(1);
    });

    test('should allow manual unsubscription', async () => {
      const system = new EventListeningSystem();
      world.addSystem(system);
      
      // Subscribe and get listener ID
      const listenerId = system.subscribeToEvent('ManualTest', () => {});
      
      // Verify subscription exists
      expect(world.eventBus.hasListeners('ManualTest')).toBe(true);
      
      // Unsubscribe manually
      const result = system.unsubscribeFromEvent(listenerId);
      expect(result).toBe(true);
      
      // Verify subscription is removed
      expect(world.eventBus.hasListeners('ManualTest')).toBe(false);
    });
  });

  describe('System communication via events', () => {
    test('should enable communication between systems', async () => {
      class ProducerSystem extends System {
        constructor() {
          super([TestComponent]);
        }

        update(entities: Entity[], _deltaTime: number): void {
          if (entities.length > 0) {
            this.dispatchEvent(new TestEvent('Data produced'));
          }
        }
      }

      class ConsumerSystem extends System {
        public consumedData: string[] = [];

        constructor() {
          super([]);
        }

        onAddedToWorld(world: World): void {
          super.onAddedToWorld(world);
          this.subscribeToEvent('TestEvent', (event: TestEvent) => {
            if (event.message === 'Data produced') {
              this.consumedData.push(event.message);
            }
          });
        }

        update(_entities: Entity[], _deltaTime: number): void {
          // Consumer doesn't need entities
        }
      }

      const producer = new ProducerSystem();
      const consumer = new ConsumerSystem();
      
      world.addSystem(producer);
      world.addSystem(consumer);
      
      // Create entity to trigger producer
      const entity = world.createEntity();
      entity.addComponent(new TestComponent(1));
      
      // Update world
      world.update(16);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(consumer.consumedData).toContain('Data produced');
    });
  });

  describe('Event priority in systems', () => {
    test('should handle events with different priorities', async () => {
      class PriorityTestSystem extends System {
        public processedEvents: string[] = [];

        constructor() {
          super([]);
        }

        onAddedToWorld(world: World): void {
          super.onAddedToWorld(world);
          
          this.subscribeToEvent('HighPriority', (event: any) => {
            this.processedEvents.push('high');
          }, { priority: EventPriority.High });
          
          this.subscribeToEvent('LowPriority', (event: any) => {
            this.processedEvents.push('low');
          }, { priority: EventPriority.Low });
        }

        update(_entities: Entity[], _deltaTime: number): void {
          // No entity processing needed
        }
      }

      const system = new PriorityTestSystem();
      world.addSystem(system);
      
      // Dispatch events in reverse priority order
      await world.eventBus.dispatch({ type: 'LowPriority' } as any);
      await world.eventBus.dispatch({ type: 'HighPriority' } as any);
      
      // High priority should be processed first
      expect(system.processedEvents).toEqual(['low', 'high']);
    });
  });

  describe('Error handling', () => {
    test('should handle errors in event listeners gracefully', async () => {
      class ErrorSystem extends System {
        constructor() {
          super([]);
        }

        onAddedToWorld(world: World): void {
          super.onAddedToWorld(world);
          
          this.subscribeToEvent('ErrorEvent', () => {
            throw new Error('Test error in system');
          });
        }

        update(_entities: Entity[], _deltaTime: number): void {
          // No processing needed
        }
      }

      const system = new ErrorSystem();
      world.addSystem(system);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Should not throw
      await expect(world.eventBus.dispatch({ type: 'ErrorEvent' } as any)).resolves.not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
