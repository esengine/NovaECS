/**
 * Query system for component-based entity filtering and iteration
 * 基于组件的实体过滤和遍历查询系统
 */

import { World } from './World';
import { ComponentType, ComponentCtor, getComponentType } from './ComponentRegistry';
import { Entity } from '../utils/Types';
import type { Archetype } from '../archetype/Archetype';
import type { IColumn } from '../storage/IColumn';
import { TagBitSet } from './TagBitSet';
// import type { IComponentStore } from './SparseSetStore';

/**
 * Query delta containing incremental changes
 * 包含增量变化的查询增量
 */
export interface QueryDelta {
  /** Entities added to query results 新增到查询结果的实体 */
  added: Entity[];
  /** Entities removed from query results 从查询结果移除的实体 */
  removed: Entity[];
  /** Entities with changed components 组件发生变化的实体 */
  changed: Entity[];
}

/**
 * Type guard to check if column supports direct data access
 * 类型守卫检查列是否支持直接数据访问
 */
function hasDirectAccess(col: IColumn): col is IColumn & { getData(): any[] } {
  return 'getData' in col && typeof (col as any).getData === 'function';
}


/**
 * Precompiled query plan for archetype optimization
 * 预编译查询计划用于原型优化
 */
interface QueryPlan {
  archVer: number;
  entries: Array<{
    arch: Archetype;
    ents: Entity[];
    cols: IColumn[];
    optionalCols: (IColumn | undefined)[];
    changedRows?: Set<number>;
  }>;
}

/**
 * Query builder for component-based entity iteration
 * 基于组件的实体遍历查询构建器
 */
export class Query<ReqTuple extends unknown[] = unknown[]> {
  private required: ComponentType<unknown>[];
  private withoutTypes: ComponentType<unknown>[] = [];
  private optionalTypes: ComponentType<unknown>[] = [];
  private requireTags: string[] = [];
  private forbidTags: string[] = [];
  private useArchetype = true;

  private changedMask: boolean[] = [];
  private plan?: QueryPlan;
  private lastPlanDirty = true;

  // Tag bit set caching for performance
  // 标签位集缓存用于性能优化
  private requiredTagMask: TagBitSet | undefined;
  private forbiddenTagMask: TagBitSet | undefined;
  private tagMasksDirty = true;

  // Delta subscription for incremental updates
  // 增量订阅用于增量更新
  private deltaEnabled = false;
  private delta?: QueryDelta;

  constructor(private world: World, required: ComponentType<unknown>[]) {
    this.required = required;
  }

  /**
   * Filter: exclude entities that have these components
   * 过滤：排除含有这些组件的实体
   */
  without<T>(...ctors: ComponentCtor<T>[]): Query<ReqTuple> {
    this.withoutTypes.push(...ctors.map(getComponentType));
    this.markPlanDirty();
    return this;
  }

  /**
   * Filter by tags: require all specified tags and forbid any of the forbidden tags
   * 标签过滤：要求所有指定标签并禁止任何被禁止的标签
   */
  where(requireAll: string[] = [], forbidAny: string[] = []): Query<ReqTuple> {
    this.requireTags = requireAll;
    this.forbidTags = forbidAny;
    this.tagMasksDirty = true;
    this.markPlanDirty();
    return this;
  }

  /**
   * Add optional components (callback receives undefined if not present)
   * 添加可选组件（如果不存在则回调接收undefined）
   */
  optional<T>(...ctors: ComponentCtor<T>[]): Query<ReqTuple> {
    this.optionalTypes.push(...ctors.map(getComponentType));
    this.markPlanDirty();
    return this;
  }

  /**
   * Only iterate entities where specified components changed this frame
   * 仅迭代指定组件在本帧发生变化的实体
   */
  changed<T>(...ctors: ComponentCtor<T>[]): Query<ReqTuple> {
    const changedIds = new Set(ctors.map(getComponentType).map(t => t.id));
    this.changedMask = this.required.map(t => changedIds.has(t.id));
    this.markPlanDirty();
    return this;
  }

