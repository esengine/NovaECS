/**
 * Tests for system profiler
 * 系统性能分析器测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler, system } from '../src/core/Scheduler';
import { Profiler } from '../src/core/Profiler';

describe('Profiler', () => {
  let world: World;
  let scheduler: Scheduler;
  let profiler: Profiler;

  beforeEach(() => {
    world = new World();
    scheduler = new Scheduler();
    profiler = new Profiler();

    // Initialize profiler in world
    world.setResource(Profiler, profiler);
  });

  test('should record system execution statistics', () => {
    const slowSystem = system('SlowSystem', () => {
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 5) {
        // Busy wait for ~5ms
      }
    }).stage('update').build();

    const fastSystem = system('FastSystem', () => {
      // Fast system - no work
    }).stage('update').build();

    scheduler.add(slowSystem);
    scheduler.add(fastSystem);

    // Run one tick
    scheduler.tick(world, 16);

    const stats = profiler.getAll();
    expect(stats).toHaveLength(2);

    const slowStat = profiler.getStat('SlowSystem', 'update');
    const fastStat = profiler.getStat('FastSystem', 'update');

    expect(slowStat).toBeDefined();
    expect(fastStat).toBeDefined();

    expect(slowStat!.name).toBe('SlowSystem');
    expect(slowStat!.stage).toBe('update');
    expect(slowStat!.calls).toBe(1);
    expect(slowStat!.lastMs).toBeGreaterThan(0);

    expect(fastStat!.name).toBe('FastSystem');
    expect(fastStat!.stage).toBe('update');
    expect(fastStat!.calls).toBe(1);
  });

  test('should calculate EMA averages over multiple calls', () => {
    const testSystem = system('TestSystem', () => {
      // Variable work
    }).stage('update').build();

    scheduler.add(testSystem);

    // Run multiple ticks
    for (let i = 0; i < 10; i++) {
      scheduler.tick(world, 16);
    }

    const stat = profiler.getStat('TestSystem', 'update');
    expect(stat).toBeDefined();
    expect(stat!.calls).toBe(10);
    expect(stat!.avgMs).toBeGreaterThan(0);
    expect(stat!.maxMs).toBeGreaterThanOrEqual(stat!.lastMs);
  });

  test('should track maximum execution times', () => {
    let workAmount = 0;
    const variableSystem = system('VariableSystem', () => {
      const start = Date.now();
      while (Date.now() - start < workAmount) {
        // Variable work
      }
    }).stage('update').build();

    scheduler.add(variableSystem);

    // First run - fast
    workAmount = 1;
    scheduler.tick(world, 16);

    let stat = profiler.getStat('VariableSystem', 'update');
    const firstMax = stat!.maxMs;

    // Second run - slower
    workAmount = 3;
    scheduler.tick(world, 16);

    stat = profiler.getStat('VariableSystem', 'update');
    expect(stat!.maxMs).toBeGreaterThanOrEqual(firstMax);

    // Reset max should set to current last value
    const beforeReset = stat!.maxMs;
    profiler.resetMax();
    stat = profiler.getStat('VariableSystem', 'update');
    expect(stat!.maxMs).toBe(stat!.lastMs);
  });

  test('should provide top systems by average time', () => {
    const systems = ['System1', 'System2', 'System3'].map(name =>
      system(name, () => {
        // Different work amounts to create different averages
        const work = name === 'System2' ? 3 : 1;
        const start = Date.now();
        while (Date.now() - start < work) {}
      }).stage('update').build()
    );

    systems.forEach(sys => scheduler.add(sys));

    // Run a few ticks to establish averages
    for (let i = 0; i < 5; i++) {
      scheduler.tick(world, 16);
    }

    const top = profiler.topByAvg(2);
    expect(top).toHaveLength(2);
    // System2 should be slowest
    expect(top[0].name).toBe('System2');
  });

  test('should handle systems without profiler gracefully', () => {
    // Remove profiler from world
    world.setResource(Profiler, undefined as any);

    const testSystem = system('TestSystem', () => {
      // Some work
    }).stage('update').build();

    scheduler.add(testSystem);

    // Should not throw error
    expect(() => {
      scheduler.tick(world, 16);
    }).not.toThrow();
  });

  test('should clear all statistics', () => {
    const testSystem = system('TestSystem', () => {}).stage('update').build();
    scheduler.add(testSystem);
    scheduler.tick(world, 16);

    expect(profiler.getAll()).toHaveLength(1);

    profiler.clear();

    expect(profiler.getAll()).toHaveLength(0);
  });

  test('should track different stages separately', () => {
    const preUpdateSystem = system('TestSystem', () => {}).stage('preUpdate').build();
    const updateSystem = system('TestSystem', () => {}).stage('update').build();

    scheduler.add(preUpdateSystem);
    scheduler.add(updateSystem);
    scheduler.tick(world, 16);

    const stats = profiler.getAll();
    expect(stats).toHaveLength(2);

    const preUpdateStat = profiler.getStat('TestSystem', 'preUpdate');
    const updateStat = profiler.getStat('TestSystem', 'update');

    expect(preUpdateStat).toBeDefined();
    expect(updateStat).toBeDefined();
    expect(preUpdateStat!.stage).toBe('preUpdate');
    expect(updateStat!.stage).toBe('update');
  });
});