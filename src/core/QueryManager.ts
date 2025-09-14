import type { Entity } from './Entity';
import type { ComponentType } from '../utils/Types';
import type {
  IQueryManager,
  IQueryBuilder,
  QueryCriteria,
  QueryOptions,
  QueryResult,
  QueryStatistics,
  QueryCacheConfig
} from '../utils/QueryTypes';
import {
  QueryComplexity,
  QueryExecutionStrategy
} from '../utils/QueryTypes';
import { QueryBuilder } from './QueryBuilder';
import { QueryCache } from './QueryCache';
import { QueryPerformanceMonitor } from './QueryPerformanceMonitor';
import type { ArchetypeManager } from './ArchetypeManager';

/**
 * Query manager that coordinates all query operations
 * 查询管理器，协调所有查询操作
 */
export class QueryManager implements IQueryManager {
  private _cache: QueryCache;
  private _performanceMonitor: QueryPerformanceMonitor;
  private _archetypeManager: ArchetypeManager;
  private _getEntities: () => Entity[];

  constructor(
    archetypeManager: ArchetypeManager,
    getEntities: () => Entity[],
    cacheConfig?: Partial<QueryCacheConfig>
  ) {
    this._archetypeManager = archetypeManager;
    this._getEntities = getEntities;
    this._cache = new QueryCache(cacheConfig);
    this._performanceMonitor = new QueryPerformanceMonitor();
  }

  /**
   * Execute query with criteria
   * 使用条件执行查询
   * @param criteria Query criteria specifying which entities to find 查询条件，指定要查找的实体
   * @param options Query options for filtering, sorting, pagination, etc. 查询选项，用于过滤、排序、分页等
   * @returns Query result with entities and metadata 查询结果，包含实体和元数据
   */
  query(criteria: QueryCriteria, options: QueryOptions = {}): QueryResult {
    const startTime = performance.now();
    const signature = this._createSignature(criteria, options);
    
    // Check cache first (if enabled)
    if (options.useCache !== false) {
      const cachedResult = this._cache.get(signature);
      if (cachedResult) {
        const executionTime = performance.now() - startTime;
        this._performanceMonitor.recordQuery(signature, criteria, executionTime, true);
        
        // Apply options to cached result
        let resultEntities = cachedResult;

        // Apply custom filter and sorting
        if (options.filter) {
          resultEntities = resultEntities.filter(options.filter);
        }

        if (options.sort) {
          resultEntities = [...resultEntities].sort(options.sort);
        }

        const totalCount = resultEntities.length;

        // Apply pagination
        if (options.offset !== undefined || options.limit !== undefined) {
          const start = options.offset || 0;
          const end = options.limit !== undefined ? start + options.limit : undefined;
          resultEntities = resultEntities.slice(start, end);
        }

        return {
          entities: resultEntities,
          totalCount,
          fromCache: true,
          executionTime,
          archetypesChecked: 0
        };
      }
    }

    // Execute query
    const result = this._executeQuery(criteria, options);
    const executionTime = performance.now() - startTime;

    // Cache result (if enabled and cacheable)
    if (options.useCache !== false && this._isCacheable(criteria, options)) {
      this._cache.set(signature, result.entities, criteria);
    }

    // Record performance
    this._performanceMonitor.recordQuery(signature, criteria, executionTime, false);

    return {
      ...result,
      executionTime,
      fromCache: false
    };
  }

  /**
   * Create a new query builder
   * 创建新的查询构建器
   */
  createBuilder(): IQueryBuilder {
    return new QueryBuilder((criteria, options) => this.query(criteria, options));
  }

  /**
   * Get query statistics
   * 获取查询统计信息
   */
  getStatistics(): QueryStatistics {
    return this._performanceMonitor.getStatistics();
  }

  /**
   * Clear query cache
   * 清除查询缓存
   */
  clearCache(): void {
    this._cache.clear();
  }

  /**
   * Configure query cache
   * 配置查询缓存
   * @param config Cache configuration options 缓存配置选项
   */
  configureCache(config: Partial<QueryCacheConfig>): void {
    this._cache.updateConfig(config);
  }

