import type { Entity } from './Entity';
import type { ComponentType } from '../utils/Types';
import type {
  QueryCacheEntry,
  QueryCacheConfig,
  QueryCriteria
} from '../utils/QueryTypes';
import { DEFAULT_QUERY_CACHE_CONFIG } from '../utils/QueryTypes';

/**
 * LRU (Least Recently Used) cache implementation for query results
 * LRU（最近最少使用）缓存实现，用于查询结果
 */
export class QueryCache {
  private _cache = new Map<string, QueryCacheEntry>();
  private _accessOrder: string[] = [];
  private _config: QueryCacheConfig;
  
  private _queriesByComponentType = new Map<string, Set<string>>();
  private _componentTypesByQuery = new Map<string, Set<string>>();

  constructor(config: Partial<QueryCacheConfig> = {}) {
    this._config = { ...DEFAULT_QUERY_CACHE_CONFIG, ...config };
  }

  /**
   * Get cached query result
   * 获取缓存的查询结果
   */
  get(signature: string): Entity[] | null {
    const entry = this._cache.get(signature);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (this._isExpired(entry)) {
      this._cache.delete(signature);
      this._removeFromAccessOrder(signature);
      return null;
    }

    // Update access order for LRU
    this._updateAccessOrder(signature);
    entry.hitCount++;

    return entry.entities;
  }

  /**
   * Set cached query result
   * 设置缓存的查询结果
   * @param signature Unique signature for the query 查询的唯一签名
   * @param entities Array of entities to cache 要缓存的实体数组
   * @param criteria Optional query criteria for component type tracking 可选的查询条件，用于组件类型跟踪
   */
  set(signature: string, entities: Entity[], criteria?: QueryCriteria): void {
    // Check if we need to evict entries
    if (this._cache.size >= this._config.maxSize) {
      this._evictEntries();
    }

    const entry: QueryCacheEntry = {
      entities: [...entities], // Create a copy to avoid external mutations
      timestamp: Date.now(),
      hitCount: 0,
      signature
    };

    this._cache.set(signature, entry);
    this._updateAccessOrder(signature);
    
    // Track component types for smart invalidation
    if (criteria) {
      this._trackQueryComponentTypes(signature, criteria);
    }
  }

  /**
   * Check if a query result is cached
   * 检查查询结果是否已缓存
   * @param signature Query signature to check 要检查的查询签名
   * @returns True if cached and not expired 如果已缓存且未过期则返回true
   */
  has(signature: string): boolean {
    const entry = this._cache.get(signature);
    return entry !== undefined && !this._isExpired(entry);
  }

