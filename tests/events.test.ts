/**
 * Tests for component structure change events (Added/Removed)
 * 组件结构变更事件测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import type { Added, Removed } from '../src/events/Types';

class Position {
  x = 0;
  y = 0;
}

class Velocity {
  dx = 0;
  dy = 0;
}

describe('Component Events', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
  });

  test('should emit Added event when component is first added', () => {
    const entity = world.createEntity();
    const addedEvents: Added[] = [];

    world.getAddedChannel().drain(event => addedEvents.push(event));
    expect(addedEvents).toHaveLength(0);

    // Add component should trigger Added event
    world.addComponent(entity, Position, { x: 10, y: 20 });

    world.getAddedChannel().drain(event => addedEvents.push(event));
    expect(addedEvents).toHaveLength(1);
    expect(addedEvents[0]).toMatchObject({
      e: entity,
      typeId: expect.any(Number),
      value: expect.objectContaining({ x: 10, y: 20 })
    });
  });

  test('should not emit Added event when replacing existing component', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Position, { x: 10, y: 20 });

    // Clear initial Added event
    world.getAddedChannel().takeAll();

    const addedEvents: Added[] = [];

    // Replace existing component should not trigger Added event
    world.addComponent(entity, Position, { x: 30, y: 40 });

    world.getAddedChannel().drain(event => addedEvents.push(event));
    expect(addedEvents).toHaveLength(0);
  });

  test('should emit Removed event when component is removed', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Position, { x: 10, y: 20 });

    // Clear initial Added event
    world.getAddedChannel().takeAll();

    const removedEvents: Removed[] = [];

    // Remove component should trigger Removed event
    world.removeComponent(entity, Position);

    world.getRemovedChannel().drain(event => removedEvents.push(event));
    expect(removedEvents).toHaveLength(1);
    expect(removedEvents[0]).toMatchObject({
      e: entity,
      typeId: expect.any(Number),
      old: expect.objectContaining({ x: 10, y: 20 })
    });
  });

  test('should not emit Removed event when component does not exist', () => {
    const entity = world.createEntity();
    const removedEvents: Removed[] = [];

    // Remove non-existent component should not trigger Removed event
    world.removeComponent(entity, Position);

    world.getRemovedChannel().drain(event => removedEvents.push(event));
    expect(removedEvents).toHaveLength(0);
  });

  test('should emit Removed events for all components when entity is destroyed', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Position, { x: 10, y: 20 });
    world.addComponent(entity, Velocity, { dx: 1, dy: 2 });

    // Clear initial Added events
    world.getAddedChannel().takeAll();

    const removedEvents: Removed[] = [];

    // Destroy entity should trigger Removed events for all components
    world.destroyEntity(entity);

    world.getRemovedChannel().drain(event => removedEvents.push(event));
    expect(removedEvents).toHaveLength(2);

    // Should have events for both Position and Velocity
    const typeIds = removedEvents.map(e => e.typeId);
    expect(typeIds).toHaveLength(2);
    expect(new Set(typeIds).size).toBe(2); // Unique type IDs
  });

  test('should emit events in the same frame as structural changes', () => {
    const entity = world.createEntity();
    const initialFrame = world.frame;

    world.addComponent(entity, Position, { x: 10, y: 20 });

    const addedEvents = world.getAddedChannel().takeAll();
    expect(addedEvents).toHaveLength(1);

    // Event should be emitted in the same frame
    expect(world.frame).toBe(initialFrame);
  });

  test('should work correctly with CommandBuffer', () => {
    const entity = world.createEntity();
    const cmd = world.cmd();

    // Queue operations in command buffer
    cmd.add(entity, Position, { x: 10, y: 20 });
    cmd.add(entity, Velocity, { dx: 1, dy: 2 });

    // No events should be emitted yet
    expect(world.getAddedChannel().size).toBe(0);

    // Flush command buffer should trigger events
    world.flush(cmd);

    const addedEvents = world.getAddedChannel().takeAll();
    expect(addedEvents).toHaveLength(2);

    // Test removal via command buffer
    const cmd2 = world.cmd();
    cmd2.remove(entity, Position);
    world.flush(cmd2);

    const removedEvents = world.getRemovedChannel().takeAll();
    expect(removedEvents).toHaveLength(1);
    expect(removedEvents[0].old).toMatchObject({ x: 10, y: 20 });
  });

  test('should provide event channel convenience methods', () => {
    const addedEvents = world.getAddedChannel();
    const removedEvents = world.getRemovedChannel();

    expect(addedEvents).toBeDefined();
    expect(removedEvents).toBeDefined();

    expect(addedEvents.size).toBe(0);
    expect(addedEvents.hasEvents).toBe(false);

    // Add a component to trigger an event
    const entity = world.createEntity();
    world.addComponent(entity, Position);

    expect(addedEvents.size).toBe(1);
    expect(addedEvents.hasEvents).toBe(true);

    // Clear events
    addedEvents.clear();
    expect(addedEvents.size).toBe(0);
    expect(addedEvents.hasEvents).toBe(false);
  });
});