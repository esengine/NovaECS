/**
 * Performance Benchmark for ECS System Execution
 * ECS 系统执行性能基准测试
 */

import type { System } from '../core/System';
import type { Entity } from '../core/Entity';
import { World } from '../core/World';
import { ExecutionMode } from '../core/System';

export interface BenchmarkResult {
  mainThreadTime: number;
  workerTime: number;
  improvement: number;
  recommendation: 'worker' | 'main_thread';
  entityCount: number;
  systemName: string;
  iterations: number;
}

export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  entityCounts: number[];
  deltaTime: number;
}

/**
 * Performance benchmark for system execution modes
 * 系统执行模式性能基准测试
 */
export class PerformanceBenchmark {
  private world: World;
  private config: BenchmarkConfig;

  constructor(config?: Partial<BenchmarkConfig>) {
    this.world = new World();
    this.config = {
      iterations: 10,
      warmupIterations: 3,
      entityCounts: [10, 50, 100, 200, 500],
      deltaTime: 16,
      ...config
    };
  }

  /**
   * Benchmark system execution across different modes
   * 跨不同模式基准测试系统执行
   */
  async benchmarkSystemExecution(
    SystemClass: new () => System,
    createEntities: (count: number, world: World) => Entity[]
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const entityCount of this.config.entityCounts) {
      console.log(`\n📊 Benchmarking ${SystemClass.name} with ${entityCount} entities...`);
      
      const result = await this.benchmarkSingleConfiguration(
        SystemClass,
        createEntities,
        entityCount
      );
      
      results.push(result);
      
      console.log(`  Main Thread: ${result.mainThreadTime.toFixed(2)}ms`);
      console.log(`  Worker: ${result.workerTime.toFixed(2)}ms`);
      console.log(`  Improvement: ${(result.improvement * 100).toFixed(1)}%`);
      console.log(`  Recommendation: ${result.recommendation}`);
    }

