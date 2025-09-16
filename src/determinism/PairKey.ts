/**
 * Deterministic Pair Key Generation
 * 确定性配对键生成
 *
 * Creates stable, deterministic keys for entity pairs based on GUID or entity ID.
 * Ensures consistent ordering across different runs and platforms.
 * 基于GUID或实体ID为实体对创建稳定、确定性的键。
 * 确保跨不同运行和平台的一致排序。
 */

import { Guid } from '../components/Guid';
import type { Entity } from '../utils/Types';
import type { World } from '../core/World';

/**
 * Extract stable key components from entity
 * 从实体提取稳定键组件
 *
 * Returns [hi, lo] tuple where:
 * - For GUID entities: [guid.hi, guid.lo]
 * - For non-GUID entities: [0, entityId] (fallback with hi=0)
 * 返回[hi, lo]元组，其中：
 * - 对于GUID实体：[guid.hi, guid.lo]
 * - 对于非GUID实体：[0, entityId]（兜底方案，hi=0）
 */
function keyOf(world: World, e: Entity): readonly [number, number] {
  try {
    const g = world.getComponent(e, Guid);
    if (g && (g.hi !== 0 || g.lo !== 0)) {
      return [g.hi >>> 0, g.lo >>> 0] as const;
    }
  } catch {
    // GUID component not found, fall back to entity ID
    // 未找到GUID组件，回退到实体ID
  }
  const id = (e as number) >>> 0;
  return [0, id] as const; // No GUID fallback (hi=0)
}

/**
 * Create deterministic pair key for two entities
 * 为两个实体创建确定性配对键
 *
 * Returns normalized pair with consistent ordering and string key suitable for Map usage.
 * The ordering ensures that the same pair of entities always produces the same key.
 * 返回具有一致排序和适合Map使用的字符串键的规范化对。
 * 排序确保相同的实体对总是产生相同的键。
 */
export function makePairKey(world: World, a: Entity, b: Entity): {
  a: Entity;
  b: Entity;
  key: string;
} {
  const ka = keyOf(world, a);
  const kb = keyOf(world, b);

  // Normalize order (ensure a <= b in deterministic ordering)
  // 规范化顺序（确保在确定性排序中 a <= b）
  const swap = (ka[0] > kb[0]) || (ka[0] === kb[0] && ka[1] > kb[1]);

  const A = swap ? b : a;
  const B = swap ? a : b;
  const k1 = swap ? kb : ka;
  const k2 = swap ? ka : kb;

  // Create string key (deterministic, simple, Map-friendly)
  // 创建字符串键（确定性、简单、对Map友好）
  const key = `${k1[0]}:${k1[1]}|${k2[0]}:${k2[1]}`;

  return { a: A, b: B, key };
}

/**
 * Create pair key from already ordered entities
 * 从已排序的实体创建配对键
 *
 * Use when you know the entities are already in correct deterministic order.
 * Slightly more efficient as it skips the ordering check.
 * 当您知道实体已经按正确的确定性顺序排列时使用。
 * 稍微更高效，因为跳过了排序检查。
 */
export function makePairKeyOrdered(world: World, a: Entity, b: Entity): string {
  const ka = keyOf(world, a);
  const kb = keyOf(world, b);
  return `${ka[0]}:${ka[1]}|${kb[0]}:${kb[1]}`;
}

/**
 * Parse pair key back to components (for debugging/inspection)
 * 将配对键解析回组件（用于调试/检查）
 */
export function parsePairKey(key: string): {
  k1: [number, number];
  k2: [number, number];
} {
  const parts = key.split('|');
  if (parts.length !== 2) {
    throw new Error(`Invalid pair key format: ${key}`);
  }

  const parseKey = (keyStr: string): [number, number] => {
    const keyParts = keyStr.split(':');
    if (keyParts.length !== 2) {
      throw new Error(`Invalid key component format: ${keyStr}`);
    }
    const [hiStr, loStr] = keyParts;
    return [parseInt(hiStr, 10) >>> 0, parseInt(loStr, 10) >>> 0];
  };

  return {
    k1: parseKey(parts[0]),
    k2: parseKey(parts[1])
  };
}