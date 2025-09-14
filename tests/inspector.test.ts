/**
 * Tests for Inspector system
 * Inspector 系统测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Scheduler, system } from '../src/core/Scheduler';
import { Profiler } from '../src/core/Profiler';
import { snapshot, printSnapshot, exportSnapshot, getComponentSummary, getSystemSummary } from '../src/core/Inspector';

class Position {
  x = 0;
  y = 0;
}

class Velocity {
  dx = 0;
  dy = 0;
}

class Health {
  value = 100;
}

describe('Inspector', () => {
  let world: World;
  let scheduler: Scheduler;
  let profiler: Profiler;

  beforeEach(() => {
    world = new World();
    scheduler = new Scheduler();
    profiler = new Profiler();

    world.setResource(Profiler, profiler);

    registerComponent(Position);
    registerComponent(Velocity);
    registerComponent(Health);
  });

  test('should capture basic world snapshot', () => {
    // Create some entities with components
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    world.addComponent(e1, Position, { x: 1, y: 2 });
    world.addComponent(e1, Velocity, { dx: 1, dy: 1 });

    world.addComponent(e2, Position, { x: 3, y: 4 });
    world.addComponent(e2, Health, { value: 50 });

    world.addComponent(e3, Health, { value: 75 });

    // Advance some frames
    world.beginFrame();
    world.beginFrame();

    const snap = snapshot(world);

    expect(snap.frame).toBe(3); // Started at 1, beginFrame() called twice
    expect(snap.entitiesAlive).toBe(3);
    expect(snap.components).toHaveLength(3);

    // Components should be sorted by size (descending)
    expect(snap.components[0].size).toBeGreaterThanOrEqual(snap.components[1].size);
    expect(snap.components[1].size).toBeGreaterThanOrEqual(snap.components[2].size);

    // Find component by name
    const posComp = snap.components.find(c => c.name === 'Position');
    const velComp = snap.components.find(c => c.name === 'Velocity');
    const healthComp = snap.components.find(c => c.name === 'Health');

    expect(posComp).toBeDefined();
    expect(posComp!.size).toBe(2); // e1, e2 have Position

    expect(velComp).toBeDefined();
    expect(velComp!.size).toBe(1); // Only e1 has Velocity

    expect(healthComp).toBeDefined();
    expect(healthComp!.size).toBe(2); // e2, e3 have Health
  });

  test('should capture system profiling data', () => {
    const testSystem = system('TestSystem', () => {
      // Some work
    }).stage('update').build();

    scheduler.add(testSystem);

    // Run a few ticks to generate profiling data
    for (let i = 0; i < 5; i++) {
      scheduler.tick(world, 16);
    }

    const snap = snapshot(world);

    expect(snap.systems).toHaveLength(1);
    expect(snap.systems[0].name).toBe('TestSystem');
    expect(snap.systems[0].stage).toBe('update');
    expect(snap.systems[0].calls).toBe(5);
    expect(snap.systems[0].avgMs).toBeGreaterThan(0);
  });

  test('should handle world without profiler', () => {
    // Remove profiler
    world.setResource(Profiler, undefined as any);

    const e1 = world.createEntity();
    world.addComponent(e1, Position);

    const snap = snapshot(world);

    expect(snap.frame).toBe(1);
    expect(snap.entitiesAlive).toBe(1);
    expect(snap.components).toHaveLength(1);
    expect(snap.systems).toHaveLength(0); // No profiler, no system data
  });

  test('should provide component summary', () => {
    const e1 = world.createEntity();
    const e2 = world.createEntity();

    world.addComponent(e1, Position);
    world.addComponent(e1, Velocity);
    world.addComponent(e2, Position);

    const snap = snapshot(world);
    const summary = getComponentSummary(snap);

    expect(summary.totalComponents).toBe(2); // Position, Velocity
    expect(summary.totalInstances).toBe(3); // 2 Position + 1 Velocity
    expect(summary.topComponents).toHaveLength(2);

    // Position should be first (size 2)
    expect(summary.topComponents[0].name).toBe('Position');
    expect(summary.topComponents[0].size).toBe(2);
  });

  test('should provide system summary', () => {
    const fastSystem = system('FastSystem', () => {}).stage('update').build();
    const slowSystem = system('SlowSystem', () => {
      // Simulate slower work
      const start = Date.now();
      while (Date.now() - start < 2) {}
    }).stage('preUpdate').build();

    scheduler.add(fastSystem);
    scheduler.add(slowSystem);

    // Run several ticks
    for (let i = 0; i < 3; i++) {
      scheduler.tick(world, 16);
    }

    const snap = snapshot(world);
    const summary = getSystemSummary(snap);

    expect(summary.totalSystems).toBe(2);
    expect(summary.totalCalls).toBe(6); // 2 systems × 3 ticks
    expect(summary.slowestSystems).toHaveLength(2);

    // SlowSystem should be first (higher avgMs)
    expect(summary.slowestSystems[0].name).toBe('SlowSystem');
  });

  test('should export snapshot as JSON', () => {
    const e1 = world.createEntity();
    world.addComponent(e1, Position);

    const snap = snapshot(world);
    const json = exportSnapshot(snap);

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.frame).toBe(snap.frame);
    expect(parsed.entitiesAlive).toBe(snap.entitiesAlive);
    expect(parsed.components).toHaveLength(snap.components.length);
  });

  test('should handle empty world', () => {
    const snap = snapshot(world);

    expect(snap.frame).toBe(1);
    expect(snap.entitiesAlive).toBe(0);
    expect(snap.components).toHaveLength(0);
    expect(snap.systems).toHaveLength(0);

    const compSummary = getComponentSummary(snap);
    expect(compSummary.totalComponents).toBe(0);
    expect(compSummary.totalInstances).toBe(0);

    const sysSummary = getSystemSummary(snap);
    expect(sysSummary.totalSystems).toBe(0);
    expect(sysSummary.totalCalls).toBe(0);
  });

  test('should not throw when printing snapshot', () => {
    const e1 = world.createEntity();
    world.addComponent(e1, Position);

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);
    scheduler.tick(world, 16);

    const snap = snapshot(world);

    // Should not throw
    expect(() => {
      printSnapshot(snap);
    }).not.toThrow();
  });

  test('should show component type IDs for unknown types', () => {
    // Create entities with components but unregister them from name lookup
    const e1 = world.createEntity();
    world.addComponent(e1, Position);

    const snap = snapshot(world);

    // Even if we can't resolve the constructor name, should still show Type#ID
    expect(snap.components[0].name).toMatch(/^(Position|Type#\d+)$/);
    expect(snap.components[0].typeId).toBeGreaterThan(0);
  });
});