    return results;
  }

  /**
   * Benchmark a single configuration
   * 基准测试单个配置
   */
  private async benchmarkSingleConfiguration(
    SystemClass: new () => System,
    createEntities: (count: number, world: World) => Entity[],
    entityCount: number
  ): Promise<BenchmarkResult> {
    // Measure main thread execution
    const mainThreadTime = await this.measureExecutionMode(
      SystemClass,
      createEntities,
      entityCount,
      ExecutionMode.MainThread
    );

    // Measure worker execution (if supported)
    let workerTime = mainThreadTime; // Default to main thread time
    if (this.world.isParallelExecutionSupported) {
      workerTime = await this.measureExecutionMode(
        SystemClass,
        createEntities,
        entityCount,
        ExecutionMode.Worker
      );
    }

    const improvement = (mainThreadTime - workerTime) / mainThreadTime;
    const recommendation = workerTime < mainThreadTime ? 'worker' : 'main_thread';

    return {
      mainThreadTime,
      workerTime,
      improvement,
      recommendation,
      entityCount,
      systemName: SystemClass.name,
      iterations: this.config.iterations
    };
  }

  /**
   * Measure execution time for specific mode
   * 测量特定模式的执行时间
   */
  private async measureExecutionMode(
    SystemClass: new () => System,
    createEntities: (count: number, world: World) => Entity[],
    entityCount: number,
    mode: ExecutionMode
  ): Promise<number> {
    const times: number[] = [];

    // Warmup iterations
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await this.runSingleIteration(SystemClass, createEntities, entityCount, mode);
    }

    // Actual measurement iterations
    for (let i = 0; i < this.config.iterations; i++) {
      const time = await this.runSingleIteration(SystemClass, createEntities, entityCount, mode);
      times.push(time);
    }

    // Return average time, excluding outliers
    return this.calculateAverageExcludingOutliers(times);
  }

  /**
   * Run a single iteration of system execution
   * 运行系统执行的单次迭代
   */
  private async runSingleIteration(
    SystemClass: new () => System,
    createEntities: (count: number, world: World) => Entity[],
    entityCount: number,
    mode: ExecutionMode
  ): Promise<number> {
    // Clear world
    this.world.clear();

    // Create system with specified execution mode
    const system = new SystemClass();
    // Override execution mode
    Object.defineProperty(system, 'executionMode', {
      value: mode,
      writable: false,
      enumerable: true,
      configurable: false
    });

    this.world.addSystem(system);

    // Create entities
    createEntities(entityCount, this.world);

    // Measure execution time
    const startTime = performance.now();
    this.world.update(this.config.deltaTime);
    
    // Wait for async execution to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const endTime = performance.now();

    // Remove system for next iteration
    this.world.removeSystem(system);

    return endTime - startTime;
  }

  /**
   * Calculate average excluding outliers
   * 计算排除异常值的平均值
   */
  private calculateAverageExcludingOutliers(times: number[]): number {
    if (times.length <= 2) {
      return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    // Sort times
    const sorted = [...times].sort((a, b) => a - b);
    
    // Remove top and bottom 10% as outliers
    const removeCount = Math.floor(sorted.length * 0.1);
    const filtered = sorted.slice(removeCount, sorted.length - removeCount);
    
    return filtered.reduce((sum, time) => sum + time, 0) / filtered.length;
  }

  /**
   * Generate performance report
   * 生成性能报告
   */
  generateReport(results: BenchmarkResult[]): string {
    let report = '\n📈 Performance Benchmark Report\n';
    report += '================================\n\n';

    results.forEach(result => {
      report += `System: ${result.systemName}\n`;
      report += `Entities: ${result.entityCount}\n`;
      report += `Main Thread: ${result.mainThreadTime.toFixed(2)}ms\n`;
      report += `Worker: ${result.workerTime.toFixed(2)}ms\n`;
      report += `Improvement: ${(result.improvement * 100).toFixed(1)}%\n`;
      report += `Recommendation: ${result.recommendation}\n`;
      report += `Iterations: ${result.iterations}\n`;
      report += '---\n';
    });

    // Summary
    const workerRecommendations = results.filter(r => r.recommendation === 'worker').length;
    const totalTests = results.length;
    
    report += '\n📊 Summary\n';
    report += `Total tests: ${totalTests}\n`;
    report += `Worker recommended: ${workerRecommendations}/${totalTests} (${((workerRecommendations / totalTests) * 100).toFixed(1)}%)\n`;
    
    const avgImprovement = results.reduce((sum, r) => sum + r.improvement, 0) / results.length;
    report += `Average improvement: ${(avgImprovement * 100).toFixed(1)}%\n`;

    return report;
  }

  /**
   * Compare two systems performance
   * 比较两个系统的性能
   */
  async compareSystemsPerformance(
    SystemA: new () => System,
    SystemB: new () => System,
    createEntities: (count: number, world: World) => Entity[],
    entityCount: number = 100
  ): Promise<{
    systemA: { mainThread: number; worker: number };
    systemB: { mainThread: number; worker: number };
    winner: string;
  }> {
    console.log(`\n🏁 Comparing ${SystemA.name} vs ${SystemB.name}`);

    const systemAResults = await this.benchmarkSingleConfiguration(
      SystemA,
      createEntities,
      entityCount
    );

    const systemBResults = await this.benchmarkSingleConfiguration(
      SystemB,
      createEntities,
      entityCount
    );

    const systemABest = Math.min(systemAResults.mainThreadTime, systemAResults.workerTime);
    const systemBBest = Math.min(systemBResults.mainThreadTime, systemBResults.workerTime);

    const winner = systemABest < systemBBest ? SystemA.name : SystemB.name;

    return {
      systemA: {
        mainThread: systemAResults.mainThreadTime,
        worker: systemAResults.workerTime
      },
      systemB: {
        mainThread: systemBResults.mainThreadTime,
        worker: systemBResults.workerTime
      },
      winner
    };
  }

  /**
   * Find optimal entity count threshold for worker execution
   * 找到工作线程执行的最佳实体数量阈值
   */
  async findOptimalWorkerThreshold(
    SystemClass: new () => System,
    createEntities: (count: number, world: World) => Entity[],
    maxEntityCount: number = 1000
  ): Promise<number> {
    console.log(`\n🎯 Finding optimal worker threshold for ${SystemClass.name}`);

    const testCounts = [];
    for (let count = 10; count <= maxEntityCount; count += 10) {
      testCounts.push(count);
    }

    let optimalThreshold = maxEntityCount;

    for (const entityCount of testCounts) {
      const result = await this.benchmarkSingleConfiguration(
        SystemClass,
        createEntities,
        entityCount
      );

      if (result.recommendation === 'worker') {
        optimalThreshold = entityCount;
        break;
      }
    }

    console.log(`  Optimal threshold: ${optimalThreshold} entities`);
    return optimalThreshold;
  }

  /**
   * Cleanup resources
   * 清理资源
   */
  dispose(): void {
    this.world.dispose();
  }
}
