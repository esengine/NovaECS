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
 * Chunk view for parallel processing
 * 并行处理的分块视图
 */
export interface QueryChunkView {
  /** Archetype identifier 原型标识符 */
  archetypeKey: string;
  /** Entity array for this chunk 此分块的实体数组 */
  entities: Entity[];
  /** Column data arrays for this chunk 此分块的列数据数组 */
  cols: any[][];
  /** Optional column data arrays 可选列数据数组 */
  optionalCols: (any[] | undefined)[] | undefined;
  /** Starting row index in the original archetype 在原始原型中的起始行索引 */
  startRow: number;
  /** Ending row index in the original archetype 在原始原型中的结束行索引 */
  endRow: number;
}

/**
 * Row accessor function type for zero-allocation column access
 * 零分配列访问的行访问器函数类型
 */
type RowAccessor = (row: number) => any;

/**
 * Type guard to check if column supports direct data access
 * 类型守卫检查列是否支持直接数据访问
 */
function hasDirectAccess(col: IColumn): col is IColumn & { getData(): any[] } {
  return 'getData' in col && typeof (col as any).getData === 'function';
}

/**
 * Create row accessor for a column
 * 为列创建行访问器
 */
function createRowAccessor(col: IColumn): RowAccessor {
  if (hasDirectAccess(col)) {
    const data = col.getData();
    return (row: number) => data[row];
  } else {
    return (row: number) => col.readToObject(row);
  }
}

/**
 * Compress sorted row indices into continuous runs
 * 将排序的行索引压缩为连续区间
 * @param sortedIndices 已排序的行索引数组
 * @returns 连续区间数组，每个元素为[start, end)的形式
 */
