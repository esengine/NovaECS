/**
 * Concurrency safety mechanisms for SAB-based parallel processing
 * 基于SAB的并行处理的并发安全机制
 */

import type { ChunkView } from '../core/ChunkedQuery';

/**
 * Row range descriptor for non-overlapping chunk distribution
 * 用于非重叠块分发的行范围描述符
 */
export type RowRange = {
  /** Start row index (inclusive) 起始行索引（包含） */
  start: number;
  /** End row index (exclusive) 结束行索引（不包含） */
  end: number;
  /** Archetype signature key for validation 用于验证的原型签名键 */
  archetypeKey: string;
};

/**
 * Validate that chunk ranges do not overlap for concurrent safety
 * Different archetypes with same row ranges are safe (no conflict)
 * Only validate overlaps for columns that will be written (if specified)
 * 验证块范围不重叠以确保并发安全
 * 不同原型的相同行范围是安全的（无冲突）
 * 只对将要写入的列验证重叠（如果指定）
 */
export function validateNonOverlappingChunks(chunks: ChunkView[], writeColumns?: number[]): boolean {
  // If no write columns specified, validate all chunks as before
  // 如果未指定写入列，像以前一样验证所有块
  if (!writeColumns || writeColumns.length === 0) {
    // Group ranges by archetype - different archetypes can have overlapping rows
    // 按原型分组范围 - 不同原型可以有重叠行
    const byArch = new Map<string, Array<{s: number, e: number}>>();
    
    for (const c of chunks) {
      const arr = byArch.get(c.archetypeKey) ?? [];
      arr.push({ s: c.startRow, e: c.endRow });
      byArch.set(c.archetypeKey, arr);
    }
    
    // Check overlaps within each archetype only
    // 仅检查每个原型内的重叠
    for (const [archetypeKey, arr] of byArch.entries()) {
      arr.sort((a, b) => a.s - b.s);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].s < arr[i-1].e) {
          console.warn(`Overlapping chunks detected in archetype ${archetypeKey}: ` +
                      `[${arr[i-1].s}, ${arr[i-1].e}) overlaps with [${arr[i].s}, ${arr[i].e})`);
          return false;
        }
      }
    }
  } else {
    // Optimized validation: only check overlaps for chunks that have write columns
    // 优化验证：只对具有写入列的块检查重叠
    const archetypesWithWrites = new Set<string>();
    
    for (const chunk of chunks) {
      // Check if this chunk has any columns that will be written to
      // 检查此块是否有将要写入的任何列
      if (chunk.rawCols || chunk.cols) {
        const hasWriteColumn = writeColumns.some(colIdx => colIdx < (chunk.rawCols?.length || chunk.cols.length));
        if (hasWriteColumn) {
          archetypesWithWrites.add(chunk.archetypeKey);
        }
      }
    }
    
    // Only validate overlaps for archetypes that contain write columns
    // 只对包含写入列的原型验证重叠
    const byArch = new Map<string, Array<{s: number, e: number}>>();
    
    for (const c of chunks) {
      if (archetypesWithWrites.has(c.archetypeKey)) {
        const arr = byArch.get(c.archetypeKey) ?? [];
        arr.push({ s: c.startRow, e: c.endRow });
        byArch.set(c.archetypeKey, arr);
      }
    }
    
    // Check overlaps within each archetype that has write operations
    // 检查具有写操作的每个原型内的重叠
    for (const [archetypeKey, arr] of byArch.entries()) {
      arr.sort((a, b) => a.s - b.s);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].s < arr[i-1].e) {
          console.warn(`Overlapping chunks detected in archetype ${archetypeKey} for write columns [${writeColumns.join(', ')}]: ` +
                      `[${arr[i-1].s}, ${arr[i-1].e}) overlaps with [${arr[i].s}, ${arr[i].e})`);
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Memory barrier using Atomics for strict synchronization
 * 使用Atomics的内存屏障进行严格同步
 */
export class MemoryBarrier {
  private static barriers = new Map<string, Int32Array>();
  
  /**
   * Create or get a named barrier
   * 创建或获取命名屏障
   */
  static getBarrier(name: string, workerCount: number): Int32Array {
    if (!this.barriers.has(name)) {
      const buffer = new SharedArrayBuffer(4 * (workerCount + 1));
      const barrier = new Int32Array(buffer);
      // barrier[0] = counter, barrier[1..workerCount] = worker completion flags
      // barrier[0] = 计数器, barrier[1..workerCount] = worker完成标志
      this.barriers.set(name, barrier);
    }
    return this.barriers.get(name)!;
  }
  
  /**
   * Worker signals completion
   * Worker信号完成
   */
  static signalCompletion(barrier: Int32Array, workerId: number): void {
    Atomics.store(barrier, workerId + 1, 1);
    Atomics.add(barrier, 0, 1);
    Atomics.notify(barrier, 0, Infinity);
  }
  
  /**
   * Main thread waits for all workers to complete
   * 主线程等待所有worker完成
   */
  static async waitForCompletion(barrier: Int32Array, workerCount: number, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Atomics.load(barrier, 0) < workerCount) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn('Memory barrier timeout - some workers may not have completed');
        return false;
      }
      
      // Use Atomics.wait for efficient blocking
      // 使用Atomics.wait进行高效阻塞
      const result = Atomics.wait(barrier, 0, Atomics.load(barrier, 0), 100);
      if (result === 'timed-out' && Date.now() - startTime > timeoutMs) {
        return false;
      }
    }
    
    // Reset barrier for next use
    // 重置屏障以供下次使用
    for (let i = 0; i <= workerCount; i++) {
      Atomics.store(barrier, i, 0);
    }
    
    return true;
  }
}

