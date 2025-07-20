import type { Event } from './Event';
import type { EventConstructor } from '../utils/Types';

/**
 * Event pool configuration
 * 事件池配置
 */
export interface EventPoolConfig {
  /** Initial pool size 初始池大小 */
  initialSize: number;
  /** Maximum pool size 最大池大小 */
  maxSize: number;
  /** Whether to enable automatic cleanup 是否启用自动清理 */
  autoCleanup: boolean;
  /** Cleanup interval in milliseconds 清理间隔（毫秒） */
  cleanupInterval: number;
  /** Maximum idle time before cleanup 清理前最大空闲时间 */
  maxIdleTime: number;
}

/**
 * Event pool statistics
 * 事件池统计信息
 */
export interface EventPoolStatistics {
  /** Total events created 创建的事件总数 */
  totalCreated: number;
  /** Events currently in pool 当前池中的事件数 */
  poolSize: number;
  /** Events currently in use 当前使用中的事件数 */
  inUse: number;
  /** Pool hit rate 池命中率 */
  hitRate: number;
  /** Memory usage estimation 内存使用估计 */
  memoryUsage: number;
}

/**
 * Default event pool configuration
 * 默认事件池配置
 */
export const DEFAULT_EVENT_POOL_CONFIG: EventPoolConfig = {
  initialSize: 10,
  maxSize: 100,
  autoCleanup: true,
  cleanupInterval: 30000, // 30 seconds
  maxIdleTime: 60000 // 1 minute
};

/**
 * Event object pool for reducing GC pressure
 * 事件对象池，用于减少GC压力
 * 
 * @example
 * ```typescript
 * // Create a pool for PlayerDeathEvent
 * const deathEventPool = new EventPool(PlayerDeathEvent, {
 *   initialSize: 5,
 *   maxSize: 50
 * });
 * 
 * // Acquire an event from the pool
 * const event = deathEventPool.acquire();
 * event.playerId = 123;
 * event.cause = 'dragon';
 * 
 * // Use the event...
 * eventBus.dispatch(event);
 * 
 * // Release back to pool
 * deathEventPool.release(event);
 * ```
 */
export class EventPool<T extends Event> {
  private readonly _eventType: EventConstructor<T>;
  private readonly _pool: T[] = [];
  private readonly _inUse = new Set<T>();
  private readonly _lastUsed = new Map<T, number>();
  private readonly _config: EventPoolConfig;
  private _statistics: EventPoolStatistics;
  private _cleanupTimer: NodeJS.Timeout | undefined;

  /**
   * Create a new event pool
   * 创建新的事件池
   */
  constructor(
    eventType: EventConstructor<T>,
    config: Partial<EventPoolConfig> = {}
  ) {
    this._eventType = eventType;
    this._config = { ...DEFAULT_EVENT_POOL_CONFIG, ...config };
    this._statistics = {
      totalCreated: 0,
      poolSize: 0,
      inUse: 0,
      hitRate: 0,
      memoryUsage: 0
    };
    this._cleanupTimer = undefined;

    this._initializePool();
    this._startCleanupTimer();
  }

  /**
   * Get event type
   * 获取事件类型
   */
  get eventType(): EventConstructor<T> {
    return this._eventType;
  }

  /**
   * Get pool configuration
   * 获取池配置
   */
  get config(): EventPoolConfig {
    return { ...this._config };
  }

  /**
   * Get pool statistics
   * 获取池统计信息
   */
  get statistics(): EventPoolStatistics {
    this._updateStatistics();
    return { ...this._statistics };
  }

