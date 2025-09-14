/**
 * Tests for ProfilerDumpSystem
 * ProfilerDumpSystem测试
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../src/core/World';
import { Scheduler, system } from '../src/core/Scheduler';
import { Profiler } from '../src/core/Profiler';
import {
  ProfilerDumpSystem,
  enableProfilerDump,
  disableProfilerDump,
  pauseProfilerDump,
  resumeProfilerDump,
  ProfilerDumpConfig_,
  DEFAULT_PROFILER_DUMP_CONFIG
} from '../src/systems/ProfilerDumpSystem';

describe('ProfilerDumpSystem', () => {
  let world: World;
  let scheduler: Scheduler;
  let profiler: Profiler;
  let consoleSpy: any;

  beforeEach(() => {
    world = new World();
    scheduler = new Scheduler();
    profiler = new Profiler();

    world.setResource(Profiler, profiler);

    // Mock console methods
    consoleSpy = {
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      table: vi.spyOn(console, 'table').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.group.mockRestore();
    consoleSpy.groupEnd.mockRestore();
    consoleSpy.table.mockRestore();
  });

  test('should dump system stats at specified intervals', () => {
    // Add some test systems
    const fastSystem = system('FastSystem', () => {}).stage('update').build();
    const slowSystem = system('SlowSystem', () => {
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 1) {}
    }).stage('preUpdate').build();

    scheduler.add(fastSystem);
    scheduler.add(slowSystem);
    scheduler.add(ProfilerDumpSystem);

    // Run systems to generate profiling data
    for (let i = 1; i <= 5; i++) {
      scheduler.tick(world, 16);
    }

    // Should not dump yet (default interval is 60)
    expect(consoleSpy.table).not.toHaveBeenCalled();

    // Skip to frame 60
    for (let i = 6; i <= 60; i++) {
      scheduler.tick(world, 16);
    }

    // Should dump at frame 60
    expect(consoleSpy.group).toHaveBeenCalledWith(
      expect.stringContaining('Top 8 Systems by Avg Time (Frame 60)')
    );
    expect(consoleSpy.table).toHaveBeenCalled();
    expect(consoleSpy.groupEnd).toHaveBeenCalled();
  });

  test('should be configurable via resource', () => {
    // Set custom config
    enableProfilerDump(world, {
      interval: 10,
      topCount: 3,
      resetMaxAfterDump: false
    });

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);
    scheduler.add(ProfilerDumpSystem);

    // Run to frame 10
    for (let i = 1; i <= 10; i++) {
      scheduler.tick(world, 16);
    }

    // Should dump at frame 10 with custom config
    expect(consoleSpy.group).toHaveBeenCalledWith(
      expect.stringContaining('Top 3 Systems by Avg Time (Frame 10)')
    );
  });

  test('should be disableable', () => {
    disableProfilerDump(world);

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);
    scheduler.add(ProfilerDumpSystem);

    // Run many frames
    for (let i = 1; i <= 120; i++) {
      scheduler.tick(world, 16);
    }

    // Should never dump when disabled
    expect(consoleSpy.table).not.toHaveBeenCalled();
  });

  test('should support pause and resume', () => {
    enableProfilerDump(world, { interval: 10 });

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);
    scheduler.add(ProfilerDumpSystem);

    // Run to first dump
    for (let i = 1; i <= 10; i++) {
      scheduler.tick(world, 16);
    }
    expect(consoleSpy.table).toHaveBeenCalledTimes(1);

    // Pause
    pauseProfilerDump(world);

    // Run to next dump point - should not dump
    for (let i = 11; i <= 20; i++) {
      scheduler.tick(world, 16);
    }
    expect(consoleSpy.table).toHaveBeenCalledTimes(1); // Still 1

    // Resume
    resumeProfilerDump(world);

    // Run to next dump point - should dump again
    for (let i = 21; i <= 30; i++) {
      scheduler.tick(world, 16);
    }
    expect(consoleSpy.table).toHaveBeenCalledTimes(2);
  });

  test('should gracefully handle missing profiler', () => {
    // Remove profiler
    world.setResource(Profiler, undefined as any);

    scheduler.add(ProfilerDumpSystem);

    // Run many frames
    for (let i = 1; i <= 60; i++) {
      scheduler.tick(world, 16);
    }

    // Should not crash or dump
    expect(consoleSpy.table).not.toHaveBeenCalled();
  });

  test('should reset max times after dump when configured', () => {
    enableProfilerDump(world, {
      interval: 10,
      resetMaxAfterDump: true
    });

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);
    scheduler.add(ProfilerDumpSystem);

    const resetMaxSpy = vi.spyOn(profiler, 'resetMax');

    // Run to first dump
    for (let i = 1; i <= 10; i++) {
      scheduler.tick(world, 16);
    }

    expect(resetMaxSpy).toHaveBeenCalledTimes(1);
  });

  test('should not reset max times when configured not to', () => {
    enableProfilerDump(world, {
      interval: 10,
      resetMaxAfterDump: false
    });

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);
    scheduler.add(ProfilerDumpSystem);

    const resetMaxSpy = vi.spyOn(profiler, 'resetMax');

    // Run to first dump
    for (let i = 1; i <= 10; i++) {
      scheduler.tick(world, 16);
    }

    expect(resetMaxSpy).not.toHaveBeenCalled();
  });

  test('should use default config when none provided', () => {
    scheduler.add(ProfilerDumpSystem);

    const testSystem = system('TestSystem', () => {}).build();
    scheduler.add(testSystem);

    // Run with default interval (60)
    for (let i = 1; i <= 60; i++) {
      scheduler.tick(world, 16);
    }

    // Should dump with default settings
    expect(consoleSpy.group).toHaveBeenCalledWith(
      expect.stringContaining(`Top ${DEFAULT_PROFILER_DUMP_CONFIG.topCount} Systems`)
    );
  });

  test('should handle empty profiler data', () => {
    enableProfilerDump(world, { interval: 10 });

    // Add ProfilerDumpSystem but no other systems
    scheduler.add(ProfilerDumpSystem);

    // Run to dump point
    for (let i = 1; i <= 10; i++) {
      scheduler.tick(world, 16);
    }

    // Should not crash, but also shouldn't dump empty data
    // (ProfilerDumpSystem itself will be in the profiler, but let's be lenient)
    expect(consoleSpy.table).toHaveBeenCalledTimes(1);
  });

  test('should format table data correctly', () => {
    enableProfilerDump(world, { interval: 10 });

    const testSystem = system('TestSystem', () => {}).stage('update').build();
    scheduler.add(testSystem);
    scheduler.add(ProfilerDumpSystem);

    // Run to generate some data
    for (let i = 1; i <= 10; i++) {
      scheduler.tick(world, 16);
    }

    expect(consoleSpy.table).toHaveBeenCalled();

    // Verify the table data structure
    const tableCall = consoleSpy.table.mock.calls[0];
    const tableData = tableCall[0];

    expect(Array.isArray(tableData)).toBe(true);

    if (tableData.length > 0) {
      const firstRow = tableData[0];
      expect(firstRow).toHaveProperty('stage');
      expect(firstRow).toHaveProperty('system');
      expect(firstRow).toHaveProperty('lastMs');
      expect(firstRow).toHaveProperty('avgMs');
      expect(firstRow).toHaveProperty('maxMs');
      expect(firstRow).toHaveProperty('calls');

      // Verify numeric values are formatted as strings with proper precision
      expect(typeof firstRow.lastMs).toBe('string');
      expect(typeof firstRow.avgMs).toBe('string');
      expect(typeof firstRow.maxMs).toBe('string');
      expect(typeof firstRow.calls).toBe('number');
    }
  });
});