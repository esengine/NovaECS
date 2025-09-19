/**
 * Contact Persistence Cache for Feature-based Warm-start
 * 基于特征的接触持久化缓存用于warm-start
 *
 * Caches converged normal/tangent impulses from previous frames to accelerate
 * solver convergence and improve stacking stability in deterministic physics.
 * 缓存上一帧收敛的法向/切向冲量以加速解算器收敛并提升确定性物理中的堆叠稳定性。
 */

import type { FX } from '../math/fixed';

/**
 * Cached contact point data for warm-start
 * 用于warm-start的缓存接触点数据
 */
export interface CachedPoint {
  /**
   * Accumulated normal impulse from last solved frame
   * 上一求解帧的累积法向冲量
   */
  jn: FX;

  /**
   * Accumulated tangent impulse from last solved frame
   * 上一求解帧的累积切向冲量
   */
  jt: FX;

  /**
   * Contact position for sanity check and drift detection
   * 接触位置用于合理性检查和漂移检测
   */
  px: FX;
  py: FX;

  /**
   * Contact normal for sanity check
   * 接触法向用于合理性检查
   */
  nx: FX;
  ny: FX;

  /**
   * Number of consecutive frames this contact has been active
   * 此接触连续活跃的帧数
   */
  age: number;

  /**
   * Last frame this contact was updated
   * 此接触最后更新的帧号
   */
  lastFrame: number;
}

/**
 * Contact persistence cache using pair keys and feature IDs
 * 使用配对键和特征ID的接触持久化缓存
 *
 * Structure: pairKey -> (featureId -> CachedPoint)
 * This allows efficient lookup and cleanup of contact manifolds.
 * 结构：配对键 -> (特征ID -> 缓存点)
 * 允许高效查找和清理接触流形。
 */
export class ContactCache2D {
  /**
   * Main cache storage: pairKey -> feature map
   * 主缓存存储：配对键 -> 特征映射
   */
  private map = new Map<string, Map<number, CachedPoint>>();

  /**
   * Maximum number of cached contact pairs before LRU cleanup
   * LRU清理前的最大缓存接触对数量
   */
  maxPairs = 10000;

  /**
   * Maximum age (frames) before contact is considered stale
   * 接触被认为过期前的最大年龄（帧数）
   */
  maxAge = 8;

  /**
   * Current frame number for age tracking
   * 用于年龄跟踪的当前帧号
   */
  frame = 1;

  /**
   * Get cached contact point for a specific pair and feature
   * 获取特定配对和特征的缓存接触点
   */
  get(pairKey: string, featureId: number): CachedPoint | undefined {
    const featureMap = this.map.get(pairKey);
    if (!featureMap) {
      return undefined;
    }
    return featureMap.get(featureId);
  }

  /**
   * Store cached contact point data
   * 存储缓存接触点数据
   */
  set(
    pairKey: string,
    featureId: number,
    jn: FX,
    jt: FX,
    px: FX,
    py: FX,
    nx: FX,
    ny: FX
  ): void {
    let featureMap = this.map.get(pairKey);
    if (!featureMap) {
      featureMap = new Map<number, CachedPoint>();
      this.map.set(pairKey, featureMap);
    }

    const existing = featureMap.get(featureId);
    const age = existing ? existing.age + 1 : 1;

    featureMap.set(featureId, {
      jn,
      jt,
      px,
      py,
      nx,
      ny,
      age,
      lastFrame: this.frame
    });
  }

  /**
   * Update cached impulses for existing contact
   * 更新现有接触的缓存冲量
   */
  updateImpulses(pairKey: string, featureId: number, jn: FX, jt: FX): boolean {
    const featureMap = this.map.get(pairKey);
    if (!featureMap) {
      return false;
    }

    const cached = featureMap.get(featureId);
    if (!cached) {
      return false;
    }

    cached.jn = jn;
    cached.jt = jt;
    cached.lastFrame = this.frame;
    return true;
  }

  /**
   * Remove all cached contacts for a specific pair
   * 移除特定配对的所有缓存接触
   */
  removePair(pairKey: string): boolean {
    return this.map.delete(pairKey);
  }