  /**
   * Remove specific cache entry
   * 移除特定的缓存条目
   * @param signature Query signature to remove 要移除的查询签名
   * @returns True if entry was removed 如果条目被移除则返回true
   */
  delete(signature: string): boolean {
    const deleted = this._cache.delete(signature);
    if (deleted) {
      this._removeFromAccessOrder(signature);
      this._untrackQueryComponentTypes(signature);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   * 清除所有缓存条目
   */
  clear(): void {
    this._cache.clear();
    this._accessOrder.length = 0;
    this._queriesByComponentType.clear();
    this._componentTypesByQuery.clear();
  }

  /**
   * Invalidate cache entries that might be affected by component type changes
   * 使可能受组件类型变化影响的缓存条目失效
   */
  invalidateByComponentType(componentType: ComponentType): void {
    if (!this._config.autoInvalidate) {
      return;
    }

    const componentTypeName = componentType.name;
    const affectedQueries = this._queriesByComponentType.get(componentTypeName);
    
    if (affectedQueries) {
      for (const signature of affectedQueries) {
        this.delete(signature);
      }
    }
  }

  /**
   * Invalidate cache entries that might be affected by multiple component types
   * 使可能受多个组件类型变化影响的缓存条目失效
   */
  invalidateByComponentTypes(componentTypes: ComponentType[]): void {
    if (!this._config.autoInvalidate) {
      return;
    }

    const affectedQueries = new Set<string>();
    
    for (const componentType of componentTypes) {
      const componentTypeName = componentType.name;
      const queries = this._queriesByComponentType.get(componentTypeName);
      if (queries) {
        for (const signature of queries) {
          affectedQueries.add(signature);
        }
      }
    }
    
    for (const signature of affectedQueries) {
      this.delete(signature);
    }
  }



  /**
   * Get cache statistics
   * 获取缓存统计信息
   */
  getStatistics(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    let totalHits = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;

    for (const entry of this._cache.values()) {
      totalHits += entry.hitCount;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
    }

    const totalAccesses = totalHits + this._cache.size; // Approximate
    const hitRate = totalAccesses > 0 ? totalHits / totalAccesses : 0;

    return {
      size: this._cache.size,
      maxSize: this._config.maxSize,
      hitRate,
      totalHits,
      oldestEntry: this._cache.size > 0 ? oldestTimestamp : 0,
      newestEntry: this._cache.size > 0 ? newestTimestamp : 0
    };
  }

  /**
   * Update cache configuration
   * 更新缓存配置
   * @param config Partial configuration to merge with current config 要与当前配置合并的部分配置
   */
  updateConfig(config: Partial<QueryCacheConfig>): void {
    this._config = { ...this._config, ...config };
    
    // If max size was reduced, evict entries
    if (this._cache.size > this._config.maxSize) {
      this._evictEntries();
    }
  }

  /**
   * Get current configuration
   * 获取当前配置
   */
  getConfig(): QueryCacheConfig {
    return { ...this._config };
  }

  /**
   * Get all cache entries (for debugging)
   * 获取所有缓存条目（用于调试）
   */
  getAllEntries(): QueryCacheEntry[] {
    return Array.from(this._cache.values());
  }

  /**
   * Check if cache entry is expired
   * 检查缓存条目是否过期
   */
  private _isExpired(entry: QueryCacheEntry): boolean {
    return Date.now() - entry.timestamp > this._config.ttl;
  }

  /**
   * Update access order for LRU eviction
   * 更新访问顺序用于LRU淘汰
   */
  private _updateAccessOrder(signature: string): void {
    // Remove from current position
    this._removeFromAccessOrder(signature);
    // Add to end (most recently used)
    this._accessOrder.push(signature);
  }

  /**
   * Remove signature from access order
   * 从访问顺序中移除签名
   */
  private _removeFromAccessOrder(signature: string): void {
    const index = this._accessOrder.indexOf(signature);
    if (index !== -1) {
      this._accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict cache entries based on strategy
   * 根据策略淘汰缓存条目
   */
  private _evictEntries(): void {
    const entriesToRemove = this._cache.size - this._config.maxSize + 1;
    
    switch (this._config.evictionStrategy) {
      case 'lru':
        this._evictLRU(entriesToRemove);
        break;
      case 'lfu':
        this._evictLFU(entriesToRemove);
        break;
      case 'ttl':
        this._evictExpired();
        // If still over capacity, fall back to LRU
        if (this._cache.size >= this._config.maxSize) {
          this._evictLRU(entriesToRemove);
        }
        break;
    }
  }

  /**
   * Evict least recently used entries
   * 淘汰最近最少使用的条目
   */
  private _evictLRU(count: number): void {
    for (let i = 0; i < count && this._accessOrder.length > 0; i++) {
      const signature = this._accessOrder.shift();
      if (signature) {
        this._cache.delete(signature);
      }
    }
  }

  /**
   * Evict least frequently used entries
   * 淘汰最少使用的条目
   */
  private _evictLFU(count: number): void {
    const entries = Array.from(this._cache.entries());
    entries.sort((a, b) => a[1].hitCount - b[1].hitCount);
    
    for (let i = 0; i < count && i < entries.length; i++) {
      const signature = entries[i][0];
      this._cache.delete(signature);
      this._removeFromAccessOrder(signature);
    }
  }

  /**
   * Evict expired entries
   * 淘汰过期条目
   */
  private _evictExpired(): void {
    const now = Date.now();
    const expiredSignatures: string[] = [];
    
    for (const [signature, entry] of this._cache.entries()) {
      if (now - entry.timestamp > this._config.ttl) {
        expiredSignatures.push(signature);
      }
    }
    
    for (const signature of expiredSignatures) {
      this._cache.delete(signature);
      this._removeFromAccessOrder(signature);
    }
  }

  /**
   * Cleanup expired entries (should be called periodically)
   * 清理过期条目（应定期调用）
   */
  cleanup(): void {
    this._evictExpired();
  }

  /**
   * Track component types used in a query for smart invalidation
   * 跟踪查询中使用的组件类型以进行智能失效
   */
  private _trackQueryComponentTypes(signature: string, criteria: QueryCriteria): void {
    const componentTypes = this._extractComponentTypesFromCriteria(criteria);
    const componentTypeNames = new Set<string>();
    
    for (const componentType of componentTypes) {
      const typeName = componentType.name;
      componentTypeNames.add(typeName);
      
      // Track queries by component type
      if (!this._queriesByComponentType.has(typeName)) {
        this._queriesByComponentType.set(typeName, new Set());
      }
      const querySet = this._queriesByComponentType.get(typeName);
      if (querySet) {
        querySet.add(signature);
      }
    }
    
    // Track component types by query
    this._componentTypesByQuery.set(signature, componentTypeNames);
  }

  /**
   * Remove tracking for a query's component types
   * 移除查询组件类型的跟踪
   */
  private _untrackQueryComponentTypes(signature: string): void {
    const componentTypes = this._componentTypesByQuery.get(signature);
    if (componentTypes) {
      for (const typeName of componentTypes) {
        const queries = this._queriesByComponentType.get(typeName);
        if (queries) {
          queries.delete(signature);
          if (queries.size === 0) {
            this._queriesByComponentType.delete(typeName);
          }
        }
      }
      this._componentTypesByQuery.delete(signature);
    }
  }

  /**
   * Extract component types from query criteria
   * 从查询条件中提取组件类型
   */
  private _extractComponentTypesFromCriteria(criteria: QueryCriteria): ComponentType[] {
    const componentTypes: ComponentType[] = [];
    
    // Add all required components (all/with)
    if (criteria.all) {
      componentTypes.push(...criteria.all);
    }
    if (criteria.with) {
      componentTypes.push(...criteria.with);
    }
    
    // Add any components (or logic)
    if (criteria.any) {
      componentTypes.push(...criteria.any);
    }
    
    // Add excluded components (none/without)
    if (criteria.none) {
      componentTypes.push(...criteria.none);
    }
    if (criteria.without) {
      componentTypes.push(...criteria.without);
    }
    
    return componentTypes;
  }
}
