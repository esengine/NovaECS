/**
 * Worker pool and kernel execution system for parallel ECS processing
 * 用于并行ECS处理的工作线程池和核函数执行系统
 */

import { VisibilityGuard } from './ConcurrencySafety';

/**
 * Payload data sent to worker for kernel execution
 * 发送给工作线程执行核函数的载荷数据
 */
export type KernelPayload = {
  /** Kernel function identifier 核函数标识符 */
  kernelId: string;
  /** Component column arrays (structured clone or SAB mapping) 组件列数组（结构化克隆或SAB映射） */
  cols: any[][];
  /** Number of entities in this chunk 此块中的实体数量 */
  length: number;
  /** Optional parameters for kernel function 核函数的可选参数 */
  params?: unknown;
  /** Optional transfer list for zero-copy transfer of ArrayBuffers 用于ArrayBuffer零拷贝传输的可选转移列表 */
  transfer?: Transferable[];
};

/**
 * Result returned from worker after kernel execution
 * 工作线程执行核函数后返回的结果
 */
export type KernelResult = {
  /** Column indices that were written to (aligned with input cols) 被写入的列索引（与输入cols对齐） */
  written: number[];
};

/**
 * Execution context for a single run operation
 * 单次运行操作的执行上下文
 */
interface RunContext {
  /** Unique identifier for this run operation 此运行操作的唯一标识符 */
  runId: number;
  /** Input payloads to execute 要执行的输入载荷 */
  payloads: KernelPayload[];
  /** Results array being populated 正在填充的结果数组 */
  results: KernelResult[];
  /** Index of next task to dispatch 下一个要分发的任务索引 */
  nextTask: number;
  /** Number of completed tasks 已完成的任务数 */
  done: number;
  /** Job ID counter for this run 此运行的作业ID计数器 */
  jobId: number;
  /** Map of in-flight tasks 进行中的任务映射 */
  inflight: Map<number, { idx: number; worker: Worker }>;
  /** Whether this run has been settled 此运行是否已结算 */
  settled: boolean;
  /** Promise resolve function Promise解析函数 */
  resolveFn: (v: KernelResult[]) => void;
  /** Promise reject function Promise拒绝函数 */
  rejectFn: (e: Error) => void;
  /** Timeout handle if timeout is set 如果设置了超时的超时句柄 */
  timeoutId?: ReturnType<typeof setTimeout>;
  /** Abort controller for cancellation 用于取消的中止控制器 */
  abortController?: AbortController;
}

