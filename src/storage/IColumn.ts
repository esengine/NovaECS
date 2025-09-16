/**
 * Column type enumeration for type-safe access
 * 列类型枚举用于类型安全访问
 */
export enum ColumnType {
  /** Array-based column with direct data access 基于数组的列，支持直接数据访问 */
  ARRAY = 'array',
  /** Structured column with object-based access 结构化列，基于对象访问 */
  OBJECT = 'object',
  /** SharedArrayBuffer-based column for parallel access 基于SharedArrayBuffer的列，用于并行访问 */
  SAB = 'sab'
}

/**
 * Base column storage interface
 * 基础列存储接口
 */
export interface IColumn {
  /** Column type identifier 列类型标识符 */
  readonly columnType: ColumnType;
  /** Current number of rows 当前行数 */
  length(): number;
  
  /** Capacity in rows 容量（行） */
  capacity(): number;
  
  /** Ensure capacity 确保容量 */
  ensureCapacity(rows: number): void;
  
  /** Swap-remove a row (for archetype migration) 交换删除一行（用于archetype迁移） */
  swapRemove(row: number): void;
  
  /** Add new row with default value at end, return row index 在末尾新增一行默认值，返回行号 */
  pushDefault(): number;
  
  /** Write from object to specified row (for addInstance/serde) 从对象写入指定行（用于addInstance/序列化） */
  writeFromObject(row: number, obj: any, epoch?: number): void;
  
  /** Read to object (for debugging/serialization) 读取为对象（调试/序列化用） */
  readToObject(row: number, out?: any): any;

  /** —— Parallel related 并行相关 —— */
  /** Build Worker payload "column view" descriptor for [start,end) (zero-copy) 为[start,end)构建Worker载荷的"列视图"描述（零拷贝） */
  buildSliceDescriptor(start: number, end: number): any;
  
  /** (Main thread) Mark certain rows in this column as written, for changed() （主线程）标记这一列某些行被写，用于changed() */
  markWrittenRange?(start: number, end: number): void;

  /** —— Change tracking 变更追踪 —— */
  /** Get write mask for frame-level change detection (1 bit per row, read-only) 获取帧级变更检测的写掩码（每行1位，只读） */
  getWriteMask?(): Uint8Array | null;

  /** Get per-row epochs/frame numbers for change detection 获取每行的时代/帧号用于变更检测 */
  getRowEpochs?(): Uint32Array | null;

  /** Clear change tracking for new frame 清理变更追踪开始新帧 */
  clearChangeTracking(): void;
}

/**
 * Array-based column with direct data access
 * 基于数组的列，支持直接数据访问
 */
export interface IArrayColumn extends IColumn {
  readonly columnType: ColumnType.ARRAY;
  /** Get direct access to underlying array 获取底层数组的直接访问 */
  getData(): any[];
}

/**
 * Object-based column with row-by-row access
 * 基于对象的列，支持逐行访问
 */
export interface IObjectColumn extends IColumn {
  readonly columnType: ColumnType.OBJECT;
  /** Get row value into reusable object (optional optimization) 将行值获取到可重用对象（可选优化） */
  getRowInto?(row: number, out: any): any;
}

/**
 * SharedArrayBuffer-based column for parallel access
 * 基于SharedArrayBuffer的列，用于并行访问
 */
export interface ISABColumn extends IColumn {
  readonly columnType: ColumnType.SAB;
  /** Get field accessor for specific field name 获取特定字段名的字段访问器 */
  getFieldAccessor?(fieldName: string): any;
  /** Get all field names 获取所有字段名 */
  getFieldNames?(): string[];
}