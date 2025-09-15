/**
 * Chunked query system for cache-friendly entity iteration
 * 面向缓存友好的分块实体遍历查询系统
 */

import type { World } from './World';
import type { ComponentCtor } from './ComponentRegistry';
import { getComponentType } from './ComponentRegistry';
import { isSABColumn, hasSliceMethod } from '../parallel/TypeGuards';

/**
 * Chunk view containing entity and component column slices
 * 包含实体和组件列切片的块视图
 */
export type ChunkView = {
  /** Entity array slice from archetype.entities 原型实体数组的切片视图 */
  entities: number[];
  /** Component column slices matching entities 与实体对应的组件列切片 */
  cols: any[][];
  /** Raw IColumn instances for SAB buildSliceDescriptor (SAB用的原始IColumn实例) */
  rawCols?: unknown[];
  /** Number of rows in this chunk 此块中的行数 */
  length: number;
  /** Archetype signature key 原型签名键 */
  archetypeKey: string;
  /** Start row index (inclusive) 起始行索引（包含） */
  startRow: number;
  /** End row index (exclusive) 结束行索引（不包含） */
  endRow: number;
};

/**
 * Chunked query for cache-friendly entity iteration with parallel-ready API
 * 面向缓存友好的分块实体遍历查询，提供并行就绪的API
 */
export class ChunkedQuery {
  constructor(
    private world: World,
    private ctors: ComponentCtor<any>[],
    private without: ComponentCtor<any>[] = [],
  ) {}

  /**
   * Iterate entities in chunks for cache-friendly processing
   * 分块遍历实体以实现缓存友好的处理
   */
  forEachChunk(cb: (chunk: ChunkView) => void, targetChunkSize = 4096) {
    const { world, ctors } = this;
    const reqTypes = ctors.map(c => getComponentType(c).id);
    const woutTypes = new Set(this.without.map(c => getComponentType(c).id));

    for (const arch of world.getArchetypeIndex().getAll()) {
      // Filter archetypes: must contain all required types and none of the excluded types
      // 过滤原型：必须包含所有必需类型且不包含任何排除类型
      const hasAll = reqTypes.every(t => arch.types.includes(t));
      const hasNone = !arch.types.some(t => woutTypes.has(t));
      if (!hasAll || !hasNone) continue;

      // Extract component columns in constructor order
      // 按构造函数顺序提取组件列
      const cols = reqTypes.map(t => arch.cols.get(t)!);
      const ents = arch.entities;

      // Split into chunks to maintain cache locality
      // 分割成块以保持缓存局部性
      for (let start = 0; start < ents.length; start += targetChunkSize) {
        const end = Math.min(start + targetChunkSize, ents.length);
        const sliceCols = cols.map(col => {
          // Handle both IColumn interface and Array-like objects
          // 处理IColumn接口和Array类对象
          if (isSABColumn(col)) {
            // Return the column itself for SAB Column, actual slicing happens in buildKernelPayloadsSAB
            // 对于SAB列返回列本身，实际切片在buildKernelPayloadsSAB中进行
            return col;
          } else if (Array.isArray(col)) {
            // Traditional array slicing for array columns
            // 传统数组切片用于数组列
            return col.slice(start, end);
          } else if (hasSliceMethod(col)) {
            // Array-like object with slice method
            // 具有slice方法的类数组对象
            return col.slice(start, end);
          } else {
            return col;
          }
        });
        const sliceEnts = ents.slice(start, end);

        cb({
          entities: sliceEnts,
          cols: sliceCols,
          rawCols: cols, // Keep original IColumn instances for SAB buildSliceDescriptor
          length: end - start,
          archetypeKey: arch.key,
          startRow: start,
          endRow: end,
        });
      }
    }
  }
}

/**
 * Convenience function to create a chunked query
 * 创建分块查询的便捷函数
 */
export function chunked(world: World, ...ctors: ComponentCtor<any>[]) {
  return new ChunkedQuery(world, ctors);
}