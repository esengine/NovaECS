import type { ComponentType } from '../utils/Types';
import type { Entity } from './Entity';
import type {
  IQueryBuilder,
  QueryCriteria,
  QueryOptions,
  QueryResult
} from '../utils/QueryTypes';

/**
 * Query builder for fluent query API
 * 查询构建器，提供流畅的查询API
 * 
 * @example
 * ```typescript
 * const entities = world.query()
 *   .with(PositionComponent, VelocityComponent)
 *   .without(DeadComponent)
 *   .limit(10)
 *   .execute();
 * 
 * const result = world.query()
 *   .any(SpriteComponent, MeshComponent)
 *   .filter(entity => entity.getComponent(HealthComponent)?.current > 0)
 *   .executeWithMetadata();
 * ```
 */
export class QueryBuilder implements IQueryBuilder {
  private _criteria: QueryCriteria = {};
  private _options: QueryOptions = {};
  private _executeQuery: (criteria: QueryCriteria, options?: QueryOptions) => QueryResult;

  constructor(executeQuery: (criteria: QueryCriteria, options?: QueryOptions) => QueryResult) {
    this._executeQuery = executeQuery;
  }

  /**
   * Add required components (AND logic)
   * 添加必需组件（AND逻辑）
   * @param componentTypes Component types that entities must have 实体必须拥有的组件类型
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  with(...componentTypes: ComponentType[]): IQueryBuilder {
    if (!this._criteria.all) {
      this._criteria.all = [];
    }
    this._criteria.all.push(...componentTypes);
    return this;
  }

  /**
   * Add required components (alias for with)
   * 添加必需组件（with的别名）
   * @param componentTypes Component types that entities must have 实体必须拥有的组件类型
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  all(...componentTypes: ComponentType[]): IQueryBuilder {
    return this.with(...componentTypes);
  }

  /**
   * Add optional components (OR logic)
   * 添加可选组件（OR逻辑）
   * @param componentTypes Component types where entities must have at least one 实体必须至少拥有其中一个的组件类型
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  any(...componentTypes: ComponentType[]): IQueryBuilder {
    if (!this._criteria.any) {
      this._criteria.any = [];
    }
    this._criteria.any.push(...componentTypes);
    return this;
  }

  /**
   * Add excluded components (NOT logic)
   * 添加排除组件（NOT逻辑）
   * @param componentTypes Component types that entities must not have 实体不能拥有的组件类型
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  without(...componentTypes: ComponentType[]): IQueryBuilder {
    if (!this._criteria.none) {
      this._criteria.none = [];
    }
    this._criteria.none.push(...componentTypes);
    return this;
  }

  /**
   * Add excluded components (alias for without)
   * 添加排除组件（without的别名）
   * @param componentTypes Component types that entities must not have 实体不能拥有的组件类型
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  none(...componentTypes: ComponentType[]): IQueryBuilder {
    return this.without(...componentTypes);
  }

  /**
   * Add custom filter function
   * 添加自定义过滤函数
   * @param predicate Filter function that returns true for entities to include 过滤函数，对要包含的实体返回true
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  filter(predicate: (entity: Entity) => boolean): IQueryBuilder {
    const existingFilter = this._options.filter;
    if (existingFilter) {
      // Combine filters with AND logic
      this._options.filter = (entity: Entity): boolean => existingFilter(entity) && predicate(entity);
    } else {
      this._options.filter = predicate;
    }
    return this;
  }

  /**
   * Set result limit
   * 设置结果限制
   * @param count Maximum number of entities to return 返回的最大实体数量
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  limit(count: number): IQueryBuilder {
    this._options.limit = Math.floor(count);
    return this;
  }

  /**
   * Set result offset
   * 设置结果偏移
   * @param count Number of entities to skip from the beginning 从开头跳过的实体数量
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  offset(count: number): IQueryBuilder {
    this._options.offset = Math.floor(count);
    return this;
  }

  /**
   * Include inactive entities
   * 包含非活跃实体
   * @param include Whether to include inactive entities in results 是否在结果中包含非活跃实体
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  includeInactive(include = true): IQueryBuilder {
    this._options.includeInactive = include;
    return this;
  }

  /**
   * Enable/disable caching
   * 启用/禁用缓存
   * @param use Whether to use query result caching 是否使用查询结果缓存
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  useCache(use = true): IQueryBuilder {
    this._options.useCache = use;
    return this;
  }

  /**
   * Add sorting function
   * 添加排序函数
   * @param compareFn Comparison function for sorting entities 用于排序实体的比较函数
   * @returns Query builder for method chaining 查询构建器，用于方法链式调用
   */
  sort(compareFn: (a: Entity, b: Entity) => number): IQueryBuilder {
    this._options.sort = compareFn;
    return this;
  }

  /**
   * Execute query and return entities
   * 执行查询并返回实体
   */
  execute(): Entity[] {
    const result = this._executeQuery(this._criteria, this._options);
    return result.entities;
  }

