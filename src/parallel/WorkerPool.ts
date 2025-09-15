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
  cols: unknown[];
  /** Number of entities in this chunk 此块中的实体数量 */
  length: number;
  /** Optional parameters for kernel function 核函数的可选参数 */
  params?: unknown;
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
 * Worker pool for parallel kernel execution with automatic task distribution
 * 用于并行核函数执行的工作线程池，支持自动任务分发
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];

  constructor(
    url: string, 
    size = navigator?.hardwareConcurrency ? Math.max(1, Math.min(8, navigator.hardwareConcurrency-1)) : 4
  ) {
    // Initialize memory fence for SAB visibility
    // 为SAB可见性初始化内存栅栏
    const fenceBuffer = VisibilityGuard.initFence();
    
    for (let i = 0; i < size; i++) {
      const w = new Worker(url, { type: 'module' as any });
      w.onmessage = (ev: MessageEvent) => {
        const { id, result } = ev.data;
        // Forward result to completion handler
        // 将结果转发给完成处理器
        (this as any)._onResult?.(w, id, result);
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
   * Execute multiple kernel payloads in parallel across worker pool
   * 在工作线程池中并行执行多个核函数载荷
   */
  async run(payloads: KernelPayload[]): Promise<KernelResult[]> {
    if (payloads.length === 0) return [];
    
    const results: KernelResult[] = new Array(payloads.length);
    let nextTask = 0, done = 0, jobId = 0;

    // Track in-flight tasks
    // 跟踪进行中的任务
    const inflight = new Map<number, { idx: number, worker: Worker }>();

    // Result completion handler
    // 结果完成处理器
    (this as any)._onResult = (w: Worker, id: number, result: KernelResult) => {
      const info = inflight.get(id)!;
      inflight.delete(id);
      results[info.idx] = result;
      done++;
      
      // Dispatch next task to this worker
      // 向此工作线程分发下一个任务
      dispatch(w);
      
      // Resolve when all tasks complete
      // 所有任务完成时解析Promise
      if (done === payloads.length) pendingResolve?.(results);
    };

    let pendingResolve!: (v: KernelResult[]) => void;
    const p = new Promise<KernelResult[]>(r => pendingResolve = r);

    // Task dispatcher function
    // 任务分发函数
    const dispatch = (w: Worker) => {
      if (nextTask >= payloads.length) { 
        this.idle.push(w); 
        return; 
      }
      
      const idx = nextTask++;
      const id = ++jobId;
      inflight.set(id, { idx, worker: w });
      w.postMessage({ id, payload: payloads[idx] });
    };

    // Start initial batch of tasks
    // 启动初始批次的任务
    while (this.idle.length && nextTask < payloads.length) {
      const w = this.idle.pop()!;
      dispatch(w);
    }
    
    return p;
  }

  /**
   * Dispose worker pool and terminate all workers
   * 销毁工作线程池并终止所有工作线程
   */
  dispose() { 
    for (const w of this.workers) w.terminate(); 
    this.workers.length = 0; 
    this.idle.length = 0; 
  }
}