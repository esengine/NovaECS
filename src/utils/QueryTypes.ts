/**
 * Enhanced query system type definitions for NovaECS
 * NovaECS增强查询系统类型定义
 */

import type { ComponentType } from './Types';
import type { Entity } from '../core/Entity';

/**
 * Query criteria for entity filtering
 * 实体过滤的查询条件
 */
export interface QueryCriteria {
  /** Components that must be present (AND logic) 必须存在的组件（AND逻辑） */
  all?: ComponentType[];
  /** Components where at least one must be present (OR logic) 至少存在一个的组件（OR逻辑） */
  any?: ComponentType[];
  /** Components that must NOT be present (NOT logic) 必须不存在的组件（NOT逻辑） */
  none?: ComponentType[];
  /** Alias for 'all' - components that must be present 'all'的别名 - 必须存在的组件 */
  with?: ComponentType[];
  /** Alias for 'none' - components that must NOT be present 'none'的别名 - 必须不存在的组件 */
  without?: ComponentType[];
}

/**
 * Query options for performance and behavior control
 * 查询选项，用于性能和行为控制
 */
export interface QueryOptions {
  /** Whether to use caching for this query 是否为此查询使用缓存 */
  useCache?: boolean;
  /** Maximum number of results to return 返回结果的最大数量 */
  limit?: number;
  /** Number of results to skip (for pagination) 跳过的结果数量（用于分页） */
  offset?: number;
  /** Whether to include inactive entities 是否包含非活跃实体 */
  includeInactive?: boolean;
  /** Custom filter function for additional filtering 自定义过滤函数用于额外过滤 */
  filter?: (entity: Entity) => boolean;
  /** Sort function for result ordering 结果排序函数 */
  sort?: (a: Entity, b: Entity) => number;
}

/**
 * Query result with metadata
 * 带有元数据的查询结果
 */
export interface QueryResult {
  /** Matching entities 匹配的实体 */
  entities: Entity[];
  /** Total count before limit/offset 应用limit/offset前的总数 */
  totalCount: number;
  /** Whether result was served from cache 结果是否来自缓存 */
  fromCache: boolean;
  /** Query execution time in milliseconds 查询执行时间（毫秒） */
  executionTime: number;
  /** Number of archetypes checked 检查的原型数量 */
  archetypesChecked: number;
}

/**
 * Query statistics for performance monitoring
 * 查询统计信息用于性能监控
 */
export interface QueryStatistics {
  /** Total number of queries executed 执行的查询总数 */
  totalQueries: number;
  /** Number of cache hits 缓存命中数 */
  cacheHits: number;
  /** Number of cache misses 缓存未命中数 */
  cacheMisses: number;
  /** Average query execution time 平均查询执行时间 */
  averageExecutionTime: number;
  /** Total query execution time 总查询执行时间 */
  totalExecutionTime: number;
  /** Most expensive queries 最耗时的查询 */
  slowestQueries: QueryPerformanceEntry[];
  /** Most frequent queries 最频繁的查询 */
  frequentQueries: QueryFrequencyEntry[];
}

/**
 * Query performance entry for tracking slow queries
 * 查询性能条目用于跟踪慢查询
 */
export interface QueryPerformanceEntry {
  /** Query signature for identification 查询签名用于识别 */
  signature: string;
  /** Execution time in milliseconds 执行时间（毫秒） */
  executionTime: number;
  /** Timestamp when query was executed 查询执行时间戳 */
  timestamp: number;
  /** Query criteria 查询条件 */
  criteria: QueryCriteria;
}

/**
 * Query frequency entry for tracking popular queries
 * 查询频率条目用于跟踪热门查询
 */
export interface QueryFrequencyEntry {
  /** Query signature for identification 查询签名用于识别 */
  signature: string;
  /** Number of times this query was executed 此查询执行次数 */
  count: number;
  /** Average execution time 平均执行时间 */
  averageTime: number;
  /** Query criteria 查询条件 */
  criteria: QueryCriteria;
}

/**
 * Query cache entry
 * 查询缓存条目
 */
export interface QueryCacheEntry {
  /** Cached entities 缓存的实体 */
  entities: Entity[];
  /** Cache creation timestamp 缓存创建时间戳 */
  timestamp: number;
  /** Number of times this cache entry was used 此缓存条目使用次数 */
  hitCount: number;
  /** Query signature 查询签名 */
  signature: string;
}

/**
 * Query cache configuration
 * 查询缓存配置
 */
export interface QueryCacheConfig {
  /** Maximum number of cached queries 最大缓存查询数 */
  maxSize: number;
  /** Cache entry TTL in milliseconds 缓存条目TTL（毫秒） */
  ttl: number;
  /** Whether to enable automatic cache invalidation 是否启用自动缓存失效 */
  autoInvalidate: boolean;
  /** Cache eviction strategy 缓存淘汰策略 */
  evictionStrategy: 'lru' | 'lfu' | 'ttl';
}

/**
 * Query builder interface for fluent API
 * 查询构建器接口用于流畅API
 */
