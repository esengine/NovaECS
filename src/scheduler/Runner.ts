/**
 * System-level parallel execution runner with wave-based scheduling
 * 基于波次调度的系统级并行执行器
 */

import { SystemHandle } from './SystemMeta';
import { WavePlanner, ExecutionWave, WavePlan } from './WavePlanner';
import { WorkerPool } from '../parallel/WorkerPool';

/**
 * System executor function signature
 * 系统执行器函数签名
 */
export type SystemExecutor = (context: SystemExecutionContext) => Promise<SystemExecutionResult> | SystemExecutionResult;

/**
 * System execution context
 * 系统执行上下文
 */
export interface SystemExecutionContext {
  /** System handle being executed 正在执行的系统句柄 */
  systemHandle: SystemHandle;
  /** Wave number this system belongs to 此系统所属的波次编号 */
  wave: number;
  /** Delta time for this frame 此帧的增量时间 */
  deltaTime: number;
  /** Frame number 帧编号 */
  frameNumber: number;
  /** Custom parameters 自定义参数 */
  params?: Record<string, unknown> | undefined;
  /** Abort signal for cancellation 用于取消的中止信号 */
  signal?: AbortSignal | undefined;
}

/**
 * System execution result
 * 系统执行结果
 */
export interface SystemExecutionResult {
  /** Whether execution was successful 执行是否成功 */
  success: boolean;
  /** Execution time in milliseconds 执行时间（毫秒） */
  executionTime: number;
  /** Error message if failed 失败时的错误消息 */
  error?: string;
  /** Custom result data 自定义结果数据 */
  data?: unknown;
  /** Systems that were modified and need invalidation 被修改需要失效的系统 */
  invalidatedSystems?: SystemHandle[];
}

/**
 * Wave execution result
 * 波次执行结果
 */
export interface WaveExecutionResult {
  /** Wave number 波次编号 */
  wave: number;
  /** Systems that executed successfully 成功执行的系统 */
  successfulSystems: SystemHandle[];
  /** Systems that failed 失败的系统 */
  failedSystems: SystemHandle[];
  /** Individual system results 各个系统的结果 */
  systemResults: Map<SystemHandle, SystemExecutionResult>;
  /** Total wave execution time 波次总执行时间 */
  totalTime: number;
  /** Whether the entire wave succeeded 整个波次是否成功 */
  waveSuccess: boolean;
}

/**
 * Complete execution session result
 * 完整执行会话结果
 */
export interface ExecutionSessionResult {
  /** All wave results 所有波次结果 */
  waves: WaveExecutionResult[];
  /** Total execution time 总执行时间 */
  totalTime: number;
  /** Whether entire session succeeded 整个会话是否成功 */
  success: boolean;
  /** Systems that were not executed due to dependencies 由于依赖未执行的系统 */
  skippedSystems: SystemHandle[];
  /** Performance metrics 性能指标 */
  metrics: ExecutionMetrics;
}

/**
 * Execution performance metrics
 * 执行性能指标
 */
export interface ExecutionMetrics {
  /** Total systems scheduled 已调度的总系统数 */
  totalSystems: number;
  /** Systems executed successfully 成功执行的系统数 */
  successfulSystems: number;
  /** Systems that failed 失败的系统数 */
  failedSystems: number;
  /** Average systems per wave 每波次的平均系统数 */
  averageSystemsPerWave: number;
  /** Parallelization efficiency (0-1) 并行化效率（0-1） */
  parallelizationEfficiency: number;
  /** Average wave execution time 平均波次执行时间 */
  averageWaveTime: number;
  /** Bottleneck wave (longest execution time) 瓶颈波次（最长执行时间） */
  bottleneckWave?: number | undefined;
}

/**
 * Runner configuration options
 * 执行器配置选项
 */
export interface RunnerConfig {
  /** Maximum concurrent systems per wave 每波次最大并发系统数 */
  maxConcurrentSystems?: number;
  /** Timeout for individual system execution 单个系统执行超时时间 */
  systemTimeoutMs?: number;
  /** Timeout for entire wave execution 整个波次执行超时时间 */
  waveTimeoutMs?: number;
  /** Whether to continue on system failure 系统失败时是否继续 */
  continueOnFailure?: boolean;
  /** Whether to use worker pool for parallelization 是否使用worker池进行并行化 */
  useWorkerPool?: boolean;
  /** Worker pool instance (if using) worker池实例（如果使用） */
  workerPool?: WorkerPool | undefined;
  /** Performance monitoring enabled 是否启用性能监控 */
  enableMetrics?: boolean;
  /** Custom error handler 自定义错误处理器 */
  errorHandler?: (error: Error, context: SystemExecutionContext) => void;
}

/**
 * System-level parallel runner with wave-based execution
 * 基于波次执行的系统级并行执行器
 */
