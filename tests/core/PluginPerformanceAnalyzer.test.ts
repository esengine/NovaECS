import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PluginPerformanceAnalyzer, PluginPerformanceConfig } from '../../src/core/PluginPerformanceAnalyzer';

describe('PluginPerformanceAnalyzer', () => {
  let analyzer: PluginPerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PluginPerformanceAnalyzer();
  });

  describe('Basic functionality', () => {
    test('should initialize with default configuration', () => {
      const config = analyzer.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.warningThreshold).toBe(16.67);
      expect(config.maxSamples).toBe(100);
      expect(config.enableMemoryMonitoring).toBe(false);
    });

    test('should initialize with custom configuration', () => {
      const customConfig: PluginPerformanceConfig = {
        enabled: false,
        warningThreshold: 10,
        maxSamples: 50,
        enableMemoryMonitoring: true,
        memorySampleInterval: 500
      };

      const customAnalyzer = new PluginPerformanceAnalyzer(customConfig);
      const config = customAnalyzer.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.warningThreshold).toBe(10);
      expect(config.maxSamples).toBe(50);
      expect(config.enableMemoryMonitoring).toBe(true);
      expect(config.memorySampleInterval).toBe(500);
    });
  });

  describe('Performance measurement', () => {
    test('should measure plugin performance', () => {
      const stopMeasure = analyzer.startMeasure('TestPlugin');
      
      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Busy wait for 10ms
      }
      
      stopMeasure();

      const metrics = analyzer.getMetrics('TestPlugin');
      expect(metrics).toBeDefined();
      expect(metrics!.totalCalls).toBe(1);
      expect(metrics!.updateTime).toBeGreaterThan(5);
      expect(metrics!.averageUpdateTime).toBeGreaterThan(5);
    });

    test('should track multiple measurements', () => {
      // First measurement
      let stopMeasure = analyzer.startMeasure('TestPlugin');
      stopMeasure();

      // Second measurement
      stopMeasure = analyzer.startMeasure('TestPlugin');
      stopMeasure();

      const metrics = analyzer.getMetrics('TestPlugin');
      expect(metrics!.totalCalls).toBe(2);
      expect(metrics!.averageUpdateTime).toBeGreaterThan(0);
    });

    test('should return no-op function when disabled', () => {
      analyzer.updateConfig({ enabled: false });
      
      const stopMeasure = analyzer.startMeasure('TestPlugin');
      stopMeasure();

      const metrics = analyzer.getMetrics('TestPlugin');
      expect(metrics).toBeUndefined();
    });
  });

  describe('Performance warnings', () => {
    test('should generate warnings for slow plugins', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      analyzer.updateConfig({ warningThreshold: 1 }); // 1ms threshold

      const stopMeasure = analyzer.startMeasure('SlowPlugin');

      // Use a more reliable delay with Promise
      await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay

      stopMeasure();

      const metrics = analyzer.getMetrics('SlowPlugin');

      // The 5ms delay should definitely trigger the 1ms threshold
      expect(metrics!.updateTime).toBeGreaterThan(1);
      expect(metrics!.warningCount).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Samples management', () => {
    test('should track performance samples', () => {
      const stopMeasure1 = analyzer.startMeasure('TestPlugin');
      stopMeasure1();
      
      const stopMeasure2 = analyzer.startMeasure('TestPlugin');
      stopMeasure2();

      const samples = analyzer.getSamples('TestPlugin');
      expect(samples).toHaveLength(2);
      expect(samples[0]).toBeGreaterThan(0);
      expect(samples[1]).toBeGreaterThan(0);
    });

    test('should limit number of samples', () => {
      analyzer.updateConfig({ maxSamples: 2 });

      // Add 3 samples
      for (let i = 0; i < 3; i++) {
        const stopMeasure = analyzer.startMeasure('TestPlugin');
        stopMeasure();
      }

      const samples = analyzer.getSamples('TestPlugin');
      expect(samples).toHaveLength(2); // Should only keep the last 2
    });
  });

  describe('Metrics management', () => {
    test('should reset metrics for specific plugin', () => {
      const stopMeasure = analyzer.startMeasure('TestPlugin');
      stopMeasure();

      expect(analyzer.getMetrics('TestPlugin')).toBeDefined();
      
      analyzer.resetMetrics('TestPlugin');
      
      expect(analyzer.getMetrics('TestPlugin')).toBeUndefined();
      expect(analyzer.getSamples('TestPlugin')).toHaveLength(0);
    });

    test('should reset all metrics', () => {
      const stopMeasure1 = analyzer.startMeasure('Plugin1');
      stopMeasure1();
      
      const stopMeasure2 = analyzer.startMeasure('Plugin2');
      stopMeasure2();

      expect(analyzer.getMetrics('Plugin1')).toBeDefined();
      expect(analyzer.getMetrics('Plugin2')).toBeDefined();
      
      analyzer.resetAllMetrics();
      
      expect(analyzer.getMetrics('Plugin1')).toBeUndefined();
      expect(analyzer.getMetrics('Plugin2')).toBeUndefined();
    });
  });

  describe('Performance report', () => {
    test('should generate performance report', () => {
      const stopMeasure1 = analyzer.startMeasure('Plugin1');
      stopMeasure1();
      
      const stopMeasure2 = analyzer.startMeasure('Plugin2');
      stopMeasure2();

      const report = analyzer.getReport();
      
      expect(Object.keys(report)).toHaveLength(2);
      expect(report['Plugin1']).toBeDefined();
      expect(report['Plugin2']).toBeDefined();
    });

    test('should generate performance summary', () => {
      const stopMeasure1 = analyzer.startMeasure('FastPlugin');
      stopMeasure1();
      
      // Simulate slower plugin
      const stopMeasure2 = analyzer.startMeasure('SlowPlugin');
      const start = performance.now();
      while (performance.now() - start < 5) {
        // Busy wait
      }
      stopMeasure2();

      const summary = analyzer.getSummary();
      
      expect(summary.totalPlugins).toBe(2);
      expect(summary.averageUpdateTime).toBeGreaterThan(0);
      expect(summary.slowestPlugin).toBe('SlowPlugin');
      expect(summary.fastestPlugin).toBe('FastPlugin');
      expect(summary.totalWarnings).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty summary', () => {
      const summary = analyzer.getSummary();
      
      expect(summary.totalPlugins).toBe(0);
      expect(summary.averageUpdateTime).toBe(0);
      expect(summary.slowestPlugin).toBeNull();
      expect(summary.fastestPlugin).toBeNull();
      expect(summary.totalWarnings).toBe(0);
    });
  });

  describe('Configuration updates', () => {
    test('should update configuration', () => {
      const newConfig = {
        warningThreshold: 20,
        maxSamples: 200
      };

      analyzer.updateConfig(newConfig);
      
      const config = analyzer.getConfig();
      expect(config.warningThreshold).toBe(20);
      expect(config.maxSamples).toBe(200);
      expect(config.enabled).toBe(true); // Should keep existing values
    });
  });

  describe('Disposal', () => {
    test('should dispose analyzer properly', () => {
      const stopMeasure = analyzer.startMeasure('TestPlugin');
      stopMeasure();

      expect(analyzer.getMetrics('TestPlugin')).toBeDefined();
      
      analyzer.dispose();
      
      // After disposal, metrics should be cleared
      expect(analyzer.getMetrics('TestPlugin')).toBeUndefined();
      expect(analyzer.getSamples('TestPlugin')).toHaveLength(0);
    });
  });
});
