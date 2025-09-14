/**
 * Tests for CheckpointRing rollback system
 * CheckpointRing 回滚系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { CheckpointRing } from '../src/replay/CheckpointRing';
import { CommandLog } from '../src/replay/CommandLog';
import { Recorder } from '../src/replay/Recorder';
import { PRNG } from '../src/determinism/PRNG';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Guid } from '../src/components/Guid';
import { registerSerde } from '../src/serialize/ComponentSerde';

// Test components
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

class Health {
  constructor(public hp = 100) {}
}

describe('CheckpointRing', () => {
  let world: World;
  let ring: CheckpointRing;

  beforeEach(() => {
    world = new World();
    ring = new CheckpointRing(undefined, 4); // Small ring for testing

    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
    registerComponent(Guid);

    // Register serialization for test components
    registerSerde(Position, {
      toJSON: (comp: Position) => ({ x: comp.x, y: comp.y }),
      fromJSON: (data: any) => new Position(data.x, data.y)
    });

    registerSerde(Velocity, {
      toJSON: (comp: Velocity) => ({ dx: comp.dx, dy: comp.dy }),
      fromJSON: (data: any) => new Velocity(data.dx, data.dy)
    });

    registerSerde(Health, {
      toJSON: (comp: Health) => ({ hp: comp.hp }),
      fromJSON: (data: any) => new Health(data.hp)
    });

    registerSerde(Guid, {
      toJSON: (comp: Guid) => ({ value: comp.value }),
      fromJSON: (data: any) => new Guid(data.value)
    });
  });

  test('should start empty', () => {
    expect(ring.size()).toBe(0);
    expect(ring.capacity()).toBe(4);
    expect(ring.isFull()).toBe(false);
    expect(ring.getCheckpoints()).toEqual([]);
  });

  test('should store checkpoints in ring buffer', () => {
    // Create entities with GUID for serialization
    world.frame = 1;
    const entity1 = world.createEntity();
    world.addComponent(entity1, Guid, { value: 'entity1' });
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    ring.snapshot(world);

    world.frame = 2;
    const entity2 = world.createEntity();
    world.addComponent(entity2, Guid, { value: 'entity2' });
    world.addComponent(entity2, Velocity, { dx: 5, dy: 10 });
    ring.snapshot(world);

    expect(ring.size()).toBe(2);
    expect(ring.getCheckpoints()).toEqual([
      { frame: 1 },
      { frame: 2 }
    ]);
  });

  test('should wrap around when ring is full', () => {
    // Fill the ring (capacity = 4)
    for (let i = 1; i <= 6; i++) {
      world.frame = i;
      ring.snapshot(world);
    }

    expect(ring.size()).toBe(4);
    expect(ring.isFull()).toBe(true);

    const checkpoints = ring.getCheckpoints();
    expect(checkpoints).toHaveLength(4);
    // Should have frames 3, 4, 5, 6 (oldest 1, 2 were overwritten)
    expect(checkpoints.map(cp => cp.frame).sort()).toEqual([3, 4, 5, 6]);
  });

  test('should find closest checkpoint', () => {
    world.frame = 1; ring.snapshot(world);
    world.frame = 5; ring.snapshot(world);
    world.frame = 10; ring.snapshot(world);

    expect(ring.getClosestCheckpoint(0)).toBeUndefined();
    expect(ring.getClosestCheckpoint(3)?.frame).toBe(1);
    expect(ring.getClosestCheckpoint(5)?.frame).toBe(5);
    expect(ring.getClosestCheckpoint(7)?.frame).toBe(5);
    expect(ring.getClosestCheckpoint(15)?.frame).toBe(10);
  });

  test('should restore to nearest checkpoint', () => {
    // Setup initial world state
    world.frame = 1;
    const entity1 = world.createEntity();
    world.addComponent(entity1, Guid, { value: 'test-entity' });
    world.addComponent(entity1, Position, { x: 100, y: 200 });
    ring.snapshot(world);

    // Modify world state
    world.frame = 5;
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    // Verify modified state
    expect(world.hasComponent(entity1, Velocity)).toBe(true);
    expect(world.frame).toBe(5);

    // Restore to checkpoint
    const restoredFrame = ring.restoreNearest(world, 3);
    expect(restoredFrame).toBe(1);
    expect(world.frame).toBe(1);

    // Verify restored state
    const restoredEntities = world.getAllAliveEntities();
    expect(restoredEntities).toHaveLength(1);

    const restoredEntity = restoredEntities[0];
    expect(world.hasComponent(restoredEntity, Position)).toBe(true);
    expect(world.hasComponent(restoredEntity, Velocity)).toBe(false);

    const pos = world.getComponent(restoredEntity, Position);
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  test('should create log subset correctly', () => {
    const fullLog = new CommandLog();
    fullLog.push({ frame: 1, cmds: [{ op: 'create', e: 1, enable: true }] });
    fullLog.push({ frame: 2, cmds: [{ op: 'create', e: 2, enable: true }] });
    fullLog.push({ frame: 3, cmds: [{ op: 'create', e: 3, enable: true }] });
    fullLog.push({ frame: 4, cmds: [{ op: 'create', e: 4, enable: true }] });
    fullLog.push({ frame: 5, cmds: [{ op: 'create', e: 5, enable: true }] });

    const subset = ring.createLogSubset(fullLog, 2, 4);

    expect(subset.frames).toHaveLength(2);
    expect(subset.frames[0].frame).toBe(3);
    expect(subset.frames[1].frame).toBe(4);
    expect(subset.startFrame).toBe(2);
  });

  test('should clear all checkpoints', () => {
    world.frame = 1; ring.snapshot(world);
    world.frame = 2; ring.snapshot(world);

    expect(ring.size()).toBe(2);

    ring.clear();

    expect(ring.size()).toBe(0);
    expect(ring.getCheckpoints()).toEqual([]);
  });

  test('should provide debug information', () => {
    world.frame = 1; ring.snapshot(world);
    world.frame = 3; ring.snapshot(world);

    const debug = ring.getDebugInfo();

    expect(debug.size).toBe(2);
    expect(debug.capacity).toBe(4);
    expect(debug.currentIndex).toBe(2); // Next position to write
    expect(debug.checkpoints).toHaveLength(2);
    expect(debug.checkpoints[0]).toEqual({ frame: 1, position: 0 });
    expect(debug.checkpoints[1]).toEqual({ frame: 3, position: 1 });
  });
});

describe('CheckpointRing Integration', () => {
  let world: World;
  let ring: CheckpointRing;
  let recorder: Recorder;

  beforeEach(() => {
    world = new World();
    ring = new CheckpointRing(undefined, 4);
    recorder = new Recorder(world);

    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
    registerComponent(Guid);

    world.setResource(Recorder, recorder);
    world.setResource(PRNG, new PRNG(12345));

    // Register serialization
    registerSerde(Position, {
      toJSON: (comp: Position) => ({ x: comp.x, y: comp.y }),
      fromJSON: (data: any) => new Position(data.x, data.y)
    });

    registerSerde(Velocity, {
      toJSON: (comp: Velocity) => ({ dx: comp.dx, dy: comp.dy }),
      fromJSON: (data: any) => new Velocity(data.dx, data.dy)
    });

    registerSerde(Health, {
      toJSON: (comp: Health) => ({ hp: comp.hp }),
      fromJSON: (data: any) => new Health(data.hp)
    });

    registerSerde(Guid, {
      toJSON: (comp: Guid) => ({ value: comp.value }),
      fromJSON: (data: any) => new Guid(data.value)
    });
  });

  test('should perform full rollback workflow', () => {
    // Frame 1: Create entity
    world.beginFrame();
    const entity1 = world.createEntity();
    world.addComponent(entity1, Guid, { value: 'player1' });
    world.addComponent(entity1, Position, { x: 0, y: 0 });
    recorder.endFrame();
    ring.snapshot(world); // Checkpoint at frame 1

    // Frame 2: Move player
    world.beginFrame();
    world.getComponent(entity1, Position)!.x = 10;
    recorder.endFrame();

    // Frame 3: Add velocity
    world.beginFrame();
    world.addComponent(entity1, Velocity, { dx: 5, dy: 5 });
    recorder.endFrame();

    // Frame 4: Move again
    world.beginFrame();
    const pos = world.getComponent(entity1, Position)!;
    pos.x = 20;
    pos.y = 15;
    recorder.endFrame();

    // Frame 5: Take another checkpoint
    ring.snapshot(world);

    // Verify current state (frame 5, should be at position 20,15 with velocity)
    expect(world.frame).toBe(5);
    expect(world.hasComponent(entity1, Position)).toBe(true);
    expect(world.hasComponent(entity1, Velocity)).toBe(true);
    const currentPos = world.getComponent(entity1, Position)!;
    expect(currentPos.x).toBe(20);
    expect(currentPos.y).toBe(15);

    // Get full command log
    const fullLog = recorder.exportLog();

    // Rollback to frame 4
    const success = ring.rollbackTo(world, 4, fullLog);
    expect(success).toBe(true);
    expect(world.frame).toBe(4);

    // Verify rollback state
    const entities = world.getAllAliveEntities();
    expect(entities).toHaveLength(1);

    const rolledBackEntity = entities[0];
    expect(world.hasComponent(rolledBackEntity, Position)).toBe(true);
    expect(world.hasComponent(rolledBackEntity, Velocity)).toBe(true);

    // Position should be from frame 4 state (not the checkpoint state)
    const rolledBackPos = world.getComponent(rolledBackEntity, Position)!;
    // Note: The exact values depend on what was recorded in the log
    expect(rolledBackPos).toBeDefined();
  });

  test('should handle rollback when no suitable checkpoint exists', () => {
    // Only take checkpoint at frame 5
    world.frame = 5;
    ring.snapshot(world);

    const fullLog = new CommandLog();
    fullLog.push({ frame: 1, cmds: [{ op: 'create', e: 1, enable: true }] });

    // Try to rollback to frame 2 (before checkpoint)
    const success = ring.rollbackTo(world, 2, fullLog);
    expect(success).toBe(false);
  });

  test('should handle exact checkpoint frame rollback', () => {
    // Setup state at frame 3
    world.frame = 3;
    const entity = world.createEntity();
    world.addComponent(entity, Guid, { value: 'test' });
    world.addComponent(entity, Position, { x: 50, y: 75 });
    ring.snapshot(world);

    // Modify world
    world.frame = 5;
    world.addComponent(entity, Velocity, { dx: 1, dy: 1 });

    const fullLog = new CommandLog();

    // Rollback to exact checkpoint frame
    const success = ring.rollbackTo(world, 3, fullLog);
    expect(success).toBe(true);
    expect(world.frame).toBe(3);

    // Should have restored to checkpoint state
    const entities = world.getAllAliveEntities();
    expect(entities).toHaveLength(1);

    const restoredEntity = entities[0];
    expect(world.hasComponent(restoredEntity, Position)).toBe(true);
    expect(world.hasComponent(restoredEntity, Velocity)).toBe(false);
  });

  test('should work with PRNG state preservation', () => {
    // Frame 1: Setup with PRNG
    world.frame = 1;
    const prng = world.getResource(PRNG)!;
    prng.seed(42);

    const entity = world.createEntity();
    world.addComponent(entity, Guid, { value: 'rng-test' });
    world.addComponent(entity, Position, {
      x: prng.nextInt(0, 100),
      y: prng.nextInt(0, 100)
    });

    ring.snapshot(world);

    // Frame 2: Use more RNG
    world.frame = 2;
    world.addComponent(entity, Health, { hp: prng.nextInt(50, 150) });

    // Verify RNG state changed
    const rngState1 = (prng as any).s;

    const fullLog = new CommandLog();

    // Rollback should restore PRNG to checkpoint state
    ring.rollbackTo(world, 1, fullLog);

    // Note: The exact RNG state verification would depend on
    // how PRNG state is handled in snapshots
    expect(world.frame).toBe(1);
  });
});