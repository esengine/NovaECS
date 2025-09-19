/**
 * Contact Commit System for Impulse Persistence
 * 接触提交系统用于冲量持久化
 *
 * Commits solved impulses from constraint solver back to contact cache
 * and performs cleanup of stale/unused cache entries for memory management.
 * 将约束解算器求解的冲量提交回接触缓存，并清理过期/未使用的缓存条目以进行内存管理。
 */

import { system, SystemContext } from '../../core/System';
import { Contacts2D } from '../../resources/Contacts2D';
import { ContactCache2D } from '../../resources/ContactCache2D';
import { makePairKey } from '../../determinism/PairKey';

/**
 * Default feature ID for contacts without explicit feature information
 * 没有明确特征信息的接触的默认特征ID
 */
const DEFAULT_FEATURE_ID = 0;

/**
 * Cleanup statistics
 * 清理统计信息
 */
export interface CleanupStats {
  removedContacts: number;
  removedPairs: number;
  totalPairsBefore: number;
  totalContactsBefore: number;
  totalPairsAfter: number;
  totalContactsAfter: number;
}

/**
 * Contact commit statistics for debugging and profiling
 * 接触提交统计信息用于调试和性能分析
 */
export class ContactCommitStats {
  frame = 0;
  totalContacts = 0;
  committedCount = 0;
  activePairs = 0;
  cleanupStats?: CleanupStats;

  constructor(
    frame: number = 0,
    totalContacts: number = 0,
    committedCount: number = 0,
    activePairs: number = 0,
    cleanupStats?: CleanupStats
  ) {
    this.frame = frame;
    this.totalContacts = totalContacts;
    this.committedCount = committedCount;
    this.activePairs = activePairs;
    if (cleanupStats) {
      this.cleanupStats = cleanupStats;
    }
  }
}

/**
 * Contact commit system for impulse persistence
 * 接触提交系统用于冲量持久化
 *
 * This system runs after the constraint solver has updated contact impulses
 * and commits the final solved values back to the contact cache for next frame.
 * Also performs cleanup of stale cache entries based on age and usage.
 * 此系统在约束解算器更新接触冲量后运行，将最终求解值提交回接触缓存供下一帧使用。
 * 还基于年龄和使用情况清理过期的缓存条目。
 */
export const ContactsCommit2D = system(
  'phys.contacts.commit',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get current frame contacts and cache
    // 获取当前帧接触和缓存
    const contacts = world.getResource(Contacts2D);
    const cache = world.getResource(ContactCache2D);

    if (!contacts || !cache || contacts.list.length === 0) {
      // Even if no contacts, still perform cleanup
      // 即使没有接触，仍然执行清理
      if (cache) {
        performCleanup(cache, world.frame >>> 0);
      }
      return;
    }

    const frame = world.frame >>> 0;

    // Ensure cache frame is synchronized (in case warm-start wasn't run)
    // 确保缓存帧同步（以防warm-start未运行）
    if (cache.frame !== frame) {
      cache.frame = frame;
    }

    // Commit solved impulses back to cache
    // 将求解的冲量提交回缓存
    let committedCount = 0;
    const activePairs = new Set<string>();

    for (const contact of contacts.list) {
      // Generate stable pair key
      // 生成稳定的配对键
      const { key } = makePairKey(world, contact.a, contact.b);
      activePairs.add(key);

      // Use feature ID or default
      // 使用特征ID或默认值
      const featureId = contact.featureId ?? DEFAULT_FEATURE_ID;

      // Update cache with final solved impulses and current geometry
      // 使用最终求解的冲量和当前几何形状更新缓存
      const success = cache.updateImpulses(key, featureId, contact.jn, contact.jt);

      if (success) {
        // Also update geometric data for consistency
        // 同时更新几何数据以保持一致性
        const cached = cache.get(key, featureId);
        if (cached) {
          cached.px = contact.px;
          cached.py = contact.py;
          cached.nx = contact.nx;
          cached.ny = contact.ny;
          // lastFrame is already updated by updateImpulses
          // lastFrame已经被updateImpulses更新
        }
        committedCount++;
      } else {
        // Contact not in cache (new or expired), create new entry
        // 接触不在缓存中（新的或已过期），创建新条目
        cache.set(
          key,
          featureId,
          contact.jn,
          contact.jt,
          contact.px,
          contact.py,
          contact.nx,
          contact.ny
        );
        committedCount++;
      }
    }

    // Perform comprehensive cleanup
    // 执行全面清理
    const cleanupStats = performCleanup(cache, frame);

    // Store commit statistics for debugging and profiling
    // 存储提交统计信息用于调试和性能分析
    const commitStats = new ContactCommitStats(
      frame,
      contacts.list.length,
      committedCount,
      activePairs.size,
      cleanupStats
    );
    world.setResource(ContactCommitStats, commitStats);
  }
)
  .stage('update')
  .after('phys.solver.gs2d')       // After SolverGS2D constraint solver
  .before('phys.integrate')        // Before velocity integration
  .inSet('physics')
  .build();

