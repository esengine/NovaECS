/**
 * Type guards for SAB and parallel processing components
 * SAB和并行处理组件的类型守卫
 */

import type { IColumn } from '../storage/IColumn';

/**
 * Column with SAB slice descriptor capability
 * 具有SAB切片描述符能力的列
 */
export interface SABColumn extends IColumn {
  buildSliceDescriptor(start: number, end: number): unknown;
}

/**
 * Column with write mask draining capability
 * 具有写掩码排放能力的列
 */
export interface DrainableColumn extends IColumn {
  drainWrittenRows(): number[];
}

/**
 * Type guard to check if column supports SAB slice descriptors
 * 类型守卫检查列是否支持SAB切片描述符
 */
export function isSABColumn(col: unknown): col is SABColumn {
  return col != null && 
         typeof col === 'object' && 
         'buildSliceDescriptor' in col && 
         typeof (col as Record<string, unknown>).buildSliceDescriptor === 'function' &&
         // ColumnSAB should have SharedArrayBuffer-related properties, while ColumnArray has just a data array
         // ColumnSAB应该有SharedArrayBuffer相关属性，而ColumnArray只有data数组
         ('buffers' in col || 'views' in col) &&
         !('data' in col);
}

/**
 * Type guard to check if column supports write mask draining
 * 类型守卫检查列是否支持写掩码排放
 */
export function isDrainableColumn(col: unknown): col is DrainableColumn {
  return col != null && 
         typeof col === 'object' && 
         'drainWrittenRows' in col && 
         typeof (col as Record<string, unknown>).drainWrittenRows === 'function';
}

/**
 * Type guard to check if object has slice method (array-like)
 * 类型守卫检查对象是否有slice方法（类数组）
 */
export function hasSliceMethod(obj: unknown): obj is { slice(start: number, end: number): unknown } {
  return obj != null && 
         typeof obj === 'object' && 
         'slice' in obj && 
         typeof (obj as Record<string, unknown>).slice === 'function';
}

/**
 * Type guard for archetype objects
 * 原型对象的类型守卫
 */
export interface ArchetypeObject {
  entities: number[];
  cols: Map<number, IColumn>;
}

export function isArchetypeObject(obj: unknown): obj is ArchetypeObject {
  return obj != null && 
         typeof obj === 'object' && 
         'entities' in obj && 
         'cols' in obj &&
         Array.isArray((obj as Record<string, unknown>).entities) &&
         (obj as Record<string, unknown>).cols instanceof Map;
}