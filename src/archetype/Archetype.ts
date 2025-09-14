/**
 * Archetype for dense component storage
 * 原型用于密集组件存储
 */

import type { Entity } from '../utils/Types';

export class Archetype {
  entities: Entity[] = [];
  // 每种组件一个列
  cols = new Map<number, unknown[]>();
  rowOf = new Map<Entity, number>();

  constructor(
    public key: string,                   // 由签名 bitset 派生
    public types: number[],               // 排序后的 typeIds
  ) {}

  /**
   * Ensure column exists for component type
   * 确保组件类型的列存在
   */
  ensureCol(typeId: number): void {
    if (!this.cols.has(typeId)) {
      this.cols.set(typeId, []);
    }
  }

  /**
   * Add entity to archetype with default component values
   * 向原型添加实体及默认组件值
   */
  push(e: Entity, makeDefault: (typeId: number) => unknown): void {
    const row = this.entities.length;
    this.entities.push(e);
    this.rowOf.set(e, row);

    for (const t of this.types) {
      this.ensureCol(t);
      const col = this.cols.get(t)!;
      col[row] = makeDefault(t);
    }
  }

  /**
   * Remove entity using swap-remove optimization
   * 使用交换删除优化移除实体
   */
  swapRemove(row: number): void {
    const last = this.entities.length - 1;
    if (row === last) {
      // 移除的就是最后一个，直接删除
      const e = this.entities.pop()!;
      this.rowOf.delete(e);
      for (const t of this.types) {
        const col = this.cols.get(t)!;
        col.pop();
      }
      return;
    }

    const lastE = this.entities[last];
    const removedE = this.entities[row];

    // 交换实体
    this.entities[row] = lastE;
    this.entities.pop();

    // 更新行映射
    this.rowOf.set(lastE, row);
    this.rowOf.delete(removedE);

    // 交换每列的数据
    for (const t of this.types) {
      const col = this.cols.get(t)!;
      col[row] = col[last];
      col.pop();
    }
  }

  /**
   * Get row index for entity
   * 获取实体的行索引
   */
  getRow(e: Entity): number | undefined {
    return this.rowOf.get(e);
  }

  /**
   * Get component column for type
   * 获取类型的组件列
   */
  getCol<T>(typeId: number): T[] {
    return this.cols.get(typeId)! as T[];
  }

  /**
   * Check if entity exists in this archetype
   * 检查实体是否存在于此原型中
   */
  hasEntity(e: Entity): boolean {
    return this.rowOf.has(e);
  }

  /**
   * Get component for entity and type
   * 获取实体指定类型的组件
   */
  getComponent<T>(e: Entity, typeId: number): T | undefined {
    const row = this.rowOf.get(e);
    if (row === undefined) return undefined;
    const col = this.cols.get(typeId);
    if (!col) return undefined;
    return col[row] as T;
  }

  /**
   * Set component for entity and type
   * 设置实体指定类型的组件
   */
  setComponent<T>(e: Entity, typeId: number, value: T): void {
    const row = this.rowOf.get(e);
    if (row === undefined) return;
    const col = this.cols.get(typeId);
    if (!col) return;
    col[row] = value;
  }

  /**
   * Get entity count
   * 获取实体数量
   */
  size(): number {
    return this.entities.length;
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
    return this.entities;
  }

  /**
   * Clear all entities and components from archetype
   * 清空原型中的所有实体和组件
   */
  clear(): void {
    this.entities.length = 0;
    this.rowOf.clear();
    for (const col of this.cols.values()) {
      col.length = 0;
    }
  }

  /**
   * Verify archetype integrity (debug utility)
   * 验证原型完整性（调试工具）
   */
  verify(): boolean {
    // Check that all arrays have same length
    const expectedLength = this.entities.length;

    for (const [typeId, col] of this.cols) {
      if (col.length !== expectedLength) {
        console.error(`Column ${typeId} length mismatch: expected ${expectedLength}, got ${col.length}`);
        return false;
      }
    }

    // Check that rowOf mapping is correct
    for (let i = 0; i < this.entities.length; i++) {
      const entity = this.entities[i];
      const mappedRow = this.rowOf.get(entity);
      if (mappedRow !== i) {
        console.error(`Entity ${entity} row mapping mismatch: expected ${i}, got ${mappedRow}`);
        return false;
      }
    }

    return true;
  }
}