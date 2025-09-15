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

  length(): number {
    return this.data.length;
  }

  capacity(): number {
    return this.data.length;
  }

  ensureCapacity(rows: number): void {
    // Arrays auto-expand, no need to pre-allocate
    // 数组自动扩展，无需预分配
  }

  swapRemove(row: number): void {
    const last = this.data.length - 1;
    this.data[row] = this.data[last];
    this.data.pop();
  }

  pushDefault(): number {
    const row = this.data.length;
    this.data.push({}); // Default empty object 默认空对象
    return row;
  }

  writeFromObject(row: number, obj: any): void {
    this.data[row] = obj;
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

  markWrittenRange?(start: number, end: number): void {
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
}