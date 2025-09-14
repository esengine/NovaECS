/**
 * Tests for command replayer system
 * 命令重放器系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Recorder } from '../src/replay/Recorder';
import { Replayer } from '../src/replay/Replayer';
import { CommandLog } from '../src/replay/CommandLog';
import { PRNG } from '../src/determinism/PRNG';
import { Scheduler } from '../src/core/Scheduler';
import { registerComponent } from '../src/core/ComponentRegistry';

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

describe('Replayer', () => {
  let world: World;
  let replayer: Replayer;

  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
    replayer = new Replayer(world);
  });

  test('should clear world state', () => {
    // Create some entities and components
    const entity1 = world.createEntity();
    const entity2 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity2, Velocity, { dx: 5, dy: 10 });

    expect(world.getAllAliveEntities()).toHaveLength(2);

    // Clear world
    replayer.clearWorld();

    expect(world.getAllAliveEntities()).toHaveLength(0);
    expect(world.frame).toBe(0);
  });

  test('should replay simple entity creation and destruction', () => {
    const log = new CommandLog();
    log.push({
      frame: 1,
      cmds: [
        { op: 'create', e: 100, enable: true },
        { op: 'create', e: 101, enable: false },
      ]
    });
    log.push({
      frame: 2,
      cmds: [
        { op: 'destroy', e: 100 }
      ]
    });

    replayer.load(log);

    // Should have one entity left (101) but with different actual ID
    const aliveEntities = world.getAllAliveEntities();
    expect(aliveEntities).toHaveLength(1);

    // Check entity mapping
    const actualEntity101 = replayer.getActualEntity(101);
    expect(actualEntity101).toBeDefined();
    expect(world.isAlive(actualEntity101!)).toBe(true);
    expect(world.isEnabled(actualEntity101!)).toBe(false);

    // Entity 100 should be destroyed and not mapped
    expect(replayer.getActualEntity(100)).toBeUndefined();
  });

  test('should replay component operations', () => {
    const log = new CommandLog();
    const posType = registerComponent(Position);
    const velType = registerComponent(Velocity);

    log.push({
      frame: 1,
      cmds: [
        { op: 'create', e: 50, enable: true },
        { op: 'add', e: 50, typeId: posType.id, data: { x: 100, y: 200 } },
        { op: 'add', e: 50, typeId: velType.id, data: { dx: 5, dy: 10 } },
      ]
    });
    log.push({
      frame: 2,
      cmds: [
        { op: 'remove', e: 50, typeId: velType.id }
      ]
    });

    replayer.load(log);

    const actualEntity = replayer.getActualEntity(50)!;
    expect(actualEntity).toBeDefined();

    // Should have Position but not Velocity
    expect(world.hasComponent(actualEntity, Position)).toBe(true);
    expect(world.hasComponent(actualEntity, Velocity)).toBe(false);

    const pos = world.getComponent(actualEntity, Position);
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  test('should replay enable/disable state changes', () => {
    const log = new CommandLog();
    log.push({
      frame: 1,
      cmds: [
        { op: 'create', e: 10, enable: true },
        { op: 'setEnabled', e: 10, v: false },
        { op: 'setEnabled', e: 10, v: true },
      ]
    });

    replayer.load(log);

    const actualEntity = replayer.getActualEntity(10)!;
    expect(world.isEnabled(actualEntity)).toBe(true);
  });

  test('should restore PRNG state during replay', () => {
    world.setResource(PRNG, new PRNG());

    const log = new CommandLog();
    log.push({
      frame: 1,
      cmds: [{ op: 'create', e: 1, enable: true }],
      rngSeed: 12345
    });
    log.push({
      frame: 2,
      cmds: [{ op: 'create', e: 2, enable: true }],
      rngSeed: 67890
    });

    replayer.load(log);

    // PRNG should be at final seed state
    const prng = world.getResource(PRNG)!;
    expect((prng as any).s).toBe(67890);
  });

  test('should replay to specific frame', () => {
    const log = new CommandLog();
    log.push({
      frame: 1,
      cmds: [{ op: 'create', e: 1, enable: true }]
    });
    log.push({
      frame: 2,
      cmds: [{ op: 'create', e: 2, enable: true }]
    });
    log.push({
      frame: 3,
      cmds: [{ op: 'create', e: 3, enable: true }]
    });

    // Replay only to frame 2
    replayer.loadToFrame(log, 2);

    expect(world.getAllAliveEntities()).toHaveLength(2);
    expect(replayer.getActualEntity(1)).toBeDefined();
    expect(replayer.getActualEntity(2)).toBeDefined();
    expect(replayer.getActualEntity(3)).toBeUndefined();
  });

  test('should handle entity mapping correctly', () => {
    const log = new CommandLog();
    log.push({
      frame: 1,
      cmds: [
        { op: 'create', e: 100, enable: true },
        { op: 'create', e: 200, enable: true },
        { op: 'create', e: 300, enable: true },
      ]
    });

    replayer.load(log);

    // Check forward mapping
    const actual100 = replayer.getActualEntity(100);
    const actual200 = replayer.getActualEntity(200);
    const actual300 = replayer.getActualEntity(300);

    expect(actual100).toBeDefined();
    expect(actual200).toBeDefined();
    expect(actual300).toBeDefined();

    // All should be different
    expect(actual100).not.toBe(actual200);
    expect(actual200).not.toBe(actual300);
    expect(actual100).not.toBe(actual300);

    // Check reverse mapping
    expect(replayer.getRecordedEntity(actual100!)).toBe(100);
    expect(replayer.getRecordedEntity(actual200!)).toBe(200);
    expect(replayer.getRecordedEntity(actual300!)).toBe(300);

    // Get all mappings
    const mappings = replayer.getEntityMappings();
    expect(mappings).toHaveLength(3);
    expect(mappings.map(m => m.recorded).sort()).toEqual([100, 200, 300]);
  });
});

describe('Replay Integration', () => {
  let originalWorld: World;
  let replayWorld: World;
  let recorder: Recorder;
  let replayer: Replayer;

  beforeEach(() => {
    originalWorld = new World();
    replayWorld = new World();

    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);

    recorder = new Recorder(originalWorld);
    originalWorld.setResource(Recorder, recorder);
    originalWorld.setResource(PRNG, new PRNG(12345));

    replayer = new Replayer(replayWorld);
    replayWorld.setResource(PRNG, new PRNG());
  });

  test('should reproduce exact same operations', () => {
    // Record some operations in original world
    originalWorld.beginFrame();

    const entity1 = originalWorld.createEntity();
    originalWorld.addComponent(entity1, Position, { x: 10, y: 20 });
    originalWorld.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = originalWorld.createEntity(false);
    originalWorld.setEnabled(entity2, true);
    originalWorld.addComponent(entity2, Health, { hp: 150 });

    originalWorld.removeComponent(entity1, Velocity);
    originalWorld.destroyEntity(entity2);

    recorder.endFrame();

    // Export log and replay in new world
    const log = recorder.exportLog();
    replayer.load(log);

    // Verify world state
    const replayEntities = replayWorld.getAllAliveEntities();
    expect(replayEntities).toHaveLength(1);

    const replayedEntity1 = replayer.getActualEntity(entity1)!;
    expect(replayedEntity1).toBeDefined();

    expect(replayWorld.hasComponent(replayedEntity1, Position)).toBe(true);
    expect(replayWorld.hasComponent(replayedEntity1, Velocity)).toBe(false);
    expect(replayWorld.hasComponent(replayedEntity1, Health)).toBe(false);

    const pos = replayWorld.getComponent(replayedEntity1, Position);
    expect(pos).toEqual({ x: 10, y: 20 });
  });

  test('should work with scheduler and systems', () => {
    const scheduler = new Scheduler();

    scheduler.add({
      name: 'TestSystem',
      stage: 'update',
      before: [],
      after: [],
      fn: (ctx) => {
        const prng = ctx.world.getResource(PRNG)!;
        const entity = ctx.world.createEntity();

        // Use deterministic random values
        ctx.commandBuffer.add(entity, Position, {
          x: prng.nextInt(0, 100),
          y: prng.nextInt(0, 100)
        });

        if (prng.nextBool()) {
          ctx.commandBuffer.add(entity, Velocity, {
            dx: prng.nextInt(-10, 10),
            dy: prng.nextInt(-10, 10)
          });
        }
      }
    });

    // Run original simulation
    scheduler.tick(originalWorld, 16);
    scheduler.tick(originalWorld, 16);

    // Export and replay
    const log = recorder.exportLog();
    replayer.load(log);

    // Verify both worlds have same structure
    const originalEntities = originalWorld.getAllAliveEntities();
    const replayEntities = replayWorld.getAllAliveEntities();

    expect(replayEntities).toHaveLength(originalEntities.length);

    // Check that components match (ignoring entity IDs)
    for (const originalEntity of originalEntities) {
      const replayEntity = replayer.getActualEntity(originalEntity);
      expect(replayEntity).toBeDefined();

      expect(replayWorld.hasComponent(replayEntity!, Position))
        .toBe(originalWorld.hasComponent(originalEntity, Position));

      expect(replayWorld.hasComponent(replayEntity!, Velocity))
        .toBe(originalWorld.hasComponent(originalEntity, Velocity));

      if (originalWorld.hasComponent(originalEntity, Position)) {
        const originalPos = originalWorld.getComponent(originalEntity, Position);
        const replayPos = replayWorld.getComponent(replayEntity!, Position);
        expect(replayPos).toEqual(originalPos);
      }

      if (originalWorld.hasComponent(originalEntity, Velocity)) {
        const originalVel = originalWorld.getComponent(originalEntity, Velocity);
        const replayVel = replayWorld.getComponent(replayEntity!, Velocity);
        expect(replayVel).toEqual(originalVel);
      }
    }
  });

  test('should validate replay consistency', () => {
    // Record operations
    originalWorld.beginFrame();
    const entity = originalWorld.createEntity();
    originalWorld.addComponent(entity, Position, { x: 50, y: 75 });
    recorder.endFrame();

    const originalLog = recorder.exportLog();

    // Replay and record again
    replayer.load(originalLog);

    const replayRecorder = new Recorder(replayWorld);
    replayWorld.setResource(Recorder, replayRecorder);

    // Run same operations on replay world
    replayRecorder.beginFrame();
    const replayEntity = replayWorld.createEntity();
    replayWorld.addComponent(replayEntity, Position, { x: 50, y: 75 });
    replayRecorder.endFrame();

    const replayLog = replayRecorder.exportLog();

    // Should be consistent (ignoring entity ID differences)
    expect(replayer.validateReplay(originalLog, replayLog)).toBe(true);
  });

  test('should detect inconsistent replays', () => {
    const log1 = new CommandLog();
    log1.push({
      frame: 1,
      cmds: [{ op: 'create', e: 1, enable: true }],
      rngSeed: 12345
    });

    const log2 = new CommandLog();
    log2.push({
      frame: 1,
      cmds: [{ op: 'create', e: 1, enable: false }], // Different enable state
      rngSeed: 12345
    });

    expect(replayer.validateReplay(log1, log2)).toBe(false);

    const log3 = new CommandLog();
    log3.push({
      frame: 1,
      cmds: [{ op: 'create', e: 1, enable: true }],
      rngSeed: 54321 // Different seed
    });

    expect(replayer.validateReplay(log1, log3)).toBe(false);
  });

  test('should handle empty logs', () => {
    const emptyLog = new CommandLog();
    replayer.load(emptyLog);

    expect(replayWorld.getAllAliveEntities()).toHaveLength(0);
    expect(replayWorld.frame).toBe(0);
  });

  test('should handle complex component data', () => {
    const complexData = {
      position: { x: 10, y: 20 },
      stats: { hp: 100, mp: 50 },
      tags: ['player', 'hero'],
      metadata: { id: 'player1', level: 5 }
    };

    const log = new CommandLog();
    log.push({
      frame: 1,
      cmds: [
        { op: 'create', e: 1, enable: true },
        { op: 'add', e: 1, typeId: 1, data: complexData }
      ]
    });

    replayer.load(log);

    const actualEntity = replayer.getActualEntity(1)!;
    expect(actualEntity).toBeDefined();

    // Complex data should be properly restored
    // (This assumes addByTypeId handles complex data correctly)
  });
});