  /**
   * Invalidate cache entries matching criteria
   * 使匹配条件的缓存条目失效
   * @param criteria Optional query criteria to match for invalidation. If not provided, clears all cache 可选的查询条件用于匹配失效。如果未提供，则清除所有缓存
   */
  invalidateCache(criteria?: QueryCriteria): void {
    if (criteria) {
      // Extract component types from criteria and invalidate by component types
      const componentTypes: ComponentType[] = [];

      if (criteria.all) componentTypes.push(...criteria.all);
      if (criteria.with) componentTypes.push(...criteria.with);
      if (criteria.any) componentTypes.push(...criteria.any);
      if (criteria.none) componentTypes.push(...criteria.none);
      if (criteria.without) componentTypes.push(...criteria.without);

      if (componentTypes.length > 0) {
        this._cache.invalidateByComponentTypes(componentTypes);
      } else {
        this._cache.clear();
      }
    } else {
      this._cache.clear();
    }
  }

  /**
   * Enable/disable query performance monitoring
   * 启用/禁用查询性能监控
   * @param enabled Whether to enable performance monitoring 是否启用性能监控
   */
  setPerformanceMonitoring(enabled: boolean): void {
    this._performanceMonitor.setEnabled(enabled);
  }



  /**
   * Invalidate cache when component type changes
   * 当组件类型变化时使缓存失效
   * @param componentType The component type that changed 发生变化的组件类型
   */
  onComponentChanged(componentType: ComponentType): void {
    this._cache.invalidateByComponentType(componentType);
  }

  /**
   * Invalidate cache when multiple component types change
   * 当多个组件类型变化时使缓存失效
   * @param componentTypes Array of component types that changed 发生变化的组件类型数组
   */
  onComponentsChanged(componentTypes: ComponentType[]): void {
    this._cache.invalidateByComponentTypes(componentTypes);
  }

  /**
   * Get cache statistics
   * 获取缓存统计信息
   */
  getCacheStatistics(): ReturnType<QueryCache['getStatistics']> {
    return this._cache.getStatistics();
  }

  /**
   * Get performance monitor
   * 获取性能监控器
   */
  getPerformanceMonitor(): QueryPerformanceMonitor {
    return this._performanceMonitor;
  }

  /**
   * Execute the actual query logic
   * 执行实际的查询逻辑
   */
  private _executeQuery(criteria: QueryCriteria, options: QueryOptions): Omit<QueryResult, 'executionTime' | 'fromCache'> {
    const complexity = this._analyzeComplexity(criteria, options);
    const strategy = this._chooseExecutionStrategy(complexity, criteria);
    
    let entities: Entity[];
    let archetypesChecked = 0;

    switch (strategy) {
      case QueryExecutionStrategy.Archetype:
        ({ entities, archetypesChecked } = this._executeArchetypeQuery(criteria));
        break;
      case QueryExecutionStrategy.BruteForce:
        entities = this._executeBruteForceQuery(criteria);
        break;
      default:
        // Auto strategy - choose based on complexity
        if (complexity === QueryComplexity.Simple) {
          ({ entities, archetypesChecked } = this._executeArchetypeQuery(criteria));
        } else {
          entities = this._executeBruteForceQuery(criteria);
        }
    }

    // Apply custom filter and sorting first
    if (options.filter) {
      entities = entities.filter(options.filter);
    }

    if (options.sort) {
      entities = [...entities].sort(options.sort);
    }

    // Calculate total count after filtering but before pagination
    const totalCount = entities.length;

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit !== undefined ? start + options.limit : undefined;
      entities = entities.slice(start, end);
    }

