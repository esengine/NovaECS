/**
 * Contact Warm-start System for Feature-based Persistence
 * 基于特征的接触warm-start系统
 *
 * Preloads converged normal/tangent impulses from previous frames to current
 * frame contact points, significantly improving stacking stability, convergence
 * speed, and determinism in constraint solver.
 * 将上一帧收敛的法向/切向冲量预加载到当前帧接触点，显著提升约束解算器的
 * 堆叠稳定性、收敛速度和确定性。
 */

import { system, SystemContext } from '../../core/System';
import { Contacts2D } from '../../resources/Contacts2D';
import { ContactCache2D } from '../../resources/ContactCache2D';
import { makePairKey } from '../../determinism/PairKey';
import type { FX } from '../../math/fixed';
import { ZERO, mul, f, add } from '../../math/fixed';

/**
 * Minimum normal alignment threshold for impulse preservation
 * 保持冲量的最小法向对齐阈值
 * If dot(oldNormal, newNormal) < threshold, clear impulses (geometry flipped)
 * 如果点积小于阈值，清零冲量（几何翻转）
 */
const NORMAL_ALIGNMENT_THRESHOLD = f(0.25); // cos(75°) ≈ 0.25

/**
 * Maximum position drift tolerance for impulse preservation
 * 保持冲量的最大位置漂移容忍度
 * If contact point moved more than this distance, reduce or clear impulses
 * 如果接触点移动超过此距离，减少或清零冲量
 */
const MAX_POSITION_DRIFT = f(0.1); // 0.1 units

/**
 * Default feature ID for contacts without explicit feature information
 * 没有明确特征信息的接触的默认特征ID
 */
const DEFAULT_FEATURE_ID = 0;

/**
 * Warm-start statistics for debugging and profiling
 * Warm-start统计信息用于调试和性能分析
 */
export class WarmStartStats {
  frame = 0;
  totalContacts = 0;
  warmedContacts = 0;
  newContacts = 0;
  invalidatedContacts = 0;
  cacheStats?: {
    pairCount: number;
    totalContacts: number;
    avgContactsPerPair: number;
    avgAge: number;
  };

  constructor(
    frame: number = 0,
    totalContacts: number = 0,
    warmedContacts: number = 0,
    newContacts: number = 0,
    invalidatedContacts: number = 0,
    cacheStats?: {
      pairCount: number;
      totalContacts: number;
      avgContactsPerPair: number;
      avgAge: number;
    }
  ) {
    this.frame = frame;
    this.totalContacts = totalContacts;
    this.warmedContacts = warmedContacts;
    this.newContacts = newContacts;
    this.invalidatedContacts = invalidatedContacts;
    if (cacheStats) {
      this.cacheStats = cacheStats;
    }
  }

  /**
   * Get warm-start efficiency ratio (warmed / total)
   * 获取warm-start效率比率（预热/总数）
   */
  getWarmStartRatio(): number {
    return this.totalContacts > 0 ? this.warmedContacts / this.totalContacts : 0;
  }

  /**
   * Get cache hit ratio (warmed / (warmed + new))
   * 获取缓存命中率（预热/（预热+新建））
   */
  getCacheHitRatio(): number {
    const processed = this.warmedContacts + this.newContacts;
    return processed > 0 ? this.warmedContacts / processed : 0;
  }
}

/**
 * Calculate dot product of two 2D vectors
 * 计算两个2D向量的点积
 */
function dot(ax: FX, ay: FX, bx: FX, by: FX): FX {
  return add(mul(ax, bx), mul(ay, by));
}

/**
 * Calculate squared distance between two points
 * 计算两点间距离的平方
 */
function distSquared(x1: FX, y1: FX, x2: FX, y2: FX): FX {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return add(mul(dx, dx), mul(dy, dy));
}

/**
 * Contact warm-start system
 * 接触warm-start系统
 *
 * Processes current frame contacts from narrowphase and applies cached impulses
 * from previous frames based on feature matching and geometric validation.
 * 处理来自窄相的当前帧接触，并基于特征匹配和几何验证应用上一帧的缓存冲量。
 */
export const ContactsWarmStart2D = system(
  'phys.contacts.warmStart',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get current frame contacts
    // 获取当前帧接触
    const contacts = world.getResource(Contacts2D);
    if (!contacts || contacts.list.length === 0) {
      return; // No contacts to process
    }

    // Get or create contact cache
    // 获取或创建接触缓存
    let cache = world.getResource(ContactCache2D);
    if (!cache) {
      cache = new ContactCache2D();
      world.setResource(ContactCache2D, cache);
    }

    const frame = world.frame >>> 0;
    cache.beginFrame(frame);

    // Process each contact for warm-start
    // 处理每个接触进行warm-start
    let warmedContacts = 0;
    let newContacts = 0;
    let invalidatedContacts = 0;

    for (const contact of contacts.list) {
      // Generate stable pair key
      // 生成稳定的配对键
      const { key } = makePairKey(world, contact.a, contact.b);

      // Use feature ID or default
      // 使用特征ID或默认值
      const featureId = contact.featureId ?? DEFAULT_FEATURE_ID;

      // Try to get cached impulses
      // 尝试获取缓存冲量
      const cached = cache.get(key, featureId);

      if (cached && (frame - cached.lastFrame) <= cache.maxAge) {
        // Found valid cached contact
        // 找到有效的缓存接触

        // Validate geometric consistency
        // 验证几何一致性
        const normalAlignment = dot(contact.nx, contact.ny, cached.nx, cached.ny);
        const positionDrift = distSquared(contact.px, contact.py, cached.px, cached.py);

        if (normalAlignment >= NORMAL_ALIGNMENT_THRESHOLD && positionDrift <= mul(MAX_POSITION_DRIFT, MAX_POSITION_DRIFT)) {
          // Geometry is consistent - apply cached impulses
          // 几何一致 - 应用缓存冲量
          contact.jn = cached.jn;
          contact.jt = cached.jt;

          // Update cache statistics
          // 更新缓存统计
          cache.set(key, featureId, cached.jn, cached.jt, contact.px, contact.py, contact.nx, contact.ny);
          warmedContacts++;
        } else {
          // Geometry changed significantly - clear impulses but update position
          // 几何发生显著变化 - 清零冲量但更新位置
          contact.jn = ZERO;
          contact.jt = ZERO;

          // Store new geometric data
          // 存储新的几何数据
          cache.set(key, featureId, ZERO, ZERO, contact.px, contact.py, contact.nx, contact.ny);
          invalidatedContacts++;
        }
      } else {
        // No cached contact found - initialize as new contact
        // 未找到缓存接触 - 初始化为新接触
        contact.jn = ZERO;
        contact.jt = ZERO;

        // Create cache entry for this contact
        // 为此接触创建缓存条目
        cache.set(key, featureId, ZERO, ZERO, contact.px, contact.py, contact.nx, contact.ny);
        newContacts++;
      }
    }

    // Store warm-start statistics for debugging and profiling
    // 存储warm-start统计信息用于调试和性能分析
    const stats = new WarmStartStats(
      frame,
      contacts.list.length,
      warmedContacts,
      newContacts,
      invalidatedContacts,
      cache.getStats()
    );
    world.setResource(WarmStartStats, stats);
  }
)
  .stage('update')
  .after('phys.narrow.circle')     // After narrowphase circle detection
  .after('phys.narrow.hull')       // After narrowphase hull detection
  .before('phys.solver.gs2d')      // Before SolverGS2D constraint solver
  .inSet('physics')
  .build();

