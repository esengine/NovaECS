/**
 * Worker Pool for true parallel system execution with intelligent lifecycle management
 * 用于真正并行系统执行的工作池，具有智能生命周期管理
 */

export interface WorkerTask {
  id: string;
  systemName: string;
  entities: Array<{
    id: number;
    components: Array<{
      type: string;
      data: unknown;
    }>;
  }>;
  deltaTime: number;
  priority: number;
  estimatedExecutionTime: number;
}

export interface WorkerResult {
  id: string;
  success: boolean;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
  componentUpdates?: Array<{
    entityId: number;
    componentType: string;
    data: Record<string, unknown>;
  }>;
}

export interface WorkerMetrics {
  id: string;
  tasksCompleted: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  memoryUsage: number;
  errorCount: number;
  lastUsed: number;
  isIdle: boolean;
}

export interface MemoryStats {
  totalAllocated: number;
  totalUsed: number;
  workerCount: number;
  averageWorkerMemory: number;
  peakMemoryUsage: number;
  gcCount: number;
}

/**
 * Intelligent Worker Pool Manager with lifecycle management and memory monitoring
 * 具有生命周期管理和内存监控的智能工作池管理器
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private busyWorkers: Set<Worker> = new Set();
  private workerMetrics = new Map<Worker, WorkerMetrics>();
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: (result: WorkerResult) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private readonly maxWorkers: number;
  private readonly workerScript: string;
  private memoryStats: MemoryStats;
  private gcTimer: number | null = null;
  private idleCheckTimer: number | null = null;
  private readonly config: {
    maxIdleTime: number;
    memoryThreshold: number;
    gcInterval: number;
    taskTimeout: number;
    minWorkers: number;
  };

  constructor(maxWorkers: number = navigator.hardwareConcurrency || 4) {
    this.maxWorkers = Math.min(maxWorkers, 8); // Limit to 8 workers max
    this.config = {
      maxIdleTime: 30000,      // 30 seconds
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      gcInterval: 60000,       // 1 minute
      taskTimeout: 10000,      // 10 seconds
      minWorkers: 1
    };

    this.memoryStats = {
      totalAllocated: 0,
      totalUsed: 0,
      workerCount: 0,
      averageWorkerMemory: 0,
      peakMemoryUsage: 0,
      gcCount: 0
    };

    this.workerScript = this.createWorkerScript();
    this.initializeWorkers();
    this.startMemoryMonitoring();
  }

  /**
   * Create the worker script as a blob URL
   * 创建作为 blob URL 的工作脚本
   */
  private createWorkerScript(): string {
    const workerCode = `
      // System execution worker with component update support
      self.onmessage = function(e) {
        const { id, systemName, entities, deltaTime } = e.data;
        const startTime = performance.now();

        try {
          // Process entities and collect component updates
          const componentUpdates = [];

          entities.forEach(entity => {
            entity.components.forEach(component => {
              // Process component based on system type
              const updatedData = processComponent(component, deltaTime, systemName);

              if (updatedData) {
                componentUpdates.push({
                  entityId: entity.id,
                  componentType: component.type,
                  data: updatedData
                });
              }
            });
          });

          self.postMessage({
            id,
            success: true,
            executionTime: performance.now() - startTime,
            componentUpdates: componentUpdates
          });
        } catch (error) {
          self.postMessage({
            id,
            success: false,
            error: error.message,
            executionTime: performance.now() - startTime
          });
        }
      };

      // Process component based on system type and return updated data
      function processComponent(component, deltaTime, systemName) {
        const data = { ...component.data };
        let modified = false;

        // Simulate different system behaviors
        if (component.type === 'Position') {
          if (systemName.toLowerCase().includes('physics') ||
              systemName.toLowerCase().includes('compute') ||
              systemName.toLowerCase().includes('intensive')) {
            // Simulate physics or compute-intensive processing
            if (data.x !== undefined && data.y !== undefined) {
              // Apply some transformation
              const angle = Math.atan2(data.y, data.x);
              const magnitude = Math.sqrt(data.x * data.x + data.y * data.y);
              data.x = magnitude * Math.cos(angle + deltaTime * 0.001);
              data.y = magnitude * Math.sin(angle + deltaTime * 0.001);
              modified = true;
            }
          }
        }

        if (component.type === 'Velocity') {
          if (systemName.toLowerCase().includes('physics')) {
            // Simulate velocity updates
            if (data.dx !== undefined && data.dy !== undefined) {
              data.dx += Math.sin(deltaTime * 0.01) * 0.1;
              data.dy += Math.cos(deltaTime * 0.01) * 0.1;
              modified = true;
            }
          }
        }

        // Simulate computational work
        if (systemName.toLowerCase().includes('intensive') ||
            systemName.toLowerCase().includes('compute')) {
          // Heavy computation simulation
          for (let i = 0; i < 1000; i++) {
            Math.sqrt(i * deltaTime);
          }
        } else {
          // Light computation simulation
          for (let i = 0; i < 100; i++) {
            Math.sqrt(i * deltaTime);
          }
        }

        return modified ? data : null;
      }
    `;

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      return URL.createObjectURL(blob);
    } catch (error) {
      // Fallback for environments without Blob/URL support
      console.warn('Blob/URL not supported, using fallback worker script');
      return 'data:application/javascript;base64,' + btoa(workerCode);
    }
  }

  /**
   * Initialize worker pool
   * 初始化工作池
   */
  private initializeWorkers(): void {
    // Only create workers in browser environment
    if (typeof Worker === 'undefined') {
      return; // Fallback to non-worker execution
    }

    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker(this.workerScript);
        worker.onmessage = (e): void => this.handleWorkerMessage(worker, e.data as WorkerResult);
        worker.onerror = (error): void => this.handleWorkerError(worker, error);

        // Initialize worker metrics
        const metrics: WorkerMetrics = {
          id: `worker_${i}`,
          tasksCompleted: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          memoryUsage: 0,
          errorCount: 0,
          lastUsed: performance.now(),
          isIdle: true
        };

        this.workers.push(worker);
        this.availableWorkers.push(worker);
        this.workerMetrics.set(worker, metrics);
      } catch (error) {
        console.warn('Failed to create worker:', error);
        break; // Stop creating workers if one fails
      }
    }
  }

  /**
   * Handle worker message
   * 处理工作消息
   */
  private handleWorkerMessage(worker: Worker, result: WorkerResult): void {
    // Update worker metrics
    const metrics = this.workerMetrics.get(worker);
    if (metrics) {
      metrics.tasksCompleted++;
      metrics.totalExecutionTime += result.executionTime;
      metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.tasksCompleted;
      metrics.memoryUsage = result.memoryUsage || 0;
      metrics.lastUsed = performance.now();
      metrics.isIdle = true;

      if (!result.success) {
        metrics.errorCount++;
      }
    }

    // Find and resolve the corresponding task
    const taskIndex = this.taskQueue.findIndex(_item =>
      this.busyWorkers.has(worker)
    );

    if (taskIndex !== -1) {
      const { resolve } = this.taskQueue[taskIndex];
      this.taskQueue.splice(taskIndex, 1);
      resolve(result);
    }

    // Return worker to available pool
    this.busyWorkers.delete(worker);
    this.availableWorkers.push(worker);

    // Process next task if any
    this.processNextTask();
  }

  /**
   * Handle worker error
   * 处理工作错误
   */
  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    console.error('Worker error:', error);

    // Find and reject the corresponding task
    const taskIndex = this.taskQueue.findIndex(_item =>
      this.busyWorkers.has(worker)
    );

    if (taskIndex !== -1) {
      const { reject } = this.taskQueue[taskIndex];
      this.taskQueue.splice(taskIndex, 1);
      reject(new Error(`Worker error: ${error.message}`));
    }

    // Return worker to available pool
    this.busyWorkers.delete(worker);
    this.availableWorkers.push(worker);
  }

  /**
   * Process next task in queue
   * 处理队列中的下一个任务
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const worker = this.availableWorkers.pop();
    if (!worker) return;

    const taskItem = this.taskQueue.find(_item => !this.busyWorkers.has(worker));

    if (taskItem) {
      // Update worker metrics
      const metrics = this.workerMetrics.get(worker);
      if (metrics) {
        metrics.isIdle = false;
        metrics.lastUsed = performance.now();
      }

      this.busyWorkers.add(worker);
      worker.postMessage(taskItem.task);
    }
  }

  /**
   * Execute task in worker
   * 在工作中执行任务
   */
  async executeTask(task: WorkerTask): Promise<WorkerResult> {
    // Fallback to direct execution if no workers available
    if (this.workers.length === 0) {
      return this.executeTaskDirect(task);
    }

    return new Promise<WorkerResult>((resolve, reject) => {
      this.taskQueue.push({
        task,
        resolve,
        reject,
        timestamp: performance.now()
      });
      this.processNextTask();
    });
  }

  /**
   * Execute task directly (fallback)
   * 直接执行任务（回退）
   */
  private async executeTaskDirect(task: WorkerTask): Promise<WorkerResult> {
    const startTime = performance.now();

    try {
      // Simulate processing
      await new Promise<void>(resolve => queueMicrotask(() => resolve()));

      return {
        id: task.id,
        success: true,
        executionTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        id: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Check if workers are available
   * 检查工作是否可用
   */
  get isWorkerSupported(): boolean {
    return this.workers.length > 0;
  }

  /**
   * Get worker pool statistics
   * 获取工作池统计信息
   */
  getStatistics(): {
    totalWorkers: number;
    availableWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      busyWorkers: this.busyWorkers.size,
      queuedTasks: this.taskQueue.length
    };
  }

  /**
   * Start memory monitoring and lifecycle management
   * 开始内存监控和生命周期管理
   */
  private startMemoryMonitoring(): void {
    // Start garbage collection timer
    if (typeof window !== 'undefined') {
      this.gcTimer = window.setInterval(() => {
        this.performGarbageCollection();
      }, this.config.gcInterval);

      // Start idle worker check timer
      this.idleCheckTimer = window.setInterval(() => {
        this.checkIdleWorkers();
      }, this.config.maxIdleTime / 2);
    } else {
      // Node.js environment
      this.gcTimer = setInterval(() => {
        this.performGarbageCollection();
      }, this.config.gcInterval) as unknown as number;

      this.idleCheckTimer = setInterval(() => {
        this.checkIdleWorkers();
      }, this.config.maxIdleTime / 2) as unknown as number;
    }
  }

  /**
   * Perform intelligent garbage collection
   * 执行智能垃圾回收
   */
  private performGarbageCollection(): void {
    const now = performance.now();

    // Update memory stats
    this.updateMemoryStats();

    // Check if memory usage is too high
    if (this.memoryStats.totalUsed > this.config.memoryThreshold) {
      this.forceGarbageCollection();
    }

    // Clean up old completed tasks from queue
    this.taskQueue = this.taskQueue.filter(item =>
      now - item.timestamp < this.config.taskTimeout
    );

    this.memoryStats.gcCount++;
  }

  /**
   * Check and terminate idle workers
   * 检查并终止空闲工作线程
   */
  private checkIdleWorkers(): void {
    const now = performance.now();
    const workersToTerminate: Worker[] = [];

    this.workerMetrics.forEach((metrics, worker) => {
      if (metrics.isIdle &&
          now - metrics.lastUsed > this.config.maxIdleTime &&
          this.workers.length > this.config.minWorkers) {
        workersToTerminate.push(worker);
      }
    });

    workersToTerminate.forEach(worker => {
      this.terminateWorker(worker);
    });
  }

  /**
   * Terminate a specific worker
   * 终止特定工作线程
   */
  private terminateWorker(worker: Worker): void {
    worker.terminate();

    // Remove from all collections
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
    }

    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex !== -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }

    this.busyWorkers.delete(worker);
    this.workerMetrics.delete(worker);
  }

  /**
   * Force garbage collection on all workers
   * 强制所有工作线程进行垃圾回收
   */
  private forceGarbageCollection(): void {
    this.workers.forEach(worker => {
      try {
        worker.postMessage({ type: 'gc' });
      } catch (error) {
        console.warn('Failed to trigger GC on worker:', error);
      }
    });
  }

  /**
   * Update memory statistics
   * 更新内存统计信息
   */
  private updateMemoryStats(): void {
    const totalWorkers = this.workers.length;
    let totalMemory = 0;

    this.workerMetrics.forEach(metrics => {
      totalMemory += metrics.memoryUsage;
    });

    this.memoryStats.workerCount = totalWorkers;
    this.memoryStats.totalUsed = totalMemory;
    this.memoryStats.averageWorkerMemory = totalWorkers > 0 ? totalMemory / totalWorkers : 0;

    if (totalMemory > this.memoryStats.peakMemoryUsage) {
      this.memoryStats.peakMemoryUsage = totalMemory;
    }
  }

  /**
   * Get comprehensive memory statistics
   * 获取全面的内存统计信息
   */
  getMemoryStatistics(): MemoryStats {
    this.updateMemoryStats();
    return { ...this.memoryStats };
  }

  /**
   * Get worker metrics
   * 获取工作线程指标
   */
  getWorkerMetrics(): WorkerMetrics[] {
    return Array.from(this.workerMetrics.values());
  }

  /**
   * Terminate all workers
   * 终止所有工作
   */
  terminate(): void {
    // Clear timers
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }

    // Terminate all workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.busyWorkers.clear();
    this.workerMetrics.clear();
    this.taskQueue = [];

    // Clean up blob URL (if supported)
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(this.workerScript);
    }
  }
}
