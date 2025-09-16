/**
 * SharedArrayBuffer-based column storage with per-field TypedArrays
 * 基于SharedArrayBuffer的列存储，每字段一个TypedArray
 */

import type { IColumn } from '../storage/IColumn';
import { ColumnType } from '../storage/IColumn';
import type { ComponentSchema, FieldType } from './Schema';

/**
 * TypedArray constructors for each field type
 * 每种字段类型的TypedArray构造函数
 */
const TYPED = {
  f32: Float32Array, f64: Float64Array,
  i32: Int32Array,   u32: Uint32Array,
  i16: Int16Array,   u16: Uint16Array,
  i8:  Int8Array,    u8:  Uint8Array,
  bool: Uint8Array, // Use 0/1 for atomic bool operations 使用0/1进行原子bool操作
} as const;

/**
 * Byte sizes for each field type
 * 每种字段类型的字节大小
 */
const BYTES: Record<FieldType, number> = {
  f32:4,f64:8,i32:4,u32:4,i16:2,u16:2,i8:1,u8:1,bool:1
};

/**
 * Type for field views collection
 * 字段视图集合的类型
 */
type Views = Record<string, Float32Array|Float64Array|Int32Array|Uint32Array|Int16Array|Uint16Array|Int8Array|Uint8Array>;

/**
 * SharedArrayBuffer-based column implementation
 * 基于SharedArrayBuffer的列实现
 */
export class ColumnSAB implements IColumn {
  readonly columnType = ColumnType.SAB;
  private _len = 0;
  private _cap = 0;
  private buffers: Record<string, SharedArrayBuffer> = {};
  private views: Views = {};
  private fields: [name:string, type:FieldType][];

  /** Optional write mask (shared bitset) for precise changed marking 可选写掩码（共享位集），用于精确changed标记 */
  private writeMaskBuf?: SharedArrayBuffer;
  private writeMask?: Uint8Array; // bitset: one bit per row 位集：一行一位

  constructor(schema: ComponentSchema, initialCap = 256) {
    this.fields = Object.entries(schema.fields);
    this.growTo(Math.max(1, initialCap));
  }

  length() { return this._len; }
  capacity() { return this._cap; }

  /**
   * Grow capacity using 2x expansion strategy
   * 使用2倍扩容策略增长容量
   */
  private growTo(newCap: number) {
    // Expand by 2x 按2倍扩容
    newCap = Math.max(newCap, this._cap ? this._cap * 2 : 256);

    for (const [name, ty] of this.fields) {
      const bytes = BYTES[ty] * newCap;
      const old = this.views[name] as any;
      const buf = new SharedArrayBuffer(bytes);
      const Ctor = TYPED[ty];
      const view = new (Ctor as any)(buf) as any;

      // Copy old data 拷贝旧数据
      if (old) view.set(old.subarray(0, this._len));
      this.buffers[name] = buf;
      this.views[name] = view;
    }

    // Write mask (1bit/row) 写掩码（1位/行）
    const maskBytes = Math.ceil(newCap / 8);
    const nbuf = new SharedArrayBuffer(maskBytes);
    const nview = new Uint8Array(nbuf);
    if (this.writeMask) nview.set(this.writeMask);
    this.writeMaskBuf = nbuf; this.writeMask = nview;

    this._cap = newCap;
  }

  ensureCapacity(rows: number) {
    if (rows > this._cap) this.growTo(rows);
  }

  pushDefault(): number {
    this.ensureCapacity(this._len + 1);
    // Default to all 0; can extend schema for custom defaults 默认全0；如需自定义默认值，可扩展schema
    const row = this._len++;
    return row;
  }

  swapRemove(row: number): void {
    const last = this._len - 1;
    for (const [name] of this.fields) {
      const v:any = this.views[name];
      v[row] = v[last];
    }
    // Sync write mask 写掩码同步
    if (this.writeMask) {
      const i = row>>3, bi = row & 7;
      const j = last>>3, bj = last & 7;
      const bitJ = (this.writeMask[j] >>> bj) & 1;
      this.writeMask[i] = (this.writeMask[i] & ~(1<<bi)) | (bitJ<<bi);
    }
    this._len--;
  }

  writeFromObject(row: number, obj: Record<string, unknown>): void {
    // Ensure capacity for this row
    // 确保此行的容量
    if (row >= this._cap) {
      this.ensureCapacity(row + 1);
    }

    for (const [name, type] of this.fields) {
      const v = this.views[name] as Float32Array | Float64Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array;
      const value = obj?.[name] ?? 0;

      // Special handling for bool fields to ensure 0/1 values
      // 特殊处理bool字段以确保0/1值
      if (type === 'bool') {
        v[row] = value ? 1 : 0;
      } else {
        v[row] = Number(value);
      }
    }

    // Update length if necessary
    // 必要时更新长度
    this._len = Math.max(this._len, row + 1);

    // Mark dirty bit 标脏位
    this.setWrittenBit(row);
  }

  readToObject(row: number, out: Record<string, unknown> = {}): Record<string, unknown> {
    // Clean up extra keys in out that don't exist in fields to avoid key pollution
    // 清理out中不存在于字段的多余键，避免键污染
    for (const k in out) {
      if (!this.fields.some(([name]) => name === k)) {
        delete out[k];
      }
    }

    for (const [name, type] of this.fields) {
      const v = this.views[name] as Float32Array | Float64Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array;

      // Special handling for bool fields to convert 0/1 back to boolean
      // 特殊处理bool字段将0/1转换回boolean
      if (type === 'bool') {
        out[name] = v[row] === 1;
      } else {
        out[name] = v[row];
      }
    }
    return out;
  }

