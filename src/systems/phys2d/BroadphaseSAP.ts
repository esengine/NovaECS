/**
 * Broadphase Sweep and Prune System
 * 宽相扫描修剪系统
 *
 * Deterministic broadphase collision detection using sweep and prune algorithm.
 * Generates stable collision candidate pairs for narrowphase processing.
 * 使用扫描和修剪算法的确定性宽相碰撞检测。
 * 为窄相处理生成稳定的碰撞候选对。
 */

import { system, SystemContext } from '../../core/System';
import type { Entity } from '../../utils/Types';
import { AABB2D } from '../../components/AABB2D';
import { BroadphasePairs } from '../../resources/BroadphasePairs';
import { stableEntityKey, cmpStable, type StableKey } from '../../determinism/GuidUtils';

/**
 * Broadphase entry with AABB bounds and stable key
 * 带有AABB边界和稳定键的宽相条目
 */
interface BroadphaseEntry {
  e: Entity;
  minx: number;
  maxx: number;
  miny: number;
  maxy: number;
  key: StableKey;
}

/**
 * Broadphase Sweep and Prune system for collision detection
 * 用于碰撞检测的宽相扫描和修剪系统
 *
 * Uses the sweep and prune algorithm with deterministic sorting to generate
 * stable collision candidate pairs across different platforms and runs.
 * 使用具有确定性排序的扫描和修剪算法，在不同平台和运行中生成稳定的碰撞候选对。
 */
export const BroadphaseSAP = system(
  'phys.broadphase.sap',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get or create broadphase pairs resource
    // 获取或创建宽相对资源
    let broadphasePairs = world.getResource(BroadphasePairs);
    if (!broadphasePairs) {
      broadphasePairs = new BroadphasePairs();
      world.setResource(BroadphasePairs, broadphasePairs);
    }

    // Query all entities with AABB components
    // 查询所有具有AABB组件的实体
    const query = world.query(AABB2D);
    const entityCount = query.count();

    // Initialize broadphase results
    // 初始化宽相结果
    broadphasePairs.frame = world.frame;
    broadphasePairs.clear();

    if (entityCount === 0) {
      return; // No entities to process
    }

    // Collect broadphase entries
    // 收集宽相条目
    const entries: BroadphaseEntry[] = [];

    query.forEach((entity, aabb: AABB2D) => {
      entries.push({
        e: entity,
        minx: aabb.minx, // Keep as fixed point for accurate collision detection
        maxx: aabb.maxx,
        miny: aabb.miny,
        maxy: aabb.maxy,
        key: stableEntityKey(world, entity)
      });
    });

    // All entries are valid since we used push
    // 所有条目都是有效的，因为我们使用了push

    // Sort entries by (minx, maxx, stableKey) for deterministic sweep
    // 按(minx, maxx, stableKey)排序条目以进行确定性扫描
    entries.sort((a, b) =>
      (a.minx - b.minx) ||
      (a.maxx - b.maxx) ||
      cmpStable(a.key, b.key)
    );

    // Sweep and prune: maintain active list sorted by maxx
    // 扫描和修剪：维护按maxx排序的活动列表
    const activeList: BroadphaseEntry[] = [];
    const candidatePairs: { a: Entity; b: Entity }[] = [];
    let totalGenerated = 0;
    let totalCulled = 0;

    for (const current of entries) {
      // Remove entries from active list that no longer overlap in X
      // 从活动列表中移除在X轴上不再重叠的条目
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < activeList.length; readIndex++) {
        const active = activeList[readIndex];
        if (active.maxx > current.minx) {
          activeList[writeIndex++] = active;
        }
      }
      activeList.length = writeIndex;

      // Test current entry against all active entries
      // 针对所有活动条目测试当前条目
      for (const active of activeList) {
        totalGenerated++;

        // Check Y-axis overlap (closed interval test)
        // 检查Y轴重叠（闭区间测试）
        if (active.maxy >= current.miny && current.maxy >= active.miny) {
          // Create ordered pair for deterministic output
          // 创建有序对以获得确定性输出
          const keyOrder = cmpStable(active.key, current.key);
          const a = keyOrder <= 0 ? active.e : current.e;
          const b = keyOrder <= 0 ? current.e : active.e;
          candidatePairs.push({ a, b });
        } else {
          totalCulled++;
        }
      }

      // Insert current entry into active list (maintain maxx order)
      // 将当前条目插入活动列表（维护maxx顺序）
      let insertPos = activeList.length;
      activeList.push(current);

      // Simple insertion sort to maintain order by maxx
      // 简单插入排序以维护按maxx的顺序
      while (insertPos > 0 && activeList[insertPos - 1].maxx > current.maxx) {
        activeList[insertPos] = activeList[insertPos - 1];
        insertPos--;
      }
      activeList[insertPos] = current;
    }

    // Final sort of pairs for completely deterministic output
    // 对对进行最终排序以获得完全确定性的输出
    candidatePairs.sort((pairA, pairB) => {
      const keyA = stableEntityKey(world, pairA.a);
      const keyB = stableEntityKey(world, pairB.a);
      const keyCmp = cmpStable(keyA, keyB);
      if (keyCmp !== 0) return keyCmp;

      const keyC = stableEntityKey(world, pairA.b);
      const keyD = stableEntityKey(world, pairB.b);
      return cmpStable(keyC, keyD);
    });

    // Store results in broadphase pairs resource
    // 将结果存储在宽相对资源中
    broadphasePairs.pairs = candidatePairs;
    broadphasePairs.generated = totalGenerated;
    broadphasePairs.culled = totalCulled;

    // Optional profiling integration
    // 可选的性能分析集成
    // Note: Profiler integration would go here if needed
  }
)
  .stage('update')
  .after('phys.syncAABB')
  .inSet('physics')
  .build();