/**
 * Atomic operations helper for SAB coordination
 * SAB协调的原子操作助手
 */
export class AtomicHelper {
  /**
   * Atomic compare-and-swap for coordination
   * 用于协调的原子比较交换
   */
  static compareAndSwap(array: Int32Array, index: number, expected: number, value: number): boolean {
    return Atomics.compareExchange(array, index, expected, value) === expected;
  }
  
  /**
   * Atomic increment with return value
   * 原子递增并返回值
   */
  static incrementAndGet(array: Int32Array, index: number): number {
    return Atomics.add(array, index, 1) + 1;
  }
  
  /**
   * Safely read boolean from Uint8Array
   * 从Uint8Array安全读取boolean
   */
  static readBool(array: Uint8Array, index: number): boolean {
    const int8View = new Int8Array(array.buffer, array.byteOffset, array.byteLength);
    return Atomics.load(int8View, index) === 1;
  }
  
  /**
   * Safely write boolean to Uint8Array
   * 向Uint8Array安全写入boolean
   */
  static writeBool(array: Uint8Array, index: number, value: boolean): void {
    const int8View = new Int8Array(array.buffer, array.byteOffset, array.byteLength);
    Atomics.store(int8View, index, value ? 1 : 0);
  }
}

/**
 * Simplified visibility guard for SAB data consistency using proper memory fencing
 * 使用正确的内存栅栏保证SAB数据一致性的简化可见性守卫
 */
export class VisibilityGuard {
  private static fence: Int32Array | null = null;

  /**
   * Initialize memory fence with shared control bit
   * 用共享控制位初始化内存栅栏
   */
  static initFence(): SharedArrayBuffer | null {
    try {
      if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
        return null;
      }
      
      const buffer = new SharedArrayBuffer(4);
      VisibilityGuard.fence = new Int32Array(buffer);
      
      // Initialize fence to 0
      Atomics.store(VisibilityGuard.fence, 0, 0);
      
      return buffer;
    } catch {
      VisibilityGuard.fence = null;
      return null;
    }
  }

  /**
   * Main thread: perform acquire operation to ensure visibility of worker writes
   * 主线程：执行获取操作以确保worker写入的可见性
   */
  static memoryFence(): void {
    if (!VisibilityGuard.fence) return;
    
    try {
      // Atomic add with 0 creates an acquire fence
      // 原子加0操作创建获取栅栏
      Atomics.add(VisibilityGuard.fence, 0, 0);
    } catch {
      // Silently ignore fence failures in environments without proper SAB support
      // 在没有正确SAB支持的环境中静默忽略栅栏失败
    }
  }

  /**
   * Worker thread: perform release operation after writing SAB data
   * Worker线程：在写入SAB数据后执行释放操作
   */
  static workerFenceRelease(fenceBuffer: SharedArrayBuffer): void {
    try {
      const fence = new Int32Array(fenceBuffer);
      const current = Atomics.load(fence, 0) | 0; // Ensure integer
      Atomics.store(fence, 0, current + 1);
    } catch {
      // Silently ignore fence failures
      // 静默忽略栅栏失败
    }
  }

  /**
   * Verify data consistency across workers
   * 验证跨worker的数据一致性
   */
  static verifyConsistency(buffer: SharedArrayBuffer, checksum: number): boolean {
    // Simple checksum verification for data integrity
    // 简单的校验和验证数据完整性
    const view = new Uint32Array(buffer);
    let computed = 0;
    for (let i = 0; i < view.length; i++) {
      computed ^= view[i];
    }
    return computed === checksum;
  }
}