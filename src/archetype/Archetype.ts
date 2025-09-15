/**
 * Archetype for dense component storage
 * 原型用于密集组件存储
 */

import type { Entity } from '../utils/Types';
import type { IColumn } from '../storage/IColumn';
import { ColumnSAB } from '../sab/ColumnSAB';
import { ColumnArray } from '../storage/ColumnArray';
import { getSchema } from '../sab/Schema';
import { getSABAvailability } from '../sab/Environment';

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
  push(e: Entity, makeDefault: (typeId: number) => unknown): void {
    const row = this.entities.length;
    this.entities.push(e);
    this.rowOf.set(e, row);

    for (let i = 0; i < this.types.length; i++) {
      const typeId = this.types[i];
      const ctor = this.typeCtors[i] || Object;
      this.ensureColumn(typeId, ctor);
      const col = this.cols.get(typeId)!;
      col.ensureCapacity(row + 1);
      const rowIndex = col.pushDefault();
      col.writeFromObject(rowIndex, makeDefault(typeId));
    }
  }

  /**
   * Remove entity using swap-remove optimization
   * 使用交换删除优化移除实体
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
    const col = this.cols.get(typeId);
    if (!col) return [];
    
    // For SAB columns, return objects; for Array columns, return data directly
    // 对于SAB列，返回对象；对于数组列，直接返回数据
    if ('getData' in col) {
      // Array column
      return (col as any).getData();
    } else {
      // SAB column - reconstruct objects
      const result: T[] = [];
      for (let i = 0; i < col.length(); i++) {
        result.push(col.readToObject(i) as T);
      }
      return result;
    }
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
    return col.readToObject(row) as T;
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
    col.writeFromObject(row, value);
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
    // Note: IColumn doesn't have direct length setter, would need clear method
    // 注意：IColumn没有直接的length设置器，需要clear方法
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

    return true;
  }
}