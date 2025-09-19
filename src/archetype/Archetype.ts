/**
 * Archetype for dense component storage
 *
 * IMPORTANT CONSTRAINT: Uses swap-remove optimization which invalidates row indices!
 * - Any removal operation may change row indices of remaining entities
 * - Do not cache row indices across structural modifications
 * - Always call getRow() to get fresh row indices when needed
 *
 * 原型用于密集组件存储
 *
 * 重要约束：使用交换删除优化会使行索引失效！
 * - 任何删除操作都可能改变剩余实体的行索引
 * - 不要在结构修改操作之间缓存行索引
 * - 需要时总是调用 getRow() 获取最新的行索引
 */

import type { Entity } from '../utils/Types';
import type { IColumn } from '../storage/IColumn';
import { ColumnSAB } from '../sab/ColumnSAB';
import { ColumnArray } from '../storage/ColumnArray';
import { getSchema } from '../sab/Schema';
import { getSABAvailability } from '../sab/Environment';

/**
 * Backend-agnostic component handle for get/set operations
 * Compatible with all column types, but slower than direct views
 * 后端无关的组件句柄，支持get/set操作
 * 兼容所有列类型，但比直接视图慢
 */
export class ComponentHandle<T = any> {
  constructor(
    private col: IColumn,
    private row: number
  ) {}

  /**
   * Get current component value (creates a copy)
   * 获取当前组件值（创建副本）
   */
  get(): T {
    return this.col.readToObject(this.row) as T;
  }

  /**
   * Set component value (replaces entirely)
   * 设置组件值（完全替换）
   */
  set(value: T, epoch?: number): void {
    this.col.writeFromObject(this.row, value, epoch);
  }

  /**
   * Update component using a modifier function
   * 使用修改函数更新组件
   */
  update(modifier: (current: T) => T, epoch?: number): void {
    const current = this.get();
    const updated = modifier(current);
    this.set(updated, epoch);
  }

  /**
   * Check if the handle is still valid (row exists)
   * 检查句柄是否仍然有效（行是否存在）
   */
  isValid(): boolean {
    return this.row >= 0 && this.row < this.col.length();
  }

  /**
   * Get the current row index (for debugging)
   * WARNING: Row index may change after structural operations!
   * 获取当前行索引（用于调试）
   * 警告：行索引在结构操作后可能改变！
   */
  getRow(): number {
    return this.row;
  }
}

/**
 * Read-write helper result types
 * 读写助手结果类型
 */
export type ViewRW<T> = { type: 'view'; v: T };
export type HandleRW<T> = { type: 'handle'; h: ComponentHandle<T> };
export type RWResult<T> = ViewRW<T> | HandleRW<T>;

/**
 * Get read-write access to component with automatic backend detection
 * Returns view for SAB backend (fastest), handle for others (compatible)
 * 获取组件的读写访问，自动检测后端
 * SAB后端返回视图（最快），其他后端返回句柄（兼容）
 */
export function getRW<T>(arch: Archetype, e: Entity, typeId: number): RWResult<T> | undefined {
  const v = arch.getComponentView<T>(e, typeId);
  if (v) return { type: 'view', v };
  const h = arch.getComponentHandle<T>(e, typeId);
  if (h) return { type: 'handle', h };
  return undefined;
}

export class Archetype {
  entities: Entity[] = [];
  /** Component columns using IColumn interface 使用IColumn接口的组件列 */
  cols = new Map<number, IColumn>();
  rowOf = new Map<Entity, number>();

  constructor(
    public key: string,                   // Derived from signature bitset 由签名bitset派生
    public types: number[],               // Sorted typeIds 排序后的typeIds
    public typeCtors: Function[] = [],    // Component constructors 组件构造函数
  ) {}

  /**
   * Ensure column exists for component type with SAB/Array backend selection
   * 确保组件类型的列存在，并选择SAB/数组后端
   */
  ensureColumn(typeId: number, ctor: Function): void {
    if (this.cols.has(typeId)) return;
    
    const schema = getSchema(ctor);
    if (getSABAvailability() && schema) {
      // Use SAB backend when available and schema is registered
      // 当可用且已注册模式时使用SAB后端
      this.cols.set(typeId, new ColumnSAB(schema));
    } else {
      // Fallback to array backend
      // 回退到数组后端
      this.cols.set(typeId, new ColumnArray());
    }
  }