  /**
   * Zero-copy slice descriptor for Worker to rebuild TypedArray views
   * 零拷贝切片描述，发给Worker重建TypedArray视图即可
   */
  buildSliceDescriptor(start: number, end: number): any {
    const desc: Record<string, { buffer: SharedArrayBuffer; byteOffset: number; length: number; type: string }> = {};
    for (const [name, ty] of this.fields) {
      const bytes = BYTES[ty];
      desc[name] = {
        buffer: this.buffers[name],
        byteOffset: start * bytes,
        length: end - start,
        type: ty,
      };
    }
    // Return unified slice descriptor format
    return {
      view: {
        kind: 'SAB',
        fields: desc,
        writeMask: { buffer: this.writeMaskBuf!, byteOffset: 0, length: Math.ceil(this._cap/8) },
        baseRow: start
      }
    };
  }

  private setWrittenBit(row: number) {
    if (!this.writeMask) return;
    const i = row >> 3, b = row & 7;
    this.writeMask[i] |= (1 << b);
  }

  markWrittenRange(start: number, end: number, epoch: number): void {
    if (!this.writeMask) return;
    // For SAB, we use write mask instead of per-row epochs
    // 对于SAB，我们使用写掩码而不是每行时代
    for (let r = start; r < end; r++) {
      const i = r >> 3, b = r & 7;
      this.writeMask[i] |= (1 << b);
    }
  }

  /**
   * Main thread reads and clears write mask (returns written row indices)
   * 主线程读取并清空写掩码（返回被写行号）
   */
  drainWrittenRows(): number[] {
    if (!this.writeMask) return [];
    const out: number[] = [];
    for (let i=0;i<this.writeMask.length;i++){
      let byte = this.writeMask[i];
      if (!byte) continue;
      while (byte) {
        const b = byte & -byte;              // Get lowest 1 bit 取最低位1
        const bit = Math.log2(b) | 0;
        const row = (i<<3) + bit;
        if (row < this._len) out.push(row);
        byte &= byte - 1;
      }
      this.writeMask[i] = 0; // Clear 清空
    }
    return out;
  }

  /**
   * Convenience: get specific field view (for main thread local use)
   * 便捷：拿到具体字段的视图（主线程本地用）
   */
  viewOf(name: string) { return this.views[name]; }

  /**
   * Get write mask for change detection (read-only, doesn't clear)
   * 获取写掩码用于变更检测（只读，不清空）
   */
  getWriteMask(): Uint8Array | null {
    return this.writeMask || null;
  }

  /**
   * Get per-row epochs - not supported for SAB backend, use writeMask instead
   * 获取每行时代 - SAB后端不支持，使用writeMask替代
   */
  getRowEpochs(): Uint32Array | null {
    return null; // SAB使用位集而不是行时代
  }

  /**
   * Clear write mask for new frame
   * 清理写掩码开始新帧
   */
  clearChangeTracking(): void {
    if (this.writeMask) {
      this.writeMask.fill(0);
    }
  }

  /**
   * Generate new column with same layout but empty data
   * 生成同布局的新列（空列）
   */
  spawnLike(newCap: number): IColumn {
    // Reconstruct schema from current fields
    // 从当前字段重建模式
    const schema = {
      fields: Object.fromEntries(this.fields)
    };
    return new ColumnSAB(schema, newCap);
  }

  /**
   * Copy [0, n) rows to target column using TypedArray operations
   * 使用TypedArray操作拷贝[0,n)行到目标列
   */
  copyRangeTo(dst: IColumn, n: number): void {
    if (!(dst instanceof ColumnSAB)) {
      // Generic path: fallback to per-row writes for compatibility with other implementations
      // 泛化路径：退化为逐行写入，保证兼容其他实现
      for (let i = 0; i < n; i++) {
        // SAB doesn't track per-row epochs, so we don't pass epoch parameter
        dst.writeFromObject(i, this.readToObject(i));
      }
      return;
    }

    // Ensure destination has enough capacity
    // 确保目标有足够容量
    dst.ensureCapacity(n);

    // Copy each field using TypedArray.set for efficiency
    // 使用TypedArray.set高效复制每个字段
    for (const [name] of this.fields) {
      const srcView = this.views[name] as any;
      const dstView = dst.views[name] as any;

      if (srcView && dstView) {
        // Use TypedArray.set for fast memory copy
        // 使用TypedArray.set进行快速内存复制
        dstView.set(srcView.subarray(0, n));
      }
    }

    // Copy write mask if available
    // 复制写掩码（如果可用）
    if (this.writeMask && dst.writeMask) {
      const maskBytesNeeded = Math.ceil(n / 8);
      dst.writeMask.set(this.writeMask.subarray(0, maskBytesNeeded));
    }

    // Update destination length
    // 更新目标长度
    dst._len = n;
  }

  /**
   * Estimated bytes per row for memory statistics
   * 每行字节估算，便于统计释放内存
   */
  bytesPerRow(): number {
    let totalBytes = 0;
    for (const [, type] of this.fields) {
      totalBytes += BYTES[type];
    }
    // Add write mask overhead (1 bit per row = 1/8 byte)
    // 添加写掩码开销（每行1位 = 1/8字节）
    totalBytes += 0.125;
    return totalBytes;
  }

  /**
   * Get zero-allocation row accessor for debugging/Raw traversal
   * 获取零分配行访问器，用于调试/Raw遍历
   */
  getRowAccessor(): (row: number, out?: any) => any {
    return (row, out = {}) => this.readToObject(row, out);
  }
}