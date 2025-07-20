import type {
  QueryStatistics,
  QueryPerformanceEntry,
  QueryFrequencyEntry,
  QueryCriteria
} from '../utils/QueryTypes';

/**
 * Performance monitor for query system
 * 查询系统性能监控器
 */
export class QueryPerformanceMonitor {
  private _enabled = true;
  private _totalQueries = 0;
  private _cacheHits = 0;
  private _cacheMisses = 0;
  private _totalExecutionTime = 0;
  private _slowestQueries: QueryPerformanceEntry[] = [];
  private _queryFrequency = new Map<string, QueryFrequencyEntry>();
  private _maxSlowQueries = 10;
  private _maxFrequentQueries = 20;
  private _slowQueryThreshold = 10; // milliseconds

  constructor(enabled = true) {
    this._enabled = enabled;
  }

  /**
   * Record query execution
   * 记录查询执行
   */
  recordQuery(
    signature: string,
    criteria: QueryCriteria,
    executionTime: number,
    fromCache: boolean
  ): void {
    if (!this._enabled) {
      return;
    }

    this._totalQueries++;
    this._totalExecutionTime += executionTime;

    if (fromCache) {
      this._cacheHits++;
    } else {
      this._cacheMisses++;
    }

    // Record slow queries
    if (executionTime >= this._slowQueryThreshold) {
      this._recordSlowQuery(signature, criteria, executionTime);
    }

    // Record query frequency
    this._recordQueryFrequency(signature, criteria, executionTime);
  }

  /**
   * Get comprehensive statistics
   * 获取综合统计信息
   */
  getStatistics(): QueryStatistics {
    const averageExecutionTime = this._totalQueries > 0 
      ? this._totalExecutionTime / this._totalQueries 
      : 0;

    return {
      totalQueries: this._totalQueries,
      cacheHits: this._cacheHits,
      cacheMisses: this._cacheMisses,
      averageExecutionTime,
      totalExecutionTime: this._totalExecutionTime,
      slowestQueries: [...this._slowestQueries],
      frequentQueries: Array.from(this._queryFrequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, this._maxFrequentQueries)
    };
  }

  /**
   * Reset all statistics
   * 重置所有统计信息
   */
  reset(): void {
    this._totalQueries = 0;
    this._cacheHits = 0;
    this._cacheMisses = 0;
    this._totalExecutionTime = 0;
    this._slowestQueries.length = 0;
    this._queryFrequency.clear();
  }

  /**
   * Enable/disable performance monitoring
   * 启用/禁用性能监控
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   * 检查是否启用了监控
   */
  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Set slow query threshold
   * 设置慢查询阈值
   */
  setSlowQueryThreshold(threshold: number): void {
    this._slowQueryThreshold = Math.max(0, threshold);
  }

  /**
   * Get slow query threshold
   * 获取慢查询阈值
   */
  getSlowQueryThreshold(): number {
    return this._slowQueryThreshold;
  }

