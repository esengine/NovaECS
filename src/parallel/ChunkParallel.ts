/**
 * Parallel chunk processing using worker pool
 * 使用工作线程池的并行块处理
 */

import type { World } from '../core/World';
import type { ComponentCtor } from '../core/ComponentRegistry';
import { getComponentType } from '../core/ComponentRegistry';
import { ChunkedQuery } from '../core/ChunkedQuery';
import type { WorkerPool } from './WorkerPool';

/**
 * Process entity chunks in parallel using worker pool
 * 使用工作线程池并行处理实体块
 */
export async function forEachChunkParallel(
  world: World,
  ctors: ComponentCtor<any>[],
  pool: WorkerPool,
  kernelId: string,
  params?: any,
  targetChunkSize = 4096
) {
  const q = new ChunkedQuery(world, ctors);
  const tasks: any[] = [];
  const chunks: any[] = [];

  // Collect chunks and create tasks
  // 收集块并创建任务
  q.forEachChunk((chunk) => {
    chunks.push(chunk);
    tasks.push({
      kernelId,
      cols: chunk.cols.map(col => [...col]), // Deep copy for structured clone 深拷贝用于结构化克隆
      length: chunk.length,
      params,
    });
  }, targetChunkSize);

  if (tasks.length === 0) return;

  // Execute tasks in parallel
  // 并行执行任务
  const results = await pool.run(tasks);

  // Apply results back to original data
  // 将结果应用回原始数据
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const chunk = chunks[i];
    const task = tasks[i];

    // Copy modified data back to original columns
    // 将修改的数据复制回原始列
    for (const writtenIdx of result.written) {
      const originalCol = chunk.cols[writtenIdx];
      const modifiedCol = task.cols[writtenIdx];
      
      for (let j = 0; j < chunk.length; j++) {
        Object.assign(originalCol[j], modifiedCol[j]);
      }
    }

    // Mark components as changed for entities in chunk
    // 为块中的实体标记组件为已更改
    markChunkChanged(world, chunk, result.written, ctors);
  }
}

/**
 * Mark components as changed for entities in chunk
 * 为块中的实体标记组件为已更改
 */
function markChunkChanged(
  world: World, 
  chunk: any, 
  writtenIndices: number[], 
  ctors: ComponentCtor<any>[]
): void {
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