  /**
   * Control whether to use archetype optimization (default: true)
   * 控制是否使用archetype优化（默认：true）
   */
  useArchetypeOptimization(enabled: boolean): Query<ReqTuple> {
    this.useArchetype = enabled;
    this.lastPlanDirty = true;
    return this;
  }

  /**
   * Enable delta subscription for incremental updates
   * 启用增量订阅以获取增量更新
   */
  enableDelta(): Query<ReqTuple> {
    if (!this.deltaEnabled) {
      this.deltaEnabled = true;
      this.delta = { added: [], removed: [], changed: [] };

      // 向 World 注册此查询用于增量更新通知
      this.world.registerQueryForDelta(this);
    }
    return this;
  }

  /**
   * Consume and clear accumulated delta
   * 消费并清空累积的增量
   */
  consumeDelta(): QueryDelta {
    if (!this.deltaEnabled) {
      return { added: [], removed: [], changed: [] };
    }

    const result = this.delta ?? { added: [], removed: [], changed: [] };
    this.delta = { added: [], removed: [], changed: [] };
    return result;
  }

  /**
   * Check if delta subscription is enabled
   * 检查是否启用了增量订阅
   */
  isDeltaEnabled(): boolean {
    return this.deltaEnabled;
  }

  /**
   * Internal method to notify about entity additions
   * 内部方法用于通知实体添加
   */
  _notifyEntityAdded(entity: Entity): void {
    if (this.deltaEnabled && this.delta) {
      this.delta.added.push(entity);
    }
  }

  /**
   * Internal method to notify about entity removals
   * 内部方法用于通知实体移除
   */
  _notifyEntityRemoved(entity: Entity): void {
    if (this.deltaEnabled && this.delta) {
      this.delta.removed.push(entity);
    }
  }

  /**
   * Internal method to notify about entity changes
   * 内部方法用于通知实体变更
   */
  _notifyEntityChanged(entity: Entity): void {
    if (this.deltaEnabled && this.delta) {
      this.delta.changed.push(entity);
    }
  }

