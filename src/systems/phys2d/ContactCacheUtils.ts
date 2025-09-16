/**
 * Contact Cache Utilities
 * 接触缓存工具
 *
 * Utilities for managing contact impulse cache and warm-start behavior.
 * 管理接触冲量缓存和warm-start行为的工具。
 */

import type { World } from '../../core/World';
import { Contacts2D } from '../../resources/Contacts2D';

/**
 * Update contact cache with current frame results
 * Should be called after constraint solver completes
 * 使用当前帧结果更新接触缓存
 * 应在约束解算器完成后调用
 */
export function updateContactCache(world: World): void {
  const contacts = world.getResource(Contacts2D);
  if (!contacts) {
    return; // No contacts to cache
  }

  // Update the cache with current frame's impulse values
  // 使用当前帧的冲量值更新缓存
  contacts.updateCache(world);
}

/**
 * Clear contact cache (useful for resetting simulation state)
 * 清空接触缓存（用于重置仿真状态）
 */
export function clearContactCache(world: World): void {
  const contacts = world.getResource(Contacts2D);
  if (contacts) {
    contacts.prev.clear();
  }
}

/**
 * Get contact statistics for debugging/profiling
 * 获取接触统计信息用于调试/性能分析
 */
export function getContactStats(world: World): {
  contacts: number;
  cached: number;
  frame: number;
} | undefined {
  const contacts = world.getResource(Contacts2D);
  return contacts?.getStats();
}