/**
 * Worker pool for parallel kernel execution with automatic task distribution
 * 用于并行核函数执行的工作线程池，支持自动任务分发
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private busy = new Set<Worker>();
  private _runSeq = 0;
  private _nextJobId = 0;
  private _currentRun: RunContext | undefined = undefined;
  private _disposed = false;
  /** Worker configuration for recreation 用于重建的Worker配置 */
  private _workerConfig: { url: string; size: number };

  constructor(
    url: string,
    size = navigator?.hardwareConcurrency ? Math.max(1, Math.min(8, navigator.hardwareConcurrency-1)) : 4
  ) {
    this._workerConfig = { url, size };
    this._initializeWorkers();
  }

  /**
   * Initialize or recreate all workers
   * 初始化或重建所有worker
   */
  private _initializeWorkers(): void {
    // Initialize memory fence for SAB visibility
    // 为SAB可见性初始化内存栅栏
    const fenceBuffer = VisibilityGuard.initFence();

    for (let i = 0; i < this._workerConfig.size; i++) {
      const w = new Worker(this._workerConfig.url, { type: 'module' });

      // Unified message routing with runId and task id
      // 使用runId和任务id的统一消息路由
      w.onmessage = (ev: MessageEvent): void => {
        if (this._disposed) return;
        const data = ev.data as { runId?: number; id?: number; result?: KernelResult };
        const { runId, id, result } = data ?? {};
        if (typeof runId === 'number' && typeof id === 'number' && result) {
          this._handleWorkerMessage(w, runId, id, result);
        }
      };

      w.onmessageerror = (_ev: MessageEvent): void => {
        if (this._disposed) return;
        this._handleWorkerError(new Error('Worker message error'));
      };

      w.onerror = (ev: ErrorEvent): void => {
        if (this._disposed) return;
        this._handleWorkerError(ev.error instanceof Error ? ev.error : new Error(ev.message || 'Worker error'));
      };

      // Send fence buffer to worker for visibility coordination
      // 将栅栏缓冲区发送给worker用于可见性协调
      if (fenceBuffer) {
        w.postMessage({ fence: fenceBuffer });
      }

      this.workers.push(w);
      this.idle.push(w);
    }
  }

  /**
   * Handle worker message with run isolation and cleanup
   * 使用运行隔离和清理处理worker消息
   */
  private _handleWorkerMessage(worker: Worker, runId: number, id: number, result: KernelResult): void {
    // Short-circuit if pool is disposed
    // 如果池已销毁则短路处理
    if (this._disposed) {
      return;
    }

    const ctx = this._currentRun;

    // Handle messages from invalid/old runs: return worker to idle
    // 处理无效/旧运行的消息：将worker归还为空闲状态
    if (!ctx || ctx.runId !== runId) {
      // Clean up worker state for old/invalid messages
      // 清理旧/无效消息的worker状态
      this._cleanupWorkerState(worker);
      return;
    }

    // Handle messages from settled runs: return worker to idle
    // 处理已结算运行的消息：将worker归还为空闲状态
    if (ctx.settled) {
      this._cleanupWorkerState(worker);
      return;
    }

    // Handle duplicate or invalid task IDs
    // 处理重复或无效的任务ID
    const info = ctx.inflight.get(id);
    if (!info) {
      // This could be a duplicate message or late arrival
      // 这可能是重复消息或延迟到达
      this._cleanupWorkerState(worker);
      return;
    }

    // Valid message processing
    // 有效消息处理
    ctx.inflight.delete(id);
    this.busy.delete(worker);
    ctx.results[info.idx] = result;
    ctx.done++;

    this._dispatchNext(worker, ctx);

    if (ctx.done === ctx.results.length) {
      this._finalize(ctx, true, ctx.results);
    }
  }

  /**
   * Clean up worker state for old/invalid messages
   * 清理旧/无效消息的worker状态
   */
  private _cleanupWorkerState(worker: Worker): void {
    if (this._disposed) return;

    this.busy.delete(worker);
    if (!this.idle.includes(worker)) {
      this.idle.push(worker);
    }
  }

  /**
   * Handle worker error with proper cleanup
   * 使用适当清理处理worker错误
   */
  private _handleWorkerError(error: Error): void {
    // Short-circuit if pool is disposed
    // 如果池已销毁则短路处理
    if (this._disposed) {
      return;
    }

    const ctx = this._currentRun;
    if (!ctx || ctx.settled) return;
    this._finalize(ctx, false, error);
  }

  /**
   * Dispatch next task to available worker
   * 向可用worker分发下一个任务
   */
  private _dispatchNext(worker: Worker, ctx: RunContext): void {
    if (ctx.settled) {
      if (!this.idle.includes(worker)) {
        this.idle.push(worker);
      }
      return;
    }

    if (ctx.nextTask >= ctx.results.length) {
      if (!this.idle.includes(worker)) {
        this.idle.push(worker);
      }
      return;
    }

    const idx = ctx.nextTask++;
    const id = ++ctx.jobId;
    const payload = ctx.payloads[idx];
    ctx.inflight.set(id, { idx, worker });
    this.busy.add(worker);

    // Use transfer list for zero-copy transfer of Transferable objects (non-SAB path)
    // 使用转移列表对可转移对象进行零拷贝传输（非SAB路径）
    const transfer = payload.transfer ?? [];
    worker.postMessage({ runId: ctx.runId, id, payload }, transfer);
  }

  /**
   * Finalize run context with cleanup and dirty worker recovery
   * 使用清理和脏置Worker恢复完成运行上下文
   */
  private _finalize(ctx: RunContext, success: boolean, value: KernelResult[] | Error): void {
    if (ctx.settled) return;
    ctx.settled = true;

    if (ctx.timeoutId) {
      clearTimeout(ctx.timeoutId);
    }

    // Handle dirty worker recovery strategy
    // 处理脏置Worker恢复策略
    if (!success) {
      // On failure: recreate all workers for clean environment
      // 失败时：重新创建所有worker以获得干净环境
      ctx.inflight.clear();
      this._currentRun = undefined;
      this._recreateWorkers();
    } else {
      // On success: return busy workers to idle
      // 成功时：将忙碌worker归还为空闲状态
      for (const [, info] of ctx.inflight) {
        this.busy.delete(info.worker);
        if (!this.idle.includes(info.worker)) {
          this.idle.push(info.worker);
        }
      }
      // Sync job ID counter for next run
      // 同步作业ID计数器以便下次运行
      this._nextJobId = ctx.jobId;
      // Stop receiving results from old run
      // 停止接收旧运行的结果
      ctx.inflight.clear();
      this._currentRun = undefined;
    }

    if (success && Array.isArray(value)) {
      ctx.resolveFn(value);
    } else {
      ctx.rejectFn(value instanceof Error ? value : new Error(String(value)));
    }
  }

  /**
   * Recreate all workers to ensure clean state
   * 重新创建所有worker以确保状态干净
   */
  private _recreateWorkers(): void {
    if (this._disposed) return;

    // Terminate all existing workers
    // 终止所有现有worker
    for (const worker of this.workers) {
      try {
        worker.terminate();
      } catch {
        // Ignore termination errors
      }
    }

    // Reset all state
    // 重置所有状态
    this.workers.length = 0;
    this.idle.length = 0;
    this.busy.clear();

    // Recreate workers with same configuration
    // 使用相同配置重新创建 worker
    this._initializeWorkers();
  }

  /**
   * Execute multiple kernel payloads in parallel across worker pool
   * 在工作线程池中并行执行多个核函数载荷
   *
   * @param payloads Kernel payloads to execute
   * @param options Execution options
   */
  async run(
    payloads: KernelPayload[],
    options: { timeout?: number; signal?: AbortSignal } = {}
  ): Promise<KernelResult[]> {
    if (this._disposed) {
      throw new Error('WorkerPool has been disposed');
    }

    if (payloads.length === 0) return [];

    if (this._currentRun) {
      throw new Error('WorkerPool.run is already in progress');
    }

    const runId = ++this._runSeq;
    const ctx: RunContext = {
      runId,
      payloads,
      results: new Array<KernelResult>(payloads.length),
      nextTask: 0,
      done: 0,
      jobId: this._nextJobId,
      inflight: new Map(),
      settled: false,
      resolveFn: () => {},
      rejectFn: () => {},
      abortController: new AbortController()
    };

    this._currentRun = ctx;

    const promise = new Promise<KernelResult[]>((resolve, reject) => {
      ctx.resolveFn = resolve;
      ctx.rejectFn = reject;
    });

    // Setup timeout if specified
    if (options.timeout && options.timeout > 0) {
      ctx.timeoutId = setTimeout(() => {
        this._finalize(ctx, false, new Error(`WorkerPool.run timeout after ${options.timeout}ms`));
      }, options.timeout);
    }

    // Setup abort signal if provided
    if (options.signal) {
      if (options.signal.aborted) {
        this._finalize(ctx, false, new Error('Operation aborted'));
        return promise;
      }
      options.signal.addEventListener('abort', () => {
        this._finalize(ctx, false, new Error('Operation aborted'));
      });
    }

    // Start dispatching tasks
    while (this.idle.length && ctx.nextTask < payloads.length) {
      const worker = this.idle.pop();
      if (!worker) break;
      this._dispatchNext(worker, ctx);
    }

    return promise;
  }

  /**
   * Dispose worker pool and terminate all workers
   * 销毁工作线程池并终止所有工作线程
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    // Reject any pending run operations
    if (this._currentRun) {
      this._finalize(this._currentRun, false, new Error('WorkerPool disposed during run'));
    }

    // Terminate all workers
    for (const worker of this.workers) {
      try {
        worker.terminate();
      } catch {
        // Ignore termination errors
      }
    }

    this.workers.length = 0;
    this.idle.length = 0;
    this.busy.clear();
    this._currentRun = undefined;
  }
}