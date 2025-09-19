/**
 * Parallel chunk processing using worker pool
 * 使用工作线程池的并行块处理
 */

import type { World } from '../core/World';
import type { ComponentCtor } from '../core/ComponentRegistry';
import { getComponentType } from '../core/ComponentRegistry';
import { ChunkedQuery, type ChunkView } from '../core/ChunkedQuery';
import type { WorkerPool, KernelPayload } from './WorkerPool';
import { getSABAvailability } from '../sab/Environment';
import { commitChangedFromMasks } from './CommitChanged';
import { validateNonOverlappingChunks, VisibilityGuard } from './ConcurrencySafety';
import { isSABColumn } from './TypeGuards';
import { getHostKernel, getKernelMeta, validateWrittenAgainstMeta } from './KernelRegistry';

/**
 * Process entity chunks in parallel using worker pool
 * 使用工作线程池并行处理实体块
 */
export async function forEachChunkParallel(
  world: World,
  ctors: ComponentCtor<any>[],
  pool: WorkerPool,
  kernelId: string,
  params?: unknown,
  targetChunkSize = 4096
): Promise<void> {
  const q = new ChunkedQuery(world, ctors);
  const tasks: KernelPayload[] = [];
  const chunks: ChunkView[] = [];

  // Collect chunks and create tasks
  // 收集块并创建任务
  q.forEachChunk((chunk) => {
    chunks.push(chunk);
    const payload = buildKernelPayloadsSAB(chunk, kernelId, params);
    tasks.push(payload);
  }, targetChunkSize);
  
  // Validate kernel metadata exists before parallel execution
  // 在并行执行前验证内核元数据存在
  const kernelMeta = getKernelMeta(kernelId);
  if (getSABAvailability() && kernelMeta) {
    // Only validate overlaps for columns that will be written
    // 只对将要写入的列验证重叠
    if (!validateNonOverlappingChunks(chunks, kernelMeta.writes)) {
      throw new Error(`Overlapping chunks detected for write columns [${kernelMeta.writes.join(', ')}] - concurrent writes would cause data races`);
    }
  } else if (getSABAvailability()) {
    console.warn(`No kernel metadata found for '${kernelId}' - skipping conflict detection. Use registerKernelMeta() for better scheduling.`);
  }

  if (tasks.length === 0) return;

  // Execute based on SAB availability
  // 根据SAB可用性执行
  if (!getSABAvailability()) {
    // Fallback: run host kernels on main thread (no SAB available)
    // 回退：在主线程运行宿主核函数（SAB不可用）
    const hostKernel = getHostKernel(kernelId);
    if (!hostKernel) {
      throw new Error(`No host kernel registered for '${kernelId}'. Register with registerHostKernel() first.`);
    }
    
    const writtenCtorSet = new Set<ComponentCtor<any>>();
    for (const chunk of chunks) {
      // Execute kernel directly on main thread with original data
      // 在主线程直接对原始数据执行核函数
      const result = hostKernel(chunk.cols as unknown[][], chunk.length, params);
      
      // Validate runtime writes against static metadata
      // 验证运行时写入与静态元数据
      if (kernelMeta) {
        const validation = validateWrittenAgainstMeta(kernelId, result.written);
        if (!validation.isValid) {
          throw new Error(`Kernel validation failed: ${validation.message}`);
        }
      }
      
      // Use metadata writes for change marking (static declaration)
      // 使用元数据写入进行变更标记（静态声明）
      const effectiveWrites = kernelMeta ? kernelMeta.writes : result.written;
      for (const writtenIdx of effectiveWrites) {
        if (writtenIdx < ctors.length) {
          writtenCtorSet.add(ctors[writtenIdx]);
        }
      }
      
      // Mark components as changed for entities in this chunk (use metadata writes)
      // 为此块中的实体标记组件为已更改（使用元数据写入）
      markChunkChanged(world, chunk, effectiveWrites, ctors);
    }
    
    return; // Data already written and marked as changed
  }

  // SAB path: execute tasks in parallel using worker pool
  // SAB路径：使用工作线程池并行执行任务
  const results = await pool.run(tasks);
  
  // Memory fence to ensure visibility after parallel execution
  // 内存栅栏确保并行执行后的可见性
  VisibilityGuard.memoryFence();

  // For SAB backend, commit all changes from write masks after parallel execution
  // 对于SAB后端，在并行执行后从写掩码提交所有变更
  const writtenCtorSet = new Set<ComponentCtor<any>>();
  for (const result of results) {
    // Validate runtime writes against static metadata
    // 验证运行时写入与静态元数据
    if (kernelMeta) {
      const validation = validateWrittenAgainstMeta(kernelId, result.written);
      if (!validation.isValid) {
        throw new Error(`Kernel validation failed: ${validation.message}`);
      }
    }
    
    // Use metadata writes for change marking (static declaration)
    // Worker result.written only used for validation
    // 使用元数据写入进行变更标记（静态声明）
    // Worker的result.written只用于验证
    const effectiveWrites = kernelMeta ? kernelMeta.writes : result.written;
    for (const writtenIdx of effectiveWrites) {
      if (writtenIdx < ctors.length) {
        writtenCtorSet.add(ctors[writtenIdx]);
      }
    }
  }
  
  // Commit changes for all written component types
  // 为所有被写组件类型提交变更
  if (writtenCtorSet.size > 0) {
    commitChangedFromMasks(world, Array.from(writtenCtorSet));
  }
}

/**
 * Mark components as changed for entities in chunk
 * 为块中的实体标记组件为已更改
 */
/**
 * Build kernel payload using SAB descriptors instead of structured cloning
 * 构建使用SAB描述符而非结构化克隆的核载荷
 */
function buildKernelPayloadsSAB(chunk: ChunkView, kernelId: string, params?: unknown): KernelPayload {
  if (getSABAvailability()) {
    // Use SAB zero-copy descriptors, prioritize rawCols for accurate SAB detection
    // 使用SAB零拷贝描述符，优先使用rawCols进行准确的SAB检测
    const sabCols: any[] = [];
    const sourceColumns = chunk.rawCols || chunk.cols;
    
    for (let i = 0; i < sourceColumns.length; i++) {
      const rawCol = sourceColumns[i];
      if (isSABColumn(rawCol)) {
        // Column implements SAB interface - use slice descriptor for zero-copy
        // 列实现SAB接口 - 使用切片描述符实现零拷贝
        sabCols.push(rawCol.buildSliceDescriptor(chunk.startRow, chunk.endRow));
      } else {
        // Fallback to structured clone for Array columns (use pre-sliced data from chunk.cols)
        // Array列回退到结构化克隆（使用chunk.cols中预切片的数据）
        const slicedCol = chunk.cols[i];
        sabCols.push(Array.isArray(slicedCol) ? [...slicedCol] : slicedCol);
      }
    }
    return {
      kernelId,
      cols: sabCols,
      length: chunk.length,
      params
    };
  } else {
    // Fallback to structured cloning for Array backend
    // Array后端回退到结构化克隆
    return {
      kernelId,
      cols: chunk.cols.map(col => Array.isArray(col) ? [...col] : col),
      length: chunk.length,
      params
    };
  }
}


function markChunkChanged(
  world: World, 
  chunk: ChunkView, 
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