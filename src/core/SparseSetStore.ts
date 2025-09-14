/**
 * Component storage with change tracking using frame version numbers
 * 支持变更追踪的组件存储，使用帧版本号
 */

import { Entity, indexOf } from '../utils/Types';

/**
 * Interface for component storage implementations with change tracking
 * 支持变更追踪的组件存储实现接口
 */
export interface IComponentStore<T> {
  /**
   * Check if entity has component
   * 检查实体是否拥有组件
   */
  has(entity: Entity): boolean;

  /**
   * Get component for entity
   * 获取实体的组件
   */
  get(entity: Entity): T | undefined;

  /**
   * Add component to entity
   * 向实体添加组件
   */
  add(entity: Entity, value: T): void;

  /**
   * Remove component from entity
   * 从实体移除组件
   */
  remove(entity: Entity): void;

  /**
   * Get number of stored components
   * 获取存储的组件数量
   */
  size(): number;

  /**
   * Iterate over all components
   * 遍历所有组件
   */
  forEach(callback: (entity: Entity, value: T) => void): void;

  /**
   * Mark component as changed for this frame
   * 标记组件在此帧发生变更
   */
  markChanged(entity: Entity, frame: number): void;

  /**
   * Get the frame version when component was last written
   * 获取组件最近一次写入的帧版本
   */
  getVersion(entity: Entity): number;
}

/**
 * Sparse-Set component store with O(1) operations and change tracking
 * 支持O(1)操作和变更追踪的稀疏集组件存储
 */
export class SparseSetStore<T> implements IComponentStore<T> {
  // Sparse array: entityIndex -> denseIndex (-1 means none)
  // 稀疏数组：实体索引 -> 稠密索引（-1表示无）
  private sparse = new Int32Array(1024).fill(-1);

  // Dense arrays storing entity indices, component values, and versions
  // 稠密数组存储实体索引、组件值和版本号
  private dense: number[] = [];           // Entity index 实体索引
  private values: T[] = [];               // Component values 组件值
  private versions: Uint32Array = new Uint32Array(0); // Frame versions (aligned with dense) 帧版本号（与dense对齐）

  /**
   * Ensure sparse array has capacity for entity index
   * 确保稀疏数组对实体索引有容量
   */
  private ensureSparse(entityIndex: number): void {
    if (entityIndex < this.sparse.length) return;
    let newSize = this.sparse.length || 1;
    while (newSize <= entityIndex) {
      newSize <<= 1;
    }
    const newSparse = new Int32Array(newSize).fill(-1);
    newSparse.set(this.sparse);
    this.sparse = newSparse;
  }

  /**
   * Ensure versions array has capacity for dense length
   * 确保版本数组对稠密长度有容量
   */
  private ensureDenseCapacity(nextLength: number): void {
    if (nextLength <= this.versions.length) return;
    let newSize = this.versions.length || 1;
    while (newSize < nextLength) {
      newSize <<= 1;
    }
    const newVersions = new Uint32Array(newSize);
    newVersions.set(this.versions);
    this.versions = newVersions;
  }

  has(entity: Entity): boolean {
    const index = indexOf(entity);
    return index < this.sparse.length && this.sparse[index] !== -1;
  }

  get(entity: Entity): T | undefined {
    const index = indexOf(entity);
    if (index >= this.sparse.length) return undefined;
    const denseIndex = this.sparse[index];
    return denseIndex === -1 ? undefined : this.values[denseIndex];
  }

  add(entity: Entity, value: T): void {
    const index = indexOf(entity);
    this.ensureSparse(index);

    if (this.sparse[index] !== -1) {
      // Overwrite existing component 覆盖现有组件
      const denseIndex = this.sparse[index];
      this.values[denseIndex] = value;
      // Version should be set by World.markChanged, not directly here
      // 版本要由World.markChanged决定，不在此直接写
      return;
    }

    const denseIndex = this.dense.length;
    this.dense.push(index);
    this.values.push(value);
    this.ensureDenseCapacity(this.dense.length);
    this.versions[denseIndex] = 0;
    this.sparse[index] = denseIndex;
  }

  remove(entity: Entity): void {
    const index = indexOf(entity);
    if (index >= this.sparse.length) return;

    const denseIndex = this.sparse[index];
    if (denseIndex === -1) return;

    const lastIndex = this.dense.length - 1;

    // Swap with last element 与尾元素交换
    const lastEntityIndex = this.dense[lastIndex];
    this.dense[denseIndex] = lastEntityIndex;
    this.values[denseIndex] = this.values[lastIndex];
    this.versions[denseIndex] = this.versions[lastIndex];

    // Update sparse mapping for swapped element
    // 更新交换元素的稀疏映射
    this.sparse[lastEntityIndex] = denseIndex;

    // Remove last element 移除尾元素
    this.dense.pop();
    this.values.pop();
    this.sparse[index] = -1;
  }

  size(): number {
    return this.dense.length;
  }

  forEach(callback: (entity: Entity, value: T) => void): void {
    for (let i = 0; i < this.dense.length; i++) {
      const entityIndex = this.dense[i];
      // Convert entity index back to Entity handle for system use
      // 将实体索引转换回Entity句柄供系统使用
      const entity = (entityIndex as unknown) as Entity;
      callback(entity, this.values[i]);
    }
  }

  markChanged(entity: Entity, frame: number): void {
    const index = indexOf(entity);
    if (index >= this.sparse.length) return;
    const denseIndex = this.sparse[index];
    if (denseIndex !== -1) {
      this.versions[denseIndex] = frame >>> 0;
    }
  }

  getVersion(entity: Entity): number {
    const index = indexOf(entity);
    if (index >= this.sparse.length) return 0;
    const denseIndex = this.sparse[index];
    return denseIndex === -1 ? 0 : this.versions[denseIndex];
  }
}