    return {
      entities,
      totalCount,
      archetypesChecked
    };
  }

  /**
   * Execute query using archetype optimization
   * 使用原型优化执行查询
   */
  private _executeArchetypeQuery(criteria: QueryCriteria): { entities: Entity[]; archetypesChecked: number } {
    // Normalize criteria
    const allComponents = [
      ...(criteria.all || []),
      ...(criteria.with || [])
    ];
    
    const excludedComponents = [
      ...(criteria.none || []),
      ...(criteria.without || [])
    ];

    let candidateEntities: Entity[] = [];
    let archetypesChecked = 0;

    if (allComponents.length > 0) {
      // Use archetype manager for required components
      const entityIds = this._archetypeManager.queryEntities(allComponents);
      candidateEntities = entityIds
        .map(id => this._getEntities().find(e => e.id === id))
        .filter((entity): entity is Entity => entity !== undefined && entity.enabled);
      
      archetypesChecked = this._archetypeManager.queryArchetypes(allComponents).length;
    } else {
      // No required components, start with all entities
      candidateEntities = this._getEntities().filter(e => e.enabled);
    }

    // Apply exclusion filters
    if (excludedComponents.length > 0) {
      candidateEntities = candidateEntities.filter(entity => 
        !excludedComponents.some(componentType => entity.hasComponent(componentType))
      );
    }

    // Apply 'any' criteria
    if (criteria.any && criteria.any.length > 0) {
      candidateEntities = candidateEntities.filter(entity =>
        criteria.any?.some(componentType => entity.hasComponent(componentType)) ?? false
      );
    }

    return { entities: candidateEntities, archetypesChecked };
  }

  /**
   * Execute query using brute force iteration
   * 使用暴力迭代执行查询
   */
  private _executeBruteForceQuery(criteria: QueryCriteria): Entity[] {
    const allEntities = this._getEntities();
    
    return allEntities.filter(entity => {
      if (!entity.enabled) return false;
      
      // Check required components (all/with)
      const requiredComponents = [
        ...(criteria.all || []),
        ...(criteria.with || [])
      ];
      
      if (requiredComponents.length > 0) {
        if (!requiredComponents.every(componentType => entity.hasComponent(componentType))) {
          return false;
        }
      }

      // Check excluded components (none/without)
      const excludedComponents = [
        ...(criteria.none || []),
        ...(criteria.without || [])
      ];
      
      if (excludedComponents.length > 0) {
        if (excludedComponents.some(componentType => entity.hasComponent(componentType))) {
          return false;
        }
      }

      // Check any components
      if (criteria.any && criteria.any.length > 0) {
        if (!criteria.any.some(componentType => entity.hasComponent(componentType))) {
          return false;
        }
      }

      return true;
    });
  }



  /**
   * Analyze query complexity
   * 分析查询复杂度
   */
  private _analyzeComplexity(criteria: QueryCriteria, options: QueryOptions): QueryComplexity {
    const hasCustomFilter = !!options.filter;
    const hasMultipleCriteria = Object.keys(criteria).length > 1;
    const hasAnyLogic = !!(criteria.any && criteria.any.length > 0);
    
    if (hasCustomFilter) {
      return QueryComplexity.Complex;
    }
    
    if (hasMultipleCriteria || hasAnyLogic) {
      return QueryComplexity.Medium;
    }
    
    return QueryComplexity.Simple;
  }

  /**
   * Choose execution strategy based on complexity
   * 根据复杂度选择执行策略
   */
  private _chooseExecutionStrategy(complexity: QueryComplexity, criteria: QueryCriteria): QueryExecutionStrategy {
    // For simple queries with only required components, use archetype optimization
    if (complexity === QueryComplexity.Simple && 
        ((criteria.all && criteria.all.length > 0) || (criteria.with && criteria.with.length > 0))) {
      return QueryExecutionStrategy.Archetype;
    }
    
    // For complex queries or queries with 'any' logic, use brute force
    return QueryExecutionStrategy.BruteForce;
  }

  /**
   * Create signature for caching
   * 创建缓存签名
   */
  private _createSignature(criteria: QueryCriteria, options: QueryOptions): string {
    const parts: string[] = [];
    
    // Add criteria to signature
    if (criteria.all?.length) {
      parts.push(`all:${criteria.all.map(t => t.name).sort().join(',')}`);
    }
    if (criteria.with?.length) {
      parts.push(`with:${criteria.with.map(t => t.name).sort().join(',')}`);
    }
    if (criteria.any?.length) {
      parts.push(`any:${criteria.any.map(t => t.name).sort().join(',')}`);
    }
    if (criteria.none?.length) {
      parts.push(`none:${criteria.none.map(t => t.name).sort().join(',')}`);
    }
    if (criteria.without?.length) {
      parts.push(`without:${criteria.without.map(t => t.name).sort().join(',')}`);
    }
    
    // Add relevant options to signature
    if (options.includeInactive) {
      parts.push('includeInactive:true');
    }
    if (options.limit !== undefined) {
      parts.push(`limit:${options.limit}`);
    }
    if (options.offset !== undefined) {
      parts.push(`offset:${options.offset}`);
    }
    
    return parts.join('|');
  }

  /**
   * Check if query result is cacheable
   * 检查查询结果是否可缓存
   */
  private _isCacheable(_criteria: QueryCriteria, options: QueryOptions): boolean {
    // Don't cache queries with custom filters or sorting
    return !options.filter && !options.sort;
  }
}