  /**
   * Acquire an event from the pool
   * 从池中获取事件
   * @param args Arguments to pass to event constructor or initialize method 传递给事件构造函数或初始化方法的参数
   * @returns Event instance from pool or newly created 从池中获取或新创建的事件实例
   */
  acquire(...args: unknown[]): T {
    let event: T;

    if (this._pool.length > 0) {
      // Reuse existing event from pool
      const pooledEvent = this._pool.pop();
      if (!pooledEvent) {
        throw new Error('Pool is empty but length > 0');
      }
      event = pooledEvent;
      event.reset();
      event.initialize(...args);

      // Update hit rate
      this._statistics.hitRate = (this._statistics.hitRate * this._statistics.totalCreated + 1) / (this._statistics.totalCreated + 1);
    } else {
      // Create new event
      event = new this._eventType(...args);
      this._statistics.totalCreated++;
    }

    // Track as in use
    this._inUse.add(event);
    this._lastUsed.set(event, Date.now());
    
    this._updateStatistics();
    return event;
  }

  /**
   * Release an event back to the pool
   * 将事件释放回池
   * @param event The event instance to release back to pool 要释放回池的事件实例
   */
  release(event: T): void {
    if (!this._inUse.has(event)) {
      console.warn('Attempting to release event that is not in use');
      return;
    }

    // Remove from in-use tracking
    this._inUse.delete(event);
    
    // Reset event state
    event.reset();

    // Add back to pool if under capacity
    if (this._pool.length < this._config.maxSize) {
      this._pool.push(event);
      this._lastUsed.set(event, Date.now());
    } else {
      // Pool is full, let it be garbage collected
      this._lastUsed.delete(event);
    }

    this._updateStatistics();
  }

  /**
   * Clear the pool
   * 清空池
   */
  clear(): void {
    this._pool.length = 0;
    this._inUse.clear();
    this._lastUsed.clear();
    this._updateStatistics();
  }

  /**
   * Get pool size
   * 获取池大小
   */
  size(): number {
    return this._pool.length;
  }

  /**
   * Get number of events in use
   * 获取使用中的事件数量
   */
  inUseCount(): number {
    return this._inUse.size;
  }

  /**
   * Check if event is from this pool and in use
   * 检查事件是否来自此池且正在使用
   */
  isInUse(event: T): boolean {
    return this._inUse.has(event);
  }

  /**
   * Force cleanup of idle events
   * 强制清理空闲事件
   */
  cleanup(): void {
    if (!this._config.autoCleanup) {
      return;
    }

    const now = Date.now();
    const toRemove: T[] = [];

    // Find events that have been idle too long
    for (const [event, lastUsed] of this._lastUsed.entries()) {
      if (now - lastUsed > this._config.maxIdleTime && !this._inUse.has(event)) {
        toRemove.push(event);
      }
    }

    // Remove idle events
    for (const event of toRemove) {
      const index = this._pool.indexOf(event);
      if (index !== -1) {
        this._pool.splice(index, 1);
        this._lastUsed.delete(event);
      }
    }

    this._updateStatistics();
  }

  /**
   * Dispose of the pool and clean up resources
   * 处理池并清理资源
   */
  dispose(): void {
    this._stopCleanupTimer();
    this.clear();
  }

  /**
   * Initialize the pool with initial events
   * 用初始事件初始化池
   */
  private _initializePool(): void {
    for (let i = 0; i < this._config.initialSize; i++) {
      const event = new this._eventType();
      this._pool.push(event);
      this._lastUsed.set(event, Date.now());
      this._statistics.totalCreated++;
    }
    this._updateStatistics();
  }

  /**
   * Start the cleanup timer
   * 启动清理定时器
   */
  private _startCleanupTimer(): void {
    if (this._config.autoCleanup && this._config.cleanupInterval > 0) {
      this._cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this._config.cleanupInterval);
    }
  }

  /**
   * Stop the cleanup timer
   * 停止清理定时器
   */
  private _stopCleanupTimer(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = undefined;
    }
  }

  /**
   * Update pool statistics
   * 更新池统计信息
   */
  private _updateStatistics(): void {
    this._statistics.poolSize = this._pool.length;
    this._statistics.inUse = this._inUse.size;
    
    // Estimate memory usage (rough calculation)
    this._statistics.memoryUsage = 
      (this._statistics.poolSize + this._statistics.inUse) * 64; // Rough estimate: 64 bytes per event
  }
}

