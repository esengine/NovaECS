/**
 * Debug system for periodically dumping system profiling data to console
 * 定期将系统性能分析数据输出到控制台的调试系统
 */

import { system } from '../core/System';
import { Profiler } from '../core/Profiler';

export interface ProfilerDumpConfig {
  /** Enable/disable the dump system 启用/禁用输出系统 */
  enabled: boolean;
  /** Print every N frames 每N帧打印一次 */
  interval: number;
  /** Number of top systems to show 显示前N个最慢系统 */
  topCount: number;
  /** Whether to reset max times after each dump 每次输出后是否重置最大时间 */
  resetMaxAfterDump: boolean;
}

/**
 * Default configuration for ProfilerDumpSystem
 * ProfilerDumpSystem的默认配置
 */
export const DEFAULT_PROFILER_DUMP_CONFIG: ProfilerDumpConfig = {
  enabled: true,
  interval: 60,
  topCount: 8,
  resetMaxAfterDump: true,
};

/**
 * Resource key for ProfilerDumpSystem configuration
 * ProfilerDumpSystem配置的资源键
 */
export class ProfilerDumpConfig_ {}

/**
 * System that periodically dumps profiling statistics to console
 * 定期将性能统计信息输出到控制台的系统
 *
 * Usage:
 * ```typescript
 * // Add to scheduler with default config
 * scheduler.add(ProfilerDumpSystem);
 *
 * // Or customize config
 * world.setResource(ProfilerDumpConfig_, {
 *   enabled: true,
 *   interval: 120,  // Every 2 seconds at 60fps
 *   topCount: 5,
 *   resetMaxAfterDump: false
 * });
 * ```
 */
export const ProfilerDumpSystem = system('ProfilerDump', (ctx) => {
  const { world } = ctx;

  // Get configuration (use default if not set)
  const config = (world.getResource(ProfilerDumpConfig_) as ProfilerDumpConfig) || DEFAULT_PROFILER_DUMP_CONFIG;

  if (!config.enabled) {
    return; // System is disabled
  }

  const prof = world.getResource(Profiler);
  if (!prof) {
    return; // No profiler available
  }

  // Check if it's time to dump (every N frames)
  if (world.frame % config.interval === 0) {
    const top = prof.topByAvg(config.topCount);

    if (top.length > 0) {
      console.group(`🔍 Top ${config.topCount} Systems by Avg Time (Frame ${world.frame})`);

      // Format data for console.table
      const tableData = top.map(s => ({
        stage: s.stage,
        system: s.name,
        lastMs: s.lastMs.toFixed(3),
        avgMs: s.avgMs.toFixed(3),
        maxMs: s.maxMs.toFixed(3),
        calls: s.calls,
      }));

      console.table(tableData);
      console.groupEnd();

      // Optionally reset max times for next observation period
      if (config.resetMaxAfterDump) {
        prof.resetMax();
      }
    }
  }
}).stage('postUpdate').build();

/**
 * Convenience function to enable ProfilerDumpSystem with custom config
 * 使用自定义配置启用ProfilerDumpSystem的便利函数
 */
export function enableProfilerDump(
  world: any,
  config: Partial<ProfilerDumpConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_PROFILER_DUMP_CONFIG, ...config };
  world.setResource(ProfilerDumpConfig_, finalConfig);
}

/**
 * Convenience function to disable ProfilerDumpSystem
 * 禁用ProfilerDumpSystem的便利函数
 */
export function disableProfilerDump(world: any): void {
  const config = (world.getResource(ProfilerDumpConfig_) as ProfilerDumpConfig) || DEFAULT_PROFILER_DUMP_CONFIG;
  world.setResource(ProfilerDumpConfig_, { ...config, enabled: false });
}

/**
 * Convenience function to temporarily pause profiler dumping
 * 临时暂停性能分析输出的便利函数
 */
export function pauseProfilerDump(world: any): void {
  disableProfilerDump(world);
}

/**
 * Convenience function to resume profiler dumping
 * 恢复性能分析输出的便利函数
 */
export function resumeProfilerDump(world: any): void {
  const config = (world.getResource(ProfilerDumpConfig_) as ProfilerDumpConfig) || DEFAULT_PROFILER_DUMP_CONFIG;
  world.setResource(ProfilerDumpConfig_, { ...config, enabled: true });
}