export class ParallelRunner {
  private executors = new Map<SystemHandle, SystemExecutor>();
  private config: Required<Omit<RunnerConfig, 'workerPool'>> & { workerPool?: WorkerPool };
  private planner: WavePlanner;
  private currentSession: {
    sessionId: string;
    abortController: AbortController;
    startTime: number;
  } | undefined;

  constructor(config: RunnerConfig = {}) {
    this.config = {
      maxConcurrentSystems: config.maxConcurrentSystems ?? 8,
      systemTimeoutMs: config.systemTimeoutMs ?? 10000,
      waveTimeoutMs: config.waveTimeoutMs ?? 30000,
      continueOnFailure: config.continueOnFailure ?? true,
      useWorkerPool: config.useWorkerPool ?? false,
      workerPool: config.workerPool,
      enableMetrics: config.enableMetrics ?? true,
      errorHandler: config.errorHandler ?? ((error, context): void => {
        console.error(`System execution error in ${String(context.systemHandle)}:`, error);
      })
    };

    this.planner = new WavePlanner();
  }

  /**
   * Register system executor
   * 注册系统执行器
   */
  registerExecutor(handle: SystemHandle, executor: SystemExecutor): void {
    this.executors.set(handle, executor);
  }

  /**
   * Unregister system executor
   * 取消注册系统执行器
   */
  unregisterExecutor(handle: SystemHandle): boolean {
    return this.executors.delete(handle);
  }

  /**
   * Get wave planner for system registration
   * 获取波次规划器以进行系统注册
   */
  getPlanner(): WavePlanner {
    return this.planner;
  }

  /**
   * Execute all registered systems in parallel waves
   * 在并行波次中执行所有已注册的系统
   */
  async execute(
    deltaTime: number,
    frameNumber: number,
    params?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ExecutionSessionResult> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const sessionStart = performance.now();

    // Setup session
    this.currentSession = {
      sessionId,
      abortController: new AbortController(),
      startTime: sessionStart
    };

    // Link external abort signal
    if (signal) {
      if (signal.aborted) {
        throw new Error('Execution aborted before starting');
      }
      signal.addEventListener('abort', () => {
        this.currentSession?.abortController.abort();
      });
    }

    try {
      // Plan execution waves
      const wavePlan = this.planner.planWaves();

      if (!this.planner.validateWavePlan(wavePlan)) {
        throw new Error('Invalid wave plan generated');
      }

      // Execute waves sequentially
      const waveResults: WaveExecutionResult[] = [];
      const completedSystems = new Set<SystemHandle>();

      for (const wave of wavePlan.waves) {
        if (this.currentSession.abortController.signal.aborted) {
          break;
        }

        const waveResult = await this.executeWave(
          wave,
          deltaTime,
          frameNumber,
          params,
          this.currentSession.abortController.signal
        );

        waveResults.push(waveResult);

        // Update completed systems
        for (const system of waveResult.successfulSystems) {
          completedSystems.add(system);
        }

        // Stop execution if wave failed and continueOnFailure is false
        if (!waveResult.waveSuccess && !this.config.continueOnFailure) {
          break;
        }
      }

      // Calculate final results
      const totalTime = performance.now() - sessionStart;
      const success = waveResults.every(w => w.waveSuccess) || this.config.continueOnFailure;
      const skippedSystems = wavePlan.waves
        .flatMap(w => w.systems)
        .filter(s => !completedSystems.has(s));

      const metrics = this.calculateMetrics(wavePlan, waveResults);

      return {
        waves: waveResults,
        totalTime,
        success,
        skippedSystems,
        metrics
      };

    } finally {
      this.currentSession = undefined;
    }
  }

