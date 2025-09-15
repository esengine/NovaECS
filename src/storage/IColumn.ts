/**
 * Column storage interface for array and SAB backends
 * 数组和SAB后端的列存储接口
 */

export interface IColumn {
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
  writeFromObject(row: number, obj: any): void;
  
  /** Read to object (for debugging/serialization) 读取为对象（调试/序列化用） */
  readToObject(row: number, out?: any): any;

  /** —— Parallel related 并行相关 —— */
  /** Build Worker payload "column view" descriptor for [start,end) (zero-copy) 为[start,end)构建Worker载荷的"列视图"描述（零拷贝） */
  buildSliceDescriptor(start: number, end: number): any;
  
  /** (Main thread) Mark certain rows in this column as written, for changed() （主线程）标记这一列某些行被写，用于changed() */
  markWrittenRange?(start: number, end: number): void;
}