/**
 * Global Event Pool Manager for managing multiple pools
 * 全局事件池管理器，用于管理多个池
 */
export class EventPoolManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _pools = new Map<EventConstructor, EventPool<any>>();
  private readonly _defaultConfig: EventPoolConfig;

  constructor(defaultConfig: Partial<EventPoolConfig> = {}) {
    this._defaultConfig = { ...DEFAULT_EVENT_POOL_CONFIG, ...defaultConfig };
  }

  /**
   * Get or create a pool for the specified event type
   * 获取或创建指定事件类型的池
   */
  getPool<T extends Event>(eventType: EventConstructor<T>): EventPool<T> {
    let pool = this._pools.get(eventType);
    if (!pool) {
      pool = new EventPool(eventType, this._defaultConfig);
      this._pools.set(eventType, pool);
    }
    return pool as EventPool<T>;
  }

  /**
   * Create a pool with custom configuration
   * 创建具有自定义配置的池
   */
  createPool<T extends Event>(
    eventType: EventConstructor<T>,
    config: Partial<EventPoolConfig>
  ): EventPool<T> {
    const pool = new EventPool(eventType, config);
    this._pools.set(eventType, pool);
    return pool;
  }

  /**
   * Remove a pool
   * 移除池
   */
  removePool<T extends Event>(eventType: EventConstructor<T>): boolean {
    const pool = this._pools.get(eventType);
    if (pool) {
      pool.dispose();
      return this._pools.delete(eventType);
    }
    return false;
  }

  /**
   * Acquire an event from the appropriate pool
   * 从适当的池中获取事件
   * @param eventType Event constructor type 事件构造函数类型
   * @param args Arguments to pass to event constructor or initialize method 传递给事件构造函数或初始化方法的参数
   * @returns Event instance from pool or newly created 从池中获取或新创建的事件实例
   */
  acquire<T extends Event>(eventType: EventConstructor<T>, ...args: unknown[]): T {
    const pool = this.getPool(eventType);
    return pool.acquire(...args);
  }

  /**
   * Release an event back to its pool
   * 将事件释放回其池
   * @param event The event instance to release back to its pool 要释放回池的事件实例
   */
  release<T extends Event>(event: T): void {
    const eventType = event.constructor as EventConstructor<T>;
    const pool = this._pools.get(eventType);
    if (pool) {
      pool.release(event);
    } else {
      console.warn('No pool found for event type:', eventType.name);
    }
  }

  /**
   * Get statistics for all pools
   * 获取所有池的统计信息
   */
  getStatistics(): Map<string, EventPoolStatistics> {
    const stats = new Map<string, EventPoolStatistics>();
    for (const [eventType, pool] of this._pools.entries()) {
      stats.set(eventType.name, pool.statistics);
    }
    return stats;
  }

  /**
   * Cleanup all pools
   * 清理所有池
   */
  cleanup(): void {
    for (const pool of this._pools.values()) {
      pool.cleanup();
    }
  }

  /**
   * Clear all pools
   * 清空所有池
   */
  clear(): void {
    for (const pool of this._pools.values()) {
      pool.clear();
    }
  }

  /**
   * Dispose of all pools
   * 处理所有池
   */
  dispose(): void {
    for (const pool of this._pools.values()) {
      pool.dispose();
    }
    this._pools.clear();
  }

  /**
   * Get total memory usage across all pools
   * 获取所有池的总内存使用量
   */
  getTotalMemoryUsage(): number {
    let total = 0;
    for (const pool of this._pools.values()) {
      total += pool.statistics.memoryUsage;
    }
    return total;
  }

  /**
   * Get total number of pools
   * 获取池的总数
   */
  getPoolCount(): number {
    return this._pools.size;
  }
}

/**
 * Global event pool manager instance
 * 全局事件池管理器实例
 */
export const globalEventPoolManager = new EventPoolManager();