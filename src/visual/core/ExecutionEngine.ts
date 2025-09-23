/**
 * Visual graph execution engine
 * 可视化图执行引擎
 *
 * Provides high-performance execution of visual programming graphs.
 * Handles scheduling, error recovery, and performance monitoring.
 * 提供可视化编程图的高性能执行。
 * 处理调度、错误恢复和性能监控。
 */

import type {
  VisualExecutionContext,
  NodeExecutionResult,
  SystemContext
} from '../types';
import { VisualGraph } from './VisualGraph';

/**
 * Execution engine for visual graphs
 * 可视化图的执行引擎
 */
export class ExecutionEngine {
  /** Performance statistics 性能统计 */
  private stats = {
    totalExecutions: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    errors: 0,
    lastExecutionTime: 0
  };

  /** Error handler function 错误处理函数 */
  private errorHandler?: (error: Error, nodeId: string) => void;

  /** Debug mode flag 调试模式标志 */
  private debugMode = false;

  /** Execution history for debugging 调试用的执行历史 */
  private executionHistory: ExecutionRecord[] = [];

  /** Maximum history size 最大历史记录大小 */
  private maxHistorySize = 100;

  constructor(options: ExecutionEngineOptions = {}) {
    this.errorHandler = options.errorHandler;
    this.debugMode = options.debugMode ?? false;
    this.maxHistorySize = options.maxHistorySize ?? 100;
  }

  /**
   * Execute a visual graph within a system context
   * 在系统上下文中执行可视化图
   *
   * @param graph Visual graph to execute 要执行的可视化图
   * @param systemCtx System execution context 系统执行上下文
   * @returns Execution results 执行结果
   */
  executeGraph(
    graph: VisualGraph,
    systemCtx: SystemContext
  ): Map<string, NodeExecutionResult> {
    const startTime = performance.now();

    try {
      // Create visual execution context
      // 创建可视化执行上下文
      const visualCtx = this.createVisualContext(systemCtx);

      // Execute the graph
      // 执行图
      const results = graph.execute(visualCtx);

      // Update statistics
      // 更新统计信息
      const executionTime = performance.now() - startTime;
      this.updateStats(executionTime, false);

      // Record execution if in debug mode
      // 如果在调试模式下记录执行
      if (this.debugMode) {
        this.recordExecution(graph, results, executionTime);
      }

      return results;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateStats(executionTime, true);

      const err = error instanceof Error ? error : new Error(String(error));

      if (this.errorHandler) {
        this.errorHandler(err, 'graph_execution');
      }

      // Record failed execution
      // 记录失败的执行
      if (this.debugMode) {
        this.recordExecution(graph, new Map(), executionTime, err);
      }

      throw err;
    }
  }

  /**
   * Create visual execution context from system context
   * 从系统上下文创建可视化执行上下文
   *
   * @param systemCtx System context 系统上下文
   * @returns Visual execution context 可视化执行上下文
   */
  private createVisualContext(systemCtx: SystemContext): VisualExecutionContext {
    return {
      world: systemCtx.world,
      commandBuffer: systemCtx.commandBuffer,
      frame: systemCtx.frame,
      deltaTime: systemCtx.deltaTime,
      variables: new Map(),
      executionStack: []
    };
  }

  /**
   * Update execution statistics
   * 更新执行统计
   *
   * @param executionTime Execution time in milliseconds 执行时间（毫秒）
   * @param isError Whether execution resulted in error 执行是否导致错误
   */
  private updateStats(executionTime: number, isError: boolean): void {
    this.stats.totalExecutions++;
    this.stats.totalExecutionTime += executionTime;
    this.stats.lastExecutionTime = executionTime;

    if (isError) {
      this.stats.errors++;
    }

    // Calculate rolling average
    // 计算滚动平均值
    this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalExecutions;
  }

  /**
   * Record execution for debugging
   * 记录执行用于调试
   */
  private recordExecution(
    graph: VisualGraph,
    results: Map<string, NodeExecutionResult>,
    executionTime: number,
    error?: Error
  ): void {
    const record: ExecutionRecord = {
      timestamp: Date.now(),
      graphName: graph.name,
      executionTime,
      nodeResults: results,
      error: error?.message,
      success: !error
    };

    this.executionHistory.push(record);

    // Maintain history size limit
    // 维护历史记录大小限制
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get execution statistics
   * 获取执行统计
   *
   * @returns Current statistics 当前统计信息
   */
  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  /**
   * Get execution history
   * 获取执行历史
   *
   * @param limit Optional limit on number of records 可选的记录数量限制
   * @returns Execution history 执行历史
   */
  getExecutionHistory(limit?: number): ExecutionRecord[] {
    const history = [...this.executionHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear execution history
   * 清除执行历史
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Reset statistics
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      errors: 0,
      lastExecutionTime: 0
    };
  }

  /**
   * Set error handler
   * 设置错误处理器
   *
   * @param handler Error handler function 错误处理函数
   */
  setErrorHandler(handler: (error: Error, nodeId: string) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Enable or disable debug mode
   * 启用或禁用调试模式
   *
   * @param enabled Whether debug mode should be enabled 是否应启用调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;

    if (!enabled) {
      this.clearHistory();
    }
  }

  /**
   * Create optimized execution function for repeated graph execution
   * 为重复图执行创建优化的执行函数
   *
   * This creates a compiled function that can execute the graph more efficiently
   * by pre-computing execution order and optimizing hot paths.
   * 这创建一个编译函数，可以通过预计算执行顺序和优化热路径来更高效地执行图。
   *
   * @param graph Graph to compile 要编译的图
   * @returns Compiled execution function 编译的执行函数
   */
  compileGraph(graph: VisualGraph): CompiledGraphFunction {
    // Pre-compute execution order
    // 预计算执行顺序
    const executionOrder = graph.getExecutionOrder();

    // Create optimized execution function
    // 创建优化的执行函数
    return (systemCtx: SystemContext) => {
      const visualCtx = this.createVisualContext(systemCtx);
      const results = new Map<string, NodeExecutionResult>();

      try {
        // Execute nodes in pre-computed order
        // 按预计算顺序执行节点
        for (const node of executionOrder) {
          if (node.shouldExecute(visualCtx)) {
            node.execute(visualCtx);

            // Simple success result for compiled execution
            // 编译执行的简单成功结果
            results.set(node.id, {
              success: true,
              executionTime: 0,
              outputs: new Map()
            });
          }
        }

        return results;
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler(
            error instanceof Error ? error : new Error(String(error)),
            'compiled_graph'
          );
        }
        throw error;
      }
    };
  }

