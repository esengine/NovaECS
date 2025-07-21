/**
 * Plugin performance metrics interface
 * 插件性能指标接口
 */
export interface PluginPerformanceMetrics {
  /** Current update time in milliseconds | 当前更新时间（毫秒） */
  updateTime: number;
  /** Average update time in milliseconds | 平均更新时间（毫秒） */
  averageUpdateTime: number;
  /** Maximum update time in milliseconds | 最大更新时间（毫秒） */
  maxUpdateTime: number;
  /** Minimum update time in milliseconds | 最小更新时间（毫秒） */
  minUpdateTime: number;
  /** Total number of update calls | 更新调用总次数 */
  totalCalls: number;
  /** Total time spent in updates | 更新总耗时 */
  totalTime: number;
  /** Memory usage in bytes (if available) | 内存使用量（字节，如果可用） */
  memoryUsage?: number;
  /** Last update timestamp | 最后更新时间戳 */
  lastUpdate: number;
  /** Performance warnings count | 性能警告次数 */
  warningCount: number;
}

/**
 * Plugin performance analyzer configuration
 * 插件性能分析器配置
 */
export interface PluginPerformanceConfig {
  /** Enable performance monitoring | 启用性能监控 */
  enabled: boolean;
  /** Warning threshold in milliseconds | 警告阈值（毫秒） */
  warningThreshold: number;
  /** Maximum number of samples to keep | 保留的最大样本数 */
  maxSamples: number;
  /** Enable memory monitoring | 启用内存监控 */
  enableMemoryMonitoring: boolean;
  /** Sample interval for memory monitoring | 内存监控采样间隔 */
  memorySampleInterval: number;
}

/**
 * Plugin performance analyzer
 * 插件性能分析器
 */
export class PluginPerformanceAnalyzer {
  private _metrics = new Map<string, PluginPerformanceMetrics>();
  private _samples = new Map<string, number[]>();
  private _config: PluginPerformanceConfig;
  private _memoryTimer: NodeJS.Timeout | undefined;

  constructor(config: Partial<PluginPerformanceConfig> = {}) {
    this._config = {
      enabled: true,
      warningThreshold: 16.67, // 60 FPS threshold
      maxSamples: 100,
      enableMemoryMonitoring: false,
      memorySampleInterval: 1000,
      ...config
    };

    if (this._config.enableMemoryMonitoring) {
      this._startMemoryMonitoring();
    }
  }

