/**
 * TOI Sort and Deduplication System
 * TOI排序和去重系统
 *
 * Sorts TOI events by time and removes duplicates for the same entity pair.
 * Ensures deterministic processing order for stable physics simulation.
 * 按时间排序TOI事件并移除相同实体对的重复项。
 * 确保确定性处理顺序以实现稳定的物理仿真。
 */

import { system, SystemContext } from '../../core/System';
import { TOIQueue2D } from '../../resources/TOIQueue2D';
import { makePairKey } from '../../determinism/PairKey';

/**
 * TOI Sort and Deduplication System
 * TOI排序和去重系统
 */
export const TOISortAndDedup2D = system(
  'phys.ccd.toiSort',
  (ctx: SystemContext) => {
    const { world } = ctx;

    // Get TOI queue resource
    // 获取TOI队列资源
    const toiQueue = world.getResource(TOIQueue2D);
    if (!toiQueue || toiQueue.items.length === 0) {
      return;
    }

    // Stable sort: first by time (t), then by pair key for determinism
    // 稳定排序：首先按时间(t)，然后按配对键确保确定性
    toiQueue.items.sort((eventA, eventB) => {
      // Primary sort: by time of impact (ascending)
      // 主排序：按撞击时间（升序）
      if (eventA.t !== eventB.t) {
        return (eventA.t as any) - (eventB.t as any);
      }

      // Secondary sort: by deterministic pair key for stability
      // 辅助排序：按确定性配对键保证稳定性
      const pairKeyA = makePairKey(world, eventA.a, eventA.b).key;
      const pairKeyB = makePairKey(world, eventB.a, eventB.b).key;

      return pairKeyA < pairKeyB ? -1 : pairKeyA > pairKeyB ? 1 : 0;
    });

    // Remove duplicates: keep only the earliest TOI event for each entity pair
    // 移除重复项：每个实体对只保留最早的TOI事件
    const seenPairs = new Set<string>();
    toiQueue.items = toiQueue.items.filter((event) => {
      const pairKey = makePairKey(world, event.a, event.b).key;

      if (seenPairs.has(pairKey)) {
        // Duplicate pair - skip this event
        // 重复配对 - 跳过此事件
        return false;
      }

      // First occurrence of this pair - keep it
      // 此配对的首次出现 - 保留
      seenPairs.add(pairKey);
      return true;
    });
  }
)
  .stage('update')
  .after('phys.ccd.hullCircle.stop')  // After CCD detection generates TOI events
  .before('phys.ccd.toiMiniSolve')    // Before TOI mini solver processes events
  .inSet('physics')
  .build();