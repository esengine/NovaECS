/**
 * Enhanced scheduler that integrates with existing Scheduler and adds system-level parallel execution
 * 与现有Scheduler集成并添加系统级并行执行的增强调度器
 */

import type { World } from '../core/World';
import { Scheduler } from '../core/Scheduler';
import { CommandBuffer } from '../core/CommandBuffer';
import { Profiler } from '../core/Profiler';
import { Recorder } from '../replay/Recorder';
import type { SystemStage, SystemConfig, SystemContext } from '../core/System';
import { SystemBuilder } from '../core/System';
import { ParallelRunner, SystemExecutor, RunnerConfig } from './Runner';
import { SystemMetaRegistry, createSystemMeta, SystemHandle } from './SystemMeta';

/**
 * Enhanced scheduler configuration
 * 增强调度器配置
 */
export interface ParallelSchedulerConfig {
  /** Whether to enable parallel execution 是否启用并行执行 */
  enableParallel?: boolean;
  /** Fallback to sequential execution on error 错误时回退到顺序执行 */
  fallbackToSequential?: boolean;
  /** Runner configuration 执行器配置 */
  runnerConfig?: RunnerConfig;
  /** Enable performance monitoring 启用性能监控 */
  enableProfiling?: boolean;
}

/**
 * System metadata adapter for legacy SystemConfig
 * 传统SystemConfig的系统元数据适配器
 */
interface SystemAdapter {
  /** Original system configuration 原始系统配置 */
  config: SystemConfig;
  /** System handle for parallel execution 并行执行的系统句柄 */
  handle: SystemHandle;
  /** Parallel executor function 并行执行器函数 */
  executor?: SystemExecutor;
}

/**
 * Enhanced parallel scheduler that extends the original scheduler
 * 扩展原始调度器的增强并行调度器
 */
export class ParallelScheduler {
  private baseScheduler: Scheduler;
  private runner: ParallelRunner;
  private metaRegistry: SystemMetaRegistry;
  private systemAdapters = new Map<string, SystemAdapter>();
  private config: Required<ParallelSchedulerConfig>;
  private ranStartup = false;

  constructor(config: ParallelSchedulerConfig = {}) {
    this.config = {
      enableParallel: config.enableParallel ?? true,
      fallbackToSequential: config.fallbackToSequential ?? true,
      runnerConfig: config.runnerConfig ?? {},
      enableProfiling: config.enableProfiling ?? true
    };

    this.baseScheduler = new Scheduler();
    this.runner = new ParallelRunner(this.config.runnerConfig);
    this.metaRegistry = new SystemMetaRegistry();
  }

  /**
   * Add system to the scheduler
   * 向调度器添加系统
   */
  add(sysOrBuilder: SystemConfig | SystemBuilder): this {
    const sys = sysOrBuilder instanceof SystemBuilder ? sysOrBuilder.build() : sysOrBuilder;

    // Add to base scheduler for fallback
    this.baseScheduler.add(sys);

    // Create adapter for parallel execution
    const handle = this.generateSystemHandle(sys.name);
    const adapter: SystemAdapter = {
      config: sys,
      handle,
      executor: this.createSystemExecutor(sys)
    };

    this.systemAdapters.set(sys.name, adapter);

    // Register system metadata if parallel execution is enabled
    if (this.config.enableParallel) {
      this.registerSystemMeta(sys, handle);
    }

    return this;
  }

  /**
   * Execute one tick of all systems with parallel optimization
   * 使用并行优化执行一次所有系统的tick
   */
  async tick(world: World, dt: number, order: SystemStage[] = ['startup', 'preUpdate', 'update', 'postUpdate', 'cleanup']): Promise<void> {
    world.beginFrame();

    try {
      if (this.config.enableParallel) {
        await this.tickParallel(world, dt, order);
      } else {
        this.tickSequential(world, dt, order);
      }
    } catch (error) {
      console.error('Parallel execution failed:', error);

      if (this.config.fallbackToSequential) {
        console.warn('Falling back to sequential execution');
        this.tickSequential(world, dt, order);
      } else {
        throw error;
      }
    }

    // End frame recording
    world.getResource(Recorder)?.endFrame();
  }

  /**
   * Execute systems in parallel waves
   * 在并行波次中执行系统
   */
  private async tickParallel(world: World, dt: number, order: SystemStage[]): Promise<void> {
    for (const stage of order) {
      if (stage === 'startup') {
        if (this.ranStartup) continue;
        this.ranStartup = true;
      }

      const stageAdapters = Array.from(this.systemAdapters.values())
        .filter(adapter => (adapter.config.stage ?? 'update') === stage);

      if (stageAdapters.length === 0) continue;

      // Clear previous registrations for this stage
      this.runner.clear();
      const planner = this.runner.getPlanner();

      // Register systems for this stage
      for (const adapter of stageAdapters) {
        if (adapter.executor) {
          this.runner.registerExecutor(adapter.handle, adapter.executor);

          // Get metadata for planning
          const meta = this.metaRegistry.get(adapter.handle);
          if (meta) {
            planner.addSystem(meta);
          }
        }
      }

      // Execute stage in parallel
      const result = await this.runner.execute(dt, world.frame, { world });

      // Handle execution results
      if (!result.success && !this.config.fallbackToSequential) {
        throw new Error(`Stage ${stage} execution failed`);
      }

      // Update profiler if available
      if (this.config.enableProfiling) {
        const profiler = world.getResource(Profiler);
        if (profiler) {
          for (const wave of result.waves) {
            for (const [systemHandle, systemResult] of wave.systemResults) {
              const adapter = Array.from(this.systemAdapters.values())
                .find(a => a.handle === systemHandle);

              if (adapter) {
                profiler.record(
                  adapter.config.name,
                  stage,
                  systemResult.executionTime
                );
              }
            }
          }
        }
      }
    }
  }