  /**
   * Start measuring performance for a plugin
   * 开始测量插件性能
   * @param pluginName Name of the plugin | 插件名称
   * @returns Function to stop measurement | 停止测量的函数
   */
  startMeasure(pluginName: string): () => void {
    if (!this._config.enabled) {
      return () => {}; // No-op if disabled
    }

    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this._updateMetrics(pluginName, duration);
    };
  }

  /**
   * Update metrics for a plugin
   * 更新插件指标
   * @param pluginName Name of the plugin | 插件名称
   * @param duration Duration in milliseconds | 持续时间（毫秒）
   */
  private _updateMetrics(pluginName: string, duration: number): void {
    let metrics = this._metrics.get(pluginName);

    if (!metrics) {
      metrics = {
        updateTime: duration,
        averageUpdateTime: duration,
        maxUpdateTime: duration,
        minUpdateTime: duration,
        totalCalls: 1,
        totalTime: duration,
        lastUpdate: Date.now(),
        warningCount: 0
      };
      this._metrics.set(pluginName, metrics);
      this._samples.set(pluginName, [duration]);
    } else {
      // Update metrics
      metrics.updateTime = duration;
      metrics.totalCalls++;
      metrics.totalTime += duration;
      metrics.averageUpdateTime = metrics.totalTime / metrics.totalCalls;
      metrics.maxUpdateTime = Math.max(metrics.maxUpdateTime, duration);
      metrics.minUpdateTime = Math.min(metrics.minUpdateTime, duration);
      metrics.lastUpdate = Date.now();

      // Update samples
      const samples = this._samples.get(pluginName);
      if (samples) {
        samples.push(duration);

        // Keep only the most recent samples
        if (samples.length > this._config.maxSamples) {
          samples.shift();
        }
      }
    }

    // Check for performance warnings (for both new and existing metrics)
    if (duration > this._config.warningThreshold) {
      metrics.warningCount++;
      console.warn(`Performance warning: Plugin ${pluginName} took ${duration.toFixed(2)}ms to update`);
    }
  }

  /**
   * Get performance metrics for a specific plugin
   * 获取特定插件的性能指标
   * @param pluginName Name of the plugin | 插件名称
   * @returns Performance metrics or undefined | 性能指标或undefined
   */
  getMetrics(pluginName: string): PluginPerformanceMetrics | undefined {
    return this._metrics.get(pluginName);
  }

  /**
   * Get performance report for all plugins
   * 获取所有插件的性能报告
   * @returns Performance metrics for all plugins | 所有插件的性能指标
   */
  getReport(): Record<string, PluginPerformanceMetrics> {
    return Object.fromEntries(this._metrics);
  }

  /**
   * Get performance samples for a plugin
   * 获取插件的性能样本
   * @param pluginName Name of the plugin | 插件名称
   * @returns Array of performance samples | 性能样本数组
   */
  getSamples(pluginName: string): number[] {
    return this._samples.get(pluginName) || [];
  }

  /**
   * Reset metrics for a specific plugin
   * 重置特定插件的指标
   * @param pluginName Name of the plugin | 插件名称
   */
  resetMetrics(pluginName: string): void {
    this._metrics.delete(pluginName);
    this._samples.delete(pluginName);
  }

  /**
   * Reset all metrics
   * 重置所有指标
   */
  resetAllMetrics(): void {
    this._metrics.clear();
    this._samples.clear();
  }

  /**
   * Update configuration
   * 更新配置
   * @param config New configuration | 新配置
   */
  updateConfig(config: Partial<PluginPerformanceConfig>): void {
    const oldConfig = this._config;
    this._config = { ...this._config, ...config };

    // Handle memory monitoring changes
    if (oldConfig.enableMemoryMonitoring !== this._config.enableMemoryMonitoring) {
      if (this._config.enableMemoryMonitoring) {
        this._startMemoryMonitoring();
      } else {
        this._stopMemoryMonitoring();
      }
    }
  }

  /**
   * Get current configuration
   * 获取当前配置
   * @returns Current configuration | 当前配置
   */
  getConfig(): PluginPerformanceConfig {
    return { ...this._config };
  }

  /**
   * Start memory monitoring
   * 开始内存监控
   */
  private _startMemoryMonitoring(): void {
    if (this._memoryTimer) {
      clearInterval(this._memoryTimer);
    }

    this._memoryTimer = setInterval(() => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        
        // Update memory usage for all tracked plugins
        for (const [, metrics] of this._metrics) {
          metrics.memoryUsage = memUsage.heapUsed;
        }
      }
    }, this._config.memorySampleInterval);
  }

  /**
   * Stop memory monitoring
   * 停止内存监控
   */
  private _stopMemoryMonitoring(): void {
    if (this._memoryTimer) {
      clearInterval(this._memoryTimer);
      this._memoryTimer = undefined;
    }
  }

  /**
   * Get performance summary
   * 获取性能摘要
   * @returns Performance summary | 性能摘要
   */
  getSummary(): {
    totalPlugins: number;
    averageUpdateTime: number;
    slowestPlugin: string | null;
    fastestPlugin: string | null;
    totalWarnings: number;
  } {
    const plugins = Array.from(this._metrics.entries());
    
    if (plugins.length === 0) {
      return {
        totalPlugins: 0,
        averageUpdateTime: 0,
        slowestPlugin: null,
        fastestPlugin: null,
        totalWarnings: 0
      };
    }

    const totalTime = plugins.reduce((sum, [, metrics]) => sum + metrics.averageUpdateTime, 0);
    const averageUpdateTime = totalTime / plugins.length;
    
    const slowest = plugins.reduce((prev, curr) => 
      curr[1].averageUpdateTime > prev[1].averageUpdateTime ? curr : prev
    );
    
    const fastest = plugins.reduce((prev, curr) => 
      curr[1].averageUpdateTime < prev[1].averageUpdateTime ? curr : prev
    );

    const totalWarnings = plugins.reduce((sum, [, metrics]) => sum + metrics.warningCount, 0);

    return {
      totalPlugins: plugins.length,
      averageUpdateTime,
      slowestPlugin: slowest[0],
      fastestPlugin: fastest[0],
      totalWarnings
    };
  }

  /**
   * Dispose the analyzer
   * 销毁分析器
   */
  dispose(): void {
    this._stopMemoryMonitoring();
    this._metrics.clear();
    this._samples.clear();
  }
}
