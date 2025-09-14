/**
 * Performance profiler for tracking system execution statistics
 * 用于跟踪系统执行统计的性能分析器
 */

import type { SystemStage } from './System';

export interface SysStat {
  /** System name 系统名称 */
  name: string;
  /** System stage 系统阶段 */
  stage: SystemStage;
  /** Last execution time in ms 最后执行时间（毫秒） */
  lastMs: number;
  /** Average execution time in ms (EMA) 平均执行时间（指数移动平均） */
  avgMs: number;
  /** Maximum execution time in ms 最大执行时间（毫秒） */
  maxMs: number;
  /** Total number of calls 总调用次数 */
  calls: number;
}

/**
 * System profiler with exponential moving average
 * 使用指数移动平均的系统分析器
 */
export class Profiler {
  private stats = new Map<string, SysStat>();

  /**
   * @param emaAlpha EMA smoothing factor (0-1), higher = more weight to recent values
   *                 EMA平滑因子（0-1），越高越重视最近的值
   */
  constructor(public emaAlpha = 0.15) {}

  /**
   * Generate unique key for system+stage combination
   * 为系统+阶段组合生成唯一键
   */
  private key(name: string, stage: SystemStage): string {
    return `${stage}:${name}`;
  }

  /**
   * Record execution time for a system
   * 记录系统执行时间
   */
  record(name: string, stage: SystemStage, ms: number): void {
    const k = this.key(name, stage);
    let s = this.stats.get(k);
    if (!s) {
      s = { name, stage, lastMs: ms, avgMs: ms, maxMs: ms, calls: 1 };
      this.stats.set(k, s);
    } else {
      s.lastMs = ms;
      s.avgMs = s.avgMs + (ms - s.avgMs) * this.emaAlpha; // EMA
      s.maxMs = Math.max(s.maxMs, ms);
      s.calls++;
    }
  }

  /**
   * Get all system statistics
   * 获取所有系统统计信息
   */
  getAll(): SysStat[] {
    return [...this.stats.values()];
  }

  /**
   * Get top N systems by average execution time
   * 按平均执行时间获取前N个系统
   */
  topByAvg(n = 10): SysStat[] {
    return this.getAll().sort((a, b) => b.avgMs - a.avgMs).slice(0, n);
  }

  /**
   * Reset maximum execution times to current last values
   * 将最大执行时间重置为当前最后值
   */
  resetMax(): void {
    for (const s of this.stats.values()) {
      s.maxMs = s.lastMs;
    }
  }

  /**
   * Clear all statistics
   * 清空所有统计信息
   */
  clear(): void {
    this.stats.clear();
  }

  /**
   * Get statistics for a specific system
   * 获取特定系统的统计信息
   */
  getStat(name: string, stage: SystemStage): SysStat | undefined {
    return this.stats.get(this.key(name, stage));
  }
}