  /**
   * Add entity to archetype with default component values
   * 向原型添加实体及默认组件值
   */
  push(e: Entity, makeDefault: (typeId: number) => unknown, epoch?: number): void {
    if (this.rowOf.has(e)) {
      throw new Error(`Entity ${e} already exists in archetype ${this.key}`);
    }

    const row = this.entities.length;

    // Prepare component data first (may throw)
    // 先准备组件数据（可能抛异常）
    const componentData: { typeId: number, data: unknown }[] = [];

    for (let i = 0; i < this.types.length; i++) {
      const typeId = this.types[i];
      const data = makeDefault(typeId);
      componentData.push({ typeId, data });
    }

    // All data prepared successfully, now commit to archetype
    // 所有数据准备成功，现在提交到原型
    this.entities.push(e);
    this.rowOf.set(e, row);

    // Expand columns and write data
    // 扩展列并写入数据
    for (let i = 0; i < this.types.length; i++) {
      const typeId = this.types[i];
      const ctor = this.typeCtors[i] || Object;
      this.ensureColumn(typeId, ctor);
      const col = this.cols.get(typeId);
      if (!col) throw new Error(`Column for type ${typeId} not found after ensureColumn`);
      col.emplaceDefault(row);
      col.writeFromObject(row, componentData[i].data, epoch);
    }
  }

  /**
   * Remove entity using swap-remove optimization
   * IMPORTANT: This operation invalidates cached row indices!
   * The last entity will be moved to the removed position, changing its row index.
   * Any external code caching row indices must refresh them after this call.
   *
   * 使用交换删除优化移除实体
   * 重要：此操作会使缓存的行索引失效！
   * 最后一个实体会移动到被删除的位置，改变其行索引。
   * 任何缓存行索引的外部代码必须在此调用后刷新它们。
   */
  swapRemove(row: number): void {
    const last = this.entities.length - 1;
    
    // Remove entity from mapping 从映射中移除实体
    const removedE = this.entities[row];
    this.rowOf.delete(removedE);
    
    if (row !== last) {
      // Swap with last entity 与最后一个实体交换
      const lastE = this.entities[last];
      this.entities[row] = lastE;
      this.rowOf.set(lastE, row);
    }
    
    // Remove last entity 移除最后一个实体
    this.entities.pop();
    
    // Update all columns using IColumn interface 使用IColumn接口更新所有列
    for (const col of this.cols.values()) {
      col.swapRemove(row);
    }
  }

  /**
   * Get row index for entity
   * WARNING: Returned row index may become invalid after swapRemove operations!
   * Do not cache row indices across structural modifications.
   *
   * 获取实体的行索引
   * 警告：返回的行索引在 swapRemove 操作后可能失效！
   * 不要在结构修改操作之间缓存行索引。
   */
  getRow(e: Entity): number | undefined {
    return this.rowOf.get(e);
  }


  /**
   * Get column view for direct access
   * 获取列视图用于直接访问
   */
  getColView(typeId: number): IColumn | undefined {
    return this.cols.get(typeId);
  }

  /**
   * Get column data snapshot
   * 获取列数据快照
   */
  getColSnapshot<T>(typeId: number): T[] {
    const col = this.cols.get(typeId);
    if (!col) return [];

    const result: T[] = [];
    for (let i = 0; i < col.length(); i++) {
      result.push(col.readToObject(i) as T);
    }
    return result;
  }


  /**
   * Check if entity exists in this archetype
   * 检查实体是否存在于此原型中
   */
  hasEntity(e: Entity): boolean {
    return this.rowOf.has(e);
  }

  /**
   * Replace component data entirely for entity and type
   * 完全替换实体指定类型的组件数据
   */
  replaceComponent<T>(e: Entity, typeId: number, value: T, epoch?: number): void {
    const row = this.rowOf.get(e);
    if (row === undefined) return;
    const col = this.cols.get(typeId);
    if (!col) return;

    // Write with epoch for change tracking
    col.writeFromObject(row, value, epoch);
  }

  /**
   * Get backend-agnostic component handle for get/set operations
   * Compatible with all column types (SAB/Array), but slower than views
   * 获取后端无关的组件句柄，支持get/set操作
   * 兼容所有列类型（SAB/数组），但比视图慢
   */
  getComponentHandle<T>(e: Entity, typeId: number): ComponentHandle<T> | undefined {
    const row = this.rowOf.get(e);
    if (row === undefined) return undefined;
    const col = this.cols.get(typeId);
    if (!col) return undefined;

    return new ComponentHandle<T>(col, row);
  }

  /**
   * Get component snapshot (immutable copy)
   * Use this when you specifically need a detached copy
   * 获取组件快照（不可变副本）
   * 当你明确需要独立副本时使用此方法
   */
  getComponentSnapshot<T>(e: Entity, typeId: number): T | undefined {
    const row = this.rowOf.get(e);
    if (row === undefined) return undefined;
    const col = this.cols.get(typeId);
    if (!col) return undefined;
    return col.readToObject(row) as T;
  }