  /**
   * Remove specific contact point
   * 移除特定接触点
   */
  removeContact(pairKey: string, featureId: number): boolean {
    const featureMap = this.map.get(pairKey);
    if (!featureMap) {
      return false;
    }

    const removed = featureMap.delete(featureId);

    // Clean up empty feature maps
    if (featureMap.size === 0) {
      this.map.delete(pairKey);
    }

    return removed;
  }

  /**
   * Clean up stale contacts based on age and frame criteria
   * 基于年龄和帧标准清理过期接触
   */
  cleanup(): void {
    const staleThreshold = this.frame - this.maxAge;
    const keysToRemove: string[] = [];

    for (const [pairKey, featureMap] of this.map) {
      const featuresToRemove: number[] = [];

      for (const [featureId, cached] of featureMap) {
        // Remove if too old or not updated recently
        if (cached.age > this.maxAge || cached.lastFrame < staleThreshold) {
          featuresToRemove.push(featureId);
        }
      }

      // Remove stale features
      for (const featureId of featuresToRemove) {
        featureMap.delete(featureId);
      }

      // Mark pair for removal if no features remain
      if (featureMap.size === 0) {
        keysToRemove.push(pairKey);
      }
    }

    // Remove empty pairs
    for (const pairKey of keysToRemove) {
      this.map.delete(pairKey);
    }
  }

  /**
   * Perform LRU cleanup if cache exceeds maximum size
   * 如果缓存超过最大大小则执行LRU清理
   */
  enforceSizeLimit(): void {
    if (this.map.size <= this.maxPairs) {
      return;
    }

    // Collect pairs with their oldest frame numbers
    const pairAges: Array<{ key: string; oldestFrame: number }> = [];

    for (const [pairKey, featureMap] of this.map) {
      let oldestFrame = this.frame;
      for (const cached of featureMap.values()) {
        if (cached.lastFrame < oldestFrame) {
          oldestFrame = cached.lastFrame;
        }
      }
      pairAges.push({ key: pairKey, oldestFrame });
    }

    // Sort by oldest frame (LRU first)
    pairAges.sort((a, b) => a.oldestFrame - b.oldestFrame);

    // Remove oldest pairs until under limit
    const toRemove = this.map.size - this.maxPairs;
    for (let i = 0; i < toRemove; i++) {
      this.map.delete(pairAges[i].key);
    }
  }

  /**
   * Begin new frame - update frame counter and perform maintenance
   * 开始新帧 - 更新帧计数器并执行维护
   */
  beginFrame(frameNumber: number): void {
    this.frame = frameNumber;
    this.cleanup();
    this.enforceSizeLimit();
  }

  /**
   * Clear all cached contacts
   * 清除所有缓存接触
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Get cache statistics for debugging
   * 获取缓存统计信息用于调试
   */
  getStats(): {
    pairCount: number;
    totalContacts: number;
    avgContactsPerPair: number;
    avgAge: number;
  } {
    let totalContacts = 0;
    let totalAge = 0;

    for (const featureMap of this.map.values()) {
      totalContacts += featureMap.size;
      for (const cached of featureMap.values()) {
        totalAge += cached.age;
      }
    }

    const pairCount = this.map.size;
    const avgContactsPerPair = pairCount > 0 ? totalContacts / pairCount : 0;
    const avgAge = totalContacts > 0 ? totalAge / totalContacts : 0;

    return {
      pairCount,
      totalContacts,
      avgContactsPerPair,
      avgAge
    };
  }

  /**
   * Check if cache contains any data for a pair
   * 检查缓存是否包含配对的任何数据
   */
  hasPair(pairKey: string): boolean {
    return this.map.has(pairKey);
  }

  /**
   * Get all feature IDs for a specific pair
   * 获取特定配对的所有特征ID
   */
  getFeatureIds(pairKey: string): number[] {
    const featureMap = this.map.get(pairKey);
    return featureMap ? Array.from(featureMap.keys()) : [];
  }

  /**
   * Get all pair keys in the cache
   * 获取缓存中的所有配对键
   */
  getAllPairKeys(): string[] {
    return Array.from(this.map.keys());
  }

  /**
   * Get feature map for a specific pair (for advanced operations)
   * 获取特定配对的特征映射（用于高级操作）
   */
  getFeatureMap(pairKey: string): Map<number, CachedPoint> | undefined {
    return this.map.get(pairKey);
  }
}