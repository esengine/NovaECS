import { registerSchema } from '../sab/Schema';
import { getGuidAllocator } from '../determinism/GuidAllocator';
import type { World } from '../core/World';

/**
 * Generate cryptographically secure random 32-bit unsigned integer
 * 生成加密安全的32位无符号整数
 */
function randomU32(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  }
  // 退化：仍保证 32 位范围
  return (Math.random() * 0x100000000) >>> 0;
}

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

  /**
   * Original string value for backward compatibility
   * 原始字符串值用于向后兼容
   */
  _originalValue?: string | undefined;

  constructor(hiOrValue?: number | string, lo?: number) {
    if (hiOrValue === undefined && lo === undefined) {
      // Generate random GUID for backward compatibility
      // 为向后兼容生成随机GUID
      this.hi = randomU32();
      this.lo = randomU32();
    } else if (typeof hiOrValue === 'string') {
      // Store original string for backward compatibility
      // 存储原始字符串用于向后兼容
      this._originalValue = hiOrValue;

      // Parse hex string format for backward compatibility
      // 解析十六进制字符串格式用于向后兼容
      if (hiOrValue.length === 16) {
        this.hi = parseInt(hiOrValue.slice(0, 8), 16) >>> 0;
        this.lo = parseInt(hiOrValue.slice(8), 16) >>> 0;
      } else {
        // Fallback: use hash for arbitrary strings
        // 回退：对任意字符串使用哈希
        let hash = 0;
        for (let i = 0; i < hiOrValue.length; i++) {
          hash = ((hash * 31) + hiOrValue.charCodeAt(i)) >>> 0;
        }
        this.hi = hash >>> 0;
        this.lo = (hash ^ 0xAAAAAAAA) >>> 0;
      }
    } else {
      this.hi = (hiOrValue || 0) >>> 0;
      this.lo = (lo || 0) >>> 0;
    }
  }

  /**
   * Get string representation for backward compatibility
   * 获取字符串表示用于向后兼容
   */
  get value(): string | undefined {
    // Return original value if available, otherwise hex representation
    // 如果有原始值则返回原始值，否则返回十六进制表示
    if (this._originalValue) {
      return this._originalValue;
    }

    // If both hi and lo are 0, this might be an empty GUID
    if (this.hi === 0 && this.lo === 0) {
      return undefined;
    }

    return `${this.hi.toString(16).padStart(8, '0')}${this.lo.toString(16).padStart(8, '0')}`;
  }

  /**
   * Set string value for backward compatibility
   * 设置字符串值用于向后兼容
   */
  set value(val: string | undefined | null) {
    if (val === undefined || val === null || val === '') {
      this._originalValue = undefined;
      this.hi = 0;
      this.lo = 0;
      return;
    }

    this._originalValue = val;

    if (val.length === 16) {
      this.hi = parseInt(val.slice(0, 8), 16) >>> 0;
      this.lo = parseInt(val.slice(8), 16) >>> 0;
    } else {
      // For arbitrary strings, use hash
      // 对任意字符串使用哈希
      let hash = 0;
      for (let i = 0; i < val.length; i++) {
        hash = ((hash * 31) + val.charCodeAt(i)) >>> 0;
      }
      this.hi = hash >>> 0;
      this.lo = (hash ^ 0xAAAAAAAA) >>> 0;
    }
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
  const ahi = a.hi >>> 0, bhi = b.hi >>> 0;
  if (ahi !== bhi) return ahi < bhi ? -1 : 1;
  const alo = a.lo >>> 0, blo = b.lo >>> 0;
  if (alo !== blo) return alo < blo ? -1 : 1;
  return 0;
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
 * Get string value from Guid, works with both instances and plain objects
 * 从Guid获取字符串值，支持实例和普通对象
 */
export function getGuidValue(guid: any): string | undefined {
  if (guid._originalValue) {
    return guid._originalValue;
  }
  if (guid.hi === 0 && guid.lo === 0) {
    return undefined;
  }
  return `${guid.hi.toString(16).padStart(8, '0')}${guid.lo.toString(16).padStart(8, '0')}`;
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