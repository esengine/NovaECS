/**
 * Array-based column storage as fallback for components without schema
 * 基于数组的列存储，作为无模式组件的回退方案
 */

import type { IColumn } from './IColumn';

/**
 * Array-based column implementation (fallback when SAB is not available)
 * 基于数组的列实现（SAB不可用时的回退方案）
 */
export class ColumnArray implements IColumn {
  private data: any[] = [];
  private rowEpochs: Uint32Array = new Uint32Array(0);

  length(): number {
    return this.data.length;
  }

  capacity(): number {
    return this.data.length;
  }

  ensureCapacity(rows: number): void {
    // Arrays auto-expand, no need to pre-allocate
    // 数组自动扩展，无需预分配
    if (rows > this.rowEpochs.length) {
      const newEpochs = new Uint32Array(rows);
      newEpochs.set(this.rowEpochs);
      this.rowEpochs = newEpochs;
    }
  }

  swapRemove(row: number): void {
    const last = this.data.length - 1;
    this.data[row] = this.data[last];
    this.data.pop();
    if (row < this.rowEpochs.length) {
      this.rowEpochs[row] = this.rowEpochs[last];
    }
  }

  pushDefault(): number {
    const row = this.data.length;
    this.data.push({}); // Default empty object 默认空对象

    // Ensure rowEpochs can accommodate this new row
    if (row >= this.rowEpochs.length) {
      const newEpochs = new Uint32Array(row + 1);
      newEpochs.set(this.rowEpochs);
      this.rowEpochs = newEpochs;
    }

    return row;
  }

  writeFromObject(row: number, obj: any, epoch?: number): void {
    this.data[row] = obj;
    if (epoch !== undefined) {
      this.markRowWritten(row, epoch);
    }
  }

  /**
   * Mark a specific row as written at given epoch
   * 标记特定行在给定时代被写入
   */
  markRowWritten(row: number, epoch: number): void {
    if (row >= this.rowEpochs.length) {
      const newEpochs = new Uint32Array(Math.max(this.data.length, row + 1));
      newEpochs.set(this.rowEpochs);
      this.rowEpochs = newEpochs;
    }
    this.rowEpochs[row] = epoch >>> 0; // Ensure unsigned 32-bit
  }

  readToObject(row: number, out: any = {}): any {
    const data = this.data[row];
    if (data && typeof data === 'object') {
      Object.assign(out, data);
    }
    return out;
  }

  /**
   * Build slice descriptor for Worker (uses structured clone)
   * 为Worker构建切片描述符（使用结构化克隆）
   */
  buildSliceDescriptor(start: number, end: number): any {
    return this.data.slice(start, end);
  }

  markWrittenRange?(): void {
    // For array backend, we don't track precise writes
    // 对于数组后端，我们不跟踪精确写入
  }

  /**
   * Get direct access to data array
   * 获取数据数组的直接访问
   */
  getData(): any[] {
    return this.data;
  }

  /**
   * Create a slice of the data array
   * 创建数据数组的切片
   */
  slice(start: number, end: number): any[] {
    return this.data.slice(start, end);
  }

  /**
   * Get write mask - not supported for array backend
   * 获取写掩码 - 数组后端不支持
   */
  getWriteMask(): Uint8Array | null {
    return null; // 数组后端不使用位集，返回null让buildChangedRowsSet使用rowEpochs
  }

  /**
   * Get per-row epochs for change detection
   * 获取每行的时代用于变更检测
   */
  getRowEpochs(): Uint32Array | null {
    return this.rowEpochs;
  }

  /**
   * Clear change tracking - not needed for epoch-based tracking
   * 清理变更追踪 - 基于时代的追踪不需要
   */
  clearChangeTracking(): void {
    // No need to clear for epoch-based tracking, just compare with current frame
    // 基于时代的追踪不需要清理，只需与当前帧比较
  }
}