function compressRuns(sortedIndices: number[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  if (sortedIndices.length === 0) return runs;

  let start = sortedIndices[0];
  let prev = start;

  for (let i = 1; i < sortedIndices.length; i++) {
    const current = sortedIndices[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }

    runs.push([start, prev + 1]);
    start = prev = current;
  }

  runs.push([start, prev + 1]);
  return runs;
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

      // For tag filtering, we can't filter at archetype level since entities in the same
      // archetype can have different tags. We need to include all archetypes and filter at row level.
      // For other types of queries (no tags), we can use the more efficient archetype-level filtering.
      if (this.requireTags.length === 0 && this.forbidTags.length === 0) {
        // No tag filtering - use original efficient archetype-level filtering
        // (This preserves the original behavior for non-tag queries)
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
      } else {
        // Tag filtering required - include all archetypes and filter at row level
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
    const rows = new Set<number>();
    const need = this.changedMask; // 与 required 对齐

    // 语义：默认"任一列 changed 即命中"（ANY）
    for (let i = 0; i < need.length; i++) {
      if (!need[i]) continue;
      const col = cols[i];

      // 优先尝试位集扫描（零拷贝，适用于SAB写掩码）
      const mask = col.getWriteMask?.();
      if (mask) {
        // 位集扫描：把置位行加入 rows
        for (let b = 0; b < mask.length; b++) {
          let byte = mask[b];
          while (byte) {
            const lsb = byte & -byte;
            const bit = Math.log2(lsb) | 0;
            const row = (b << 3) + bit;
            if (row < arch.entities.length) rows.add(row);
            byte &= byte - 1;
          }
        }
        continue;
      }

      // 其次尝试按行时代/帧号检测
      const epochs = col.getRowEpochs?.();
      if (epochs) {
        const cur = this.world.epoch();
        for (let r = 0, n = arch.entities.length; r < n; r++) {
          if (epochs[r] === cur) rows.add(r);
        }
        continue;
      }

      // 回退：未知后端，保守全行
      for (let r = 0, n = arch.entities.length; r < n; r++) {
        rows.add(r);
      }
    }

    return rows;
  }

  /**
   * Zero-allocation raw column iteration
   * 零分配原始列遍历
   */
  forEachRaw(callback: (row: number, entities: Entity[], accessors: RowAccessor[], optionalAccessors?: (RowAccessor | undefined)[]) => void): void {
    if (this.required.length === 0) return;

    if (this.useArchetype && this.requireTags.length === 0 && this.forbidTags.length === 0) {
      this.forEachArchetypeRaw(callback);
    } else {
      // Sparse store path: convert to single-entity semantics
      this.forEachSparseStore((entity, ...components) => {
        // Create single-entity accessors for forEachRaw interface
        const accessors: RowAccessor[] = components.slice(0, this.required.length).map(comp => () => comp);
        const optionalAccessors: (RowAccessor | undefined)[] | undefined =
          this.optionalTypes.length > 0 ?
            components.slice(this.required.length).map(comp => comp !== undefined ? () => comp : undefined) : undefined;

        callback(0, [entity], accessors, optionalAccessors);
      });
    }
  }

  /**
   * Iterate over matching entities with their components
   * 遍历匹配的实体及其组件
   */
  forEach(callback: (entity: Entity, ...components: ReqTuple) => void): void {
    if (this.required.length === 0) return;

    if (this.useArchetype && this.requireTags.length === 0 && this.forbidTags.length === 0) {
      // Use archetype path with forEachRaw
      this.forEachRaw((row: number, entities: Entity[], accessors: RowAccessor[], optionalAccessors?: (RowAccessor | undefined)[]) => {
        const entity = entities[row];

        // Extract required components using accessors
        const requiredComponents = accessors.map(accessor => accessor(row));

        // Extract optional components using accessors
        const optionalComponents = optionalAccessors ?
          optionalAccessors.map(accessor => accessor ? accessor(row) : undefined) : [];

        // Combine required and optional components
        const allComponents = [...requiredComponents, ...optionalComponents];

        callback(entity, ...allComponents as ReqTuple);
      });
    } else {
      // Use sparse store path with direct entity callback
      this.forEachSparseStore(callback);
    }
  }

  /**
   * Raw archetype iteration
   * 原始原型迭代
   */
  private forEachArchetypeRaw(callback: (row: number, entities: Entity[], accessors: RowAccessor[], optionalAccessors?: (RowAccessor | undefined)[]) => void): void {
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

        // Create row accessors for zero-allocation access
        const accessors: RowAccessor[] = cols.map(createRowAccessor);

        // Create optional column accessors
        const optionalAccessors: (RowAccessor | undefined)[] | undefined = optionalCols.length > 0 ?
          optionalCols.map(col => col ? createRowAccessor(col) : undefined) : undefined;

        // Determine which rows to iterate
        const rowsToProcess = changedRows || new Set(Array.from({length: ents.length}, (_, i) => i));

        // Process rows
        for (const row of rowsToProcess) {
          if (row >= ents.length) continue;

          const entity = ents[row];

          // Check entity is alive and enabled (same as QueryArchetypeAdapter)
          if (!this.world.isAlive(entity) || !this.world.isEnabled(entity)) {
            continue;
          }

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

          callback(row, ents, accessors, optionalAccessors);
        }
      }
    } finally {
      this.world._leaveIteration();
    }
  }


  /**
   * Sparse store iteration with direct per-entity callback
   * 稀疏存储迭代，直接的单实体回调
   */
  private forEachSparseStore(callback: (entity: Entity, ...components: ReqTuple) => void): void {
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
      anchorStore.forEach((entity, _anchorValue) => {
        // Check entity is alive and enabled
        if (!this.world.isAlive(entity) || !this.world.isEnabled(entity)) {
          return;
        }

        // Check required components and collect instances
        const requiredComponents: unknown[] = new Array(this.required.length);
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
          requiredComponents[i] = value;
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
        const optionalComponents: (unknown | undefined)[] = [];
        for (let i = 0; i < this.optionalTypes.length; i++) {
          const type = this.optionalTypes[i];
          const store = this.world.getStore(type);
          optionalComponents[i] = store ? store.get(entity) : undefined;
        }

        // Combine components and call callback directly
        const allComponents = [...requiredComponents, ...optionalComponents];
        callback(entity, ...allComponents as ReqTuple);
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
      this.forEachRaw((row: number, entities: Entity[], accessors: RowAccessor[], optionalAccessors?: (RowAccessor | undefined)[]) => {
        const entity = entities[row];
        const requiredComponents = accessors.map(accessor => accessor(row));
        const optionalComponents = optionalAccessors ?
          optionalAccessors.map(accessor => accessor ? accessor(row) : undefined) : [];
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
      this.forEachRaw((row: number, entities: Entity[], accessors: RowAccessor[], optionalAccessors?: (RowAccessor | undefined)[]) => {
        const entity = entities[row];
        const requiredComponents = accessors.map(accessor => accessor(row));
        const optionalComponents = optionalAccessors ?
          optionalAccessors.map(accessor => accessor ? accessor(row) : undefined) : [];
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

  // ================== Parallel Processing ==================
  // 并行处理

  /**
   * Generate chunk views for parallel processing
   * 生成并行处理的分块视图
   */
  toChunks(targetChunkSize: number = 4096): QueryChunkView[] {
    if (this.required.length === 0) return [];

    this.rebuildPlanIfNeeded();
    const plan = this.plan;
    if (!plan || plan.entries.length === 0) return [];

    const chunks: QueryChunkView[] = [];

    for (const entry of plan.entries) {
      const { arch, ents, cols, optionalCols, changedRows } = entry;

      // Determine which rows to process
      const rowsToProcess = changedRows || new Set(Array.from({length: ents.length}, (_, i) => i));
      let rowIndices = Array.from(rowsToProcess).filter(row => row < ents.length);

      // Build tag masks if needed for filtering
      this.buildTagMasksIfNeeded();

      // Apply entity state and tag filtering
      rowIndices = rowIndices.filter(row => {
        const entity = ents[row];

        // Check entity is alive and enabled (same as QueryArchetypeAdapter)
        if (!this.world.isAlive(entity) || !this.world.isEnabled(entity)) {
          return false;
        }

        // Fast tag filtering using bit sets (consistent with forEachArchetypeRaw)
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
      });

      if (rowIndices.length === 0) continue;

      // Sort row indices for run compression
      rowIndices.sort((a, b) => a - b);

      // Compress into continuous runs
      const runs = compressRuns(rowIndices);

      // Get archetype key for identification
      const archetypeKey = `arch_${arch.types.join('_')}`;

      // Process each continuous run
      for (const [runStart, runEnd] of runs) {
        // Split large runs into chunks of targetChunkSize
        for (let chunkStart = runStart; chunkStart < runEnd; chunkStart += targetChunkSize) {
          const chunkEnd = Math.min(chunkStart + targetChunkSize, runEnd);

          // Generate continuous row indices for this chunk
          const chunkRowIndices: number[] = [];
          for (let row = chunkStart; row < chunkEnd; row++) {
            chunkRowIndices.push(row);
          }

          // Extract entities for this chunk
          const chunkEntities = chunkRowIndices.map(row => ents[row]);

          // Extract column data for this chunk
          const chunkCols: any[][] = [];
          for (let colIndex = 0; colIndex < cols.length; colIndex++) {
            const col = cols[colIndex];

            // Use buildSliceDescriptor for zero-copy slice
            chunkCols[colIndex] = col.buildSliceDescriptor(chunkStart, chunkEnd);
          }

          // Extract optional column data for this chunk
          let chunkOptionalCols: (any[] | undefined)[] | undefined;
          if (optionalCols && optionalCols.length > 0) {
            chunkOptionalCols = [];
            for (let colIndex = 0; colIndex < optionalCols.length; colIndex++) {
              const col = optionalCols[colIndex];

              if (!col) {
                chunkOptionalCols[colIndex] = undefined;
                continue;
              }

              // Use buildSliceDescriptor for zero-copy slice
              chunkOptionalCols[colIndex] = col.buildSliceDescriptor(chunkStart, chunkEnd);
            }
          }

          chunks.push({
            archetypeKey,
            entities: chunkEntities,
            cols: chunkCols,
            optionalCols: chunkOptionalCols,
            startRow: chunkStart,
            endRow: chunkEnd
          });
        }
      }
    }

    return chunks;
  }

}