  /**
   * Check if an entity matches this query's requirements
   * 检查实体是否匹配此查询的要求
   */
  _matchesEntity(entity: Entity): boolean {
    // Check required components
    for (const type of this.required) {
      const store = this.world.getStore(type);
      if (!store || !store.has(entity)) {
        return false;
      }
    }

    // Check without components
    for (const type of this.withoutTypes) {
      const store = this.world.getStore(type);
      if (store && store.has(entity)) {
        return false;
      }
    }

    // Check tag requirements using bit sets
    this.buildTagMasksIfNeeded();

    if (this.requiredTagMask || this.forbiddenTagMask) {
      const entityBits = this.world.getEntityTagBits(entity);

      // Check required tags
      if (this.requiredTagMask && (!entityBits || !entityBits.containsAll(this.requiredTagMask))) {
        return false;
      }

      // Check forbidden tags
      if (this.forbiddenTagMask && entityBits && entityBits.hasAny(this.forbiddenTagMask)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Mark query plan as dirty
   * 标记查询计划为脏
   */
  private markPlanDirty(): void {
    this.lastPlanDirty = true;
  }

  /**
   * Build tag masks if dirty
   * 如果脏则构建标签掩码
   */
  private buildTagMasksIfNeeded(): void {
    if (!this.tagMasksDirty) {
      return;
    }

    this.requiredTagMask = this.requireTags.length > 0
      ? this.world.createTagMask(this.requireTags)
      : undefined;

    this.forbiddenTagMask = this.forbidTags.length > 0
      ? this.world.createTagMask(this.forbidTags)
      : undefined;

    this.tagMasksDirty = false;
  }

  /**
   * Rebuild query plan if needed
   * 如需要则重建查询计划
   */
  private rebuildPlanIfNeeded(): void {
    const archVer = this.world.getArchetypeIndex().version();
    if (!this.lastPlanDirty && this.plan && this.plan.archVer === archVer) {
      return;
    }

    const reqIds = this.required.map(t => t.id);
    const woutSet = new Set(this.withoutTypes.map(t => t.id));
    const optIds = this.optionalTypes.map(t => t.id);

    const entries: Array<{
      arch: Archetype;
      ents: Entity[];
      cols: IColumn[];
      optionalCols: (IColumn | undefined)[];
      changedRows?: Set<number>;
    }> = [];

    for (const arch of this.world.getArchetypeIndex().getAll()) {
      // Required components must exist
      if (!reqIds.every(id => arch.types.includes(id))) continue;

      // Without components must not exist
      if (arch.types.some((id: number) => woutSet.has(id))) continue;

      // Get required columns
      const cols = reqIds.map(id => arch.cols.get(id)!);

      // Get optional columns (may be undefined)
      const optionalCols = optIds.map(id => arch.cols.get(id) || undefined);

      // Build changed rows set if needed
      let changedRows: Set<number> | undefined;
      if (this.changedMask.some(mask => mask)) {
        changedRows = this.buildChangedRowsSet(arch, cols);
      }

      // Only include if tags match
      if (this.requireTags.length === 0 && this.forbidTags.length === 0) {
        const entry: typeof entries[0] = {
          arch,
          ents: arch.entities,
          cols,
          optionalCols
        };
        if (changedRows !== undefined) {
          entry.changedRows = changedRows;
        }
        entries.push(entry);
      }
    }

    this.plan = { archVer, entries };
    this.lastPlanDirty = false;
  }

  /**
   * Build set of rows that have changed components
   * 构建包含变更组件的行集合
   */
  private buildChangedRowsSet(arch: Archetype, cols: IColumn[]): Set<number> {
    const changedRows = new Set<number>();

    // For each required component that has changed mask
    for (let i = 0; i < this.changedMask.length; i++) {
      if (!this.changedMask[i]) continue;

      // TODO: Get changed rows from column's change tracking
      // const col = cols[i]; // Will be used when implementing real change detection
      // For now, return all rows as a fallback
      for (let row = 0; row < arch.entities.length; row++) {
        changedRows.add(row);
      }
    }

    // Prevent unused parameter warning - cols will be used in actual implementation
    void cols;
    return changedRows;
  }

  /**
   * Zero-allocation raw column iteration
   * 零分配原始列遍历
   */
  forEachRaw(callback: (row: number, entities: Entity[], cols: any[][], optionalCols?: (any[] | undefined)[]) => void): void {
    if (this.required.length === 0) return;

    if (this.useArchetype && this.requireTags.length === 0 && this.forbidTags.length === 0) {
      this.forEachArchetypeRaw(callback);
    } else {
      this.forEachSparseStoreRaw(callback);
    }
  }

  /**
   * Iterate over matching entities with their components
   * 遍历匹配的实体及其组件
   */
  forEach(callback: (entity: Entity, ...components: ReqTuple) => void): void {
    if (this.required.length === 0) return;

    this.forEachRaw((row: number, entities: Entity[], cols: any[][], optionalCols?: (any[] | undefined)[]) => {
      const entity = entities[row];

      // Extract required components
      const requiredComponents = cols.map(col => col[row]);

      // Extract optional components
      const optionalComponents = optionalCols ?
        optionalCols.map(col => col ? col[row] : undefined) : [];

      // Combine required and optional components
      const allComponents = [...requiredComponents, ...optionalComponents];

      callback(entity, ...allComponents as ReqTuple);
    });
  }

  /**
   * Raw archetype iteration
   * 原始原型迭代
   */
  private forEachArchetypeRaw(callback: (row: number, entities: Entity[], cols: any[][], optionalCols?: (any[] | undefined)[]) => void): void {
    this.rebuildPlanIfNeeded();
    this.buildTagMasksIfNeeded();
    const plan = this.plan;

    if (!plan || plan.entries.length === 0) {
      return;
    }

    this.world._enterIteration();
    try {
      for (const entry of plan.entries) {
        const { ents, cols, optionalCols, changedRows } = entry;

        // Convert IColumn to raw data arrays for zero-allocation access
        const rawCols: any[][] = cols.map(col => {
          if (hasDirectAccess(col)) {
            return col.getData();
          } else {
            const length = col.length();
            const rawData: any[] = new Array(length);
            for (let i = 0; i < length; i++) {
              rawData[i] = col.readToObject(i);
            }
            return rawData;
          }
        });

        // Convert optional columns
        const rawOptionalCols: (any[] | undefined)[] | undefined = optionalCols.length > 0 ?
          optionalCols.map(col => {
            if (!col) return undefined;
            if (hasDirectAccess(col)) {
              return col.getData();
            } else {
              const length = col.length();
              const rawData: any[] = new Array(length);
              for (let i = 0; i < length; i++) {
                rawData[i] = col.readToObject(i);
              }
              return rawData;
            }
          }) : undefined;

        // Determine which rows to iterate
        const rowsToProcess = changedRows || new Set(Array.from({length: ents.length}, (_, i) => i));

        // Process rows
        for (const row of rowsToProcess) {
          if (row >= ents.length) continue;

          const entity = ents[row];

          // Fast tag filtering using bit sets
          if (this.requiredTagMask || this.forbiddenTagMask) {
            const entityBits = this.world.getEntityTagBits(entity);

            // Check required tags
            if (this.requiredTagMask && (!entityBits || !entityBits.containsAll(this.requiredTagMask))) {
              continue;
            }

            // Check forbidden tags
            if (this.forbiddenTagMask && entityBits && entityBits.hasAny(this.forbiddenTagMask)) {
              continue;
            }
          }

          callback(row, ents, rawCols, rawOptionalCols);
        }
      }
    } finally {
      this.world._leaveIteration();
    }
  }


  /**
   * Raw sparse store iteration
   * 原始稀疏存储迭代
   */
  private forEachSparseStoreRaw(callback: (row: number, entities: Entity[], cols: any[][], optionalCols?: (any[] | undefined)[]) => void): void {
    this.buildTagMasksIfNeeded();

    let anchorType = this.required[0];
    let anchorStore = this.world.getStore(anchorType);
    let anchorSize = anchorStore?.size() ?? 0;

    for (let i = 1; i < this.required.length; i++) {
      const store = this.world.getStore(this.required[i]);
      const size = store?.size() ?? 0;
      if (size < anchorSize) {
        anchorType = this.required[i];
        anchorStore = store;
        anchorSize = size;
      }
    }

    if (!anchorStore || anchorStore.size() === 0) return;

    this.world._enterIteration();
    try {
      const tempEntities: Entity[] = [];
      const tempCols: any[][] = [];
      const tempOptionalCols: (any[] | undefined)[] = [];

      // Pre-allocate columns for reuse
      for (let i = 0; i < this.required.length; i++) {
        tempCols[i] = [];
      }

      for (let i = 0; i < this.optionalTypes.length; i++) {
        tempOptionalCols[i] = [];
      }

      anchorStore.forEach((entity, _anchorValue) => {
        // Check required components and collect instances
        const values: unknown[] = new Array(this.required.length);
        let hasAll = true;

        for (let i = 0; i < this.required.length; i++) {
          const type = this.required[i];
          const store = this.world.getStore(type);
          if (!store) {
            hasAll = false;
            break;
          }
          const value = store.get(entity);
          if (value === undefined) {
            hasAll = false;
            break;
          }
          values[i] = value;
        }

        if (!hasAll) return;

        // Check if this entity should be included based on changed mask
        if (this.changedMask.some(mask => mask)) {
          // TODO: Implement change detection for sparse stores
          // For now, include all entities as a fallback
        }

        // Apply without filter
        for (let i = 0; i < this.withoutTypes.length; i++) {
          const type = this.withoutTypes[i];
          const store = this.world.getStore(type);
          if (store && store.has(entity)) return;
        }

        // Fast tag filtering using bit sets
        if (this.requiredTagMask || this.forbiddenTagMask) {
          const entityBits = this.world.getEntityTagBits(entity);

          // Check required tags
          if (this.requiredTagMask && (!entityBits || !entityBits.containsAll(this.requiredTagMask))) {
            return;
          }

          // Check forbidden tags
          if (this.forbiddenTagMask && entityBits && entityBits.hasAny(this.forbiddenTagMask)) {
            return;
          }
        }

        // Collect optional components
        const optionalValues: (unknown | undefined)[] = [];
        for (let i = 0; i < this.optionalTypes.length; i++) {
          const type = this.optionalTypes[i];
          const store = this.world.getStore(type);
          optionalValues[i] = store ? store.get(entity) : undefined;
        }

        // Add to temporary arrays
        tempEntities[0] = entity;
        for (let i = 0; i < values.length; i++) {
          tempCols[i][0] = values[i];
        }

        for (let i = 0; i < optionalValues.length; i++) {
          if (tempOptionalCols[i]) {
            tempOptionalCols[i]![0] = optionalValues[i];
          }
        }

        // Call callback with single entity batch
        callback(0, tempEntities, tempCols, this.optionalTypes.length > 0 ? tempOptionalCols : undefined);
      });
    } finally {
      this.world._leaveIteration();
    }
  }

  // ================== Convenience APIs ==================
  // 便利API

  /**
   * Count matching entities (fast path for simple counting)
   * 计算匹配实体数量（简单计数的快路径）
   */
  count(): number {
    if (this.required.length === 0) return 0;

    // Fast path: no filtering, just sum entity counts from plan
    if (this.changedMask.every(mask => !mask) &&
        this.requireTags.length === 0 &&
        this.forbidTags.length === 0) {

      this.rebuildPlanIfNeeded();
      const plan = this.plan;
      if (!plan || plan.entries.length === 0) return 0;

      return plan.entries.reduce((total, entry) => total + entry.ents.length, 0);
    }

    // Slow path: count with filtering
    let count = 0;
    this.forEachRaw(() => count++);
    return count;
  }

  /**
   * Check if any entities match the query (optionally with predicate)
   * 检查是否有实体匹配查询（可选谓词函数）
   */
  some(predicate?: (entity: Entity, ...components: ReqTuple) => boolean): boolean {
    if (this.required.length === 0) return false;

    let found = false;

    // Use try-catch for early exit
    try {
      this.forEachRaw((row: number, entities: Entity[], cols: any[][], optionalCols?: (any[] | undefined)[]) => {
        const entity = entities[row];
        const requiredComponents = cols.map(col => col[row]);
        const optionalComponents = optionalCols ?
          optionalCols.map(col => col ? col[row] : undefined) : [];
        const allComponents = [...requiredComponents, ...optionalComponents];

        if (!predicate || predicate(entity, ...allComponents as ReqTuple)) {
          found = true;
          throw new Error('EARLY_EXIT'); // Use exception for early exit
        }
      });
    } catch (e) {
      if ((e as Error).message !== 'EARLY_EXIT') {
        throw e;
      }
    }

    return found;
  }

  /**
   * Get the first matching entity and its components
   * 获取第一个匹配的实体及其组件
   */
  first(): [Entity, ...ReqTuple] | undefined {
    if (this.required.length === 0) return undefined;

    let result: [Entity, ...ReqTuple] | undefined;

    // Use try-catch for early exit
    try {
      this.forEachRaw((row: number, entities: Entity[], cols: any[][], optionalCols?: (any[] | undefined)[]) => {
        const entity = entities[row];
        const requiredComponents = cols.map(col => col[row]);
        const optionalComponents = optionalCols ?
          optionalCols.map(col => col ? col[row] : undefined) : [];
        const allComponents = [...requiredComponents, ...optionalComponents];

        result = [entity, ...allComponents] as [Entity, ...ReqTuple];
        throw new Error('EARLY_EXIT'); // Use exception for early exit
      });
    } catch (e) {
      if ((e as Error).message !== 'EARLY_EXIT') {
        throw e;
      }
    }

    return result;
  }

  /**
   * Map query results to an array (materialize for dev tools/debugging)
   * 将查询结果映射为数组（物化用于开发工具/调试）
   */
  map<R>(mapper: (entity: Entity, ...components: ReqTuple) => R): R[] {
    const results: R[] = [];
    this.forEach((entity, ...components) => {
      results.push(mapper(entity, ...components));
    });
    return results;
  }

  /**
   * Collect all matching entities into an array
   * 收集所有匹配的实体到数组中
   */
  toArray(): Array<[Entity, ...ReqTuple]> {
    return this.map((entity, ...components) => [entity, ...components] as [Entity, ...ReqTuple]);
  }

}