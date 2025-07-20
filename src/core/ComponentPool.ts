/**
 * Component Object Pool for memory management and GC pressure reduction
 * 组件对象池，用于内存管理和减少GC压力
 * 
 * @example
 * ```typescript
 * // Create a pool for PositionComponent
 * const positionPool = new ComponentPool(PositionComponent, {
 *   initialSize: 10,
 *   maxSize: 100,
 *   autoCleanup: true,
 *   cleanupInterval: 60000,
 *   maxIdleTime: 30000
 * });
 * 
 * // Acquire a component from pool
 * const position = positionPool.acquire();
 * position.x = 100;
 * position.y = 200;
 * 
 * // Release component back to pool
 * positionPool.release(position);
 * ```
 */

import type { Component } from './Component';
import type { ComponentConstructor, PoolConfig, PoolStatistics } from '../utils/Types';

/**
 * Default pool configuration
 * 默认池配置
 */
const DEFAULT_POOL_CONFIG: PoolConfig = {
  initialSize: 10,
  maxSize: 100,
  autoCleanup: true,
  cleanupInterval: 60000, // 1 minute
  maxIdleTime: 30000      // 30 seconds
};

/**
 * Component Object Pool for efficient memory management
 * 组件对象池，用于高效内存管理
 */
export class ComponentPool<T extends Component> {
  private readonly _componentType: ComponentConstructor<T>;
  private readonly _pool: T[] = [];
  private readonly _inUse = new Set<T>();
  private readonly _config: PoolConfig;
  private readonly _statistics: PoolStatistics;
  private _cleanupTimer: number | null = null;
  private readonly _componentTimestamps = new Map<T, number>();

  /**
   * Create a new component pool
   * 创建新的组件池
   */
  constructor(
    componentType: ComponentConstructor<T>,
    config: Partial<PoolConfig> = {}
  ) {
    this._componentType = componentType;
    this._config = { ...DEFAULT_POOL_CONFIG, ...config };
    this._statistics = {
      totalCreated: 0,
      poolSize: 0,
      inUse: 0,
      hitRate: 0,
      memoryUsage: 0
    };

    this._initializePool();
    this._startCleanupTimer();
  }

  /**
   * Get component type
   * 获取组件类型
   */
  get componentType(): ComponentConstructor<T> {
    return this._componentType;
  }

  /**
   * Get pool configuration
   * 获取池配置
   */
  get config(): PoolConfig {
    return { ...this._config };
  }

  /**
   * Get pool statistics
   * 获取池统计信息
   */
  get statistics(): PoolStatistics {
    this._updateStatistics();
    return { ...this._statistics };
  }

  /**
   * Acquire component from pool
   * 从池中获取组件
   */
  acquire(): T {
    let component = this._pool.pop();
    
    if (!component) {
      // Create new component if pool is empty
      component = new this._componentType();
      this._statistics.totalCreated++;
    } else {
      // Reset component state if reset method exists
      component.reset?.();
      this._componentTimestamps.delete(component);
    }

    this._inUse.add(component);
    this._updateStatistics();
    
    return component;
  }

  /**
   * Release component back to pool
   * 将组件释放回池中
   */
  release(component: T): void {
    if (!this._inUse.has(component)) {
      console.warn('Attempting to release component that was not acquired from this pool');
      return;
    }

    this._inUse.delete(component);

    // Check if pool has space
    if (this._pool.length < this._config.maxSize) {
      // Reset component state
      component.enabled = true;
      component.reset?.();
      
      // Add to pool with timestamp
      this._pool.push(component);
      this._componentTimestamps.set(component, performance.now());
    }

    this._updateStatistics();
  }

  /**
   * Preload components into pool
   * 预加载组件到池中
   */
  preload(count: number): void {
    const targetSize = Math.min(count, this._config.maxSize);
    const currentSize = this._pool.length;
    
    for (let i = currentSize; i < targetSize; i++) {
      const component = new this._componentType();
      component.reset?.();
      this._pool.push(component);
      this._componentTimestamps.set(component, performance.now());
      this._statistics.totalCreated++;
    }

    this._updateStatistics();
  }

  /**
   * Clear all components from pool
   * 清空池中的所有组件
   */
  clear(): void {
    // Call onRemoved lifecycle for pooled components
    for (const component of this._pool) {
      component.onRemoved?.();
      this._componentTimestamps.delete(component);
    }

    this._pool.length = 0;
    this._updateStatistics();
  }

