import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { World } from '../../src/core/World';
import { Entity } from '../../src/core/Entity';
import { Component } from '../../src/core/Component';
import { System } from '../../src/core/System';


class TestComponent extends Component {
  constructor(public value: number = 0) {
    super();
  }
}

class TestSystem extends System {
  public updateCalled = false;

  constructor() {
    super([TestComponent]);
  }

  update(_entities: Entity[], _deltaTime: number): void {
    this.updateCalled = true;
  }
}

describe('World Events Integration', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  afterEach(() => {
    world.destroy();
  });

  describe('Entity lifecycle events', () => {
    test('should dispatch EntityCreatedEvent when entity is created', async () => {
      const listener = vi.fn();
      world.eventBus.on('EntityCreated', listener);

      const entity = world.createEntity();

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EntityCreated',
          entityId: entity.id
        })
      );
    });

    test('should dispatch EntityDestroyedEvent when entity is removed', async () => {
      const listener = vi.fn();
      world.eventBus.on('EntityDestroyed', listener);

      const entity = world.createEntity();
      const entityId = entity.id;

      world.removeEntity(entity);

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EntityDestroyed',
          entityId: entityId
        })
      );
    });
  });

  describe('Component lifecycle events', () => {
    test('should dispatch ComponentAddedEvent when component is added', async () => {
      const listener = vi.fn();
      world.eventBus.on('ComponentAdded', listener);

      const entity = world.createEntity();
      entity.addComponent(new TestComponent(42));

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ComponentAdded',
          entityId: entity.id,
          componentType: 'TestComponent'
        })
      );
    });

    test('should dispatch ComponentRemovedEvent when component is removed', async () => {
      const listener = vi.fn();
      world.eventBus.on('ComponentRemoved', listener);

      const entity = world.createEntity();
      entity.addComponent(new TestComponent(42));
      entity.removeComponent(TestComponent);

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ComponentRemoved',
          entityId: entity.id,
          componentType: 'TestComponent'
        })
      );
    });
  });

  describe('System lifecycle events', () => {
    test('should dispatch SystemAddedEvent when system is added', async () => {
      const listener = vi.fn();
      world.eventBus.on('SystemAdded', listener);

      const system = new TestSystem();
      world.addSystem(system);

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SystemAdded',
          systemName: 'TestSystem'
        })
      );
    });

    test('should dispatch SystemRemovedEvent when system is removed', async () => {
      const listener = vi.fn();
      world.eventBus.on('SystemRemoved', listener);

      const system = new TestSystem();
      world.addSystem(system);
      world.removeSystem(system);

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SystemRemoved',
          systemName: 'TestSystem'
        })
      );
    });
  });

  describe('World lifecycle events', () => {
    test('should dispatch WorldPausedEvent when world is paused', async () => {
      const listener = vi.fn();
      world.eventBus.on('WorldPaused', listener);

      world.paused = true;

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WorldPaused'
        })
      );
    });

    test('should dispatch WorldResumedEvent when world is resumed', async () => {
      const listener = vi.fn();
      world.eventBus.on('WorldResumed', listener);

      world.paused = true;
      world.paused = false;

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WorldResumed'
        })
      );
    });

    test('should dispatch WorldUpdateStartEvent and WorldUpdateEndEvent', async () => {
      const startListener = vi.fn();
      const endListener = vi.fn();

      world.eventBus.on('WorldUpdateStart', startListener);
      world.eventBus.on('WorldUpdateEnd', endListener);
      
      world.update(16);
      
      // Wait for async update to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(startListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WorldUpdateStart',
          deltaTime: 16
        })
      );
      
      expect(endListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WorldUpdateEnd',
          deltaTime: 16
        })
      );
    });
  });

  describe('Event statistics', () => {
    test('should provide event statistics', async () => {
      const listener = vi.fn();
      world.eventBus.on('TestEvent', listener);
      
      // Dispatch some events
      await world.eventBus.dispatch({ type: 'TestEvent' } as any);
      await world.eventBus.dispatch({ type: 'TestEvent' } as any);
      
      const stats = world.getEventStatistics();
      
      expect(stats.totalDispatched).toBe(2);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    test('should provide event queue sizes', () => {
      const sizes = world.getEventQueueSizes();
      
      expect(sizes).toHaveProperty('immediate');
      expect(sizes).toHaveProperty('endOfFrame');
      expect(sizes).toHaveProperty('nextFrame');
      expect(sizes).toHaveProperty('delayed');
      
      expect(typeof sizes.immediate).toBe('number');
      expect(typeof sizes.endOfFrame).toBe('number');
      expect(typeof sizes.nextFrame).toBe('number');
      expect(typeof sizes.delayed).toBe('number');
    });

    test('should include event statistics in performance statistics', () => {
      const perfStats = world.getPerformanceStatistics();
      
      expect(perfStats).toHaveProperty('events');
      expect(perfStats.events).toHaveProperty('totalDispatched');
      expect(perfStats.events).toHaveProperty('averageProcessingTime');
    });
  });

  describe('Event bus access', () => {
    test('should provide access to event bus', () => {
      const eventBus = world.eventBus;
      
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.on).toBe('function');
      expect(typeof eventBus.dispatch).toBe('function');
      expect(typeof eventBus.off).toBe('function');
    });
  });

  describe('Cleanup', () => {
    test('should clear event system when world is cleared', () => {
      const listener = vi.fn();
      world.eventBus.on('TestEvent', listener);
      
      expect(world.eventBus.getListenerCount('TestEvent')).toBe(1);
      
      world.clear();
      
      expect(world.eventBus.getListenerCount('TestEvent')).toBe(0);
      
      const stats = world.getEventStatistics();
      expect(stats.totalDispatched).toBe(0);
    });
  });
});

