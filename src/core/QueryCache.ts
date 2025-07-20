import type { Entity } from './Entity';
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
   */
  set(signature: string, entities: Entity[]): void {
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
  }

  /**
   * Check if a query result is cached
   * 检查查询结果是否已缓存
   */
  has(signature: string): boolean {
    const entry = this._cache.get(signature);
    return entry !== undefined && !this._isExpired(entry);
  }

  /**
   * Remove specific cache entry
   * 移除特定的缓存条目
   */
  delete(signature: string): boolean {
    const deleted = this._cache.delete(signature);
    if (deleted) {
      this._removeFromAccessOrder(signature);
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
  }

  /**
   * Invalidate cache entries that might be affected by entity changes
   * 使可能受实体变化影响的缓存条目失效
   */
  invalidateByEntity(_entityId: number): void {
    // For now, we'll clear all cache entries when any entity changes
    // This is conservative but safe. In the future, we could implement
    // more sophisticated invalidation based on component types
    if (this._config.autoInvalidate) {
      this.clear();
    }
  }

  /**
   * Invalidate cache entries matching specific criteria
   * 使匹配特定条件的缓存条目失效
   */
  invalidateByCriteria(_criteria: QueryCriteria): void {
    // This is a simplified implementation
    // In a more sophisticated version, we would analyze which cached queries
    // might be affected by the given criteria
    if (this._config.autoInvalidate) {
      this.clear();
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
}
