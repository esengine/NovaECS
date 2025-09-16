import { registerSchema } from '../sab/Schema';
import { getGuidAllocator } from '../determinism/GuidAllocator';
import type { World } from '../core/World';

/**
 * GUID component for stable entity identification
 * GUID组件用于稳定的实体标识
 *
 * Uses 64-bit representation with two u32 segments for efficient
 * column storage and fast comparison operations.
 * 使用64位表示，两个u32段，用于高效的列存储和快速比较操作。
 */
export class Guid {
  /**
   * High 32 bits of the GUID
   * GUID的高32位
   */
  hi = 0 >>> 0;

  /**
   * Low 32 bits of the GUID
   * GUID的低32位
   */
  lo = 0 >>> 0;

  constructor(hi = 0, lo = 0) {
    this.hi = hi >>> 0;
    this.lo = lo >>> 0;
  }
}

/**
 * Create a new Guid with deterministic allocation from World
 * 使用World的确定性分配创建新Guid
 */
export function createGuid(world: World): Guid {
  const allocator = getGuidAllocator(world);
  const { hi, lo } = allocator.issue();
  return new Guid(hi, lo);
}

/**
 * Create a Guid from explicit hi/lo values
 * 从显式的hi/lo值创建Guid
 */
export function createGuidFromValues(hi: number, lo: number): Guid {
  return new Guid(hi >>> 0, lo >>> 0);
}

/**
 * Create a zero Guid (useful for comparisons)
 * 创建零Guid（用于比较）
 */
export function createZeroGuid(): Guid {
  return new Guid(0, 0);
}

/**
 * Compare two Guids for ordering (returns -1, 0, or 1)
 * 比较两个Guid的顺序（返回-1、0或1）
 */
export function compareGuid(a: Guid, b: Guid): number {
  const hiDiff = (a.hi >>> 0) - (b.hi >>> 0);
  if (hiDiff !== 0) {
    return hiDiff;
  }
  return (a.lo >>> 0) - (b.lo >>> 0);
}

/**
 * Check if two Guids are equal
 * 检查两个Guid是否相等
 */
export function guidEquals(a: Guid, b: Guid): boolean {
  return a.hi === b.hi && a.lo === b.lo;
}

/**
 * Check if Guid is zero
 * 检查Guid是否为零
 */
export function isZeroGuid(guid: Guid): boolean {
  return guid.hi === 0 && guid.lo === 0;
}

/**
 * Register Guid schema for SAB optimization
 * 注册Guid的SAB优化schema
 */
registerSchema(Guid, {
  fields: {
    hi: 'u32',
    lo: 'u32'
  }
});