  /**
   * Execute a single wave with parallel system execution
   * 执行单个波次的并行系统执行
   */
  private async executeWave(
    wave: ExecutionWave,
    deltaTime: number,
    frameNumber: number,
    params?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<WaveExecutionResult> {
    const waveStart = performance.now();
    const systemResults = new Map<SystemHandle, SystemExecutionResult>();
    const successfulSystems: SystemHandle[] = [];
    const failedSystems: SystemHandle[] = [];

    // Limit concurrent systems
    const maxConcurrent = Math.min(wave.systems.length, this.config.maxConcurrentSystems);
    const systemQueue = [...wave.systems];

    // Execute systems with concurrency control
    const executeSystem = async (systemHandle: SystemHandle): Promise<void> => {
      if (signal?.aborted) return;

      const executor = this.executors.get(systemHandle);
      if (!executor) {
        const error = `No executor registered for system ${String(systemHandle)}`;
        systemResults.set(systemHandle, {
          success: false,
          executionTime: 0,
          error
        });
        failedSystems.push(systemHandle);
        return;
      }

      const context: SystemExecutionContext = {
        systemHandle,
        wave: wave.wave,
        deltaTime,
        frameNumber,
        params,
        signal
      };

      const systemStart = performance.now();
      try {
        // Create timeout signal
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, this.config.systemTimeoutMs);

        // Combine signals
        const combinedSignal = this.combineAbortSignals([
          signal,
          timeoutController.signal
        ]);

        const contextWithTimeout = { ...context, signal: combinedSignal };
        const result = await Promise.resolve(executor(contextWithTimeout));

        clearTimeout(timeoutId);

        const executionTime = performance.now() - systemStart;
        const finalResult = {
          ...result,
          executionTime
        };

        systemResults.set(systemHandle, finalResult);

        if (result.success) {
          successfulSystems.push(systemHandle);
        } else {
          failedSystems.push(systemHandle);
        }

      } catch (error) {
        const executionTime = performance.now() - systemStart;
        const errorResult: SystemExecutionResult = {
          success: false,
          executionTime,
          error: error instanceof Error ? error.message : String(error)
        };

        systemResults.set(systemHandle, errorResult);
        failedSystems.push(systemHandle);

        if (this.config.errorHandler) {
          this.config.errorHandler(
            error instanceof Error ? error : new Error(String(error)),
            context
          );
        }
      }
    };

    // Execute with concurrency limit
    const executing = new Set<Promise<void>>();

    for (const systemHandle of systemQueue) {
      if (signal?.aborted) break;

      // Wait if at concurrency limit
      if (executing.size >= maxConcurrent) {
        await Promise.race(executing);
      }

      const promise = executeSystem(systemHandle);
      executing.add(promise);

      void promise.finally(() => {
        executing.delete(promise);
      });
    }

    // Wait for all remaining executions
    await Promise.all(executing);

    const totalTime = performance.now() - waveStart;
    const waveSuccess = failedSystems.length === 0 || this.config.continueOnFailure;

    return {
      wave: wave.wave,
      successfulSystems,
      failedSystems,
      systemResults,
      totalTime,
      waveSuccess
    };
  }

  /**
   * Combine multiple abort signals into one
   * 将多个中止信号合并为一个
   */
  private combineAbortSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal?.aborted) {
        controller.abort();
        break;
      }

      signal?.addEventListener('abort', () => {
        controller.abort();
      });
    }

    return controller.signal;
  }

  /**
   * Calculate execution metrics
   * 计算执行指标
   */
  private calculateMetrics(plan: WavePlan, results: WaveExecutionResult[]): ExecutionMetrics {
    const totalSystems = plan.waves.reduce((sum, wave) => sum + wave.systems.length, 0);
    const successfulSystems = results.reduce((sum, wave) => sum + wave.successfulSystems.length, 0);
    const failedSystems = results.reduce((sum, wave) => sum + wave.failedSystems.length, 0);

    const averageSystemsPerWave = results.length > 0 ? totalSystems / results.length : 0;
    const averageWaveTime = results.length > 0
      ? results.reduce((sum, wave) => sum + wave.totalTime, 0) / results.length
      : 0;

    // Find bottleneck wave
    let bottleneckWave: number | undefined;
    let maxWaveTime = 0;
    for (const result of results) {
      if (result.totalTime > maxWaveTime) {
        maxWaveTime = result.totalTime;
        bottleneckWave = result.wave;
      }
    }

    const result: ExecutionMetrics = {
      totalSystems,
      successfulSystems,
      failedSystems,
      averageSystemsPerWave,
      parallelizationEfficiency: plan.efficiency,
      averageWaveTime
    };

    if (bottleneckWave !== undefined) {
      result.bottleneckWave = bottleneckWave;
    }

    return result;
  }

  /**
   * Abort current execution session
   * 中止当前执行会话
   */
  abort(): void {
    if (this.currentSession) {
      this.currentSession.abortController.abort();
    }
  }

  /**
   * Get current execution status
   * 获取当前执行状态
   */
  isExecuting(): boolean {
    return this.currentSession !== undefined;
  }

  /**
   * Get current session info
   * 获取当前会话信息
   */
  getCurrentSession(): { sessionId: string; elapsed: number } | null {
    if (!this.currentSession) {
      return null;
    }

    return {
      sessionId: this.currentSession.sessionId,
      elapsed: performance.now() - this.currentSession.startTime
    };
  }

  /**
   * Update runner configuration
   * 更新执行器配置
   */
  updateConfig(newConfig: Partial<RunnerConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current configuration
   * 获取当前配置
   */
  getConfig(): Required<Omit<RunnerConfig, 'workerPool'>> & { workerPool?: WorkerPool } {
    return { ...this.config };
  }

  /**
   * Clear all registered executors
   * 清除所有已注册的执行器
   */
  clear(): void {
    this.executors.clear();
    this.planner.clear();
  }

  /**
   * Get execution statistics
   * 获取执行统计信息
   */
  getExecutionStats(): {
    registeredSystems: number;
    plannedWaves: number;
    estimatedEfficiency: number;
  } {
    const plan = this.planner.planWaves();

    return {
      registeredSystems: this.executors.size,
      plannedWaves: plan.waves.length,
      estimatedEfficiency: plan.efficiency
    };
  }
}