  /**
   * Set maximum number of slow queries to track
   * 设置跟踪的最大慢查询数量
   */
  setMaxSlowQueries(max: number): void {
    this._maxSlowQueries = Math.max(1, max);
    
    // Trim existing slow queries if necessary
    if (this._slowestQueries.length > this._maxSlowQueries) {
      this._slowestQueries = this._slowestQueries
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, this._maxSlowQueries);
    }
  }

  /**
   * Set maximum number of frequent queries to track
   * 设置跟踪的最大频繁查询数量
   */
  setMaxFrequentQueries(max: number): void {
    this._maxFrequentQueries = Math.max(1, max);
  }

  /**
   * Get cache hit rate
   * 获取缓存命中率
   */
  getCacheHitRate(): number {
    const totalCacheQueries = this._cacheHits + this._cacheMisses;
    return totalCacheQueries > 0 ? this._cacheHits / totalCacheQueries : 0;
  }

  /**
   * Get queries per second (based on recent activity)
   * 获取每秒查询数（基于最近活动）
   */
  getQueriesPerSecond(): number {
    // This is a simplified implementation
    // In a real scenario, you'd track queries over time windows
    return this._totalQueries; // Placeholder
  }

  /**
   * Get performance summary
   * 获取性能摘要
   */
  getPerformanceSummary(): {
    totalQueries: number;
    averageTime: number;
    cacheHitRate: number;
    slowQueriesCount: number;
    topSlowQuery: QueryPerformanceEntry | null;
    topFrequentQuery: QueryFrequencyEntry | null;
  } {
    const stats = this.getStatistics();
    
    return {
      totalQueries: stats.totalQueries,
      averageTime: stats.averageExecutionTime,
      cacheHitRate: this.getCacheHitRate(),
      slowQueriesCount: stats.slowestQueries.length,
      topSlowQuery: stats.slowestQueries[0] || null,
      topFrequentQuery: stats.frequentQueries[0] || null
    };
  }

  /**
   * Record slow query
   * 记录慢查询
   */
  private _recordSlowQuery(
    signature: string,
    criteria: QueryCriteria,
    executionTime: number
  ): void {
    const entry: QueryPerformanceEntry = {
      signature,
      executionTime,
      timestamp: Date.now(),
      criteria: { ...criteria }
    };

    this._slowestQueries.push(entry);

    // Keep only the slowest queries
    if (this._slowestQueries.length > this._maxSlowQueries) {
      this._slowestQueries.sort((a, b) => b.executionTime - a.executionTime);
      this._slowestQueries = this._slowestQueries.slice(0, this._maxSlowQueries);
    }
  }

  /**
   * Record query frequency
   * 记录查询频率
   */
  private _recordQueryFrequency(
    signature: string,
    criteria: QueryCriteria,
    executionTime: number
  ): void {
    let entry = this._queryFrequency.get(signature);
    
    if (entry) {
      entry.count++;
      // Update running average
      entry.averageTime = (entry.averageTime * (entry.count - 1) + executionTime) / entry.count;
    } else {
      entry = {
        signature,
        count: 1,
        averageTime: executionTime,
        criteria: { ...criteria }
      };
      this._queryFrequency.set(signature, entry);
    }
  }

  /**
   * Export statistics to JSON
   * 导出统计信息为JSON
   */
  exportStatistics(): string {
    return JSON.stringify(this.getStatistics(), null, 2);
  }

  /**
   * Import statistics from JSON
   * 从JSON导入统计信息
   */
  importStatistics(json: string): void {
    try {
      const stats = JSON.parse(json) as QueryStatistics;
      
      this._totalQueries = stats.totalQueries;
      this._cacheHits = stats.cacheHits;
      this._cacheMisses = stats.cacheMisses;
      this._totalExecutionTime = stats.totalExecutionTime;
      this._slowestQueries = [...stats.slowestQueries];
      
      // Rebuild frequency map
      this._queryFrequency.clear();
      for (const freq of stats.frequentQueries) {
        this._queryFrequency.set(freq.signature, { ...freq });
      }
    } catch (error) {
      throw new Error(`Failed to import statistics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get detailed report
   * 获取详细报告
   */
  getDetailedReport(): string {
    const stats = this.getStatistics();
    const summary = this.getPerformanceSummary();
    
    let report = '=== Query Performance Report ===\n\n';
    
    report += `Total Queries: ${summary.totalQueries}\n`;
    report += `Average Execution Time: ${summary.averageTime.toFixed(2)}ms\n`;
    report += `Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(1)}%\n`;
    report += `Slow Queries (>${this._slowQueryThreshold}ms): ${summary.slowQueriesCount}\n\n`;
    
    if (summary.topSlowQuery) {
      report += `Slowest Query: ${summary.topSlowQuery.executionTime.toFixed(2)}ms\n`;
      report += `  Signature: ${summary.topSlowQuery.signature}\n\n`;
    }
    
    if (summary.topFrequentQuery) {
      report += `Most Frequent Query: ${summary.topFrequentQuery.count} times\n`;
      report += `  Average Time: ${summary.topFrequentQuery.averageTime.toFixed(2)}ms\n`;
      report += `  Signature: ${summary.topFrequentQuery.signature}\n\n`;
    }
    
    if (stats.slowestQueries.length > 0) {
      report += 'Top Slow Queries:\n';
      stats.slowestQueries.slice(0, 5).forEach((query, index) => {
        report += `  ${index + 1}. ${query.executionTime.toFixed(2)}ms - ${query.signature}\n`;
      });
      report += '\n';
    }
    
    if (stats.frequentQueries.length > 0) {
      report += 'Most Frequent Queries:\n';
      stats.frequentQueries.slice(0, 5).forEach((query, index) => {
        report += `  ${index + 1}. ${query.count} times (${query.averageTime.toFixed(2)}ms avg) - ${query.signature}\n`;
      });
    }
    
    return report;
  }
}
