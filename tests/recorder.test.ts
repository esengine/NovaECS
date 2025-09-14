/**
 * Tests for command recorder system
 * 命令记录器系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Recorder } from '../src/replay/Recorder';
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

describe('CommandLog', () => {
  let log: CommandLog;

  beforeEach(() => {
    log = new CommandLog();
  });

  test('should start empty', () => {
    expect(log.frames).toHaveLength(0);
    expect(log.getFrameCount()).toBe(0);
    expect(log.getLatestFrame()).toBe(0);
  });

  test('should add frames', () => {
    log.push({ frame: 1, cmds: [] });
    log.push({ frame: 2, cmds: [{ op: 'create', e: 1, enable: true }] });

    expect(log.getFrameCount()).toBe(2);
    expect(log.getLatestFrame()).toBe(2);
  });

  test('should find frames by number', () => {
    log.push({ frame: 1, cmds: [] });
    log.push({ frame: 3, cmds: [] });

    expect(log.getFrame(1)).toBeDefined();
    expect(log.getFrame(2)).toBeUndefined();
    expect(log.getFrame(3)).toBeDefined();
  });

  test('should get frame ranges', () => {
    log.push({ frame: 1, cmds: [] });
    log.push({ frame: 2, cmds: [] });
    log.push({ frame: 3, cmds: [] });
    log.push({ frame: 5, cmds: [] });

    const range = log.getFrameRange(2, 4);
    expect(range).toHaveLength(2);
    expect(range[0].frame).toBe(2);
    expect(range[1].frame).toBe(3);
  });

  test('should clear all frames', () => {
    log.push({ frame: 1, cmds: [] });
    log.push({ frame: 2, cmds: [] });

    log.clear();
    expect(log.getFrameCount()).toBe(0);
  });
});

describe('Recorder', () => {
  let world: World;
  let recorder: Recorder;

  beforeEach(() => {
    world = new World();
    recorder = new Recorder(world);
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
  });

  test('should record entity creation', () => {
    recorder.beginFrame();
    recorder.onCreate(1, true);
    recorder.onCreate(2, false);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame).toBeDefined();
    expect(frame!.cmds).toHaveLength(2);
    expect(frame!.cmds[0]).toEqual({ op: 'create', e: 1, enable: true });
    expect(frame!.cmds[1]).toEqual({ op: 'create', e: 2, enable: false });
  });

  test('should record entity destruction', () => {
    recorder.beginFrame();
    recorder.onDestroy(5);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame!.cmds).toHaveLength(1);
    expect(frame!.cmds[0]).toEqual({ op: 'destroy', e: 5 });
  });

  test('should record enable/disable state changes', () => {
    recorder.beginFrame();
    recorder.onSetEnabled(3, false);
    recorder.onSetEnabled(4, true);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame!.cmds).toHaveLength(2);
    expect(frame!.cmds[0]).toEqual({ op: 'setEnabled', e: 3, v: false });
    expect(frame!.cmds[1]).toEqual({ op: 'setEnabled', e: 4, v: true });
  });

  test('should record component addition', () => {
    const pos = new Position(10, 20);

    recorder.beginFrame();
    recorder.onAdd(1, 123, pos);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame!.cmds).toHaveLength(1);
    expect(frame!.cmds[0]).toEqual({
      op: 'add',
      e: 1,
      typeId: 123,
      data: { x: 10, y: 20 }
    });
  });

  test('should record component removal', () => {
    recorder.beginFrame();
    recorder.onRemove(1, 456);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame!.cmds).toHaveLength(1);
    expect(frame!.cmds[0]).toEqual({ op: 'remove', e: 1, typeId: 456 });
  });

  test('should record RNG seed', () => {
    world.setResource(PRNG, new PRNG(42));

    recorder.beginFrame();
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame!.rngSeed).toBeDefined();
  });

  test('should support start/stop recording', () => {
    expect(recorder.isRecording()).toBe(true);

    recorder.stopRecording();
    expect(recorder.isRecording()).toBe(false);

    recorder.beginFrame();
    recorder.onCreate(1, true);
    recorder.endFrame();

    expect(recorder.log.getFrameCount()).toBe(0);

    recorder.startRecording();
    expect(recorder.isRecording()).toBe(true);

    recorder.beginFrame();
    recorder.onCreate(2, true);
    recorder.endFrame();

    expect(recorder.log.getFrameCount()).toBe(1);
  });

  test('should track current frame command count', () => {
    recorder.beginFrame();
    expect(recorder.getCurrentFrameCommandCount()).toBe(0);

    recorder.onCreate(1, true);
    expect(recorder.getCurrentFrameCommandCount()).toBe(1);

    recorder.onAdd(1, 123, new Position());
    expect(recorder.getCurrentFrameCommandCount()).toBe(2);

    recorder.endFrame();
    expect(recorder.getCurrentFrameCommandCount()).toBe(0);
  });

  test('should handle deep cloning for component data', () => {
    const complexData = {
      nested: { value: 42 },
      array: [1, 2, 3]
    };

    recorder.beginFrame();
    recorder.onAdd(1, 123, complexData);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    const recordedData = frame!.cmds[0] as any;

    // Should be deep copied
    expect(recordedData.data).toEqual(complexData);
    expect(recordedData.data).not.toBe(complexData);
    expect(recordedData.data.nested).not.toBe(complexData.nested);
  });

  test('should handle non-serializable objects gracefully', () => {
    const nonSerializable = {
      func: () => 'test',
      symbol: Symbol('test'),
      circular: null as any
    };
    nonSerializable.circular = nonSerializable;

    recorder.beginFrame();
    recorder.onAdd(1, 123, nonSerializable);
    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame!.cmds).toHaveLength(1);
    // Should not crash, uses shallow copy fallback
  });

  test('should support export/import', () => {
    recorder.beginFrame();
    recorder.onCreate(1, true);
    recorder.onAdd(1, 123, new Position(5, 10));
    recorder.endFrame();

    const exported = recorder.exportLog();
    expect(exported.getFrameCount()).toBe(1);

    const newRecorder = new Recorder(world);
    newRecorder.importLog(exported);

    expect(newRecorder.log.getFrameCount()).toBe(1);
    const frame = newRecorder.log.getFrame(world.frame);
    expect(frame!.cmds).toHaveLength(2);
  });
});

describe('World Integration', () => {
  let world: World;
  let recorder: Recorder;

  beforeEach(() => {
    world = new World();
    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);

    recorder = new Recorder(world);
    world.setResource(Recorder, recorder);
  });

  test('should automatically record world operations', () => {
    world.beginFrame();

    const entity1 = world.createEntity();
    world.addComponent(entity1, Position, { x: 10, y: 20 });
    world.addComponent(entity1, Velocity, { dx: 1, dy: 2 });

    const entity2 = world.createEntity(false);
    world.setEnabled(entity2, true);

    world.removeComponent(entity1, Velocity);
    world.destroyEntity(entity2);

    recorder.endFrame();

    const frame = recorder.log.getFrame(world.frame);
    expect(frame).toBeDefined();
    expect(frame!.cmds).toHaveLength(7); // create, add, add, create, setEnabled, remove, destroy

    const cmds = frame!.cmds;
    expect(cmds[0]).toEqual({ op: 'create', e: entity1, enable: true });
    expect(cmds[1].op).toBe('add');
    expect(cmds[2].op).toBe('add');
    expect(cmds[3]).toEqual({ op: 'create', e: entity2, enable: false });
    expect(cmds[4]).toEqual({ op: 'setEnabled', e: entity2, v: true });
    expect(cmds[5]).toEqual({ op: 'remove', e: entity1, typeId: expect.any(Number) });
    expect(cmds[6]).toEqual({ op: 'destroy', e: entity2 });
  });

  test('should work with scheduler', () => {
    world.setResource(PRNG, new PRNG(12345));

    const scheduler = new Scheduler();
    let executionCount = 0;

    scheduler.add({
      name: 'TestSystem',
      stage: 'update',
      before: [],
      after: [],
      fn: (ctx) => {
        executionCount++;
        const entity = ctx.world.createEntity();
        ctx.commandBuffer.add(entity, Position, { x: executionCount, y: executionCount * 2 });
      }
    });

    // First tick
    scheduler.tick(world, 16);

    let frame = recorder.log.getFrame(world.frame);
    expect(frame).toBeDefined();
    expect(frame!.cmds.length).toBeGreaterThan(0);
    expect(frame!.rngSeed).toBeDefined();

    // Second tick
    scheduler.tick(world, 16);

    frame = recorder.log.getFrame(world.frame);
    expect(frame).toBeDefined();
    expect(frame!.cmds.length).toBeGreaterThan(0);

    expect(recorder.log.getFrameCount()).toBe(2);
    expect(executionCount).toBe(2);
  });

  test('should maintain deterministic recording with PRNG', () => {
    world.setResource(PRNG, new PRNG(42));

    const scheduler = new Scheduler();
    scheduler.add({
      name: 'RandomSystem',
      stage: 'update',
      before: [],
      after: [],
      fn: (ctx) => {
        const prng = ctx.world.getResource(PRNG)!;
        const entity = ctx.world.createEntity();
        ctx.commandBuffer.add(entity, Position, {
          x: prng.nextInt(0, 100),
          y: prng.nextInt(0, 100)
        });
      }
    });

    // Run multiple times with same seed
    const logs: CommandLog[] = [];

    for (let run = 0; run < 2; run++) {
      world = new World();
      registerComponent(Position);
      world.setResource(PRNG, new PRNG(42));

      recorder = new Recorder(world);
      world.setResource(Recorder, recorder);

      scheduler.tick(world, 16);
      logs.push(recorder.exportLog());
    }

    // Should produce identical logs
    expect(logs[0].getFrameCount()).toBe(logs[1].getFrameCount());

    const frame1 = logs[0].getFrame(2)!; // Frame starts at 2 after first tick
    const frame2 = logs[1].getFrame(2)!;

    expect(frame1.rngSeed).toBe(frame2.rngSeed);
    expect(frame1.cmds).toEqual(frame2.cmds);
  });
});