  /**
   * Create execution profiler for performance analysis
   * 为性能分析创建执行分析器
   *
   * @param graph Graph to profile 要分析的图
   * @returns Profiler function 分析器函数
   */
  createProfiler(graph: VisualGraph): GraphProfiler {
    const nodeTimings = new Map<string, number[]>();

    return {
      execute: (systemCtx: SystemContext): Map<string, NodeExecutionResult> => {
        const visualCtx = this.createVisualContext(systemCtx);
        const executionOrder = graph.getExecutionOrder();
        const results = new Map<string, NodeExecutionResult>();

        for (const node of executionOrder) {
          if (node.shouldExecute(visualCtx)) {
            const startTime = performance.now();
            node.execute(visualCtx);
            const endTime = performance.now();

            const timing = endTime - startTime;

            // Record timing
            // 记录时序
            if (!nodeTimings.has(node.id)) {
              nodeTimings.set(node.id, []);
            }
            const timings = nodeTimings.get(node.id);
            if (timings) {
              timings.push(timing);
            }

            results.set(node.id, {
              success: true,
              executionTime: timing,
              outputs: new Map()
            });
          }
        }

        return results;
      },

      getTimings: (): Map<string, NodeTiming> => {
        const timings = new Map<string, NodeTiming>();

        for (const [nodeId, times] of nodeTimings) {
          const totalTime = times.reduce((sum, time) => sum + time, 0);
          const avgTime = totalTime / times.length;
          const minTime = Math.min(...times);
          const maxTime = Math.max(...times);

          timings.set(nodeId, {
            nodeId,
            totalTime,
            averageTime: avgTime,
            minTime,
            maxTime,
            executionCount: times.length
          });
        }

        return timings;
      },

      reset: (): void => {
        nodeTimings.clear();
      }
    };
  }
}

/**
 * Execution engine configuration options
 * 执行引擎配置选项
 */
export interface ExecutionEngineOptions {
  /** Error handler function 错误处理函数 */
  errorHandler?: (error: Error, nodeId: string) => void;
  /** Enable debug mode 启用调试模式 */
  debugMode?: boolean;
  /** Maximum execution history size 最大执行历史大小 */
  maxHistorySize?: number;
}

/**
 * Execution statistics
 * 执行统计
 */
export interface ExecutionStats {
  /** Total number of executions 总执行次数 */
  totalExecutions: number;
  /** Total execution time in milliseconds 总执行时间（毫秒） */
  totalExecutionTime: number;
  /** Average execution time 平均执行时间 */
  averageExecutionTime: number;
  /** Number of errors 错误数量 */
  errors: number;
  /** Last execution time 上次执行时间 */
  lastExecutionTime: number;
}

/**
 * Execution record for debugging
 * 调试用的执行记录
 */
export interface ExecutionRecord {
  /** Execution timestamp 执行时间戳 */
  timestamp: number;
  /** Graph name 图名称 */
  graphName: string;
  /** Execution time 执行时间 */
  executionTime: number;
  /** Node execution results 节点执行结果 */
  nodeResults: Map<string, NodeExecutionResult>;
  /** Error message if failed 失败时的错误信息 */
  error?: string;
  /** Whether execution was successful 执行是否成功 */
  success: boolean;
}

/**
 * Compiled graph execution function
 * 编译的图执行函数
 */
export type CompiledGraphFunction = (
  systemCtx: SystemContext
) => Map<string, NodeExecutionResult>;

/**
 * Graph profiler interface
 * 图分析器接口
 */
export interface GraphProfiler {
  /** Execute graph with profiling 执行图并进行分析 */
  execute: CompiledGraphFunction;
  /** Get timing data 获取时序数据 */
  getTimings: () => Map<string, NodeTiming>;
  /** Reset profiling data 重置分析数据 */
  reset: () => void;
}

/**
 * Node timing information
 * 节点时序信息
 */
export interface NodeTiming {
  /** Node ID 节点ID */
  nodeId: string;
  /** Total execution time 总执行时间 */
  totalTime: number;
  /** Average execution time 平均执行时间 */
  averageTime: number;
  /** Minimum execution time 最小执行时间 */
  minTime: number;
  /** Maximum execution time 最大执行时间 */
  maxTime: number;
  /** Number of executions 执行次数 */
  executionCount: number;
}