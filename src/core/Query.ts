/**
 * New Query system based on Archetype iteration (cache-friendly)
 * 基于Archetype迭代的新查询系统（缓存友好）
 */

import type { Entity } from '../utils/Types';
import type { World } from './World';
import type { ComponentType, ComponentCtor } from './ComponentRegistry';
import type { IColumn, IArrayColumn } from '../storage/IColumn';
import type { Archetype } from '../archetype/Archetype';
import { getComponentType } from './ComponentRegistry';
import { ColumnType } from '../storage/IColumn';

/**
 * Component access mode for query iteration
 * 查询迭代的组件访问模式
 */
type SelectMode = 'view' | 'handle' | 'snapshot';

/**
 * Query configuration options
 * 查询配置选项
 */
export interface QueryOptions {
  /** Access mode for components 组件访问模式 */
  mode?: SelectMode;
  /** Required tags 必需标签 */
  withTags?: string[];
  /** Excluded tags 排除标签 */
  withoutTags?: string[];
  /** Only entities with these changed components 仅包含这些组件发生变化的实体 */
  changed?: ComponentCtor<any>[];
}

/**
 * Internal plan entry for archetype iteration
 * 原型迭代的内部计划条目
 */
type PlanEntry = {
  /** Target archetype 目标原型 */
  arch: Archetype;
  /** Component columns in typeIds order 按typeIds顺序的组件列 */
  cols: IColumn[];
  /** Write masks for change detection (SAB backend) 写入掩码用于变更检测（SAB后端） */
  writeMasks: (Uint8Array | null)[];
  /** Row epochs for change detection (Array backend) 行纪元用于变更检测（数组后端） */
  rowEpochs: (Uint32Array | null)[];
};

/**
 * Archetype-based query system for cache-friendly entity iteration
 * 基于原型的查询系统，提供缓存友好的实体迭代
 */
export class Query<Ts extends unknown[]> {
  private world: World;
  private types: ComponentType<any>[];
  private typeIds: number[];
  private opts: Required<QueryOptions>;
  private plan: PlanEntry[] = [];

  /** Pending entity additions for delta tracking 待处理的实体添加（用于增量跟踪） */
  private pendingAdded: Entity[] = [];
  /** Pending entity removals for delta tracking 待处理的实体移除（用于增量跟踪） */
  private pendingRemoved: Entity[] = [];
  /** Pending entity changes for delta tracking 待处理的实体变更（用于增量跟踪） */
  private pendingChanged: Entity[] = [];

  constructor(world: World, types: ComponentType<any>[], opts: QueryOptions = {}) {
    this.world = world;
    this.types = types;
    this.typeIds = types.map(t => t.id);
    this.opts = {
      mode: opts.mode ?? 'view',
      withTags: opts.withTags ?? [],
      withoutTags: opts.withoutTags ?? [],
      changed: opts.changed ?? []
    };
    this.compile();
  }

  /**
   * Compile execution plan by finding matching archetypes
   * 编译执行计划，查找匹配的原型
   */
  private compile() {
    const all = this.world.getArchetypeIndex().getAll();
    for (const arch of all) {
      // Check if archetype contains all required components
      if (!this.typeIds.every(id => arch.types.includes(id))) continue;

      // Get component columns for required types
      const cols: IColumn[] = [];
      for (const id of this.typeIds) {
        const col = arch.getColView(id);
        if (!col) { cols.length = 0; break; }
        cols.push(col);
      }
      if (cols.length !== this.typeIds.length) continue;

      // Setup change detection sources
      const writeMasks = cols.map(c => (typeof (c as any).getWriteMask === 'function') ? (c as any).getWriteMask() as Uint8Array | null : null);
      const rowEpochs  = cols.map(c => (typeof (c as any).getRowEpochs === 'function') ? (c as any).getRowEpochs() as Uint32Array | null : null);

      this.plan.push({ arch, cols, writeMasks, rowEpochs });
    }
  }

  // —— 行是否通过 changed 过滤 —— //
  private rowPassChanged(p: PlanEntry, row: number): boolean {
    if (this.opts.changed.length === 0) return true;

    // 只在指定的 changed 组件上检查（并集），没能力检测的列就当作"不筛掉"
    let hit = false;
    for (let i = 0; i < this.types.length; i++) {
      const need = this.opts.changed.some(ctor => ctor && ctor === this.types[i].ctor);
      if (!need) continue;

      const mask = p.writeMasks[i];
      if (mask) {
        const byte = mask[row >> 3];
        const bit  = (byte >>> (row & 7)) & 1;
        if (bit) { hit = true; break; }
      } else {
        const epochs = p.rowEpochs[i];
        if (epochs) {
          if (epochs[row] === this.world.epoch()) { hit = true; break; }
        } else {
          // 该列无法提供 changed 能力：保守放行
          hit = true; break;
        }
      }
    }
    return hit;
  }

  /**
   * Check if entity passes tag filter
   * 检查实体是否通过标签过滤
   */
  private passTags(e: Entity): boolean {
    if (this.opts.withTags.length === 0 && this.opts.withoutTags.length === 0) return true;

    const bits = this.world.getEntityTagBits(e);
    if (!bits) {
      // Entity has no tags but withTags is required
      return this.opts.withTags.length === 0;
    }

    // Check required tags
    for (const t of this.opts.withTags) {
      const i = this.world.getTagMaskManager().getBitIndex(t);
      if (!bits.hasBit(i)) return false;
    }

    // Check excluded tags
    for (const t of this.opts.withoutTags) {
      const i = this.world.getTagMaskManager().getBitIndex(t);
      if (bits.hasBit(i)) return false;
    }
    return true;
  }