export interface IQueryBuilder {
  /**
   * Add required components (AND logic) 添加必需组件（AND逻辑）
   * @param componentTypes Component types that entities must have 实体必须拥有的组件类型
   */
  with(...componentTypes: ComponentType[]): IQueryBuilder;
  /**
   * Add required components (alias for with) 添加必需组件（with的别名）
   * @param componentTypes Component types that entities must have 实体必须拥有的组件类型
   */
  all(...componentTypes: ComponentType[]): IQueryBuilder;
  /**
   * Add optional components (OR logic) 添加可选组件（OR逻辑）
   * @param componentTypes Component types where entities must have at least one 实体必须至少拥有其中一个的组件类型
   */
  any(...componentTypes: ComponentType[]): IQueryBuilder;
  /**
   * Add excluded components (NOT logic) 添加排除组件（NOT逻辑）
   * @param componentTypes Component types that entities must not have 实体不能拥有的组件类型
   */
  without(...componentTypes: ComponentType[]): IQueryBuilder;
  /**
   * Add excluded components (alias for without) 添加排除组件（without的别名）
   * @param componentTypes Component types that entities must not have 实体不能拥有的组件类型
   */
  none(...componentTypes: ComponentType[]): IQueryBuilder;
  /**
   * Add custom filter function 添加自定义过滤函数
   * @param predicate Filter function that returns true for entities to include 过滤函数，对要包含的实体返回true
   */
  filter(predicate: (entity: Entity) => boolean): IQueryBuilder;
  /**
   * Set result limit 设置结果限制
   * @param count Maximum number of entities to return 返回的最大实体数量
   */
  limit(count: number): IQueryBuilder;
  /**
   * Set result offset 设置结果偏移
   * @param count Number of entities to skip from the beginning 从开头跳过的实体数量
   */
  offset(count: number): IQueryBuilder;
  /**
   * Include inactive entities 包含非活跃实体
   * @param include Whether to include inactive entities in results 是否在结果中包含非活跃实体
   */
  includeInactive(include?: boolean): IQueryBuilder;
  /**
   * Enable/disable caching 启用/禁用缓存
   * @param use Whether to use query result caching 是否使用查询结果缓存
   */
  useCache(use?: boolean): IQueryBuilder;
  /**
   * Add sorting function 添加排序函数
   * @param compareFn Comparison function for sorting entities 用于排序实体的比较函数
   */
  sort(compareFn: (a: Entity, b: Entity) => number): IQueryBuilder;
  /** Execute query and return entities 执行查询并返回实体 */
  execute(): Entity[];
  /** Execute query and return detailed result 执行查询并返回详细结果 */
  executeWithMetadata(): QueryResult;
  /** Get first matching entity 获取第一个匹配的实体 */
  first(): Entity | undefined;
  /** Check if any entities match 检查是否有实体匹配 */
  exists(): boolean;
  /** Count matching entities 计算匹配的实体数量 */
  count(): number;
  /** Reset builder to initial state 重置构建器到初始状态 */
  reset(): IQueryBuilder;
  /** Clone this builder 克隆此构建器 */
  clone(): IQueryBuilder;
  /** Validate query criteria 验证查询条件 */
  validate(): { valid: boolean; errors: string[] };
  /** Get query signature for caching 获取查询签名用于缓存 */
  getSignature(): string;
  /** Get current criteria (for debugging) 获取当前条件（用于调试） */
  getCriteria(): QueryCriteria;
  /** Get current options (for debugging) 获取当前选项（用于调试） */
  getOptions(): QueryOptions;
}

/**
 * Query manager interface for managing queries and cache
 * 查询管理器接口用于管理查询和缓存
 */
export interface IQueryManager {
  /** Execute query with criteria 使用条件执行查询 */
  query(criteria: QueryCriteria, options?: QueryOptions): QueryResult;
  /** Create a new query builder 创建新的查询构建器 */
  createBuilder(): IQueryBuilder;
  /** Get query statistics 获取查询统计信息 */
  getStatistics(): QueryStatistics;
  /** Clear query cache 清除查询缓存 */
  clearCache(): void;
  /** Configure query cache 配置查询缓存 */
  configureCache(config: Partial<QueryCacheConfig>): void;
  /** Invalidate cache entries matching criteria 使匹配条件的缓存条目失效 */
  invalidateCache(criteria?: QueryCriteria): void;
  /** Enable/disable query performance monitoring 启用/禁用查询性能监控 */
  setPerformanceMonitoring(enabled: boolean): void;
}

/**
 * Default query cache configuration
 * 默认查询缓存配置
 */
export const DEFAULT_QUERY_CACHE_CONFIG: QueryCacheConfig = {
  maxSize: 100,
  ttl: 5000, // 5 seconds
  autoInvalidate: true,
  evictionStrategy: 'lru'
};

/**
 * Query complexity levels for performance optimization
 * 查询复杂度级别用于性能优化
 */
export enum QueryComplexity {
  /** Simple component type queries 简单组件类型查询 */
  Simple = 'simple',
  /** Queries with multiple criteria 多条件查询 */
  Medium = 'medium',
  /** Complex queries with custom filters 带自定义过滤器的复杂查询 */
  Complex = 'complex'
}

/**
 * Query execution strategy
 * 查询执行策略
 */
export enum QueryExecutionStrategy {
  /** Use archetype-based optimization 使用基于原型的优化 */
  Archetype = 'archetype',
  /** Use brute force iteration 使用暴力迭代 */
  BruteForce = 'brute_force',
  /** Automatically choose best strategy 自动选择最佳策略 */
  Auto = 'auto'
}

/**
 * Query event types for monitoring
 * 查询事件类型用于监控
 */
export enum QueryEventType {
  /** Query started 查询开始 */
  QueryStart = 'query_start',
  /** Query completed 查询完成 */
  QueryComplete = 'query_complete',
  /** Cache hit 缓存命中 */
  CacheHit = 'cache_hit',
  /** Cache miss 缓存未命中 */
  CacheMiss = 'cache_miss',
  /** Cache invalidated 缓存失效 */
  CacheInvalidated = 'cache_invalidated'
}
