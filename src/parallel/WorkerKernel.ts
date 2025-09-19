/**
 * Worker-side kernel execution framework
 * 工作线程侧核函数执行框架
 */

import type { KernelPayload, KernelResult } from './WorkerPool';

/**
 * Kernel function signature for processing entity chunks
 * 处理实体块的核函数签名
 */
export type KernelFunction = (
  cols: any[][], 
  length: number, 
  params?: any
) => number[];

/**
 * Kernel registry for worker-side execution
 * 工作线程侧执行的核函数注册表
 */
class KernelRegistry {
  private kernels = new Map<string, KernelFunction>();

  /**
   * Register a kernel function with unique identifier
   * 使用唯一标识符注册核函数
   */
  register(id: string, kernel: KernelFunction): void {
    this.kernels.set(id, kernel);
  }

  /**
   * Execute kernel by ID with given payload
   * 使用给定载荷按ID执行核函数
   */
  execute(id: string, cols: any[][], length: number, params?: any): number[] {
    const kernel = this.kernels.get(id);
    if (!kernel) {
      throw new Error(`Kernel '${id}' not found`);
    }
    return kernel(cols, length, params);
  }

  /**
   * Check if kernel is registered
   * 检查核函数是否已注册
   */
  has(id: string): boolean {
    return this.kernels.has(id);
  }
}

// Global kernel registry instance
// 全局核函数注册表实例
const registry = new KernelRegistry();

/**
 * Register a kernel function for worker execution
 * 注册核函数以供工作线程执行
 */
export function registerKernel(id: string, kernel: KernelFunction): void {
  registry.register(id, kernel);
}

/**
 * Initialize worker message handler for kernel execution (only in worker context)
 * 初始化核函数执行的工作线程消息处理器（仅在工作线程上下文中）
 */
export function initWorkerKernel(): void {
  if (typeof self !== 'undefined' && typeof self.onmessage !== 'undefined') {
    self.onmessage = (ev: MessageEvent): void => {
      const { id, payload } = ev.data as { id: number, payload: KernelPayload };
      
      try {
        // Execute kernel and get written column indices
        // 执行核函数并获取写入的列索引
        const written = registry.execute(
          payload.kernelId, 
          payload.cols, 
          payload.length, 
          payload.params
        );
        
        const result: KernelResult = { written };
        
        // Send result back to main thread
        // 将结果发送回主线程
        self.postMessage({ id, result });
      } catch (error) {
        // Send error back to main thread
        // 将错误发送回主线程
        self.postMessage({ 
          id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    };
  }
}