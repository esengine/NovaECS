/**
 * Parallel query system integrating ChunkedQuery with WorkerPool
 * 集成ChunkedQuery和WorkerPool的并行查询系统
 */

import type { World } from '../core/World';
import type { ComponentCtor } from '../core/ComponentRegistry';
import { getComponentType } from '../core/ComponentRegistry';
import { ChunkedQuery, type ChunkView } from '../core/ChunkedQuery';
import { WorkerPool, type KernelPayload } from './WorkerPool';

/**
 * Parallel query for executing kernel functions across worker pool
 * 用于在工作线程池中执行核函数的并行查询
 */
export class ParallelQuery {
  private chunkedQuery: ChunkedQuery;
  
  constructor(
    private world: World,
    private pool: WorkerPool,
    private ctors: ComponentCtor<any>[],
    without: ComponentCtor<any>[] = []
  ) {
    this.chunkedQuery = new ChunkedQuery(world, ctors, without);
  }

  /**
   * Execute kernel function in parallel across all matching chunks
   * 在所有匹配的块中并行执行核函数
   */
  async runKernel(
    kernelId: string, 
    params?: any, 
    targetChunkSize = 4096
  ): Promise<void> {
    // Collect all chunks
    // 收集所有块
    const chunks: ChunkView[] = [];
    this.chunkedQuery.forEachChunk(chunk => {
      chunks.push(chunk);
    }, targetChunkSize);

    if (chunks.length === 0) return;

    // Create kernel payloads for each chunk
    // 为每个块创建核函数载荷
    const payloads: KernelPayload[] = chunks.map(chunk => ({
      kernelId,
      cols: chunk.cols.map(col => [...col]), // Deep copy for structured clone
      length: chunk.length,
      params
    }));

    // Execute kernels in parallel
    // 并行执行核函数
    const results = await this.pool.run(payloads);

    // Apply results back to original data and mark components as changed
    // 将结果应用回原始数据并标记组件为已更改
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chunk = chunks[i];
      const payload = payloads[i];

      // Copy modified data back to original columns
      // 将修改的数据复制回原始列
      for (const writtenIdx of result.written) {
        const originalCol = chunk.cols[writtenIdx];
        const modifiedCol = payload.cols[writtenIdx];
        
        for (let j = 0; j < chunk.length; j++) {
          Object.assign(originalCol[j], modifiedCol[j]);
        }
      }

      // Mark changed components for each entity in chunk
      // 为块中的每个实体标记已更改的组件
      this.markChangedComponents(chunk, result.written);
    }
  }

  /**
   * Mark components as changed for entities in chunk
   * 为块中的实体标记组件为已更改
   */
  private markChangedComponents(chunk: ChunkView, writtenIndices: number[]): void {
    const { world, ctors } = this;
    
    for (const writtenIdx of writtenIndices) {
      const ctor = ctors[writtenIdx];
      const componentType = getComponentType(ctor);
      
      // Mark each entity's component as changed
      // 标记每个实体的组件为已更改
      for (let i = 0; i < chunk.length; i++) {
        const entity = chunk.entities[i];
        const store = world.getStore(componentType);
        if (store) {
          store.markChanged(entity, world.frame);
        }
      }
    }
  }
}

/**
 * Convenience function to create a parallel query
 * 创建并行查询的便捷函数
 */
export function parallel(
  world: World,
  pool: WorkerPool,
  ...ctors: ComponentCtor<any>[]
): ParallelQuery {
  return new ParallelQuery(world, pool, ctors);
}