  /**
   * Cleanup idle components
   * 清理空闲组件
   */
  cleanup(): void {
    if (!this._config.autoCleanup) return;

    const now = performance.now();
    const maxIdleTime = this._config.maxIdleTime;
    
    // Remove idle components
    for (let i = this._pool.length - 1; i >= 0; i--) {
      const component = this._pool[i];
      const timestamp = this._componentTimestamps.get(component);
      
      if (timestamp && (now - timestamp) > maxIdleTime) {
        const removedComponent = this._pool.splice(i, 1)[0];
        removedComponent.onRemoved?.();
        this._componentTimestamps.delete(removedComponent);
      }
    }

    this._updateStatistics();
  }

  /**
   * Destroy pool and cleanup resources
   * 销毁池并清理资源
   */
  destroy(): void {
    this._stopCleanupTimer();
    this.clear();
    this._inUse.clear();
    this._componentTimestamps.clear();
  }

  /**
   * Initialize pool with initial components
   * 使用初始组件初始化池
   */
  private _initializePool(): void {
    this.preload(this._config.initialSize);
  }

  /**
   * Start automatic cleanup timer
   * 启动自动清理定时器
   */
  private _startCleanupTimer(): void {
    if (!this._config.autoCleanup) return;

    if (typeof window !== 'undefined') {
      this._cleanupTimer = window.setInterval(() => {
        this.cleanup();
      }, this._config.cleanupInterval);
    } else {
      // Node.js environment
      this._cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this._config.cleanupInterval) as unknown as number;
    }
  }

  /**
   * Stop cleanup timer
   * 停止清理定时器
   */
  private _stopCleanupTimer(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /**
   * Update pool statistics
   * 更新池统计信息
   */
  private _updateStatistics(): void {
    this._statistics.poolSize = this._pool.length;
    this._statistics.inUse = this._inUse.size;
    
    const totalAcquired = this._statistics.totalCreated;
    const poolHits = totalAcquired - this._statistics.totalCreated + this._pool.length;
    this._statistics.hitRate = totalAcquired > 0 ? poolHits / totalAcquired : 0;
    
    // Estimate memory usage (rough calculation)
    const componentSize = 64; // Estimated average component size in bytes
    this._statistics.memoryUsage = (this._pool.length + this._inUse.size) * componentSize;
  }
}

/**
 * Global Component Pool Manager for managing multiple pools
 * 全局组件池管理器，用于管理多个池
 */
export class ComponentPoolManager {
  private readonly _pools = new Map<ComponentConstructor, ComponentPool<Component>>();
  private readonly _defaultConfig: PoolConfig;

  /**
   * Create pool manager with default configuration
   * 使用默认配置创建池管理器
   */
  constructor(defaultConfig: Partial<PoolConfig> = {}) {
    this._defaultConfig = { ...DEFAULT_POOL_CONFIG, ...defaultConfig };
  }

  /**
   * Get or create pool for component type
   * 获取或创建组件类型的池
   */
  getPool<T extends Component>(
    componentType: ComponentConstructor<T>,
    config?: Partial<PoolConfig>
  ): ComponentPool<T> {
    let pool = this._pools.get(componentType) as ComponentPool<T>;
    
    if (!pool) {
      const poolConfig = config ? { ...this._defaultConfig, ...config } : this._defaultConfig;
      pool = new ComponentPool(componentType, poolConfig);
      this._pools.set(componentType, pool as ComponentPool<Component>);
    }
    
    return pool;
  }

  /**
   * Get all pool statistics
   * 获取所有池的统计信息
   */
  getAllStatistics(): Map<string, PoolStatistics> {
    const stats = new Map<string, PoolStatistics>();
    
    for (const [componentType, pool] of this._pools) {
      stats.set(componentType.name, pool.statistics);
    }
    
    return stats;
  }

  /**
   * Cleanup all pools
   * 清理所有池
   */
  cleanupAll(): void {
    for (const pool of this._pools.values()) {
      pool.cleanup();
    }
  }

  /**
   * Destroy all pools
   * 销毁所有池
   */
  destroyAll(): void {
    for (const pool of this._pools.values()) {
      pool.destroy();
    }
    this._pools.clear();
  }
}
