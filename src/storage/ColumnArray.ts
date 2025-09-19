/**
 * Array-based column storage as fallback for components without schema
 * 基于数组的列存储，作为无模式组件的回退方案
 */

import type { IColumn } from './IColumn';
import { ColumnType } from './IColumn';

/**
 * Array-based column implementation (fallback when SAB is not available)
 * 基于数组的列实现（SAB不可用时的回退方案）
 */
export class ColumnArray implements IColumn {
  readonly columnType = ColumnType.ARRAY;
  private data: any[] = [];
  private _length: number = 0;
  private rowEpochs: Uint32Array = new Uint32Array(0);

  length(): number {
    return this._length;
  }

  capacity(): number {
    return this.data.length;
  }

  ensureCapacity(rows: number): void {
    // Pre-allocate array capacity for compaction
    // 为压缩预分配数组容量
    if (rows > this.data.length) {
      this.data.length = rows;
    }
    if (rows > this.rowEpochs.length) {
      const newEpochs = new Uint32Array(rows);
      newEpochs.set(this.rowEpochs);
      this.rowEpochs = newEpochs;
    }
  }

  swapRemove(row: number): void {
    const last = this._length - 1;
    if (row < 0 || row > last) return;

    if (row !== last) {
      this.data[row] = this.data[last];
      if (row < this.rowEpochs.length && last < this.rowEpochs.length) {
        this.rowEpochs[row] = this.rowEpochs[last];
      }
    }

    // Release reference to prevent memory leak
    // 释放引用防止内存泄漏
    this.data[last] = undefined;
    // rowEpochs[last] can be left as-is (_length shrink is sufficient)
    // rowEpochs[last] 可不清理（_length收缩即可）
    this._length--;
  }

  pushDefault(): number {
    const row = this._length;

    // Ensure capacity
    if (row >= this.data.length) {
      this.data.length = Math.max(this.data.length * 2, row + 1);
    }

    // Don't allocate {}, just reserve slot - Archetype.push() will writeFromObject() immediately
    // 不分配{}，只预留位置 - Archetype.push()会立即调用writeFromObject()
    this._length++;

    // Ensure rowEpochs can accommodate this new row
    if (row >= this.rowEpochs.length) {
      const newEpochs = new Uint32Array(Math.max(this.rowEpochs.length * 2, row + 1));
      newEpochs.set(this.rowEpochs);
      this.rowEpochs = newEpochs;
    }

    return row;
  }

  emplaceDefault(row: number): void {
    this.ensureCapacity(row + 1);

    // Don't allocate {}, just reserve slot - caller will writeFromObject() immediately
    // 不分配{}，只预留位置 - 调用方会立即调用writeFromObject()
    this._length = Math.max(this._length, row + 1);
  }

  writeFromObject(row: number, obj: any, epoch?: number): void {
    this.ensureCapacity(row + 1);
    this.data[row] = obj;
    this._length = Math.max(this._length, row + 1);
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
    const src = this.data[row];

    // If src is not an object, return it directly without modifying out
    // 如果src不是对象，直接返回，不修改out
    if (!(src && typeof src === 'object')) {
      return src;
    }

    // Ensure out is a valid object for Object.assign
    // 确保out是Object.assign的有效对象
    if (!out || typeof out !== 'object') {
      out = {};
    }

    // Clean up extra keys in out that don't exist in src to avoid key pollution
    // 清理out中不存在于src的多余键，避免键污染
    for (const k in out) {
      if (!(k in src)) {
        delete out[k];
      }
    }

    Object.assign(out, src);
    return out;
  }

  /**
   * Build slice descriptor for Worker (uses structured clone)
   * 为Worker构建切片描述符（使用结构化克隆）
   */
  buildSliceDescriptor(start: number, end: number): any {
    const data = this.data.slice(start, end);        // 结构化克隆
    return { view: { kind: 'AOS', data, baseRow: start } };
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
   * Mark range of rows as written for parallel write-back
   * 标记行范围被写入，用于并行回写
   */
  markWrittenRange(start: number, end: number, epoch: number): void {
    if (end > this.rowEpochs.length) {
      this.ensureCapacity(end);
    }
    for (let i = start; i < end; i++) {
      this.rowEpochs[i] = epoch >>> 0;
    }
  }

  /**
   * Clear change tracking - not needed for epoch-based tracking
   * 清理变更追踪 - 基于时代的追踪不需要
   */
  clearChangeTracking(): void {
    // No need to clear for epoch-based tracking, just compare with current frame
    // 基于时代的追踪不需要清理，只需与当前帧比较
  }

  /**
   * Generate new column with same layout but empty data
   * 生成同布局的新列（空列）
   */
  spawnLike(newCap: number): IColumn {
    const newColumn = new ColumnArray();
    newColumn.ensureCapacity(newCap);
    return newColumn;
  }

  /**
   * Copy [0, n) rows to target column
   * 拷贝[0,n)行到目标列
   */
  copyRangeTo(dst: IColumn, n: number): void {
    if (!(dst instanceof ColumnArray)) {
      // Generic path: fallback to per-row writes for compatibility with other implementations
      // 泛化路径：退化为逐行写入，保证兼容其他实现
      for (let i = 0; i < n; i++) {
        const epoch = i < this.rowEpochs.length ? this.rowEpochs[i] : undefined;
        dst.writeFromObject(i, this.data[i], epoch);
      }
      return;
    }

    // Ensure destination has enough capacity
    // 确保目标有足够容量
    dst.ensureCapacity(n);

    // Fast path: direct array copy for ColumnArray
    // 快速路径：对ColumnArray直接数组复制
    const dstCA = dst;
    for (let i = 0; i < n; i++) {
      dstCA.data[i] = this.data[i];
    }

    // Copy row epochs if available
    // 复制行时代信息（如果可用）
    if (this.rowEpochs.length > 0) {
      dstCA.rowEpochs.set(this.rowEpochs.subarray(0, n));
    }

    // Set destination length - this is crucial!
    // 设置目标长度 - 这是关键！
    dstCA._length = n;
  }

  /**
   * Estimated bytes per row for memory statistics
   * 每行字节估算，便于统计释放内存
   */
  bytesPerRow(): number {
    // Rough estimate: object reference (8 bytes) + typical component size
    // 粗略估算：对象引用（8字节）+ 典型组件大小
    return 64; // Conservative estimate for object components
  }

  /**
   * Get zero-allocation row accessor for debugging/Raw traversal
   * 获取零分配行访问器，用于调试/Raw遍历
   */
  getRowAccessor(): (row: number, out?: any) => any {
    return (row, out = {}) => this.readToObject(row, out);
  }

  /**
   * Clear all row data but preserve column structure
   * 清空所有行数据但保留列结构
   */
  clear(): void {
    // Clear references to prevent memory leaks but keep capacity
    // 清除引用防止内存泄漏但保持容量
    for (let i = 0; i < this._length; i++) {
      this.data[i] = undefined;
    }
    this._length = 0;

    // Keep rowEpochs capacity but clear tracking data
    // 保持rowEpochs容量但清理追踪数据
    if (this.rowEpochs.length > 0) {
      this.rowEpochs.fill(0);
    }
  }
}