/**
 * Perform comprehensive cache cleanup
 * 执行全面的缓存清理
 *
 * Removes stale contacts and empty pairs based on:
 * - Age: contacts not updated for maxAge frames
 * - Usage: contacts not accessed recently
 * - Activity: pairs not active in current frame (optional aggressive cleanup)
 * 基于以下条件移除过期接触和空对：
 * - 年龄：maxAge帧内未更新的接触
 * - 使用：最近未访问的接触
 * - 活动：当前帧不活跃的对（可选的激进清理）
 */
function performCleanup(
  cache: ContactCache2D,
  currentFrame: number
): CleanupStats {
  const statsBefore = cache.getStats();

  const staleThreshold = currentFrame - cache.maxAge;
  let removedContacts = 0;
  let removedPairs = 0;

  // Clean up individual contacts within each pair
  // 清理每个对内的单个接触
  for (const pairKey of cache.getAllPairKeys()) {
    const featureMap = cache.getFeatureMap(pairKey);
    if (!featureMap) continue;

    const featuresToRemove: number[] = [];

    for (const [featureId, cached] of featureMap) {
      let shouldRemove = false;

      // Remove if contact is too old
      // 如果接触太旧则移除
      if (cached.age > cache.maxAge) {
        shouldRemove = true;
      }

      // Remove if not updated recently
      // 如果最近未更新则移除
      if (cached.lastFrame < staleThreshold) {
        shouldRemove = true;
      }

      if (shouldRemove) {
        featuresToRemove.push(featureId);
        removedContacts++;
      }
    }

    // Remove stale features (this will automatically clean up empty pairs)
    // 移除过期特征（这将自动清理空对）
    const initialPairCount = cache.hasPair(pairKey) ? 1 : 0;
    for (const featureId of featuresToRemove) {
      cache.removeContact(pairKey, featureId);
    }
    const finalPairCount = cache.hasPair(pairKey) ? 1 : 0;
    removedPairs += initialPairCount - finalPairCount;
  }

  const statsAfter = cache.getStats();

  return {
    removedContacts,
    removedPairs,
    totalPairsBefore: statsBefore.pairCount,
    totalContactsBefore: statsBefore.totalContacts,
    totalPairsAfter: statsAfter.pairCount,
    totalContactsAfter: statsAfter.totalContacts
  };
}

/**
 * Contact commit system with aggressive cleanup
 * 带有激进清理的接触提交系统
 *
 * Alternative version that performs more aggressive cleanup by removing
 * cache entries for pairs that are not active in the current frame.
 * Use this if memory usage is a concern and you can tolerate losing
 * some warm-start benefits for inactive contacts.
 * 通过移除在当前帧不活跃的对的缓存条目来执行更激进清理的替代版本。
 * 如果内存使用是一个问题，并且您可以容忍对不活跃接触失去一些warm-start好处，请使用此版本。
 */
export const ContactsCommitAggressiveCleanup2D = system(
  'phys.contacts.commitAggressive',
  (ctx: SystemContext) => {
    const { world } = ctx;

    const contacts = world.getResource(Contacts2D);
    const cache = world.getResource(ContactCache2D);

    if (!cache) {
      return;
    }

    const frame = world.frame >>> 0;
    const activePairs = new Set<string>();

    // Collect active pairs from current contacts
    // 从当前接触收集活跃对
    if (contacts && contacts.list.length > 0) {
      for (const contact of contacts.list) {
        const { key } = makePairKey(world, contact.a, contact.b);
        activePairs.add(key);

        const featureId = contact.featureId ?? DEFAULT_FEATURE_ID;
        cache.updateImpulses(key, featureId, contact.jn, contact.jt);
      }
    }

    // Aggressive cleanup: remove any pair not active this frame
    // 激进清理：移除本帧不活跃的任何对
    const pairsToRemove: string[] = [];
    for (const pairKey of cache.getAllPairKeys()) {
      if (!activePairs.has(pairKey)) {
        pairsToRemove.push(pairKey);
      }
    }

    for (const pairKey of pairsToRemove) {
      cache.removePair(pairKey);
    }

    // Still perform age-based cleanup for remaining pairs
    // 仍然对剩余对执行基于年龄的清理
    performCleanup(cache, frame);
  }
)
  .stage('update')
  .after('phys.solver.gs2d')
  .before('phys.integrate')
  .inSet('physics')
  .build();