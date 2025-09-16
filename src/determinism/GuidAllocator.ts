/**
 * Deterministic GUID Allocator
 * 确定性GUID分配器
 *
 * Provides deterministic allocation of 64-bit GUIDs using monotonic increment.
 * Ensures consistent allocation across different runs and sessions.
 * 使用单调递增提供64位GUID的确定性分配。
 * 确保跨不同运行和会话的一致分配。
 */

import { PRNG } from './PRNG';
import type { World } from '../core/World';

export class GuidAllocator {
  /**
   * High 32 bits counter
   * 高32位计数器
   */
  hi: number;

  /**
   * Low 32 bits counter
   * 低32位计数器
   */
  lo: number;

  constructor(seed = 1) {
    // Use seed to derive a high bit prefix
    // Ensures different sessions/replays stay consistent with same seed
    // 使用种子衍生高位前缀
    // 确保不同会话/重放使用相同种子时保持一致
    this.hi = (seed ^ 0x9E3779B9) >>> 0;
    this.lo = 0 >>> 0;
  }

  /**
   * Issue next GUID in deterministic sequence
   * 在确定性序列中发出下一个GUID
   */
  issue(): { hi: number; lo: number } {
    // Monotonic increment with overflow carry to high bits
    // 单调递增，溢出时进位到高位
    this.lo = (this.lo + 1) >>> 0;
    if (this.lo === 0) {
      this.hi = (this.hi + 1) >>> 0;
    }
    return { hi: this.hi, lo: this.lo };
  }

  /**
   * Get current allocator state for serialization
   * 获取当前分配器状态用于序列化
   */
  getState(): { hi: number; lo: number } {
    return { hi: this.hi, lo: this.lo };
  }

  /**
   * Set allocator state for deterministic restoration
   * 设置分配器状态用于确定性恢复
   */
  setState(state: { hi: number; lo: number }): void {
    this.hi = state.hi >>> 0;
    this.lo = state.lo >>> 0;
  }
}

/**
 * Get or create GUID allocator from World resource
 * Uses PRNG seed for deterministic initialization
 * 从World资源获取或创建GUID分配器
 * 使用PRNG种子进行确定性初始化
 */
export function getGuidAllocator(world: World): GuidAllocator {
  let alloc = world.getResource(GuidAllocator);
  if (!alloc) {
    const rng = world.getResource(PRNG);
    const seed = rng ? (rng.getState() | 0) : 1;
    alloc = new GuidAllocator(seed >>> 0);
    world.setResource(GuidAllocator, alloc);
  }
  return alloc;
}