  /**
   * Execute query and return detailed result
   * 执行查询并返回详细结果
   */
  executeWithMetadata(): QueryResult {
    return this._executeQuery(this._criteria, this._options);
  }

  /**
   * Get first matching entity
   * 获取第一个匹配的实体
   */
  first(): Entity | undefined {
    const originalLimit = this._options.limit;
    this._options.limit = 1;

    const result = this._executeQuery(this._criteria, this._options);

    // Restore original limit
    if (originalLimit !== undefined) {
      this._options.limit = originalLimit;
    } else {
      delete this._options.limit;
    }
    
    return result.entities[0];
  }

  /**
   * Check if any entities match
   * 检查是否有实体匹配
   */
  exists(): boolean {
    const originalLimit = this._options.limit;
    this._options.limit = 1;

    const result = this._executeQuery(this._criteria, this._options);

    // Restore original limit
    if (originalLimit !== undefined) {
      this._options.limit = originalLimit;
    } else {
      delete this._options.limit;
    }
    
    return result.entities.length > 0;
  }

  /**
   * Count matching entities
   * 计算匹配的实体数量
   */
  count(): number {
    const result = this._executeQuery(this._criteria, this._options);
    return result.totalCount;
  }

  /**
   * Reset builder to initial state
   * 重置构建器到初始状态
   */
  reset(): IQueryBuilder {
    this._criteria = {};
    this._options = {};
    return this;
  }

  /**
   * Clone this builder
   * 克隆此构建器
   */
  clone(): IQueryBuilder {
    const cloned = new QueryBuilder(this._executeQuery);
    
    // Deep clone criteria
    cloned._criteria = {};
    if (this._criteria.all) {
      cloned._criteria.all = [...this._criteria.all];
    }
    if (this._criteria.any) {
      cloned._criteria.any = [...this._criteria.any];
    }
    if (this._criteria.none) {
      cloned._criteria.none = [...this._criteria.none];
    }
    if (this._criteria.with) {
      cloned._criteria.with = [...this._criteria.with];
    }
    if (this._criteria.without) {
      cloned._criteria.without = [...this._criteria.without];
    }
    
    // Clone options
    cloned._options = { ...this._options };
    
    return cloned;
  }

  /**
   * Get current criteria (for debugging)
   * 获取当前条件（用于调试）
   */
  getCriteria(): QueryCriteria {
    return { ...this._criteria };
  }

  /**
   * Get current options (for debugging)
   * 获取当前选项（用于调试）
   */
  getOptions(): QueryOptions {
    return { ...this._options };
  }

  /**
   * Create a query signature for caching
   * 创建查询签名用于缓存
   */
  getSignature(): string {
    const parts: string[] = [];
    
    if (this._criteria.all?.length) {
      parts.push(`all:${this._criteria.all.map(t => t.name).sort().join(',')}`);
    }
    
    if (this._criteria.any?.length) {
      parts.push(`any:${this._criteria.any.map(t => t.name).sort().join(',')}`);
    }
    
    if (this._criteria.none?.length) {
      parts.push(`none:${this._criteria.none.map(t => t.name).sort().join(',')}`);
    }
    
    if (this._criteria.with?.length) {
      parts.push(`with:${this._criteria.with.map(t => t.name).sort().join(',')}`);
    }
    
    if (this._criteria.without?.length) {
      parts.push(`without:${this._criteria.without.map(t => t.name).sort().join(',')}`);
    }
    
    if (this._options.includeInactive) {
      parts.push('includeInactive:true');
    }
    
    if (this._options.limit !== undefined) {
      parts.push(`limit:${this._options.limit}`);
    }
    
    if (this._options.offset !== undefined) {
      parts.push(`offset:${this._options.offset}`);
    }
    
    // Note: filter and sort functions are not included in signature
    // as they can't be easily serialized
    
    return parts.join('|');
  }

  /**
   * Validate query criteria
   * 验证查询条件
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for conflicting criteria
    const allComponents = new Set([
      ...(this._criteria.all || []),
      ...(this._criteria.with || [])
    ]);
    
    const excludedComponents = new Set([
      ...(this._criteria.none || []),
      ...(this._criteria.without || [])
    ]);
    
    // Check for conflicts between required and excluded
    for (const component of allComponents) {
      if (excludedComponents.has(component)) {
        errors.push(`Component ${component.name} is both required and excluded`);
      }
    }
    
    // Check for empty query
    if (allComponents.size === 0 && 
        (!this._criteria.any || this._criteria.any.length === 0) &&
        !this._options.filter) {
      errors.push('Query must have at least one criteria or filter');
    }
    
    // Check for invalid options
    if (this._options.limit !== undefined && this._options.limit < 0) {
      errors.push('Limit must be non-negative');
    }
    
    if (this._options.offset !== undefined && this._options.offset < 0) {
      errors.push('Offset must be non-negative');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