  /**
   * Execute systems sequentially using base scheduler
   * 使用基础调度器顺序执行系统
   */
  private tickSequential(world: World, dt: number, order: SystemStage[]): void {
    this.baseScheduler.tick(world, dt, order);
  }

  /**
   * Generate unique system handle
   * 生成唯一系统句柄
   */
  private generateSystemHandle(systemName: string): SystemHandle {
    return `sys_${systemName}`;
  }

  /**
   * Create system executor from SystemConfig
   * 从SystemConfig创建系统执行器
   */
  private createSystemExecutor(sys: SystemConfig): SystemExecutor {
    return async (context): Promise<any> => {
      const world = context.params?.world as World;
      if (!world) {
        throw new Error(`World not provided in execution context for system ${sys.name}`);
      }

      // Check run condition
      if (sys.runIf && !this.safeRunIf(sys.runIf, world)) {
        return {
          success: true,
          executionTime: 0,
          data: { skipped: true }
        };
      }

      // Execute system
      const cmd = new CommandBuffer(world);
      const systemContext: SystemContext = {
        world,
        commandBuffer: cmd,
        frame: world.frame,
        deltaTime: context.deltaTime
      };

      const startTime = performance.now();

      try {
        await Promise.resolve(sys.fn(systemContext));

        // Flush command buffer
        if (sys.flushPolicy === 'afterEach' || sys.flushPolicy == null) {
          cmd.flush();
        }

        const executionTime = performance.now() - startTime;

        return {
          success: true,
          executionTime,
          data: { commandBuffer: cmd }
        };
      } catch (error) {
        const executionTime = performance.now() - startTime;

        return {
          success: false,
          executionTime,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    };
  }

  /**
   * Register system metadata for parallel execution
   * 为并行执行注册系统元数据
   */
  private registerSystemMeta(sys: SystemConfig, handle: SystemHandle): void {
    // Create basic metadata - in a real implementation, this would analyze
    // the system function to determine actual read/write patterns
    const metaBuilder = createSystemMeta(handle, sys.name);

    // Priority is not available in SystemConfig, could be extended later
    // 优先级在SystemConfig中不可用，以后可以扩展

    // Add explicit dependencies from before/after
    if (sys.before) {
      for (const beforeTarget of sys.before) {
        const beforeHandle = this.generateSystemHandle(beforeTarget);
        metaBuilder.dependsOn(beforeHandle);
      }
    }

    if (sys.after) {
      for (const afterTarget of sys.after) {
        const afterHandle = this.generateSystemHandle(afterTarget);
        metaBuilder.dependentSystem(afterHandle);
      }
    }

    // TODO: Analyze system function for component access patterns
    // This would require static analysis or runtime annotations
    // For now, assume all systems can run in parallel unless they have explicit dependencies

    const meta = metaBuilder.build();
    this.metaRegistry.register(meta);
  }

  /**
   * Safely execute system condition predicate
   * 安全执行系统条件谓词
   */
  private safeRunIf(pred: (world: World) => boolean, world: World): boolean {
    try {
      return pred(world);
    } catch {
      return false;
    }
  }

  /**
   * Get system execution statistics
   * 获取系统执行统计信息
   */
  getStats(): {
    totalSystems: number;
    parallelSystems: number;
    estimatedEfficiency: number;
  } {
    const totalSystems = this.systemAdapters.size;
    const runnerStats = this.runner.getExecutionStats();

    return {
      totalSystems,
      parallelSystems: runnerStats.registeredSystems,
      estimatedEfficiency: runnerStats.estimatedEfficiency
    };
  }

  /**
   * Enable or disable parallel execution
   * 启用或禁用并行执行
   */
  setParallelEnabled(enabled: boolean): void {
    this.config.enableParallel = enabled;
  }

  /**
   * Update runner configuration
   * 更新执行器配置
   */
  updateRunnerConfig(newConfig: Partial<RunnerConfig>): void {
    this.runner.updateConfig(newConfig);
  }

  /**
   * Get the underlying parallel runner
   * 获取底层并行执行器
   */
  getRunner(): ParallelRunner {
    return this.runner;
  }

  /**
   * Get the base scheduler (for compatibility)
   * 获取基础调度器（用于兼容性）
   */
  getBaseScheduler(): Scheduler {
    return this.baseScheduler;
  }

  /**
   * Get system metadata registry
   * 获取系统元数据注册表
   */
  getMetaRegistry(): SystemMetaRegistry {
    return this.metaRegistry;
  }
}