  /**
   * Get zero-copy component view for direct field access
   * WARNING: View is bound to current row - must be refreshed after structural changes (swapRemove/clearRows/clear)
   * Returns undefined if backend doesn't support zero-copy views (use getComponentHandle instead)
   * 获取零拷贝组件视图，支持直接字段访问
   * 警告：视图绑定到当前行 - 结构修改后（swapRemove/clearRows/clear）必须重新获取
   * 如果后端不支持零拷贝视图则返回undefined（请使用getComponentHandle）
   */
  getComponentView<T>(e: Entity, typeId: number): T | undefined {
    const row = this.rowOf.get(e);
    if (row === undefined) return undefined;
    const col = this.cols.get(typeId);
    if (!col) return undefined;

    // Only ColumnSAB supports view method; other backends return undefined
    // 仅ColumnSAB支持view方法；其他后端返回undefined
    if (col.view) {
      return col.view<T>(row);
    }
    return undefined;
  }

  /**
   * Get readonly component view for safe traversal and debugging
   * WARNING: View is bound to current row - must be refreshed after structural changes (swapRemove/clearRows/clear)
   * Falls back to snapshot for non-SAB backends (still safe for readonly access)
   * 获取只读组件视图，用于安全遍历和调试
   * 警告：视图绑定到当前行 - 结构修改后（swapRemove/clearRows/clear）必须重新获取
   * 对于非SAB后端回退到快照（对只读访问仍然安全）
   */
  getComponentViewReadonly<T>(e: Entity, typeId: number): T | undefined {
    const row = this.rowOf.get(e);
    if (row === undefined) return undefined;
    const col = this.cols.get(typeId);
    if (!col) return undefined;

    // ColumnSAB supports viewReadonly method; other backends fall back to snapshot
    // ColumnSAB支持viewReadonly方法；其他后端回退到快照
    if (col.viewReadonly) {
      return col.viewReadonly<T>(row);
    }
    // Fallback: return immutable snapshot (safe for readonly access)
    // 回退：返回不可变快照（对只读访问安全）
    return col.readToObject(row) as T;
  }

  /**
   * Get entity count
   * 获取实体数量
   */
  size(): number {
    return this.entities.length;
  }

  /**
   * Get entity count (hot path accessor)
   * 获取实体数量（热路径访问器）
   */
  length(): number {
    return this.entities.length;
  }

  /**
   * Get entity at row (hot path accessor, no bounds checking)
   * 获取指定行的实体（热路径访问器，无边界检查）
   */
  entityAt(row: number): Entity {
    return this.entities[row];
  }

  /**
   * Check if archetype is empty
   * 检查原型是否为空
   */
  isEmpty(): boolean {
    return this.entities.length === 0;
  }

  /**
   * Get all entities in this archetype
   * 获取此原型中的所有实体
   */
  getEntities(): readonly Entity[] {
    return Object.freeze([...this.entities]);
  }

  /**
   * Clear row data but preserve column structure
   * IMPORTANT: This operation invalidates ALL cached row indices!
   *
   * 清空行数据但保留列结构
   * 重要：此操作会使所有缓存的行索引失效！
   */
  clearRows(): void {
    this.entities.length = 0;
    this.rowOf.clear();

    // Clear each column's data while preserving structure
    // 清空每列的数据但保留结构
    for (const col of this.cols.values()) {
      col.clear();
    }
  }

  /**
   * Clear all entities and columns completely
   * IMPORTANT: This operation invalidates ALL cached row indices!
   *
   * 完全清空所有实体和列
   * 重要：此操作会使所有缓存的行索引失效！
   */
  clear(): void {
    this.entities.length = 0;
    this.rowOf.clear();
    this.cols.clear();
  }

  /**
   * Verify archetype integrity (debug utility)
   * 验证原型完整性（调试工具）
   */
  verify(): boolean {
    // Check that all columns have same length as entities
    // 检查所有列的长度与实体数量相同
    const expectedLength = this.entities.length;

    for (const [typeId, col] of this.cols) {
      if (col.length() !== expectedLength) {
        console.error(`Column ${typeId} length mismatch: expected ${expectedLength}, got ${col.length()}`);
        return false;
      }
    }

    // Check that rowOf mapping is correct
    // 检查rowOf映射是否正确
    for (let i = 0; i < this.entities.length; i++) {
      const entity = this.entities[i];
      const mappedRow = this.rowOf.get(entity);
      if (mappedRow !== i) {
        console.error(`Entity ${entity} row mapping mismatch: expected ${i}, got ${mappedRow}`);
        return false;
      }
    }

    // Check entity uniqueness in array
    // 检查数组中的实体唯一性
    const entitySet = new Set(this.entities);
    if (entitySet.size !== this.entities.length) {
      console.error(`Duplicate entities detected: ${this.entities.length} entities but only ${entitySet.size} unique`);
      return false;
    }

    // Check rowOf size consistency
    // 检查rowOf大小一致性
    if (this.rowOf.size !== this.entities.length) {
      console.error(`rowOf size mismatch: expected ${this.entities.length}, got ${this.rowOf.size}`);
      return false;
    }

    return true;
  }
}