  /**
   * Iterate over matching entities with component data
   * 遍历匹配的实体及其组件数据
   */
  forEach(cb: (e: Entity, ...args: Ts) => void) {
    this.world._enterIteration();
    try {
      for (const p of this.plan) {
        const n = p.arch.length();
        for (let row = 0; row < n; row++) {
          const e = p.arch.entityAt(row);

          if (!this.passTags(e)) continue;
          if (!this.rowPassChanged(p, row)) continue;

          const args: unknown[] = [];

          // Extract component data based on access mode
          for (let i = 0; i < p.cols.length; i++) {
            const col = p.cols[i];
            let val: unknown;
            switch (this.opts.mode) {
              case 'view':
                // Use the same logic as the old Query system for component references
                val = getComponentFromColumn(col, row);
                break;
              case 'handle':
                val = makeHandle(col, row, () => this.world.epoch());
                break;
              case 'snapshot':
              default:
                val = col.readToObject(row);
                break;
            }
            args.push(val);
          }

          cb(e, ...(args as Ts));
        }
      }
    } finally {
      this.world._leaveIteration();
    }
  }


  /**
   * Check if entity matches query requirements (for delta tracking)
   * 检查实体是否匹配查询要求（用于增量跟踪）
   */
  _matchesEntity(e: Entity): boolean {
    const arch = (this.world as any).entityArchetype?.get(e) as Archetype | undefined;
    if (!arch) return false;
    if (!this.typeIds.every(id => arch.types.includes(id))) return false;
    return this.passTags(e);
  }

  /** Internal method for delta tracking 内部方法用于增量跟踪 */
  _notifyEntityAdded(e: Entity)   { this.pendingAdded.push(e); }
  /** Internal method for delta tracking 内部方法用于增量跟踪 */
  _notifyEntityRemoved(e: Entity) { this.pendingRemoved.push(e); }
  /** Internal method for delta tracking 内部方法用于增量跟踪 */
  _notifyEntityChanged(e: Entity) { this.pendingChanged.push(e); }

  /**
   * Count matching entities
   * 计算匹配的实体数量
   */
  count(): number {
    let total = 0;
    this.forEach(() => { total++; });
    return total;
  }

  /**
   * Check if any entity matches predicate
   * 检查是否有实体匹配谓词
   */
  some(predicate?: (entity: Entity, ...components: Ts) => boolean): boolean {
    let found = false;
    try {
      this.forEach((entity, ...components) => {
        if (!predicate || predicate(entity, ...components)) {
          found = true;
          throw new Error('EARLY_EXIT');
        }
      });
    } catch (e) {
      if ((e as Error).message === 'EARLY_EXIT') {
        return found;
      }
      throw e;
    }
    return found;
  }

  /**
   * Get first matching entity and components
   * 获取第一个匹配的实体和组件
   */
  first(): [Entity, ...Ts] | undefined {
    let result: [Entity, ...Ts] | undefined;
    try {
      this.forEach((entity, ...components) => {
        result = [entity, ...components] as [Entity, ...Ts];
        throw new Error('EARLY_EXIT');
      });
    } catch (e) {
      if ((e as Error).message !== 'EARLY_EXIT') {
        throw e;
      }
    }
    return result;
  }

  /**
   * Convert query results to array
   * 将查询结果转换为数组
   */
  toArray(): Array<[Entity, ...Ts]> {
    const results: Array<[Entity, ...Ts]> = [];
    this.forEach((entity, ...components) => {
      results.push([entity, ...components] as [Entity, ...Ts]);
    });
    return results;
  }

  /**
   * Map query results with transformer function
   * 使用转换函数映射查询结果
   */
  map<R>(mapper: (entity: Entity, ...components: Ts) => R): R[] {
    const results: R[] = [];
    this.forEach((entity, ...components) => {
      results.push(mapper(entity, ...components));
    });
    return results;
  }

}

/**
 * Get component reference from column with proper type handling
 * 从列中获取组件引用，使用适当的类型处理
 */
function getComponentFromColumn(col: IColumn, row: number): any {
  // Type-safe access for columns with columnType
  if ('columnType' in col && col.columnType) {
    switch (col.columnType) {
      case ColumnType.ARRAY:
        return (col as IArrayColumn).getData()[row];
      case ColumnType.OBJECT:
        return col.readToObject(row);
      case ColumnType.SAB:
        return col.readToObject(row);
      default:
        return col.readToObject(row);
    }
  }

  // Fallback for columns without columnType
  if ('getData' in col && typeof (col as any).getData === 'function') {
    const data = (col as any).getData();
    return data[row];
  }

  return col.readToObject(row);
}

/**
 * Create component handle for cross-backend get/set operations
 * 创建组件句柄，支持跨后端的get/set操作
 */
function makeHandle(col: IColumn, row: number, epochRef: ()=>number) {
  return {
    get: <T>() => col.readToObject(row) as T,
    set: <T>(next: T, epoch?: number) => col.writeFromObject(row, next as any, epoch ?? epochRef())
  };
}